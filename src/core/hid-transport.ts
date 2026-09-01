// Thin wrapper over navigator.hid. Knows nothing about the M913's specific
// commands (that's profiles/m913.ts) — just how to find/open a device, dump
// its report descriptor, and move 17-byte packets in and out.

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

export async function requestM913(): Promise<HIDDevice> {
  const devices = await navigator.hid.requestDevice({
    filters: [
      { vendorId: M913_VENDOR_IDS.areson },
      { vendorId: M913_VENDOR_IDS.compx },
    ],
  });
  if (devices.length === 0) {
    throw new Error("No device selected.");
  }
  return devices[0];
}

export async function openDevice(device: HIDDevice): Promise<void> {
  if (!device.opened) {
    await device.open();
  }
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
