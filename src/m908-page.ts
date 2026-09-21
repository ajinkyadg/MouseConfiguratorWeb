// Wires the M908 configurator page (m908.html) to the M908 protocol
// modules. UNVERIFIED AGAINST REAL HARDWARE — see docs/protocol-notes/m908.md.
import {
  closeDevice,
  findM908ConfigDevice,
  openDevice,
  requestM908,
  sendM908Row,
  sendM908Rows,
} from "./core/m908-transport";
import {
  buildM908ProfileSelectRows,
  buildM908SettingsRows,
  M908_KNOWN_DPI_VALUES,
  m908DpiSupported,
  type M908LightMode,
  type M908ProfileSettings,
} from "./profiles/m908";
import { M908_BUTTON_NAMES, m908ActionSupported, type M908ButtonName } from "./profiles/m908-buttons";
import { M908_BUILT_IN_PRESETS, M908_NEUTRAL_PROFILE } from "./profiles/m908-presets";
import { isWebHidAvailable, WEBHID_UNAVAILABLE_MESSAGE } from "./core/platform";

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
const buttonRowsEl = document.querySelector<HTMLDivElement>("#button-rows")!;
const showActionReferenceBtn = document.querySelector<HTMLButtonElement>("#show-action-reference")!;
const actionReferenceEl = document.querySelector<HTMLDivElement>("#action-reference")!;

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
let profile: M908ProfileSettings = structuredClone(M908_NEUTRAL_PROFILE);

function setConnected(connected: boolean) {
  connectBtn.disabled = connected;
  applyBtn.disabled = !connected;
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
    btn.textContent = `${hz} Hz`;
    btn.classList.toggle("active", profile.reportRateHz === hz);
    btn.addEventListener("click", () => {
      profile.reportRateHz = hz;
      renderReportRateButtons();
    });
    reportRateButtonsEl.append(btn);
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
    enabledCheckbox.addEventListener("change", () => {
      profile.dpiEnabled[i] = enabledCheckbox.checked;
    });

    const select = document.createElement("select");
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
    });

    row.append(label, enabledCheckbox, select);
    dpiRowsEl.append(row);
  }
}

function renderButtonRows() {
  buttonRowsEl.replaceChildren();
  for (const name of M908_BUTTON_NAMES) {
    const row = document.createElement("div");
    row.className = "button-row";

    const label = document.createElement("label");
    label.textContent = name.replace(/^button_/, "").replace(/_/g, " ");

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "e.g. ctrl+c, fire:a:5:10, macro3";
    input.value = profile.buttonActions[name] ?? "";
    input.style.flex = "1";

    const validity = document.createElement("span");
    validity.className = "current-value";

    function updateValidity() {
      const value = input.value.trim();
      if (!value) {
        validity.textContent = "(unchanged)";
        validity.style.color = "var(--text-secondary)";
      } else if (m908ActionSupported(value)) {
        validity.textContent = "✓ valid";
        validity.style.color = "#6fe07a";
      } else {
        validity.textContent = "✗ unrecognized";
        validity.style.color = "#ff6b6b";
      }
    }
    updateValidity();

    input.addEventListener("input", () => {
      const value = input.value.trim();
      if (value) profile.buttonActions[name as M908ButtonName] = value;
      else delete profile.buttonActions[name as M908ButtonName];
      updateValidity();
    });

    row.append(label, input, validity);
    buttonRowsEl.append(row);
  }
}

function renderLedControls() {
  ledModeEl.value = profile.lightMode;
  const [r, g, b] = profile.color;
  ledColorEl.value = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  ledBrightnessEl.value = String(profile.brightness);
  ledSpeedEl.value = String(profile.speed);
}

function renderAll() {
  renderDpiRows();
  renderLedControls();
  renderReportRateButtons();
  scrollSpeedEl.value = String(profile.scrollSpeed);
  renderButtonRows();
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
  renderAll();
  log(preset ? `Loaded preset "${preset.name}".` : "Reset to a neutral profile.");
});

ledModeEl.addEventListener("change", () => {
  profile.lightMode = ledModeEl.value as M908LightMode;
});
ledColorEl.addEventListener("input", () => {
  const hex = ledColorEl.value.replace("#", "");
  profile.color = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
});
ledBrightnessEl.addEventListener("input", () => {
  profile.brightness = Number(ledBrightnessEl.value);
});
ledSpeedEl.addEventListener("input", () => {
  profile.speed = Number(ledSpeedEl.value);
});
scrollSpeedEl.addEventListener("input", () => {
  profile.scrollSpeed = Math.max(0, Math.min(255, Number(scrollSpeedEl.value) || 0));
});

showActionReferenceBtn.addEventListener("click", () => {
  const isOpen = actionReferenceEl.classList.toggle("open");
  actionReferenceEl.textContent = isOpen ? buildActionReferenceText() : "";
});

// --- Connect ---

connectBtn.addEventListener("click", async () => {
  try {
    const devices = await requestM908();
    const configDevice = findM908ConfigDevice(devices);
    if (!configDevice) {
      log("Connect failed: none of the granted collections expose the config feature report.");
      return;
    }
    await closeDevice(device);
    await openDevice(configDevice);
    device = configDevice;
    setConnected(true);
    statusEl.textContent = `Connected: ${configDevice.productName || "M908"}`;
    statusEl.classList.add("connected");
    log("Connected.");
  } catch (err) {
    log(`Connect failed: ${err instanceof Error ? err.message : String(err)}`);
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

applyBtn.addEventListener("click", async () => {
  if (!device) return;

  const profiles = [profile, M908_NEUTRAL_PROFILE, M908_NEUTRAL_PROFILE, M908_NEUTRAL_PROFILE, M908_NEUTRAL_PROFILE] as const;
  const results: boolean[] = [];

  results.push(
    await applySection("Profile select", async () => {
      const rows = buildM908ProfileSelectRows(0);
      await sendM908Rows(device!, rows);
    })
  );

  results.push(
    await applySection("Settings", async () => {
      const { settings1, settings2, settings3 } = buildM908SettingsRows(
        profiles as unknown as Parameters<typeof buildM908SettingsRows>[0]
      );
      await sendM908Rows(device!, settings1);
      await sendM908Row(device!, settings2);
      await sendM908Rows(device!, settings3);
    })
  );

  const okCount = results.filter(Boolean).length;
  log(`Apply Configuration: ${okCount}/${results.length} sections ok.`);
});

// --- Init ---

renderPresetOptions();
renderLedModeOptions();
renderAll();

if (!isWebHidAvailable()) {
  statusEl.textContent = "This browser doesn't support WebHID — open this page in Chrome or Edge.";
  statusEl.classList.remove("connected");
  connectBtn.disabled = true;
  log(WEBHID_UNAVAILABLE_MESSAGE);
}

