// M908-specific WebHID transport. Kept separate from hid-transport.ts
// (the M913 module) rather than generalized, so nothing here can regress
// the already-working, hardware-verified M913 flow.
//
// UNVERIFIED AGAINST REAL HARDWARE — see docs/protocol-notes/m908.md.
import { isWebHidAvailable, WEBHID_UNAVAILABLE_MESSAGE } from "./platform";

import { toFeatureReportPayload } from "../profiles/m908";

export const M908_VENDOR_ID = 0x04d9;
export const M908_PRODUCT_ID = 0xfc4d;
// Only one PID is documented in the reference project — unlike the M913,
// it's not yet confirmed whether a separate wireless-receiver PID exists.

export async function requestM908(): Promise<HIDDevice[]> {
  if (!isWebHidAvailable()) {
    throw new Error(WEBHID_UNAVAILABLE_MESSAGE);
  }
  const devices = await navigator.hid.requestDevice({
    filters: [{ vendorId: M908_VENDOR_ID, productId: M908_PRODUCT_ID }],
  });
  if (devices.length === 0) {
    throw new Error("No device selected.");
  }
  return devices;
}

export async function openDevice(device: HIDDevice): Promise<void> {
  if (!device.opened) {
    await device.open();
  }
}

export async function closeDevice(device: HIDDevice | null): Promise<void> {
  if (!device?.opened) return;
  try {
    await device.close();
  } catch {
    // best-effort, same rationale as hid-transport.ts's closeDevice
  }
}

// Finds the collection declaring the M908's config channel: a feature
// report with id 2 (see m908.md's Transport section). Mirrors M913's
// findConfigDevice — deliberately does not open() every candidate first,
// for the same reason documented there (opening a sibling collection can
// block the write on the one actually in use).
function hasFeatureReport2(device: HIDDevice): boolean {
  const search = (collections: HIDCollectionInfo[]): boolean =>
    collections.some((c) => c.featureReports.some((r) => r.reportId === 2) || search(c.children));
  return search(device.collections);
}

export function findM908ConfigDevice(devices: HIDDevice[]): HIDDevice | null {
  for (const device of devices) {
    if (hasFeatureReport2(device)) return device;
  }
  return null;
}

// Sends one raw settings/profile row (16 or 64 bytes, byte 0 = report ID
// 2) as a WebHID feature report. See m908.ts's toFeatureReportPayload for
// the byte-0-stripping assumption this relies on — the single biggest
// unverified piece of this whole integration.
export async function sendM908Row(device: HIDDevice, row: number[]): Promise<void> {
  const { reportId, payload } = toFeatureReportPayload(row);
  // Cast needed purely for a TS lib-version type mismatch between plain
  // Uint8Array and the ambient webhid.d.ts's BufferSource — a Uint8Array
  // always backs a real (non-shared) ArrayBuffer at runtime here, so this
  // doesn't change behavior.
  await device.sendFeatureReport(reportId, payload as BufferSource);
}

// The official software leaves about 30 ms between packets (median of a
// captured full write); sending them back to back is untested on hardware.
export const M908_ROW_GAP_MS = 30;

export async function sendM908Rows(device: HIDDevice, rows: number[][], gapMs: number = M908_ROW_GAP_MS): Promise<void> {
  for (const row of rows) {
    await sendM908Row(device, row);
    if (gapMs > 0) await new Promise((resolve) => setTimeout(resolve, gapMs));
  }
}
