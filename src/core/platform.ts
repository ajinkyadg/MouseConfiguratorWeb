// Platform detection, specifically for the one case where a correct,
// well-formed config write cannot succeed no matter what the page does.
//
// Background — confirmed against real hardware, 2026-09-21:
//
// The M913's config channel (feature report 0x08, vendor usage page
// 0xFF02) is declared on the same physical HID interface as the mouse's
// Keyboard top-level collection. Chrome correctly filters the protected
// Keyboard/System Control collections out of what this page can see, and
// correctly exposes the vendor collection carrying report 0x08 — the page
// gets a valid HIDDevice and open() succeeds.
//
// But macOS gates report transfers on any HID interface carrying keyboard
// usages, and as of macOS 26.6.2 that gate rejects unprivileged processes.
// Verified with a native IOKit probe outside the browser entirely:
//
//   unprivileged: IOHIDDeviceSetReport(feature, 0x08) -> kIOReturnNotPermitted
//   as root:      IOHIDDeviceSetReport(feature, 0x08) -> success
//
// Chrome runs unprivileged, so every sendFeatureReport() fails with
// "Failed to write the feature report." Nothing in JavaScript can cross a
// kernel privilege boundary — this is not a bug in this page, not a
// permission the user can grant (Input Monitoring does not help), and not
// something a different browser, USB port, or reboot changes.
//
// The same writes were confirmed working on macOS 26.5.2 on 2026-08-29,
// five days before 26.6.2 shipped, so this is version-specific: older
// macOS must keep working and must not be blocked or warned about.

export const MACOS_WRITE_BLOCK_EXPLANATION =
  "macOS 26.6.2 and later block browsers from writing to this mouse. The M913's " +
  "config channel shares a HID interface with its keyboard collection, and macOS " +
  "now restricts writes on those interfaces to privileged processes. Chrome isn't " +
  "one, so the write is refused by the kernel before it reaches the mouse. This " +
  "isn't a permission you can grant — Input Monitoring doesn't affect it, and " +
  "neither does changing browser, USB port, or restarting. Use the native macOS " +
  "app instead, which talks to the mouse over USB directly. Windows and Linux are " +
  "unaffected.";

export function isMacOS(): boolean {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (uaData?.platform) return uaData.platform === "macOS";
  return /Mac/i.test(navigator.platform || navigator.userAgent);
}

// True only for macOS versions known to block the write. Returns false when
// the version can't be determined, so an unknown platform degrades to
// "let the user try" rather than blocking something that might work.
//
// navigator.platform and the UA string are useless here: Chrome freezes the
// macOS version in both, reporting "10.15.7" forever. The real version is
// only available through the User-Agent Client Hints high-entropy API,
// which is Chromium-only — hence the guarded access and the false default.
export async function macOSBlocksHidWrites(): Promise<boolean> {
  if (!isMacOS()) return false;

  const uaData = (navigator as Navigator & {
    userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ platformVersion?: string }> };
  }).userAgentData;

  if (!uaData?.getHighEntropyValues) return false;

  try {
    const { platformVersion } = await uaData.getHighEntropyValues(["platformVersion"]);
    if (!platformVersion) return false;
    const [major = 0, minor = 0] = platformVersion.split(".").map(Number);
    if (!Number.isFinite(major) || !Number.isFinite(minor)) return false;
    return major > 26 || (major === 26 && minor >= 6);
  } catch {
    return false;
  }
}

// Whether a thrown error is the kernel refusing the write, rather than a
// malformed packet or a disconnected device. Chrome surfaces the refusal
// as a plain DOMException with this message and no error code, so matching
// on the text is the only signal available.
export function isWriteRefusedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /failed to (write|send) the (feature )?report/i.test(message);
}

// --- WebHID availability ------------------------------------------------

// Safari has never implemented WebHID, and Firefox has declined to. In
// those browsers navigator.hid is simply undefined, so the first thing
// Connect touched was a property of undefined — surfacing to the user as
// "undefined is not an object (evaluating 'navigator.hid.requestDevice')",
// a JavaScriptCore TypeError that says nothing about the actual problem
// or the fix. This is a browser-support gap, entirely separate from the
// macOS kernel gate above: it happens on every OS, for every device.

export const WEBHID_UNAVAILABLE_MESSAGE =
  "This browser doesn't support WebHID, the API used to talk to the mouse. " +
  "Safari and Firefox don't implement it. Open this page in Chrome, Edge, or " +
  "another Chromium-based browser.";

export function isWebHidAvailable(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator && navigator.hid != null;
}
