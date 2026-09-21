// Thin wrapper over navigator.hid. Knows nothing about the M913's specific
// commands (that's profiles/m913.ts) — just how to find/open a device, dump
// its report descriptor, and move 17-byte packets in and out.

import { isWebHidAvailable, WEBHID_UNAVAILABLE_MESSAGE } from "./platform";

export type HardwareRevision = "areson" | "compx" | "unknown";

export const M913_VENDOR_IDS = {
  areson: 0x25a7,
  compx: 0x3554,
} as const;

// Confirmed against real hardware, 2026-08-31: the 2.4G wireless receiver
// (aresonWireless PID) only relays standard mouse input reports — writing
// the config feature report over it fails outright. Only the wired
// connection (aresonWired PID) accepts config writes. Compx PIDs are the
// documented equivalents from usb.h; not yet independently confirmed.
export const M913_PRODUCT_IDS = {
  aresonWireless: 0xfa07,
  aresonWired: 0xfa08,
  compxWireless: 0xf55d,
  compxWired: 0xf55e,
} as const;

// --- Is this actually an M913? --------------------------------------------
//
// Neither vendor ID is exclusive to the M913: 0x3554 (Compx) is an OEM ID,
// and its wired PID 0xf55e is also reported by the Redragon M917 GB Pro
// (libratbag/libratbag#1854) and the K1NG M916 PRO
// (skullboypl/universal-mouse-drivers#1); Areson's 0x25a7:fa07/fa08 are
// also used by the UtechSmart Venus Pro. Sending the M913's 16-button
// layout to one of those could remap or scramble its buttons. VID/PID alone
// therefore can't prove it's an M913 — only the product name can, and a
// device whose name doesn't say "M913" needs the user to confirm.

export type M913Identification =
  // Name says M913 on a known vendor — safe to configure.
  | { kind: "m913"; revision: Exclude<HardwareRevision, "unknown">; reason: string }
  // Known vendor, but the name doesn't say M913 (generic or empty) —
  // plausibly an M913, but needs explicit user confirmation.
  | { kind: "unconfirmed"; revision: HardwareRevision; reason: string }
  // Name names a different model (e.g. M917, K1NG M916) or the vendor isn't
  // one the M913 uses — very likely not an M913.
  | { kind: "other-model"; revision: HardwareRevision; reason: string };

export interface HidIdentity {
  vendorId: number;
  productId: number;
  productName: string;
}

const hex4 = (n: number) => n.toString(16).padStart(4, "0");

export function identifyM913({ vendorId, productId, productName }: HidIdentity): M913Identification {
  const revision: HardwareRevision =
    vendorId === M913_VENDOR_IDS.areson ? "areson" : vendorId === M913_VENDOR_IDS.compx ? "compx" : "unknown";
  const id = `${hex4(vendorId)}:${hex4(productId)}`;
  const name = (productName ?? "").trim();
  const quoted = name ? `"${name}"` : "(no product name)";

  if (revision === "unknown") {
    return { kind: "other-model", revision, reason: `${quoted} (${id}) isn't from a vendor the M913 uses.` };
  }
  const knownPid = (Object.values(M913_PRODUCT_IDS) as number[]).includes(productId);

  // "M913", "M-913", "M 913" — but not e.g. "M9130".
  if (/M[\s-]?913(?!\d)/i.test(name)) {
    return knownPid
      ? { kind: "m913", revision, reason: `${quoted} (${id}) identifies as an M913.` }
      : { kind: "unconfirmed", revision, reason: `${quoted} says M913, but its product ID ${id} isn't one of the known M913 IDs.` };
  }
  // Another model number in the name: M9xx / M6xx / K1NG etc.
  const otherModel = name.match(/\bM[\s-]?\d{3}\b|\bK1NG\b|Venus/i);
  if (otherModel) {
    return { kind: "other-model", revision, reason: `${quoted} (${id}) looks like a different mouse (${otherModel[0]}), not an M913.` };
  }
  return {
    kind: "unconfirmed",
    revision,
    reason: `${quoted} (${id}) doesn't identify as an M913 — the same vendor/product IDs are used by other mice, e.g. the Redragon M917 and K1NG M916.`,
  };
}

export function detectHardware(device: HIDDevice): HardwareRevision {
  if (device.vendorId === M913_VENDOR_IDS.areson) return "areson";
  if (device.vendorId === M913_VENDOR_IDS.compx) return "compx";
  return "unknown";
}

// Whether this HIDDevice is the wired connection (required for sending
// config commands) rather than the wireless receiver (input-only, as far
// as WebHID is concerned).
export function isWiredConnection(device: HIDDevice): boolean {
  return device.productId === M913_PRODUCT_IDS.aresonWired || device.productId === M913_PRODUCT_IDS.compxWired;
}

// A physical M913 exposes several top-level HID collections at once (the
// standard mouse pointer interface, plus at least one vendor-specific one
// carrying the config feature report) — and per the WebHID spec, one
// HIDDevice represents a single top-level collection, not the whole
// physical device. Picking the device in Chrome's chooser grants access to
// ALL of that physical device's collections in one grant, so a single
// requestDevice() call returns one HIDDevice per collection here.
//
// Confirmed against real hardware, 2026-09-01: which collection lands at
// index 0 varies connection to connection — sometimes the plain mouse
// interface (no feature reports at all), sometimes the vendor one (feature
// reports 6 and 8). Blindly using devices[0] intermittently grabbed the
// wrong one and produced "Failed to write the feature report" — not a
// device problem, a "trusted array order that isn't stable" bug.
export async function requestM913(): Promise<HIDDevice[]> {
  if (!isWebHidAvailable()) {
    throw new Error(WEBHID_UNAVAILABLE_MESSAGE);
  }
  // Narrowed to the four documented M913 PIDs (docs/protocol-notes/m913.md,
  // "Device identification") so unrelated Areson/Compx devices don't show
  // up in the chooser. This does NOT exclude every non-M913 — 3554:f55e is
  // shared with other models — so identifyM913() still gates writes.
  const devices = await navigator.hid.requestDevice({
    filters: [
      { vendorId: M913_VENDOR_IDS.areson, productId: M913_PRODUCT_IDS.aresonWireless },
      { vendorId: M913_VENDOR_IDS.areson, productId: M913_PRODUCT_IDS.aresonWired },
      { vendorId: M913_VENDOR_IDS.compx, productId: M913_PRODUCT_IDS.compxWireless },
      { vendorId: M913_VENDOR_IDS.compx, productId: M913_PRODUCT_IDS.compxWired },
    ],
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

// Closes a previously-opened device, swallowing any error — used before
// reconnecting so a stale handle from an earlier connect() in the same
// page session doesn't linger. Nothing in this file called close()
// anywhere before this existed: every "Connect" click left its device
// open forever, so a long session with many reconnects (exactly what
// happens while troubleshooting) could accumulate several simultaneous
// open connections to the same physical device — a real candidate for
// "used to work, now every write fails" that a fresh page load resets
// but repeated in-page reconnects would not.
export async function closeDevice(device: HIDDevice | null): Promise<void> {
  if (!device?.opened) return;
  try {
    await device.close();
  } catch {
    // best-effort — proceeding to open a new device matters more than
    // a clean close of the old one
  }
}

// Recursively checks whether any collection on this device declares a
// report with the given id in the given category (input/output/feature).
function hasReport(device: HIDDevice, category: "input" | "output" | "feature", reportId: number): boolean {
  const key = `${category}Reports` as const;
  const search = (collections: HIDCollectionInfo[]): boolean =>
    collections.some((c) => c[key].some((r) => r.reportId === reportId) || search(c.children));
  return search(device.collections);
}

// Among all of a physical M913's collections (see requestM913()'s doc
// comment), finds the one that actually declares the config channel — a
// feature report with id 0x08 (Areson) or an output report with id 0x08
// (Compx) — by inspecting each candidate's real report descriptor rather
// than trusting picker order.
//
// Deliberately does NOT call open() on every candidate to do this:
// HIDDevice.collections is populated at grant time, before open() is ever
// called — reading it needs no connection. Confirmed against real
// hardware, 2026-09-01: an earlier version of this function opened every
// candidate just to inspect it, which reintroduced "Failed to write the
// feature report" — opening the sibling (plain mouse) collection first
// appears to claim exclusive access at the OS level and blocks the write
// on the one actually being used, even though it's nominally a different
// top-level collection. Only the caller's chosen device should ever be
// opened.
export function findConfigDevice(devices: HIDDevice[]): HIDDevice | null {
  for (const device of devices) {
    if (hasReport(device, "feature", 0x08) || hasReport(device, "output", 0x08)) {
      return device;
    }
  }
  return null;
}

// Human-readable dump of the device's real report descriptor — the
// ground truth for whether byte[0] of the 17-byte packet (0x08) is the
// WebHID report ID or part of the payload, and whether the Areson report
// is exposed as Feature vs Output. See docs/protocol-notes/m913.md,
// "Open questions."
export function describeCollections(device: HIDDevice): string {
  const lines: string[] = [];
  lines.push(`vendorId=0x${device.vendorId.toString(16)} productId=0x${device.productId.toString(16)} name="${device.productName}"`);

  // A report's actual bit-level shape lives on each of its `items`, not on
  // the report itself — one reportId commonly packs several items of
  // different widths (e.g. a few bytes of buttons plus a byte of
  // scroll delta). Total the whole report's byte length by summing every
  // item's reportSize*reportCount, in addition to listing each item.
  const describeReports = (label: string, reports: HIDReportInfo[]) => {
    if (reports.length === 0) return;
    lines.push(`  ${label}:`);
    for (const r of reports) {
      const items = r.items ?? [];
      const totalBits = items.reduce((sum, item) => sum + (item.reportSize ?? 0) * (item.reportCount ?? 0), 0);
      lines.push(`    reportId=${r.reportId ?? "(none)"} totalSize=${totalBits / 8} bytes (${items.length} item(s)):`);
      for (const item of items) {
        const bytes = item.reportSize && item.reportCount ? (item.reportSize * item.reportCount) / 8 : "?";
        lines.push(
          `      reportSize=${item.reportSize}b reportCount=${item.reportCount} (~${bytes} bytes) usages=[${(item.usages ?? []).map((u) => "0x" + u.toString(16)).join(",")}]`
        );
      }
    }
  };

  const walk = (collections: HIDCollectionInfo[], depth: number) => {
    for (const c of collections) {
      lines.push(
        `${"  ".repeat(depth)}collection usagePage=0x${c.usagePage.toString(16)} usage=0x${c.usage.toString(16)}`
      );
      describeReports("input", c.inputReports);
      describeReports("output", c.outputReports);
      describeReports("feature", c.featureReports);
      walk(c.children, depth + 1);
    }
  };
  walk(device.collections, 1);

  return lines.join("\n");
}

// Sends a 17-byte config packet as built by profiles/m913.ts. Byte[0] of
// the packet is the documented report-ID marker (0x08); this function
// treats it as the WebHID report ID and sends the remaining 16 bytes as
// the payload, per the (unverified) assumption in the protocol notes.
// If the mouse doesn't respond correctly, this split — reportId vs
// payload slice — is the first thing to try changing, guided by what
// describeCollections() shows for the real device.
export async function sendConfigPacket(
  device: HIDDevice,
  hardware: HardwareRevision,
  packet: Uint8Array
): Promise<void> {
  if (packet.length !== 17) {
    throw new Error(`Expected a 17-byte packet, got ${packet.length}`);
  }
  const reportId = packet[0];
  const payload = packet.slice(1);

  if (hardware === "compx") {
    await device.sendReport(reportId, payload);
  } else {
    await device.sendFeatureReport(reportId, payload);
  }
}

// Waits for the next inputreport event, prefixing the reportId back on
// so the returned bytes line up with the 17-byte packet layout in the
// protocol notes (byte[0] = 0x09 for device→host packets).
export function waitForResponse(device: HIDDevice, timeoutMs = 2000): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      device.removeEventListener("inputreport", onReport);
      reject(new Error("Timed out waiting for a response from the mouse."));
    }, timeoutMs);

    function onReport(ev: HIDInputReportEvent) {
      clearTimeout(timer);
      device.removeEventListener("inputreport", onReport);
      const out = new Uint8Array(ev.data.byteLength + 1);
      out[0] = ev.reportId;
      out.set(new Uint8Array(ev.data.buffer, ev.data.byteOffset, ev.data.byteLength), 1);
      resolve(out);
    }

    device.addEventListener("inputreport", onReport);
  });
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}
