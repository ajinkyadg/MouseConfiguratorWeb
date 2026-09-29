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
import { ACTION_CATEGORIES, BUTTON_SLOTS, displayLabel } from "./profiles/m913-action-catalog";
import { KEY_COMBO_SPECIAL_GROUPS } from "./profiles/key-combo-keys";
import {
  BUILT_IN_PRESETS,
  DEFAULT_DPI_COLORS_HEX,
  defaultConfig,
  dpiColorsFromHex,
  dpiColorsHexOf,
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
const buttonRowsEl = document.querySelector<HTMLDivElement>("#button-rows")!;
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
// Per-button-id "load a value into this row's UI" functions, populated by
// renderButtonRows() — lets applyConfigToUI() below set a button row's
// picker/label state the same way a user's own interaction would, instead
// of only ever updating buttonActions directly.
const buttonRowLoaders: Record<string, (value: string) => void> = {};

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
}

// Short, human-readable outcome for screen readers and anyone who has
// scrolled away from the log; the log keeps the full packet trace.
function announce(message: string, tone: "warning" | "" = "") {
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
// Two-step picker: a category select (a real, short list — "Clicks",
// "DPI & Light", etc. — plus Key Combination/Custom) followed by an
// action select scoped to whichever category was chosen. This replaces a
// single <select> with <optgroup>s, which browsers still render as one
// long flat list regardless of the grouping.

function renderButtonRows() {
  for (const slot of BUTTON_SLOTS) {
    const row = document.createElement("div");
    row.className = "button-row";

    const label = document.createElement("label");
    label.textContent = slot.displayName;

    const currentValue = document.createElement("span");
    currentValue.className = "current-value";
    currentValue.id = `current-${slot.id}`;
    currentValue.textContent = "Unchanged";

    const categorySelect = document.createElement("select");
    categorySelect.className = "category-select";
    categorySelect.setAttribute("aria-label", `${slot.displayName} action category`);
    categorySelect.innerHTML =
      `<option value="">Unchanged</option>` +
      ACTION_CATEGORIES.map((c) => `<option value="${c.name}">${c.name}</option>`).join("") +
      `<option value="__combo__">Key Combination…</option>` +
      `<option value="__custom__">Custom…</option>`;

    const actionSelect = document.createElement("select");
    actionSelect.className = "action-select";
    actionSelect.setAttribute("aria-label", `${slot.displayName} action`);
    actionSelect.style.display = "none";

    const comboBuilder = document.createElement("div");
    comboBuilder.className = "combo-builder";
    comboBuilder.setAttribute("role", "group");
    comboBuilder.setAttribute("aria-label", `${slot.displayName} key combination`);
    // The special-key <option>s (~77 per row) are filled in on first open
    // by openComboBuilder() — building them for all 16 rows up front was
    // most of the page's DOM, for a picker that's rarely opened.
    comboBuilder.innerHTML = `
      <label><input type="checkbox" data-mod="ctrl" /> Ctrl</label>
      <label><input type="checkbox" data-mod="shift" /> Shift</label>
      <label><input type="checkbox" data-mod="alt" /> ⌥ Option/Alt</label>
      <label><input type="checkbox" data-mod="super" /> ⌘/Super</label>
      <input type="text" placeholder="key, e.g. c" class="combo-key" aria-label="${slot.displayName} key" />
      <select class="combo-special-key" aria-label="${slot.displayName} special key">
        <option value="" selected>Special key…</option>
      </select>
      <button type="button" class="combo-apply" aria-label="Use combination for ${slot.displayName}">Use</button>
    `;
    function openComboBuilder() {
      const specialKeySelect = comboBuilder.querySelector<HTMLSelectElement>(".combo-special-key")!;
      if (specialKeySelect.options.length === 1) {
        specialKeySelect.insertAdjacentHTML(
          "beforeend",
          KEY_COMBO_SPECIAL_GROUPS.map(
            (group) =>
              `<optgroup label="${group.name}">` +
              group.keys.map((k) => `<option value="${k}">${k}</option>`).join("") +
              `</optgroup>`
          ).join("")
        );
      }
      comboBuilder.classList.add("open");
    }

    const customWrap = document.createElement("div");
    customWrap.className = "custom-wrap";
    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.placeholder = "e.g. ctrl+alt+super+d";
    customInput.setAttribute("aria-label", `${slot.displayName} custom action`);
    for (const el of [categorySelect, actionSelect, customInput]) el.setAttribute("aria-describedby", currentValue.id);
    customWrap.appendChild(customInput);

    // Updates the model + visible label only — used for direct
    // interaction within this row, where the picker UI driving the change
    // is already showing the right thing.
    function setCurrent(value: string) {
      buttonActions[slot.id] = value;
      currentValue.textContent = value ? displayLabel(value) ?? value : "Unchanged";
      currentValue.title = currentValue.textContent; // full text when the column ellipsizes it
    }

    // Full programmatic load: also re-syncs the category/action pickers
    // and the custom field to match `value`, for when a profile is loaded
    // rather than the user picking something interactively.
    function loadRowValue(value: string) {
      comboBuilder.classList.remove("open");
      customWrap.classList.remove("open");
      actionSelect.style.display = "none";

      if (!value) {
        categorySelect.value = "";
        setCurrent("");
        return;
      }
      const owningCategory = ACTION_CATEGORIES.find((c) => c.actions.some((a) => a.value === value));
      if (owningCategory) {
        categorySelect.value = owningCategory.name;
        actionSelect.innerHTML =
          `<option value="" disabled>Choose action…</option>` +
          owningCategory.actions.map((a) => `<option value="${a.value}">${a.label}</option>`).join("");
        actionSelect.value = value;
        actionSelect.style.display = "inline-block";
      } else {
        categorySelect.value = "__custom__";
        customWrap.classList.add("open");
        customInput.value = value;
      }
      setCurrent(value);
    }
    buttonRowLoaders[slot.id] = loadRowValue;

    categorySelect.addEventListener("change", () => {
      actionSelect.style.display = "none";
      comboBuilder.classList.remove("open");
      customWrap.classList.remove("open");
      const value = categorySelect.value;

      if (value === "") {
        setCurrent("");
      } else if (value === "__combo__") {
        openComboBuilder();
      } else if (value === "__custom__") {
        customWrap.classList.add("open");
        customInput.value = "";
        setCurrent("");
      } else {
        const category = ACTION_CATEGORIES.find((c) => c.name === value)!;
        actionSelect.innerHTML =
          `<option value="" disabled selected>Choose action…</option>` +
          category.actions.map((a) => `<option value="${a.value}">${a.label}</option>`).join("");
        actionSelect.style.display = "inline-block";
      }
    });

    actionSelect.addEventListener("change", () => setCurrent(actionSelect.value));

    customInput.addEventListener("input", () => setCurrent(customInput.value.trim()));

    const comboKeyInput = comboBuilder.querySelector<HTMLInputElement>(".combo-key")!;
    const comboSpecialKeySelect = comboBuilder.querySelector<HTMLSelectElement>(".combo-special-key")!;
    comboSpecialKeySelect.addEventListener("change", () => {
      if (comboSpecialKeySelect.value) comboKeyInput.value = comboSpecialKeySelect.value;
      comboSpecialKeySelect.value = ""; // acts as a quick-insert, not a persistent selection
    });

    comboBuilder.querySelector(".combo-apply")!.addEventListener("click", () => {
      const mods: string[] = [];
      comboBuilder.querySelectorAll<HTMLInputElement>("input[data-mod]").forEach((el) => {
        if (el.checked) mods.push(el.dataset.mod!);
      });
      const key = comboKeyInput.value.trim().toLowerCase();
      const action = [...mods, key].filter(Boolean).join("+");
      if (!action) {
        announce(`${slot.displayName}: pick a modifier or type a key first.`, "warning");
        comboKeyInput.focus();
        return;
      }
      const tokens = actionComboTokens(action);
      if (tokens > MAX_COMBO_TOKENS) {
        log(`Combo "${action}" uses ${tokens} modifiers+keys — hardware allows at most ${MAX_COMBO_TOKENS}.`);
        announce(`${slot.displayName}: that combination uses ${tokens} keys — the mouse allows at most ${MAX_COMBO_TOKENS}.`, "warning");
        return;
      }
      setCurrent(action);
      comboBuilder.classList.remove("open");
      comboKeyInput.value = "";
      comboBuilder.querySelectorAll<HTMLInputElement>("input[data-mod]").forEach((el) => (el.checked = false));
    });

    row.appendChild(label);
    row.appendChild(currentValue);
    row.appendChild(categorySelect);
    row.appendChild(actionSelect);
    row.appendChild(comboBuilder);
    row.appendChild(customWrap);
    buttonRowsEl.appendChild(row);
  }
}
renderButtonRows();

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
  for (const slot of BUTTON_SLOTS) {
    buttonRowLoaders[slot.id]?.(config.buttonActions[slot.id] ?? "");
  }
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
  profileUpdateBtn.disabled = !currentUserProfile();
  profileDeleteBtn.disabled = !currentUserProfile();
}

function loadProfile(profile: UserProfile) {
  applyConfigToUI(profile.config);
  loadedProfileID = profile.id;
  renderProfileSelect();
}

profileSelectEl.addEventListener("change", () => {
  const id = profileSelectEl.value;
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
  log(`Saved profile "${saved.name}".`);
});

profileUpdateBtn.addEventListener("click", () => {
  const profile = currentUserProfile();
  if (!profile) return;
  profileStore.updateProfile(profile.id, getCurrentConfig());
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
  applyBtn.closest(".apply-row")?.classList.add("unstuck");
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
