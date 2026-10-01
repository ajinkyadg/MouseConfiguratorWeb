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
// usages, and on some macOS 26.6 setups that gate rejects unprivileged processes.
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
// The same writes were confirmed working on macOS 26.5.2 on 2026-08-29.
//
// Update 2026-10-01: on macOS 26.6.2 (build 25G83) the owner applied a
// config from a normally launched Chrome with no sudo, so the gate is not
// universal on 26.6.2 — it depends on something we haven't pinned down. The
// page therefore never warns up front; it explains the workaround only after
// an Apply is actually refused (isWriteRefusedError on macOS).

export const MACOS_WRITE_BLOCK_EXPLANATION =
  "macOS refused this write. On some macOS 26.6 setups, browsers can't write to this mouse: the M913's " +
  "config channel shares a HID interface with its keyboard collection, and macOS " +
  "can restrict writes on those interfaces to privileged processes. Chrome isn't " +
  "one, so the write is refused by the kernel before it reaches the mouse. Input " +
  "Monitoring, changing USB port, or restarting won't help. Workaround: launch " +
  "Chrome with sudo (see \"Apply refused on macOS?\" below the settings on this page " +
  "for the exact command) and apply from that window — confirmed working. Windows " +
  "and Linux are unaffected.";

export function isMacOS(): boolean {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (uaData?.platform) return uaData.platform === "macOS";
  return /Mac/i.test(navigator.platform || navigator.userAgent);
}

export type DesktopOS = "macos" | "windows" | "linux" | "unknown";

// Which desktop the visitor is on, for picking the productivity preset whose
// shortcuts actually exist there (Cmd vs Ctrl, Spotlight vs Windows Search).
// Only ever used to choose a default the user can change, so "unknown" is
// harmless — never gate behaviour on it.
export function detectDesktopOS(): DesktopOS {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform || navigator.platform || navigator.userAgent;
  if (/mac/i.test(platform)) return "macos";
  // iPhone/iPad can't run WebHID, but someone browsing on one most likely
  // uses a Mac, so show them the macOS preset rather than Windows.
  if (/^ios$|iphone|ipad|ipod/i.test(platform)) return "macos";
  if (/win/i.test(platform)) return "windows";
  // Android reports "Linux" in the legacy UA string; it can't run WebHID, but
  // the preset shown on a phone should still not claim to be a desktop one.
  if (/android/i.test(navigator.userAgent)) return "unknown";
  if (/linux|x11|cros/i.test(platform)) return "linux";
  return "unknown";
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
