import {
  requestM913,
  openDevice,
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

let device: HIDDevice | null = null;
let hardware: HardwareRevision = "unknown";
let pollingRateHz = 1000;
const buttonActions: Record<string, string> = {};

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
    device = await requestM913();
    await openDevice(device);
    hardware = detectHardware(device);
    const wired = isWiredConnection(device);
    log(`Connected. Hardware revision detected: ${hardware} (${wired ? "wired" : "wireless receiver"})`);
    log(describeCollections(device));
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

for (const hz of [125, 250, 500, 1000]) {
  const btn = document.createElement("button");
  btn.textContent = `${hz} Hz`;
  if (hz === pollingRateHz) btn.classList.add("active");
  btn.addEventListener("click", () => {
    pollingRateHz = hz;
    for (const b of pollButtonsEl.querySelectorAll("button")) b.classList.remove("active");
    btn.classList.add("active");
  });
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
      <label><input type="checkbox" data-mod="alt" /> Alt</label>
      <label><input type="checkbox" data-mod="super" /> ⌘/Super</label>
      <input type="text" placeholder="key, e.g. c" class="combo-key" />
      <button type="button" class="combo-apply">Use</button>
    `;

    const customWrap = document.createElement("div");
    customWrap.className = "custom-wrap";
    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.placeholder = "e.g. ctrl+alt+super+d";
    customWrap.appendChild(customInput);

    function setCurrent(value: string) {
      buttonActions[slot.id] = value;
      currentValue.textContent = value ? displayLabel(value) ?? value : "Unchanged";
    }

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

    comboBuilder.querySelector(".combo-apply")!.addEventListener("click", () => {
      const mods: string[] = [];
      comboBuilder.querySelectorAll<HTMLInputElement>("input[data-mod]").forEach((el) => {
        if (el.checked) mods.push(el.dataset.mod!);
      });
      const key = (comboBuilder.querySelector(".combo-key") as HTMLInputElement).value.trim().toLowerCase();
      const action = [...mods, key].filter(Boolean).join("+");
      if (!action) return;
      const tokens = actionComboTokens(action);
      if (tokens > MAX_COMBO_TOKENS) {
        log(`Combo "${action}" uses ${tokens} modifiers+keys — hardware allows at most ${MAX_COMBO_TOKENS}.`);
        return;
      }
      setCurrent(action);
      comboBuilder.classList.remove("open");
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
