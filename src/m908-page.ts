// Wires the M908 configurator page (m908.html) to the M908 protocol
// modules. UNVERIFIED AGAINST REAL HARDWARE — see docs/protocol-notes/m908.md.
import { initDropdowns } from "./dropdowns";
import { initRangeSliders, syncRangeSliders } from "./range-slider";
import {
  closeDevice,
  findM908ConfigDevice,
  openDevice,
  requestM908,
  sendM908Rows,
} from "./core/m908-transport";
import {
  buildM908ApplySequence,
  M908_KNOWN_DPI_VALUES,
  m908DpiSupported,
  type M908LightMode,
  type M908ProfileIndex,
  type M908ProfileSettings,
} from "./profiles/m908";
import { m908ActionSupported, type M908ButtonName } from "./profiles/m908-buttons";
import { M908_BUILT_IN_PRESETS, M908_NEUTRAL_PROFILE } from "./profiles/m908-presets";
import {
  copyM908Slot,
  defaultM908ProfileSet,
  isM908ProfileIndex,
  loadM908ProfileSet,
  M908_PROFILE_COUNT,
  parseM908ProfileSet,
  saveM908ProfileSet,
  serializeM908ProfileSet,
  type KeyValueStorage,
  type M908ProfileSet,
} from "./profiles/m908-profile-store";
import { detectDesktopOS, isWebHidAvailable, WEBHID_UNAVAILABLE_MESSAGE } from "./core/platform";
import { comboKeys, formatCombo, modifierLabel, shortcutName, type ShortcutOS } from "./profiles/shortcut-names";
import { createButtonEditor, type ActionDescription } from "./button-editor";
import { comboKeyGroups } from "./profiles/key-combo-keys";
import { ACTION_CATEGORIES, type ActionCategory } from "./profiles/m913-action-catalog";

const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const logEl = document.querySelector<HTMLDivElement>("#log")!;
const connectBtn = document.querySelector<HTMLButtonElement>("#connect")!;
const applyBtn = document.querySelector<HTMLButtonElement>("#apply")!;
const presetSelectEl = document.querySelector<HTMLSelectElement>("#preset-select")!;
const dpiRowsEl = document.querySelector<HTMLDivElement>("#dpi-rows")!;
const ledModeEl = document.querySelector<HTMLSelectElement>("#led-mode")!;
const ledColorEl = document.querySelector<HTMLInputElement>("#led-color")!;
const ledBrightnessEl = document.querySelector<HTMLInputElement>("#led-brightness")!;
const ledSpeedEl = document.querySelector<HTMLInputElement>("#led-speed")!;
const reportRateButtonsEl = document.querySelector<HTMLDivElement>("#report-rate-buttons")!;
const scrollSpeedEl = document.querySelector<HTMLInputElement>("#scroll-speed")!;
const buttonEditorEl = document.querySelector<HTMLDivElement>("#button-editor")!;
const showActionReferenceBtn = document.querySelector<HTMLButtonElement>("#show-action-reference")!;
const actionReferenceEl = document.querySelector<HTMLDivElement>("#action-reference")!;
const slotButtonsEl = document.querySelector<HTMLDivElement>("#slot-buttons")!;
const editingSlotEl = document.querySelector<HTMLParagraphElement>("#editing-slot")!;
const activeProfileEl = document.querySelector<HTMLSelectElement>("#active-profile")!;
const copyTargetEl = document.querySelector<HTMLSelectElement>("#copy-target")!;
const copySlotBtn = document.querySelector<HTMLButtonElement>("#copy-slot")!;
const exportSetBtn = document.querySelector<HTMLButtonElement>("#export-set")!;
const importSetBtn = document.querySelector<HTMLButtonElement>("#import-set")!;
const importSetInput = document.querySelector<HTMLInputElement>("#import-set-input")!;

const REPORT_RATES = [125, 250, 500, 1000];
const LIGHT_MODES: { value: M908LightMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "static", label: "Static" },
  { value: "breathing", label: "Breathing" },
  { value: "breathing_rainbow", label: "Breathing Rainbow" },
  { value: "rainbow", label: "Rainbow" },
  { value: "wave", label: "Wave" },
  { value: "flashing", label: "Flashing" },
  { value: "alternating", label: "Alternating" },
  { value: "reactive", label: "Reactive" },
  { value: "reactive_button", label: "Reactive (Button)" },
  { value: "random", label: "Random" },
];

function log(msg: string) {
  const time = new Date().toLocaleTimeString();
  logEl.textContent = `[${time}] ${msg}\n${logEl.textContent}`;
}

let device: HIDDevice | null = null;

// --- Five-slot profile state ---
// Every Apply writes all five onboard profiles (see buildM908ApplySequence),
// so the page holds all five. `profile` always points at the slot being
// edited — it's an alias into `profileSet.profiles`, not a copy, so the
// existing section handlers edit the right slot by mutating it.

// localStorage can be absent or throw (private windows, blocked site
// data); the page keeps working in memory without it.
function getStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const storage = getStorage();

let profileSet: M908ProfileSet = loadM908ProfileSet(storage) ?? defaultM908ProfileSet();
let editingSlot: M908ProfileIndex = profileSet.activeProfile;
let profile: M908ProfileSettings = profileSet.profiles[editingSlot];

let storageWarned = false;
function persist() {
  if (saveM908ProfileSet(storage, profileSet) || storageWarned) return;
  storageWarned = true;
  log("Couldn't save your profiles in this browser (storage unavailable) — use Export to keep a copy.");
}

// Set once the user has OK'd the first full five-profile write this page load.
let fullWriteConfirmed = false;

const applyHintEl = document.querySelector<HTMLParagraphElement>("#apply-hint")!;
const APPLY_HINT = applyHintEl.textContent ?? "";

function setConnected(connected: boolean) {
  applyBtn.disabled = !connected;
  // Disabling the focused Connect button would drop keyboard focus to
  // <body>; hand it to Apply first, which is the next step anyway.
  if (connected && document.activeElement === connectBtn) applyBtn.focus();
  connectBtn.disabled = connected;
  applyHintEl.textContent = connected ? APPLY_HINT : "Connect your mouse (top of page) to enable Apply.";
}

// Short outcome for screen readers and anyone scrolled away from the log.
function announce(message: string, tone: "warning" | "" = "") {
  statusEl.textContent = message;
  statusEl.classList.remove("connected");
  statusEl.classList.toggle("warning", tone === "warning");
}

// --- Rendering ---

function renderPresetOptions() {
  for (const preset of M908_BUILT_IN_PRESETS) {
    const opt = document.createElement("option");
    opt.value = preset.id;
    opt.textContent = preset.name;
    presetSelectEl.append(opt);
  }
}

function renderLedModeOptions() {
  for (const mode of LIGHT_MODES) {
    const opt = document.createElement("option");
    opt.value = mode.value;
    opt.textContent = mode.label;
    ledModeEl.append(opt);
  }
}

function renderReportRateButtons() {
  reportRateButtonsEl.replaceChildren();
  for (const hz of REPORT_RATES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${hz} Hz`;
    btn.dataset.hz = String(hz);
    btn.addEventListener("click", () => {
      profile.reportRateHz = hz;
      syncReportRateButtons();
      persist();
    });
    reportRateButtonsEl.append(btn);
  }
  syncReportRateButtons();
}

// Updates selection in place — rebuilding the buttons on every click
// would destroy the focused one and drop keyboard focus to <body>.
function syncReportRateButtons() {
  for (const btn of reportRateButtonsEl.querySelectorAll<HTMLButtonElement>("button")) {
    const selected = Number(btn.dataset.hz) === profile.reportRateHz;
    btn.classList.toggle("active", selected);
    btn.setAttribute("aria-pressed", String(selected));
  }
}

function renderDpiRows() {
  dpiRowsEl.replaceChildren();
  for (let i = 0; i < 5; i++) {
    const row = document.createElement("div");
    row.className = "row";

    const label = document.createElement("label");
    label.textContent = `Stage ${i + 1}`;

    const enabledCheckbox = document.createElement("input");
    enabledCheckbox.type = "checkbox";
    enabledCheckbox.checked = profile.dpiEnabled[i];
    enabledCheckbox.setAttribute("aria-label", `Enable stage ${i + 1}`);
    enabledCheckbox.addEventListener("change", () => {
      profile.dpiEnabled[i] = enabledCheckbox.checked;
      persist();
    });

    const select = document.createElement("select");
    select.setAttribute("aria-label", `Stage ${i + 1} DPI`);
    for (const dpi of M908_KNOWN_DPI_VALUES) {
      const opt = document.createElement("option");
      opt.value = String(dpi);
      opt.textContent = String(dpi);
      if (dpi === profile.dpiValues[i]) opt.selected = true;
      select.append(opt);
    }
    select.addEventListener("change", () => {
      const value = Number(select.value);
      if (m908DpiSupported(value)) profile.dpiValues[i] = value;
      persist();
    });

    row.append(label, enabledCheckbox, select);
    dpiRowsEl.append(row);
  }
}

// --- Buttons ---------------------------------------------------------------
//
// Same keypad grid + editor panel as the M913 page (src/button-editor.ts),
// with the M908's own action vocabulary: its special actions plus the OS
// shortcut lists, filtered to what the M908 parser accepts.

const NAMING_OS: ShortcutOS = (() => {
  const os = detectDesktopOS();
  return os === "unknown" ? "windows" : os;
})();

const named = (label: string, value: string) => ({ label, value });
const M908_CATEGORIES: ActionCategory[] = [
  {
    name: "Clicks",
    actions: [
      named("Left click", "left"), named("Right click", "right"), named("Middle click", "middle"),
      named("Forward", "forward"), named("Back", "backward"), named("Do nothing", "none"),
    ],
  },
  {
    name: "DPI, Profile & Wheel",
    actions: [
      named("DPI up", "dpi+"), named("DPI down", "dpi-"), named("DPI cycle", "dpi-cycle"),
      named("Next profile", "profile+"), named("Previous profile", "profile-"), named("Cycle profiles", "profile_switch"),
      named("Polling rate up", "report_rate+"), named("Polling rate down", "report_rate-"),
      named("DPI light on/off", "dpi_led_toggle"), named("Next lighting mode", "led_mode_switch"),
      named("Scroll up", "scroll_up"), named("Scroll down", "scroll_down"),
    ],
  },
  {
    name: "Media",
    actions: [
      named("Play / pause", "media_play"), named("Stop media", "media_stop"),
      named("Previous track", "media_previous"), named("Next track", "media_next"),
      named("Volume up", "media_volume_up"), named("Volume down", "media_volume_down"), named("Mute", "media_mute"),
    ],
  },
  ...ACTION_CATEGORIES.filter((c) => c.name.endsWith("Shortcuts")).map((c) => ({
    name: c.name,
    actions: c.actions.filter((a) => m908ActionSupported(a.value)),
  })),
];

function describeAction(value: string): ActionDescription {
  const name = shortcutName(value, NAMING_OS);
  if (name) return { name, keys: comboKeys(value, NAMING_OS) };
  for (const category of M908_CATEGORIES) {
    const action = category.actions.find((a) => a.value === value);
    if (action) return { name: action.label, keys: action.os ? comboKeys(value, action.os) : [] };
  }
  const macro = /^macro(\d+)/.exec(value);
  if (macro) return { name: `Macro ${macro[1]}`, keys: [] };
  if (value.startsWith("fire:")) return { name: "Rapid fire", keys: [] };
  // Keyboard combos are named by their keys; anything else (raw codes)
  // shows as typed.
  return { name: /^[a-z0-9_]+(\+[a-z0-9_]+)+$/.test(value) ? formatCombo(value, NAMING_OS) : value, keys: [] };
}

function tileLabel(name: M908ButtonName): { short: string; full: string; group: string } {
  const side = /^button_(\d+)$/.exec(name);
  if (side) return { short: `Side ${side[1]}`, full: `Side button ${side[1]}`, group: "side" };
  const labels: Record<string, [string, string, string]> = {
    button_left: ["Left", "Left click", "clicks"], button_right: ["Right", "Right click", "clicks"],
    button_middle: ["Middle", "Middle click", "clicks"], button_fire: ["Fire", "Fire button", "clicks"],
    button_dpi_up: ["DPI +", "DPI up button", "wheel"], button_dpi_down: ["DPI −", "DPI down button", "wheel"],
    scroll_up: ["Scroll ↑", "Wheel scroll up", "wheel"], scroll_down: ["Scroll ↓", "Wheel scroll down", "wheel"],
  };
  const [short, full, group] = labels[name]!;
  return { short, full, group };
}

const TILE_ORDER: M908ButtonName[] = [
  "button_left", "button_right", "button_middle", "button_fire",
  "button_dpi_up", "button_dpi_down", "scroll_up", "scroll_down",
  "button_1", "button_2", "button_3", "button_4", "button_5", "button_6",
  "button_7", "button_8", "button_9", "button_10", "button_11", "button_12",
];

const buttonEditor = createButtonEditor({
  root: buttonEditorEl,
  groups: [
    { id: "clicks", label: "Clicks" },
    { id: "wheel", label: "Wheel & DPI" },
    { id: "side", label: "Side panel" },
  ],
  slots: TILE_ORDER.map((id) => ({ id, ...tileLabel(id) })),
  categories: M908_CATEGORIES,
  getValue: (id) => profile.buttonActions[id as M908ButtonName] ?? "",
  setValue: (id, value) => {
    if (value) profile.buttonActions[id as M908ButtonName] = value;
    else delete profile.buttonActions[id as M908ButtonName];
    persist();
  },
  isChanged: () => false, // the M908's five profiles save automatically
  validate: (value) => (m908ActionSupported(value) ? null : `"${value}" isn't an action the M908 understands.`),
  describe: describeAction,
  categoryKeys: (value, category) => {
    const os = category.actions.find((a) => a.value === value)?.os;
    return os ? comboKeys(value, os) : [];
  },
  announce: (message) => announce(message),
  customPlaceholder: "e.g. ctrl+c, fire:a:5:10, macro3",
  modifierLabel: (mod) => modifierLabel(mod, NAMING_OS),
  comboKeyGroups: comboKeyGroups((key) => m908ActionSupported(`ctrl+${key}`)),
});

function renderLedControls() {
  ledModeEl.value = profile.lightMode;
  const [r, g, b] = profile.color;
  ledColorEl.value = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  ledBrightnessEl.value = String(profile.brightness);
  ledSpeedEl.value = String(profile.speed);
  syncRangeSliders();
}

// Slot switcher buttons are built once and then updated in place (same
// reason as syncReportRateButtons: rebuilding would drop keyboard focus).
function renderSlotControls() {
  slotButtonsEl.replaceChildren();
  activeProfileEl.replaceChildren();
  for (let i = 0; i < M908_PROFILE_COUNT; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.slot = String(i);
    btn.addEventListener("click", () => selectSlot(i as M908ProfileIndex));
    slotButtonsEl.append(btn);

    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `Profile ${i + 1}`;
    activeProfileEl.append(opt);
  }
  syncSlotControls();
}

function syncSlotControls() {
  for (const btn of slotButtonsEl.querySelectorAll<HTMLButtonElement>("button")) {
    const i = Number(btn.dataset.slot);
    const selected = i === editingSlot;
    btn.classList.toggle("active", selected);
    btn.setAttribute("aria-pressed", String(selected));
    btn.replaceChildren(`Profile ${i + 1}`);
    if (i === profileSet.activeProfile) {
      const mark = document.createElement("span");
      mark.className = "slot-active-mark";
      mark.setAttribute("aria-hidden", "true");
      const srText = document.createElement("span");
      srText.className = "visually-hidden";
      srText.textContent = " (active on mouse)";
      btn.append(mark, srText);
      btn.title = "Active on the mouse after Apply";
    } else {
      btn.removeAttribute("title");
    }
  }
  activeProfileEl.value = String(profileSet.activeProfile);
  editingSlotEl.textContent = `Editing profile ${editingSlot + 1} of ${M908_PROFILE_COUNT}.`;

  // Copy targets: every slot except the one being edited.
  const previousTarget = copyTargetEl.value;
  copyTargetEl.replaceChildren();
  for (let i = 0; i < M908_PROFILE_COUNT; i++) {
    if (i === editingSlot) continue;
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `Profile ${i + 1}`;
    copyTargetEl.append(opt);
  }
  if (previousTarget && Number(previousTarget) !== editingSlot) copyTargetEl.value = previousTarget;
}

function selectSlot(slot: M908ProfileIndex) {
  if (slot === editingSlot) return;
  editingSlot = slot;
  profile = profileSet.profiles[slot];
  presetSelectEl.value = "";
  renderAll();
  syncSlotControls();
}

function renderAll() {
  renderDpiRows();
  renderLedControls();
  renderReportRateButtons();
  scrollSpeedEl.value = String(profile.scrollSpeed);
  buttonEditor.refresh();
}

function buildActionReferenceText(): string {
  return [
    "Plain key: c   (or any letter/digit/named key, e.g. 'enter', 'space', 'arrow_left')",
    "With modifiers: ctrl+c, ctrl+shift+c, super+space",
    "Special actions: left, right, middle, dpi-cycle, dpi+, dpi-, scroll_up, scroll_down,",
    "  profile_switch, profile+, profile-, report_rate+, report_rate-, media_play,",
    "  media_next, compatibility_copy, compatibility_paste, compatibility_switch_window,",
    "  compatibility_show_desktop, and more (see redragon-family-keycodes.json).",
    "Fire (repeated keypress): fire:<key>:<repeats>:<delay>   e.g. fire:mouse_left:3:0",
    "Snipe (hold to change DPI): snipe:<dpi>   only 200-1100 in 100-steps documented",
    "Macro reference: macro1 .. macro15, macro3:5 (5 repeats), macro1:until, macro1:while",
    "Raw bytes: 0xNNNNNNNN",
  ].join("\n");
}

// --- Presets ---

presetSelectEl.addEventListener("change", () => {
  const preset = M908_BUILT_IN_PRESETS.find((p) => p.id === presetSelectEl.value);
  profile = structuredClone(preset ? preset.profile : M908_NEUTRAL_PROFILE);
  profileSet.profiles[editingSlot] = profile;
  renderAll();
  persist();
  log(
    preset
      ? `Loaded preset "${preset.name}" into profile ${editingSlot + 1}.`
      : `Reset profile ${editingSlot + 1} to a neutral profile.`
  );
});

ledModeEl.addEventListener("change", () => {
  profile.lightMode = ledModeEl.value as M908LightMode;
  persist();
});
ledColorEl.addEventListener("input", () => {
  const hex = ledColorEl.value.replace("#", "");
  profile.color = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  persist();
});
ledBrightnessEl.addEventListener("input", () => {
  profile.brightness = Number(ledBrightnessEl.value);
  persist();
});
ledSpeedEl.addEventListener("input", () => {
  profile.speed = Number(ledSpeedEl.value);
  persist();
});
scrollSpeedEl.addEventListener("input", () => {
  profile.scrollSpeed = Math.max(0, Math.min(255, Number(scrollSpeedEl.value) || 0));
  persist();
});

// --- Slot tools ---

activeProfileEl.addEventListener("change", () => {
  const index = Number(activeProfileEl.value);
  if (!isM908ProfileIndex(index)) return;
  profileSet.activeProfile = index;
  syncSlotControls();
  persist();
});

copySlotBtn.addEventListener("click", () => {
  const target = Number(copyTargetEl.value);
  if (!isM908ProfileIndex(target) || target === editingSlot) return;
  if (!confirm(`Replace profile ${target + 1} with a copy of profile ${editingSlot + 1}?`)) return;
  profileSet = copyM908Slot(profileSet, editingSlot, target);
  profile = profileSet.profiles[editingSlot];
  persist();
  log(`Copied profile ${editingSlot + 1} to profile ${target + 1}.`);
  announce(`Copied profile ${editingSlot + 1} to profile ${target + 1}.`);
});

exportSetBtn.addEventListener("click", () => {
  const blob = new Blob([serializeM908ProfileSet(profileSet)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "m908-profiles.json";
  a.click();
  URL.revokeObjectURL(url);
  log("Exported all five profiles to m908-profiles.json.");
});

importSetBtn.addEventListener("click", () => importSetInput.click());

importSetInput.addEventListener("change", async () => {
  const file = importSetInput.files?.[0];
  importSetInput.value = ""; // allow re-importing the same file later
  if (!file) return;
  const imported = parseM908ProfileSet(await file.text());
  if (!imported) {
    log(`Import failed: "${file.name}" isn't an M908 five-profile export.`);
    announce(`Import failed: "${file.name}" isn't an M908 five-profile export.`, "warning");
    return;
  }
  profileSet = imported;
  profile = profileSet.profiles[editingSlot];
  presetSelectEl.value = "";
  renderAll();
  syncSlotControls();
  persist();
  log(`Imported five profiles from "${file.name}" (active: profile ${profileSet.activeProfile + 1}).`);
  announce(`Imported five profiles from "${file.name}".`);
});

showActionReferenceBtn.addEventListener("click", () => {
  const isOpen = actionReferenceEl.classList.toggle("open");
  showActionReferenceBtn.setAttribute("aria-expanded", String(isOpen));
  actionReferenceEl.textContent = isOpen ? buildActionReferenceText() : "";
});

// --- Connect ---

connectBtn.addEventListener("click", async () => {
  try {
    const devices = await requestM908();
    const configDevice = findM908ConfigDevice(devices);
    if (!configDevice) {
      log("Connect failed: none of the granted collections expose the config feature report.");
      announce("Connect failed: couldn't find the config channel — see the log.", "warning");
      return;
    }
    await closeDevice(device);
    await openDevice(configDevice);
    device = configDevice;
    setConnected(true);
    announce(`Connected: ${configDevice.productName || "M908"}`);
    statusEl.classList.add("connected");
    log("Connected.");
  } catch (err) {
    log(`Connect failed: ${err instanceof Error ? err.message : String(err)}`);
    announce(`Connect failed: ${err instanceof Error ? err.message : String(err)}`, "warning");
  }
});

// --- Apply ---

async function applySection(name: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    log(`${name}: ok`);
    return true;
  } catch (err) {
    log(`${name}: FAILED — ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// Busy state uses aria-disabled rather than disabled: disabling the button
// the user just activated would drop keyboard focus to <body>.
let applying = false;

const FULL_WRITE_WARNING =
  "Apply writes all five onboard profiles at once — the M908 has no way to update just one.\n\n" +
  "Whatever is stored in profiles 1-5 right now (including anything set up in Redragon's Windows software) " +
  "will be replaced by the five profiles shown on this page.\n\nContinue?";

applyBtn.addEventListener("click", async () => {
  if (!device || applying) return;
  if (!fullWriteConfirmed) {
    if (!confirm(FULL_WRITE_WARNING)) {
      log("Apply cancelled — nothing was written.");
      return;
    }
    fullWriteConfirmed = true;
  }
  applying = true;
  applyBtn.setAttribute("aria-disabled", "true");
  applyBtn.textContent = "Applying…";

  const steps = buildM908ApplySequence(profileSet.profiles, profileSet.activeProfile);
  let okCount = 0;
  for (const step of steps) {
    const ok = await applySection(step.label, () => sendM908Rows(device!, step.rows));
    if (!ok) {
      // The blocks are one framed write sequence; don't keep sending the
      // rest of it after a failure.
      log(`Stopped after "${step.label}" failed; the remaining ${steps.length - okCount - 1} step(s) weren't sent.`);
      break;
    }
    okCount++;
  }

  log(`Apply Configuration: ${okCount}/${steps.length} steps ok.`);
  if (okCount === steps.length) {
    announce(`Configuration applied — all five profiles written, profile ${profileSet.activeProfile + 1} active.`);
    statusEl.classList.add("connected");
  } else {
    announce(`Apply finished with errors: ${okCount}/${steps.length} steps ok — see the log.`, "warning");
  }
  applying = false;
  applyBtn.removeAttribute("aria-disabled");
  applyBtn.textContent = "Apply Configuration";
});

// --- Init ---

renderPresetOptions();
renderLedModeOptions();
renderSlotControls();
renderAll();
setConnected(false);

if (!isWebHidAvailable()) {
  statusEl.textContent = "This browser doesn't support WebHID — open this page in Chrome or Edge.";
  statusEl.classList.remove("connected");
  connectBtn.disabled = true;
  applyBtn.disabled = true;
  document.querySelector<HTMLElement>("#unsupported")!.hidden = false;
  // Apply can never enable here, so don't keep it floating over the page.
  applyBtn.closest(".config-toolbar")?.classList.add("unstuck");
  log(WEBHID_UNAVAILABLE_MESSAGE);
}

initDropdowns();
initRangeSliders();
