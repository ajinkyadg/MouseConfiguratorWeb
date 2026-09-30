import { initDropdowns } from "./dropdowns";
import { initRangeSliders, syncRangeSliders } from "./range-slider";
import {
  requestM913,
  openDevice,
  closeDevice,
  findConfigDevice,
  detectHardware,
  identifyM913,
  isWiredConnection,
  describeCollections,
  sendConfigPacket,
  waitForResponse,
  toHex,
  type HardwareRevision,
  type M913Identification,
} from "./core/hid-transport";
import {
  macOSBlocksHidWrites,
  isWriteRefusedError,
  isWebHidAvailable,
  detectDesktopOS,
  MACOS_WRITE_BLOCK_EXPLANATION,
  WEBHID_UNAVAILABLE_MESSAGE,
  type DesktopOS,
} from "./core/platform";
import {
  buildPollingRatePacket,
  buildAresonDpiPackets,
  buildCompxDpiPackets,
  buildLedPackets,
  ARESON_KNOWN_DPI_VALUES,
  COMPX_DPI_MIN,
  COMPX_DPI_MAX,
  COMPX_DPI_STEP,
  type DpiSettings,
  type LedMode,
} from "./profiles/m913";
import { buildButtonMappingPackets, actionComboTokens, MAX_COMBO_TOKENS } from "./profiles/m913-buttons";
import { ACTION_CATEGORIES, BUTTON_SLOTS } from "./profiles/m913-action-catalog";
import { comboKeys, formatCombo, modifierLabel, shortcutName, type ShortcutOS } from "./profiles/shortcut-names";
import { createButtonEditor, type ActionDescription } from "./button-editor";
import { comboKeyGroups } from "./profiles/key-combo-keys";
import { parseAction } from "./profiles/m913-buttons";

// Which OS's shortcut names the button list uses ("super+s" is Save on macOS,
// Search on Windows). Follows the loaded preset when it targets an OS,
// otherwise the visitor's own machine.
const PRESET_OS: Record<string, ShortcutOS> = {
  "preset-office-macos": "macos",
  "preset-office-windows": "windows",
  "preset-office-linux": "linux",
  "preset-default": "macos",
};
let namingOS: ShortcutOS = (() => {
  const os = detectDesktopOS();
  return os === "unknown" ? "windows" : os;
})();
import {
  BUILT_IN_PRESETS,
  DEFAULT_DPI_COLORS_HEX,
  defaultConfig,
  dpiColorsFromHex,
  dpiColorsHexOf,
  normalizeConfig,
  type DpiColorsHex,
  type MouseWebConfig,
  type UserProfile,
} from "./profiles/user-profiles";
import { ProfileStore } from "./profiles/profile-store";
import { jmkToButtonActions } from "./profiles/jmk-import";

const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const logEl = document.querySelector<HTMLDivElement>("#log")!;
const connectBtn = document.querySelector<HTMLButtonElement>("#connect")!;
const pollButtonsEl = document.querySelector<HTMLDivElement>("#poll-buttons")!;
const dpiRowsEl = document.querySelector<HTMLDivElement>("#dpi-rows")!;
const dpiHintEl = document.querySelector<HTMLElement>("#dpi-hint")!;
const ledModeEl = document.querySelector<HTMLSelectElement>("#led-mode")!;
const ledColorEl = document.querySelector<HTMLInputElement>("#led-color")!;
const ledBrightnessRow = document.querySelector<HTMLDivElement>("#led-brightness-row")!;
const ledBrightnessEl = document.querySelector<HTMLInputElement>("#led-brightness")!;
const ledSpeedRow = document.querySelector<HTMLDivElement>("#led-speed-row")!;
const ledSpeedEl = document.querySelector<HTMLInputElement>("#led-speed")!;
const buttonEditorEl = document.querySelector<HTMLDivElement>("#button-editor")!;
const changeStatusEl = document.querySelector<HTMLParagraphElement>("#change-status")!;
const revertBtn = document.querySelector<HTMLButtonElement>("#revert")!;
const applyBtn = document.querySelector<HTMLButtonElement>("#apply")!;
const showActionRefBtn = document.querySelector<HTMLButtonElement>("#show-action-reference")!;
const actionRefEl = document.querySelector<HTMLDivElement>("#action-reference")!;
const profileSelectEl = document.querySelector<HTMLSelectElement>("#profile-select")!;
const profileSaveAsBtn = document.querySelector<HTMLButtonElement>("#profile-save-as")!;
const profileUpdateBtn = document.querySelector<HTMLButtonElement>("#profile-update")!;
const profileDeleteBtn = document.querySelector<HTMLButtonElement>("#profile-delete")!;
const profileImportBtn = document.querySelector<HTMLButtonElement>("#profile-import")!;
const profileExportBtn = document.querySelector<HTMLButtonElement>("#profile-export")!;
const profileImportInput = document.querySelector<HTMLInputElement>("#profile-import-input")!;
const profileImportJmkBtn = document.querySelector<HTMLButtonElement>("#profile-import-jmk")!;
const profileImportJmkInput = document.querySelector<HTMLInputElement>("#profile-import-jmk-input")!;

let device: HIDDevice | null = null;
let hardware: HardwareRevision = "unknown";
let pollingRateHz = 1000;
const buttonActions: Record<string, string> = {};

const profileStore = new ProfileStore();
// Which profile (preset or user-saved) the working configuration was last
// loaded from, if any — null means the user is editing an unsaved
// configuration from scratch. Matched against profileStore.profiles (not
// BUILT_IN_PRESETS) to decide whether Update/Delete apply.
let loadedProfileID: string | null = null;

function log(msg: string) {
  const time = new Date().toLocaleTimeString();
  logEl.textContent = `[${time}] ${msg}\n${logEl.textContent}`;
}

const applyHintEl = document.querySelector<HTMLParagraphElement>("#apply-hint")!;
const APPLY_HINT = applyHintEl.textContent ?? "";

function setConnected(connected: boolean) {
  applyBtn.disabled = !connected;
  // Disabling the focused Connect button would drop keyboard focus to
  // <body>; hand it to Apply first, which is the next step anyway.
  if (connected && document.activeElement === connectBtn) applyBtn.focus();
  connectBtn.disabled = connected;
  applyHintEl.textContent = connected ? APPLY_HINT : "Connect your mouse (top of page) to enable Apply.";
  applyBtn.title = applyHintEl.textContent; // the hint line is now a tooltip
}

// Short, human-readable outcome for screen readers and anyone who has
// scrolled away from the log; the log keeps the full packet trace.
// Edit confirmations ("Side 1 set to Copy") go to a screen-reader-only
// live region, so the visible #status keeps showing the connection state.
const editLiveEl = document.createElement("p");
editLiveEl.className = "visually-hidden";
editLiveEl.setAttribute("role", "status");
document.body.append(editLiveEl);
function say(message: string) {
  editLiveEl.textContent = message;
}

// The drawer opens below the fold on shorter screens; bring it into view.
document.querySelector<HTMLDetailsElement>("#settings-drawer")?.addEventListener("toggle", (event) => {
  const drawer = event.currentTarget as HTMLDetailsElement;
  if (!drawer.open) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  drawer.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
});

function announce(message: string, tone: "warning" | "" = "") {
  // The device log is collapsed by default; open it when something needs
  // attention, since that's where the full detail is.
  if (tone === "warning") document.querySelector<HTMLDetailsElement>(".log-drawer")?.setAttribute("open", "");
  statusEl.textContent = message;
  statusEl.classList.remove("connected");
  statusEl.classList.toggle("warning", tone === "warning");
}

// Safety guard: the M913's vendor/product IDs are shared with other mice
// (see identifyM913()). For anything that doesn't identify as an M913,
// warn and make the user explicitly confirm before Apply can send M913
// packets to it. Returns true only if it's OK to enable Apply.
// A confirmation of an "unconfirmed" device (generic name, known M913
// IDs) is remembered for that exact vendor:product:name, so an M913 whose
// firmware reports a generic name isn't asked on every connect. Devices
// whose name points at a different model are always asked.
const CONFIRMED_DEVICES_KEY = "mouseconfig.confirmedM913Devices";

function deviceKey(device: HIDDevice): string {
  return `${device.vendorId}:${device.productId}:${device.productName}`;
}

function readConfirmedDevices(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CONFIRMED_DEVICES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function isRememberedConfirmation(identity: M913Identification, device: HIDDevice): boolean {
  return identity.kind === "unconfirmed" && readConfirmedDevices().includes(deviceKey(device));
}

function rememberConfirmation(identity: M913Identification, device: HIDDevice) {
  if (identity.kind !== "unconfirmed") return;
  try {
    const keys = new Set(readConfirmedDevices()).add(deviceKey(device));
    localStorage.setItem(CONFIRMED_DEVICES_KEY, JSON.stringify([...keys]));
  } catch {
    // Storage unavailable: the user is simply asked again next time.
  }
}

// True when the device may be configured: identified as an M913, or
// confirmed by the user now or on an earlier connect.
function isApprovedDevice(identity: M913Identification, device: HIDDevice): boolean {
  if (identity.kind === "m913" || isRememberedConfirmation(identity, device)) return true;
  if (!confirmNonM913(identity, device.productName)) return false;
  rememberConfirmation(identity, device);
  return true;
}

function confirmNonM913(identity: M913Identification, productName: string): boolean {
  const name = productName.trim() || "this device";
  log("Not an identified M913 — Apply stays disabled unless you confirm it is one.");
  announce(`"${name}" doesn't identify as a Redragon M913 — confirm before any settings are sent.`, "warning");
  const opening =
    identity.kind === "other-model"
      ? `"${name}" looks like a DIFFERENT mouse, not a Redragon M913.`
      : `"${name}" doesn't identify itself as a Redragon M913.`;
  return window.confirm(
    `${opening}\n\n${identity.reason}\n\n` +
      "This page sends M913-specific commands. On a different mouse they can remap its buttons or change settings unpredictably.\n\n" +
      "Only continue if this really is a Redragon M913. Configure it as an M913?"
  );
}

async function sendAndLog(label: string, packet: Uint8Array) {
  if (!device) return;
  log(`→ ${label}: ${toHex(packet)}`);
  await sendConfigPacket(device, hardware, packet);
  try {
    const resp = await waitForResponse(device, 800);
    log(`← response: ${toHex(resp)}`);
  } catch {
    log(`  (no response within 800ms)`);
  }
}

// --- Connect -----------------------------------------------------------

connectBtn.addEventListener("click", async () => {
  try {
    // Close any previously-opened device from an earlier connect() in
    // this same page session before requesting a new one — see
    // closeDevice()'s doc comment for why leaving old handles open can
    // eventually block new writes.
    await closeDevice(device);
    device = null;

    // The physical M913 exposes several top-level HID collections at
    // once (see requestM913()'s doc comment) — picking the device in
    // Chrome's chooser grants all of them in one requestDevice() call.
    // Which one lands at index 0 isn't stable connection to connection,
    // so every candidate gets inspected rather than trusting devices[0].
    // Inspection reads .collections only — deliberately not opened here;
    // see findConfigDevice()'s doc comment for why opening a sibling
    // collection first breaks the write on the one actually used.
    const devices = await requestM913();
    for (const [i, candidate] of devices.entries()) {
      log(`Granted collection ${i + 1}/${devices.length}:`);
      log(describeCollections(candidate));
    }

    const configDevice = findConfigDevice(devices);
    if (!configDevice) {
      log("None of the granted collections declare the config channel (a feature or output report with id 0x08). This M913 may need a different report id, or the picker didn't grant every collection this time — try reconnecting.");
      statusEl.textContent = "Connected, but couldn't find the config channel — see log.";
      statusEl.classList.remove("connected");
      setConnected(false);
      return;
    }
    await openDevice(configDevice); // the only collection this session ever opens
    device = configDevice;

    hardware = detectHardware(device);
    const wired = isWiredConnection(device);
    log(`Using the collection with the config channel. Hardware revision detected: ${hardware} (${wired ? "wired" : "wireless receiver"})`);
    renderDpiRows();
    const identity = identifyM913(device);
    log(`Device check: ${identity.reason}`);

    if (!wired) {
      announce(`Connected: ${device.productName} — wireless receiver detected. Plug in the USB cable to apply settings.`, "warning");
      setConnected(false);
      log("The wireless receiver only relays mouse movement/clicks — configuration commands need the wired USB connection. Plug in the cable and reconnect.");
    } else if (!isApprovedDevice(identity, device)) {
      log(`Not configuring "${device.productName}": you didn't confirm it's an M913. Nothing was sent to it.`);
      announce(`Not configuring "${device.productName || "this device"}" — it doesn't identify as an M913 and wasn't confirmed. Nothing was sent.`, "warning");
      await closeDevice(device);
      device = null;
      setConnected(false);
    } else if (await macOSBlocksHidWrites()) {
      // Connected and correct in every respect the page can control — the
      // write is normally refused by the macOS kernel, not by the device.
      // Warn up front, but still allow Apply: the gate only rejects
      // unprivileged processes, so a browser running as root (or a future
      // macOS that relaxes the gate, or a wrong version detection) can
      // still succeed, and the page shouldn't be the thing that stops it.
      announce(`Connected: ${device.productName} — macOS 26.6+ usually blocks browser writes to this mouse. Apply will be attempted anyway.`, "warning");
      if (macosTip) macosTip.open = true;
      setConnected(true);
      log(MACOS_WRITE_BLOCK_EXPLANATION);
    } else if (identity.kind !== "m913") {
      log(`You confirmed "${device.productName}" is an M913 — Apply enabled.`);
      announce(`Connected: ${device.productName} (${hardware} hardware, wired) — not identified as an M913, enabled because you confirmed it is.`, "warning");
      setConnected(true);
    } else {
      announce(`Connected: ${device.productName} (${hardware} hardware, wired)`);
      statusEl.classList.add("connected");
      setConnected(true);
      // Connect lives in the hero, the settings below the fold — take the
      // user to them. Not done in the warning branches, whose message sits
      // up top and needs reading first.
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.querySelector("#settings")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  } catch (err) {
    log(`Connect failed: ${(err as Error).message}`);
    announce(`Connect failed: ${(err as Error).message}`, "warning");
  }
});

// --- macOS tip: copy the sudo Chrome command -------------------------------

// The tip is a collapsed expander so it doesn't push the configurator a
// screen down; it opens itself only when linked to (the #status link or a
// shared #macos URL) and when a connect detects the macOS write block.
const macosTip = document.querySelector<HTMLDetailsElement>("#macos");
if (macosTip && location.hash === "#macos") macosTip.open = true;
document.querySelector('a[href="#macos"]')?.addEventListener("click", () => {
  if (macosTip) macosTip.open = true;
});

const copyStatusEl = document.querySelector<HTMLSpanElement>("#copy-status");

const copyMacosCommandBtn = document.querySelector<HTMLButtonElement>("#copy-macos-command");
copyMacosCommandBtn?.addEventListener("click", async () => {
  const command = document.querySelector("#macos-command")?.textContent ?? "";
  try {
    await navigator.clipboard.writeText(command);
    copyMacosCommandBtn.textContent = "Copied";
    if (copyStatusEl) copyStatusEl.textContent = "Command copied.";
  } catch {
    // Clipboard access can be denied; the <pre> is user-select: all, so a
    // single click still selects the whole command for a manual copy.
    copyMacosCommandBtn.textContent = "Select & copy";
    if (copyStatusEl) copyStatusEl.textContent = "Copy was blocked — select the command and copy it manually.";
  }
  setTimeout(() => (copyMacosCommandBtn.textContent = "Copy"), 2000);
});

// --- Polling rate --------------------------------------------------------

function setPollingRate(hz: number) {
  pollingRateHz = hz;
  for (const b of pollButtonsEl.querySelectorAll("button")) {
    const selected = Number((b as HTMLElement).dataset.hz) === hz;
    b.classList.toggle("active", selected);
    b.setAttribute("aria-pressed", String(selected));
  }
}

for (const hz of [125, 250, 500, 1000]) {
  const btn = document.createElement("button");
  btn.textContent = `${hz} Hz`;
  btn.type = "button";
  btn.dataset.hz = String(hz);
  btn.classList.toggle("active", hz === pollingRateHz);
  btn.setAttribute("aria-pressed", String(hz === pollingRateHz));
  btn.addEventListener("click", () => setPollingRate(hz));
  pollButtonsEl.appendChild(btn);
}

// --- DPI -----------------------------------------------------------------

const dpiValueInputs: HTMLInputElement[] = [];
const dpiEnabledInputs: HTMLInputElement[] = [];
const dpiColorInputs: HTMLInputElement[] = [];

function renderDpiRows() {
  // Re-rendered on connect (the step/hint depend on the hardware revision);
  // carry over whatever the rows held so a loaded profile isn't wiped.
  const previous = dpiValueInputs.length ? { ...readDpiSettings(), colorsHex: readDpiColorsHex() } : null;
  dpiRowsEl.innerHTML = "";
  dpiValueInputs.length = 0;
  dpiEnabledInputs.length = 0;
  dpiColorInputs.length = 0;

  if (hardware === "areson") {
    dpiHintEl.textContent = `Areson hardware only accepts specific table values, e.g. ${ARESON_KNOWN_DPI_VALUES.slice(0, 6).join(", ")}, … (see the datalist on each field).`;
  } else if (hardware === "compx") {
    dpiHintEl.textContent = `Compx hardware accepts any multiple of ${COMPX_DPI_STEP} from ${COMPX_DPI_MIN} to ${COMPX_DPI_MAX}.`;
  } else {
    dpiHintEl.textContent = "";
  }

  const datalistId = "dpi-known-values";
  let datalist = document.getElementById(datalistId) as HTMLDataListElement | null;
  if (!datalist) {
    datalist = document.createElement("datalist");
    datalist.id = datalistId;
    document.body.appendChild(datalist);
  }
  datalist.innerHTML = ARESON_KNOWN_DPI_VALUES.map((v) => `<option value="${v}">`).join("");

  for (let i = 0; i < 5; i++) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <label>Stage ${i + 1}</label>
      <input type="checkbox" checked aria-label="Enable stage ${i + 1}" />
      <input type="number" aria-label="Stage ${i + 1} DPI" step="${hardware === "compx" ? COMPX_DPI_STEP : 50}" placeholder="e.g. 1600" list="${datalistId}" />
      <input type="color" aria-label="Stage ${i + 1} indicator color" value="#${DEFAULT_DPI_COLORS_HEX[i]}" />
    `;
    dpiRowsEl.appendChild(row);
    dpiEnabledInputs.push(row.querySelector('input[type="checkbox"]')!);
    dpiValueInputs.push(row.querySelector('input[type="number"]')!);
    dpiColorInputs.push(row.querySelector('input[type="color"]')!);
  }
  if (previous) setDpiSettings(previous.values, previous.enabled, previous.colorsHex);
}
renderDpiRows();

function readDpiColorsHex(): DpiColorsHex {
  // <input type="color"> always yields "#rrggbb"; dpiColorsHexOf guards anyway.
  return dpiColorsHexOf({ dpiColorsHex: dpiColorInputs.map((el) => el.value) as DpiColorsHex });
}

function readDpiSettings(): DpiSettings {
  return {
    values: dpiValueInputs.map((el) => Number(el.value) || 0) as DpiSettings["values"],
    enabled: dpiEnabledInputs.map((el) => el.checked) as DpiSettings["enabled"],
    colors: dpiColorsFromHex(readDpiColorsHex()),
  };
}

function setDpiSettings(values: readonly number[], enabled: readonly boolean[], colorsHex: Readonly<DpiColorsHex>) {
  dpiValueInputs.forEach((el, i) => (el.value = values[i] ? String(values[i]) : ""));
  dpiEnabledInputs.forEach((el, i) => (el.checked = enabled[i] ?? true));
  dpiColorInputs.forEach((el, i) => (el.value = `#${colorsHex[i]}`));
}

// --- LED -------------------------------------------------------------

function updateLedVisibility() {
  const mode = ledModeEl.value as LedMode;
  (document.querySelector("#led-color-row") as HTMLElement).style.display = mode === "steady" || mode === "respiration" ? "flex" : "none";
  ledBrightnessRow.style.display = mode === "steady" ? "flex" : "none";
  ledSpeedRow.style.display = mode === "respiration" ? "flex" : "none";
}
ledModeEl.addEventListener("change", updateLedVisibility);
updateLedVisibility();

// --- Buttons -----------------------------------------------------------
//
// The keypad grid + editor panel (src/button-editor.ts). This page supplies
// the M913's rules: what parses, the 3-key combo limit, and how an action
// is named for the visitor's OS.

function catalogEntry(value: string) {
  for (const category of ACTION_CATEGORIES) {
    const action = category.actions.find((a) => a.value === value);
    if (action) return action;
  }
  return undefined;
}

function describeAction(value: string): ActionDescription {
  const name = shortcutName(value, namingOS);
  if (name) return { name, keys: comboKeys(value, namingOS) };
  // A catalog name from another OS's list would mislabel the combo here
  // (bare "super" is the GNOME overview on Linux, but just ⌘ on a Mac).
  const entry = catalogEntry(value);
  if (entry && (!entry.os || entry.os === namingOS)) return { name: entry.label, keys: entry.os ? comboKeys(value, entry.os) : [] };
  // Any other keyboard combo is named by its keys ("⌃⇧K"); modifiers alone
  // are held while the button is held.
  const keyboard = parseAction(value)?.keyboard;
  if (keyboard) return { name: `${keyboard.keys.length ? "" : "Hold "}${formatCombo(value, namingOS)}`, keys: [] };
  return { name: value, keys: [] };
}

function validateAction(value: string): string | null {
  if (!parseAction(value)) return `"${value}" isn't an action the M913 understands.`;
  const tokens = actionComboTokens(value);
  if (tokens > MAX_COMBO_TOKENS) return `That uses ${tokens} keys — the M913 allows at most ${MAX_COMBO_TOKENS}.`;
  return null;
}

// The profile as last loaded/saved; edits are compared against it (see
// "Unsaved-change tracking" below).
let baseline: MouseWebConfig | null = null;

const buttonEditor = createButtonEditor({
  root: buttonEditorEl,
  groups: [
    { id: "clicks", label: "Clicks" },
    { id: "side", label: "Side panel" },
  ],
  slots: BUTTON_SLOTS.map((slot) => {
    const side = /^side(\d+)$/.exec(slot.id);
    return {
      id: slot.id,
      short: side ? `Side ${side[1]}` : slot.displayName.replace(/ (Click|Button)$/, ""),
      tag: side ? side[1]! : slot.displayName.replace(/ (Click|Button)$/, ""),
      full: slot.displayName,
      group: side ? "side" : "clicks",
    };
  }),
  categories: ACTION_CATEGORIES,
  getValue: (id) => buttonActions[id] ?? "",
  setValue: (id, value) => {
    buttonActions[id] = value;
    updateChangeState();
  },
  isChanged: (id) => (buttonActions[id] ?? "") !== (baseline?.buttonActions[id] ?? ""),
  validate: validateAction,
  describe: describeAction,
  categoryKeys: (value, category) => {
    const os = category.actions.find((a) => a.value === value)?.os;
    return os ? comboKeys(value, os) : [];
  },
  announce: (message) => say(message),
  customPlaceholder: "e.g. ctrl+shift+k, media_play, fire:58:3",
  modifierLabel: (mod) => modifierLabel(mod, namingOS),
  comboKeyGroups: comboKeyGroups((key) => parseAction(key) !== null),
  customExtras: [...document.querySelectorAll<HTMLElement>("#show-action-reference, #action-reference")],
});

// --- Unsaved-change tracking --------------------------------------------
//
// "Changed" means different from the profile last loaded or saved — shown
// as a dot on each changed tile, a count in the toolbar, and "(modified)"
// on the profile picker — so edits are never lost silently.


function configsDiffer(a: MouseWebConfig, b: MouseWebConfig): number {
  let count = 0;
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  for (const key of ["pollingRateHz", "dpi", "dpiEnabled", "dpiColorsHex", "ledMode", "ledColorHex", "ledBrightness", "ledSpeed"] as const) {
    if (!same(a[key], b[key])) count++;
  }
  for (const slot of BUTTON_SLOTS) {
    if ((a.buttonActions[slot.id] ?? "") !== (b.buttonActions[slot.id] ?? "")) count++;
  }
  return count;
}

function unsavedChanges(): number {
  return baseline ? configsDiffer(normalizeConfig(getCurrentConfig()), baseline) : 0;
}

function updateChangeState() {
  const count = unsavedChanges();
  const noun = `${count} unsaved change${count === 1 ? "" : "s"}`;
  // Presets can't be overwritten, so say how to keep the edits.
  changeStatusEl.textContent = !count ? "All changes saved" : currentUserProfile() ? noun : `${noun} · Save As to keep`;
  changeStatusEl.classList.toggle("dirty", count > 0);
  revertBtn.hidden = count === 0 || !baseline;
  // One Save button: updates a saved profile, or asks for a name (Save As)
  // when the edits are to a built-in preset.
  profileUpdateBtn.disabled = count === 0;
  profileUpdateBtn.textContent = currentUserProfile() ? "Save" : "Save as…";
  renderSettingsSummary();
  const selectedOption = profileSelectEl.selectedOptions[0];
  if (selectedOption && selectedOption.value) {
    const base = selectedOption.dataset.name ?? selectedOption.textContent ?? "";
    selectedOption.dataset.name = base;
    selectedOption.textContent = count ? `${base} (modified)` : base;
  }
  buttonEditor.refresh();
}

// One-line summary shown on the collapsed Sensor & lighting drawer.
const settingsSummaryEl = document.querySelector<HTMLSpanElement>("#settings-summary")!;
function renderSettingsSummary() {
  const config = getCurrentConfig();
  const dpi = config.dpi.filter((_, i) => config.dpiEnabled[i]).join(" · ");
  const led = ledModeEl.selectedOptions[0]?.textContent ?? config.ledMode;
  settingsSummaryEl.textContent = `DPI ${dpi || "—"}  |  LED ${led}  |  ${config.pollingRateHz} Hz`;
}

function markSaved() {
  baseline = normalizeConfig(getCurrentConfig());
  updateChangeState();
}

// Every settings control reports through input/change/click; recompute on
// the next frame so the control's own handler has updated state first.
let changeFrame = 0;
for (const type of ["input", "change", "click"]) {
  document.querySelector(".settings-row")!.addEventListener(type, () => {
    cancelAnimationFrame(changeFrame);
    changeFrame = requestAnimationFrame(updateChangeState);
  });
}

revertBtn.addEventListener("click", () => {
  if (baseline) applyConfigToUI(baseline);
  updateChangeState();
  say("Changes reverted.");
});

showActionRefBtn.addEventListener("click", () => {
  actionRefEl.classList.toggle("open");
  showActionRefBtn.setAttribute("aria-expanded", String(actionRefEl.classList.contains("open")));
  if (actionRefEl.classList.contains("open")) {
    const lines: string[] = [];
    for (const category of ACTION_CATEGORIES) {
      lines.push(category.name + ":");
      for (const action of category.actions) {
        lines.push(`  ${action.value}${action.label !== action.value ? " — " + action.label : ""}`);
      }
    }
    lines.push("", "Modifiers: ctrl, shift, alt, super (combine with + before a key)");
    lines.push("Combos: at most " + MAX_COMBO_TOKENS + " modifiers+keys total, e.g. ctrl+shift+z");
    actionRefEl.textContent = lines.join("\n");
  }
});

// --- Profiles --------------------------------------------------------

function getCurrentConfig(): MouseWebConfig {
  const dpi = readDpiSettings();
  return {
    pollingRateHz,
    dpi: dpi.values,
    dpiEnabled: dpi.enabled,
    dpiColorsHex: readDpiColorsHex(),
    ledMode: ledModeEl.value as LedMode,
    ledColorHex: ledColorEl.value.slice(1),
    ledBrightness: Number(ledBrightnessEl.value),
    ledSpeed: Number(ledSpeedEl.value),
    buttonActions: Object.fromEntries(Object.entries(buttonActions).filter(([, v]) => v)),
  };
}

function applyConfigToUI(config: MouseWebConfig) {
  setPollingRate(config.pollingRateHz);
  setDpiSettings(config.dpi, config.dpiEnabled, dpiColorsHexOf(config));
  ledModeEl.value = config.ledMode;
  ledColorEl.value = `#${config.ledColorHex}`;
  ledBrightnessEl.value = String(config.ledBrightness);
  ledSpeedEl.value = String(config.ledSpeed);
  syncRangeSliders();
  updateLedVisibility();
  for (const slot of BUTTON_SLOTS) buttonActions[slot.id] = config.buttonActions[slot.id] ?? "";
  buttonEditor.refresh();
}

function currentUserProfile(): UserProfile | undefined {
  return loadedProfileID ? profileStore.profiles.find((p) => p.id === loadedProfileID) : undefined;
}

function currentProfileLabel(): string {
  const userProfile = currentUserProfile();
  if (userProfile) return userProfile.name;
  const preset = BUILT_IN_PRESETS.find((p) => p.id === loadedProfileID);
  if (preset) return preset.name;
  return "Unsaved Configuration";
}

function renderProfileSelect() {
  const current = loadedProfileID ?? "";
  profileSelectEl.innerHTML =
    `<option value="">— Unsaved Configuration —</option>` +
    `<optgroup label="Presets">` +
    BUILT_IN_PRESETS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("") +
    `</optgroup>` +
    (profileStore.profiles.length
      ? `<optgroup label="My Profiles">` +
        profileStore.profiles.map((p) => `<option value="${p.id}">${p.name}</option>`).join("") +
        `</optgroup>`
      : "");
  profileSelectEl.value = current;
  profileDeleteBtn.disabled = !currentUserProfile();
  updateChangeState();
}

function loadProfile(profile: UserProfile) {
  const detected = detectDesktopOS();
  namingOS = PRESET_OS[profile.id] ?? (detected === "unknown" ? "windows" : detected);
  applyConfigToUI(profile.config);
  loadedProfileID = profile.id;
  baseline = normalizeConfig(profile.config);
  renderProfileSelect();
}

profileSelectEl.addEventListener("change", () => {
  const id = profileSelectEl.value;
  const pending = unsavedChanges();
  if (pending && !window.confirm(`Discard ${pending} unsaved change${pending === 1 ? "" : "s"} to "${currentProfileLabel()}"?`)) {
    profileSelectEl.value = loadedProfileID ?? "";
    return;
  }
  if (!id) {
    loadedProfileID = null;
    renderProfileSelect();
    return;
  }
  const profile = BUILT_IN_PRESETS.find((p) => p.id === id) ?? profileStore.profiles.find((p) => p.id === id);
  if (profile) loadProfile(profile);
});

profileSaveAsBtn.addEventListener("click", () => {
  const name = window.prompt("Save profile as:", currentProfileLabel() === "Unsaved Configuration" ? "" : currentProfileLabel());
  if (name === null) return;
  const trimmed = name.trim();
  const saved = profileStore.addProfile(trimmed || "Untitled", getCurrentConfig());
  loadedProfileID = saved.id;
  renderProfileSelect();
  markSaved();
  log(`Saved profile "${saved.name}".`);
});

profileUpdateBtn.addEventListener("click", () => {
  const profile = currentUserProfile();
  if (!profile) {
    profileSaveAsBtn.click();
    return;
  }
  profileStore.updateProfile(profile.id, getCurrentConfig());
  markSaved();
  log(`Updated profile "${profile.name}".`);
});

profileDeleteBtn.addEventListener("click", () => {
  const profile = currentUserProfile();
  if (!profile) return;
  profileStore.deleteProfile(profile.id);
  loadedProfileID = null;
  renderProfileSelect();
  profileSelectEl.focus(); // Delete just disabled itself; keep keyboard focus on the page
  log(`Deleted profile "${profile.name}".`);
});

profileImportBtn.addEventListener("click", () => profileImportInput.click());

profileImportInput.addEventListener("change", async () => {
  const file = profileImportInput.files?.[0];
  profileImportInput.value = ""; // allow re-importing the same file later
  if (!file) return;
  const text = await file.text();
  const imported = profileStore.importProfile(text);
  if (!imported) {
    log(`Import failed: "${file.name}" isn't a valid profile export.`);
    announce(`Import failed: "${file.name}" isn't a valid profile export.`, "warning");
    return;
  }
  loadProfile(imported);
  log(`Imported profile "${imported.name}".`);
});

profileImportJmkBtn.addEventListener("click", () => profileImportJmkInput.click());

profileImportJmkInput.addEventListener("change", async () => {
  const file = profileImportJmkInput.files?.[0];
  profileImportJmkInput.value = "";
  if (!file) return;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const buttonActions = jmkToButtonActions(bytes);
  const mappedCount = Object.keys(buttonActions).length;
  if (mappedCount === 0) {
    log(`Import failed: "${file.name}" doesn't look like a recognizable .jmk profile.`);
    announce(`Import failed: "${file.name}" doesn't look like a recognizable .jmk profile.`, "warning");
    return;
  }

  const imported: UserProfile = {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.jmk$/i, ""),
    config: { ...defaultConfig(), buttonActions },
  };
  loadProfile(imported);
  log(
    `Imported ${mappedCount} button mapping(s) from "${file.name}". ` +
      `DPI, polling rate, and LED weren't decoded yet, so those are at defaults — ` +
      `buttons bound to a custom recorded macro in the original file aren't decoded either.`
  );
});

profileExportBtn.addEventListener("click", () => {
  const label = currentProfileLabel();
  const profileToExport: UserProfile = currentUserProfile() ?? {
    id: crypto.randomUUID(),
    name: label === "Unsaved Configuration" ? "M913 Profile" : label,
    config: getCurrentConfig(),
  };
  const json = profileStore.exportProfile(profileToExport);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${profileToExport.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Restore whatever was selected last time; otherwise start from the
// productivity preset for this OS, so a first-time visitor sees shortcuts
// that exist on their machine (Cmd bindings are useless on Windows, and
// vice versa) rather than whatever raw HTML is hardcoded in index.html.
const OFFICE_PRESET_BY_OS: Record<DesktopOS, string> = {
  macos: "preset-office-macos",
  windows: "preset-office-windows",
  linux: "preset-office-linux",
  unknown: "preset-office-windows", // the most common desktop, and all-Ctrl
};

function startingProfile(): UserProfile {
  const remembered = profileStore.selectedProfileID;
  const restored = remembered
    ? profileStore.profiles.find((p) => p.id === remembered) ??
      BUILT_IN_PRESETS.find((p) => p.id === remembered)
    : undefined;
  const forThisOS = BUILT_IN_PRESETS.find((p) => p.id === OFFICE_PRESET_BY_OS[detectDesktopOS()]);
  return restored ?? forThisOS ?? BUILT_IN_PRESETS[0];
}

loadProfile(startingProfile()); // loadProfile() already calls renderProfileSelect()
setConnected(false);

// Say up front that this browser can't do it, rather than letting the user
// click Connect and get a raw TypeError from deep inside requestM913().
if (!isWebHidAvailable()) {
  statusEl.textContent = "This browser doesn't support WebHID — open this page in Chrome or Edge.";
  statusEl.classList.remove("connected");
  connectBtn.disabled = true;
  applyBtn.disabled = true;
  document.querySelector<HTMLElement>("#unsupported")!.hidden = false;
  // Apply can never enable here, so don't keep it floating over the page.
  applyBtn.closest(".config-toolbar")?.classList.add("unstuck");
  if (macosTip) macosTip.open = false;
  log(WEBHID_UNAVAILABLE_MESSAGE);
}

// --- Apply ---------------------------------------------------------------

// Each section is tried independently and keeps going even if an earlier
// one throws — a single combined try/catch meant one failing section (in
// practice, whichever came first) silently prevented every section after
// it from ever being attempted, which made it impossible to tell whether
// a failure was specific to one command or affected everything.
// Set once per Apply so the explanation is logged once, not once per
// failing section — every section fails for the same single reason, and
// repeating a paragraph four times buries the packet trace above it.
let explainedWriteBlock = false;

async function applySection(label: string, send: () => Promise<void>): Promise<boolean> {
  try {
    await send();
    return true;
  } catch (err) {
    log(`${label} failed: ${(err as Error).message}`);
    if (!explainedWriteBlock && isWriteRefusedError(err) && (await macOSBlocksHidWrites())) {
      explainedWriteBlock = true;
      log(MACOS_WRITE_BLOCK_EXPLANATION);
    }
    return false;
  }
}

// Busy state uses aria-disabled rather than disabled: disabling the button
// the user just activated would drop keyboard focus to <body>.
let applying = false;

applyBtn.addEventListener("click", async () => {
  if (!device || applying) return;
  applying = true;
  applyBtn.setAttribute("aria-disabled", "true");
  applyBtn.textContent = "Applying…";
  explainedWriteBlock = false;
  const results: Record<string, boolean> = {};

  results.pollingRate = await applySection("Polling rate", () => sendAndLog("polling rate", buildPollingRatePacket(pollingRateHz)));

  results.dpi = await applySection("DPI", async () => {
    const dpi = readDpiSettings();
    const dpiPackets = hardware === "compx" ? buildCompxDpiPackets(dpi) : buildAresonDpiPackets(dpi);
    for (const [i, packet] of dpiPackets.entries()) {
      await sendAndLog(`DPI packet ${i + 1}/${dpiPackets.length}`, packet);
    }
  });

  results.led = await applySection("LED", async () => {
    const mode = ledModeEl.value as LedMode;
    const color = parseInt(ledColorEl.value.slice(1), 16);
    const brightness = Number(ledBrightnessEl.value);
    const speed = Number(ledSpeedEl.value);
    const ledPackets = buildLedPackets(mode, color, brightness, speed);
    for (const [i, packet] of ledPackets.entries()) {
      await sendAndLog(`LED packet ${i + 1}/${ledPackets.length}`, packet);
    }
  });

  const changedButtons = Object.fromEntries(Object.entries(buttonActions).filter(([, v]) => v));
  if (Object.keys(changedButtons).length > 0) {
    results.buttons = await applySection("Buttons", async () => {
      const buttonPackets = buildButtonMappingPackets(changedButtons, hardware === "compx" ? "compx" : "areson");
      for (const [i, packet] of buttonPackets.entries()) {
        await sendAndLog(`Button packet ${i + 1}/${buttonPackets.length}`, packet);
      }
    });
  }

  const summary = Object.entries(results)
    .map(([section, ok]) => `${section}=${ok ? "ok" : "FAILED"}`)
    .join(", ");
  log(`Apply Configuration: ${summary}`);
  const failed = Object.entries(results).filter(([, ok]) => !ok).map(([section]) => section);
  if (failed.length) announce(`Apply finished with errors: ${failed.join(", ")} failed — see the log.`, "warning");
  else announce("Configuration applied.");
  if (!failed.length) statusEl.classList.add("connected");
  applying = false;
  applyBtn.removeAttribute("aria-disabled");
  applyBtn.textContent = "Apply Configuration";
});

initDropdowns();
initRangeSliders();
