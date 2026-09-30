// Human names for the key combinations the button picker offers, so the UI
// can say "Copy · ⌘C" instead of "super+c". Names are per-OS because the
// same combo means different things: super+s is Save on macOS but Windows
// Search on Windows, and super+tab is the app switcher on one and Task View
// on the other.

export type ShortcutOS = "macos" | "windows" | "linux";

const MAC: Record<string, string> = {
  "super+c": "Copy",
  "super+v": "Paste",
  "super+x": "Cut",
  "super+z": "Undo",
  "super+shift+z": "Redo",
  "super+a": "Select all",
  "super+s": "Save",
  "super+f": "Find",
  "super+w": "Close tab",
  "super+q": "Quit app",
  "super+t": "New tab",
  "super+shift+t": "Reopen closed tab",
  "super+tab": "Switch app",
  "super+space": "Spotlight",
  "super+h": "Hide app",
  "super+m": "Minimise",
  "super+comma": "Settings",
  "super+shift+3": "Screenshot",
  "super+shift+4": "Screenshot region",
  "super+shift+5": "Screenshot tools",
  "ctrl+arrow_up": "Mission Control",
  "ctrl+arrow_down": "App windows",
  "ctrl+arrow_left": "Previous space",
  "ctrl+arrow_right": "Next space",
  "f11": "Show desktop",
  "f4": "Launchpad",
};

// Ctrl-based shortcuts shared by Windows and Linux desktops.
const PC: Record<string, string> = {
  "ctrl+c": "Copy",
  "ctrl+v": "Paste",
  "ctrl+x": "Cut",
  "ctrl+z": "Undo",
  "ctrl+y": "Redo",
  "ctrl+shift+z": "Redo",
  "ctrl+a": "Select all",
  "ctrl+s": "Save",
  "ctrl+f": "Find",
  "ctrl+w": "Close tab",
  "ctrl+t": "New tab",
  "ctrl+shift+t": "Reopen closed tab",
  "alt+tab": "Switch window",
  "printscreen": "Screenshot",
};

const WINDOWS: Record<string, string> = {
  ...PC,
  "super+s": "Search",
  "super+shift+s": "Screenshot region",
  "super+tab": "Task View",
  "super+e": "File Explorer",
  "super+d": "Show desktop",
  "super+l": "Lock",
};

const LINUX: Record<string, string> = {
  ...PC,
  "super": "Activities overview",
  "super+l": "Lock",
  "ctrl+alt+arrow_left": "Previous workspace",
  "ctrl+alt+arrow_right": "Next workspace",
};

// Browser tab navigation is the same everywhere.
const COMMON: Record<string, string> = {
  "ctrl+tab": "Next tab",
  "ctrl+shift+tab": "Previous tab",
  "enter": "Enter",
};

const NAMES: Record<ShortcutOS, Record<string, string>> = { macos: MAC, windows: WINDOWS, linux: LINUX };

export function shortcutName(value: string, os: ShortcutOS): string | undefined {
  const key = value.trim().toLowerCase();
  return NAMES[os][key] ?? COMMON[key];
}

const MAC_GLYPHS: Record<string, string> = { super: "⌘", shift: "⇧", ctrl: "⌃", alt: "⌥" };
const PC_MODS: Record<string, string> = { ctrl: "Ctrl", shift: "Shift", alt: "Alt" };
const KEYS: Record<string, string> = {
  arrow_up: "↑", arrow_down: "↓", arrow_left: "←", arrow_right: "→",
  space: "Space", tab: "Tab", enter: "Enter", comma: ",", printscreen: "PrtSc",
};

/// The combo as separate keycaps: ["⌘", "⇧", "Z"] on macOS,
/// ["Ctrl", "Shift", "Z"] elsewhere.
export function comboKeys(value: string, os: ShortcutOS): string[] {
  const superName = os === "windows" ? "Win" : "Super";
  return value.trim().toLowerCase().split("+").filter(Boolean).map((t) =>
    os === "macos" ? MAC_GLYPHS[t] ?? KEYS[t] ?? t.toUpperCase()
    : t === "super" ? superName : PC_MODS[t] ?? KEYS[t] ?? t.toUpperCase());
}

/// Label for a modifier toggle in the combo builder, in that OS's words:
/// a glyph plus full name on macOS (⌘ / "Command"), the key name elsewhere.
export function modifierLabel(mod: string, os: ShortcutOS): { short: string; full: string } {
  if (os === "macos") {
    const mac: Record<string, [string, string]> = { ctrl: ["⌃", "Control"], alt: ["⌥", "Option"], super: ["⌘", "Command"], shift: ["⇧", "Shift"] };
    const [short, full] = mac[mod] ?? [mod, mod];
    return { short, full };
  }
  const name = { ctrl: "Ctrl", alt: "Alt", super: os === "windows" ? "Win" : "Super", shift: "Shift" }[mod] ?? mod;
  return { short: name, full: name };
}

/// Modifier order used everywhere a combo string is built, so a recorded
/// shortcut matches the preset/name tables ("super+shift+z", "ctrl+alt+…").
export const MODIFIER_ORDER = ["ctrl", "alt", "super", "shift"] as const;

/// Renders "super+shift+z" the way the OS writes it: "⌘⇧Z" on macOS,
/// "Ctrl+Shift+Z" style elsewhere.
export function formatCombo(value: string, os: ShortcutOS): string {
  const tokens = value.trim().toLowerCase().split("+");
  const key = (t: string) => KEYS[t] ?? t.toUpperCase();
  if (os === "macos") return tokens.map((t) => MAC_GLYPHS[t] ?? key(t)).join("");
  const superName = os === "windows" ? "Win" : "Super";
  return tokens.map((t) => (t === "super" ? superName : PC_MODS[t] ?? key(t))).join("+");
}

/// "Copy · ⌘C" for a known shortcut; undefined for anything else, so callers
/// can fall back to the catalog label or the raw action string.
export function describeShortcut(value: string, os: ShortcutOS): string | undefined {
  const name = shortcutName(value, os);
  if (!name) return undefined;
  const combo = formatCombo(value, os);
  return combo === name ? name : `${name} · ${combo}`;
}
