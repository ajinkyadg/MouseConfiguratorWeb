import {
  requestM913,
  openDevice,
  detectHardware,
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
  type DpiSettings,
  type LedMode,
} from "./profiles/m913";

const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const logEl = document.querySelector<HTMLDivElement>("#log")!;
const connectBtn = document.querySelector<HTMLButtonElement>("#connect")!;
const pollButtons = document.querySelectorAll<HTMLButtonElement>(".poll");
const dpiRowsEl = document.querySelector<HTMLDivElement>("#dpi-rows")!;
const applyDpiBtn = document.querySelector<HTMLButtonElement>("#apply-dpi")!;
const ledModeEl = document.querySelector<HTMLSelectElement>("#led-mode")!;
const ledColorEl = document.querySelector<HTMLInputElement>("#led-color")!;
const ledBrightnessEl = document.querySelector<HTMLInputElement>("#led-brightness")!;
const ledSpeedEl = document.querySelector<HTMLInputElement>("#led-speed")!;
const applyLedBtn = document.querySelector<HTMLButtonElement>("#apply-led")!;

let device: HIDDevice | null = null;
let hardware: HardwareRevision = "unknown";

function log(msg: string) {
  const time = new Date().toLocaleTimeString();
  logEl.textContent = `[${time}] ${msg}\n${logEl.textContent}`;
}

function setConnected(connected: boolean) {
  connectBtn.disabled = connected;
  pollButtons.forEach((b) => (b.disabled = !connected));
  applyDpiBtn.disabled = !connected;
  applyLedBtn.disabled = !connected;
}

async function sendAndLog(label: string, packet: Uint8Array) {
  if (!device) return;
  log(`→ ${label}: ${toHex(packet)}`);
  await sendConfigPacket(device, hardware, packet);
  try {
    const resp = await waitForResponse(device, 800);
    log(`← response: ${toHex(resp)}`);
  } catch {
    log(`  (no response within 800ms — device may not ack this command, or the ack format differs from what's expected)`);
  }
}

connectBtn.addEventListener("click", async () => {
  try {
    device = await requestM913();
    await openDevice(device);
    hardware = detectHardware(device);
    statusEl.textContent = `Connected: ${device.productName} (${hardware} hardware)`;
    log(`Connected. Hardware revision detected: ${hardware}`);
    log(describeCollections(device));
    setConnected(true);
  } catch (err) {
    log(`Connect failed: ${(err as Error).message}`);
  }
});

pollButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const hz = Number(btn.dataset.hz);
    const packet = buildPollingRatePacket(hz);
    await sendAndLog(`polling rate ${hz}Hz`, packet);
  });
});

// Five DPI slot rows: value input + enabled checkbox.
const dpiInputs: HTMLInputElement[] = [];
const dpiEnabled: HTMLInputElement[] = [];
for (let i = 0; i < 5; i++) {
  const row = document.createElement("div");
  row.className = "dpi-row";
  row.innerHTML = `
    <label>Slot ${i + 1}</label>
    <input type="checkbox" class="dpi-enabled" checked />
    <input type="number" class="dpi-value" step="50" placeholder="e.g. 1600" />
  `;
  dpiRowsEl.appendChild(row);
  dpiEnabled.push(row.querySelector(".dpi-enabled")!);
  dpiInputs.push(row.querySelector(".dpi-value")!);
}

applyDpiBtn.addEventListener("click", async () => {
  const settings: DpiSettings = {
    values: dpiInputs.map((el) => Number(el.value) || 0) as DpiSettings["values"],
    enabled: dpiEnabled.map((el) => el.checked) as DpiSettings["enabled"],
  };
  const packets = hardware === "compx" ? buildCompxDpiPackets(settings) : buildAresonDpiPackets(settings);
  for (const [i, packet] of packets.entries()) {
    await sendAndLog(`DPI packet ${i + 1}/${packets.length}`, packet);
  }
});

applyLedBtn.addEventListener("click", async () => {
  const mode = ledModeEl.value as LedMode;
  const color = parseInt(ledColorEl.value.slice(1), 16);
  const brightness = Number(ledBrightnessEl.value);
  const speed = Number(ledSpeedEl.value);
  const packets = buildLedPackets(mode, color, brightness, speed);
  for (const [i, packet] of packets.entries()) {
    await sendAndLog(`LED packet ${i + 1}/${packets.length}`, packet);
  }
});
