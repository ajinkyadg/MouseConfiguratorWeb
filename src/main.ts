import {
  requestM913,
  openDevice,
  findConfigDevice,
  detectHardware,
  isWiredConnection,
  describeCollections,
  sendConfigPacket,
  waitForResponse,
  toHex,
  type HardwareRevision,
} from "./core/hid-transport";
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
import { BUILT_IN_PRESETS, type MouseWebConfig, type UserProfile } from "./profiles/user-profiles";
import { ProfileStore } from "./profiles/profile-store";

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

function setConnected(connected: boolean) {
  connectBtn.disabled = connected;
  applyBtn.disabled = !connected;
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

    if (!wired) {
      statusEl.textContent = `Connected: ${device.productName} — wireless receiver detected. Plug in the USB cable to apply settings.`;
      statusEl.classList.remove("connected");
      setConnected(false);
      log("The wireless receiver only relays mouse movement/clicks — configuration commands need the wired USB connection. Plug in the cable and reconnect.");
    } else {
      statusEl.textContent = `Connected: ${device.productName} (${hardware} hardware, wired)`;
      statusEl.classList.add("connected");
      setConnected(true);
    }
  } catch (err) {
    log(`Connect failed: ${(err as Error).message}`);
  }
});

// --- Polling rate --------------------------------------------------------

function setPollingRate(hz: number) {
  pollingRateHz = hz;
  for (const b of pollButtonsEl.querySelectorAll("button")) {
    b.classList.toggle("active", Number((b as HTMLElement).dataset.hz) === hz);
  }
}

for (const hz of [125, 250, 500, 1000]) {
  const btn = document.createElement("button");
  btn.textContent = `${hz} Hz`;
  btn.dataset.hz = String(hz);
  if (hz === pollingRateHz) btn.classList.add("active");
  btn.addEventListener("click", () => setPollingRate(hz));
  pollButtonsEl.appendChild(btn);
}

// --- DPI -----------------------------------------------------------------

const dpiValueInputs: HTMLInputElement[] = [];
const dpiEnabledInputs: HTMLInputElement[] = [];

function renderDpiRows() {
  dpiRowsEl.innerHTML = "";
  dpiValueInputs.length = 0;
  dpiEnabledInputs.length = 0;

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
      <label>Slot ${i + 1}</label>
      <input type="checkbox" checked />
      <input type="number" step="${hardware === "compx" ? COMPX_DPI_STEP : 50}" placeholder="e.g. 1600" list="${datalistId}" />
    `;
    dpiRowsEl.appendChild(row);
    dpiEnabledInputs.push(row.querySelector('input[type="checkbox"]')!);
    dpiValueInputs.push(row.querySelector('input[type="number"]')!);
  }
}
renderDpiRows();

function readDpiSettings(): DpiSettings {
  return {
    values: dpiValueInputs.map((el) => Number(el.value) || 0) as DpiSettings["values"],
    enabled: dpiEnabledInputs.map((el) => el.checked) as DpiSettings["enabled"],
  };
}

function setDpiSettings(values: readonly number[], enabled: readonly boolean[]) {
  dpiValueInputs.forEach((el, i) => (el.value = values[i] ? String(values[i]) : ""));
  dpiEnabledInputs.forEach((el, i) => (el.checked = enabled[i] ?? true));
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
    currentValue.textContent = "Unchanged";

    const categorySelect = document.createElement("select");
    categorySelect.className = "category-select";
    categorySelect.innerHTML =
      `<option value="">Unchanged</option>` +
      ACTION_CATEGORIES.map((c) => `<option value="${c.name}">${c.name}</option>`).join("") +
      `<option value="__combo__">Key Combination…</option>` +
      `<option value="__custom__">Custom…</option>`;

    const actionSelect = document.createElement("select");
    actionSelect.className = "action-select";
    actionSelect.style.display = "none";

    const comboBuilder = document.createElement("div");
    comboBuilder.className = "combo-builder";
    comboBuilder.innerHTML = `
      <label><input type="checkbox" data-mod="ctrl" /> Ctrl</label>
      <label><input type="checkbox" data-mod="shift" /> Shift</label>
      <label><input type="checkbox" data-mod="alt" /> ⌥ Option/Alt</label>
      <label><input type="checkbox" data-mod="super" /> ⌘/Super</label>
      <input type="text" placeholder="key, e.g. c" class="combo-key" />
      <select class="combo-special-key">
        <option value="" selected>Special key…</option>
        ${KEY_COMBO_SPECIAL_GROUPS.map(
          (group) =>
            `<optgroup label="${group.name}">` +
            group.keys.map((k) => `<option value="${k}">${k}</option>`).join("") +
            `</optgroup>`
        ).join("")}
      </select>
      <button type="button" class="combo-apply">Use</button>
    `;

    const customWrap = document.createElement("div");
    customWrap.className = "custom-wrap";
    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.placeholder = "e.g. ctrl+alt+super+d";
    customWrap.appendChild(customInput);

    // Updates the model + visible label only — used for direct
    // interaction within this row, where the picker UI driving the change
    // is already showing the right thing.
    function setCurrent(value: string) {
      buttonActions[slot.id] = value;
      currentValue.textContent = value ? displayLabel(value) ?? value : "Unchanged";
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
        comboBuilder.classList.add("open");
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
      if (!action) return;
      const tokens = actionComboTokens(action);
      if (tokens > MAX_COMBO_TOKENS) {
        log(`Combo "${action}" uses ${tokens} modifiers+keys — hardware allows at most ${MAX_COMBO_TOKENS}.`);
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
    ledMode: ledModeEl.value as LedMode,
    ledColorHex: ledColorEl.value.slice(1),
    ledBrightness: Number(ledBrightnessEl.value),
    ledSpeed: Number(ledSpeedEl.value),
    buttonActions: Object.fromEntries(Object.entries(buttonActions).filter(([, v]) => v)),
  };
}

function applyConfigToUI(config: MouseWebConfig) {
  setPollingRate(config.pollingRateHz);
  setDpiSettings(config.dpi, config.dpiEnabled);
  ledModeEl.value = config.ledMode;
  ledColorEl.value = `#${config.ledColorHex}`;
  ledBrightnessEl.value = String(config.ledBrightness);
  ledSpeedEl.value = String(config.ledSpeed);
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
    return;
  }
  loadProfile(imported);
  log(`Imported profile "${imported.name}".`);
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
// Default preset, so the page's initial state actually matches what
// "Default" claims to be instead of whatever raw HTML happens to be
// hardcoded in index.html (e.g. a placeholder LED color no preset uses).
const restoredProfile = profileStore.selectedProfileID
  ? profileStore.profiles.find((p) => p.id === profileStore.selectedProfileID)
  : undefined;
loadProfile(restoredProfile ?? BUILT_IN_PRESETS[0]); // loadProfile() already calls renderProfileSelect()

// --- Apply ---------------------------------------------------------------

applyBtn.addEventListener("click", async () => {
  if (!device) return;
  applyBtn.disabled = true;
  try {
    await sendAndLog("polling rate", buildPollingRatePacket(pollingRateHz));

    const dpi = readDpiSettings();
    const dpiPackets = hardware === "compx" ? buildCompxDpiPackets(dpi) : buildAresonDpiPackets(dpi);
    for (const [i, packet] of dpiPackets.entries()) {
      await sendAndLog(`DPI packet ${i + 1}/${dpiPackets.length}`, packet);
    }

    const mode = ledModeEl.value as LedMode;
    const color = parseInt(ledColorEl.value.slice(1), 16);
    const brightness = Number(ledBrightnessEl.value);
    const speed = Number(ledSpeedEl.value);
    const ledPackets = buildLedPackets(mode, color, brightness, speed);
    for (const [i, packet] of ledPackets.entries()) {
      await sendAndLog(`LED packet ${i + 1}/${ledPackets.length}`, packet);
    }

    const changedButtons = Object.fromEntries(Object.entries(buttonActions).filter(([, v]) => v));
    if (Object.keys(changedButtons).length > 0) {
      const buttonPackets = buildButtonMappingPackets(changedButtons, hardware === "compx" ? "compx" : "areson");
      for (const [i, packet] of buttonPackets.entries()) {
        await sendAndLog(`Button packet ${i + 1}/${buttonPackets.length}`, packet);
      }
    }

    log("Apply Configuration: done.");
  } catch (err) {
    log(`Apply failed: ${(err as Error).message}`);
  } finally {
    applyBtn.disabled = false;
  }
});
