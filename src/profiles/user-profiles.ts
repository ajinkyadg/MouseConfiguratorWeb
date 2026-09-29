// Profile model — a named, JSON-serializable snapshot of the full working
// configuration (polling/DPI/LED/buttons). Mirrors the native macOS app's
// MouseProfile/PersistedProfiles/ProfileExportFile shapes field-for-field
// (see RedragonM913Configurator/Sources/M913Configurator/Profile.swift) so
// a profile exported from one is structurally the same shape as the
// other's, even though each app's own field currently isn't cross-loaded.
import { DEFAULT_DPI_COLORS, type DpiColors, type LedMode } from "./m913";

export type DpiColorsHex = [string, string, string, string, string];

export interface MouseWebConfig {
  pollingRateHz: number;
  dpi: [number, number, number, number, number];
  dpiEnabled: [boolean, boolean, boolean, boolean, boolean];
  // Per-stage DPI indicator colors, RRGGBB with no '#'. Optional: profiles
  // saved/exported before this existed don't have it and load with
  // DEFAULT_DPI_COLORS_HEX (see dpiColorsHexOf / normalizeConfig).
  dpiColorsHex?: DpiColorsHex;
  ledMode: LedMode;
  ledColorHex: string; // no leading '#', matching the native app's convention
  ledBrightness: number;
  ledSpeed: number;
  buttonActions: Record<string, string>;
}

export function rgbToHex(rgb: number): string {
  return (rgb & 0xffffff).toString(16).padStart(6, "0");
}

export const DEFAULT_DPI_COLORS_HEX: Readonly<DpiColorsHex> = DEFAULT_DPI_COLORS.map(rgbToHex) as DpiColorsHex;

const HEX_COLOR = /^[0-9a-f]{6}$/i;

/// The config's per-stage colors, with each missing or malformed entry
/// replaced by its default — never throws on old or hand-edited profiles.
export function dpiColorsHexOf(config: Pick<MouseWebConfig, "dpiColorsHex">): DpiColorsHex {
  const saved: unknown = config.dpiColorsHex;
  const list = Array.isArray(saved) ? saved : [];
  return DEFAULT_DPI_COLORS_HEX.map((fallback, i) => {
    const v = list[i];
    if (typeof v !== "string") return fallback;
    const hex = v.replace(/^#/, "");
    return HEX_COLOR.test(hex) ? hex.toLowerCase() : fallback;
  }) as DpiColorsHex;
}

export function dpiColorsFromHex(hex: Readonly<DpiColorsHex>): DpiColors {
  return hex.map((h) => parseInt(h, 16)) as DpiColors;
}

/// Fills in fields added after a profile may have been saved, so every
/// loaded/imported config has the current shape.
export function normalizeConfig(config: MouseWebConfig): MouseWebConfig {
  return { ...config, dpiColorsHex: dpiColorsHexOf(config) };
}

export function defaultConfig(): MouseWebConfig {
  return {
    pollingRateHz: 1000,
    dpi: [400, 800, 1600, 3200, 6400],
    dpiEnabled: [true, true, true, true, true],
    dpiColorsHex: [...DEFAULT_DPI_COLORS_HEX],
    ledMode: "steady",
    ledColorHex: "0000ff",
    ledBrightness: 255,
    ledSpeed: 3,
    buttonActions: {},
  };
}

export interface UserProfile {
  id: string;
  name: string;
  config: MouseWebConfig;
}

/// Disambiguates `base` against `existing` names by appending " 2", " 3",
/// etc. until it's unique.
export function uniqueProfileName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let suffix = 2;
  while (existing.includes(`${base} ${suffix}`)) suffix++;
  return `${base} ${suffix}`;
}

export interface PersistedProfiles {
  schemaVersion: number;
  profiles: UserProfile[];
  selectedProfileID: string | null;
}

export interface ProfileExportFile {
  schemaVersion: number;
  exportedAt: string;
  profile: UserProfile;
}

// Built-in presets. The three Office Essentials presets lead because the
// shortcuts a mouse should send are OS-specific — Cmd vs Ctrl, Spotlight vs
// Windows Search vs the GNOME overview — so one "default" mapping is wrong
// for two thirds of visitors. main.ts picks the one matching the visitor's
// OS on first load; all of them stay selectable, since people configure a
// mouse for a machine they aren't sitting at.
//
// Slot assignment follows the thumb-reachability model in
// docs/professional-presets.md: the inner columns (side4/5/7/8) are where
// the thumb rests, so the highest-frequency harmless pairs live there, while
// anything whose misfire is annoying sits further out.
export const BUILT_IN_PRESETS: UserProfile[] = [
  {
    id: "preset-office-macos",
    name: "Productivity — macOS",
    config: {
      ...defaultConfig(),
      buttonActions: {
        side4: "super+c", // Copy
        side5: "super+v", // Paste
        side7: "ctrl+tab", // Next tab
        side8: "ctrl+shift+tab", // Previous tab
        side1: "super+z", // Undo
        side2: "super+w", // Close tab/window
        side6: "super+space", // Spotlight
        side9: "super+tab", // Switch application
        side3: "super+shift+z", // Redo
        side10: "super+shift+t", // Reopen closed tab — the antidote to side2
        side11: "super+shift+4", // Screenshot a region
        side12: "ctrl+arrow_up", // Mission Control
        fire: "enter",
      },
    },
  },
  {
    id: "preset-office-windows",
    name: "Productivity — Windows",
    config: {
      ...defaultConfig(),
      buttonActions: {
        side4: "ctrl+c",
        side5: "ctrl+v",
        side7: "ctrl+tab",
        side8: "ctrl+shift+tab",
        side1: "ctrl+z",
        side2: "ctrl+w",
        side6: "super+s", // Windows Search
        side9: "alt+tab", // Switch window
        side3: "ctrl+y", // Redo (Office/Explorer convention)
        side10: "ctrl+shift+t",
        side11: "super+shift+s", // Snipping Tool region capture
        side12: "super+tab", // Task View
        fire: "enter",
      },
    },
  },
  {
    id: "preset-office-linux",
    name: "Productivity — Linux (GNOME)",
    config: {
      ...defaultConfig(),
      buttonActions: {
        side4: "ctrl+c",
        side5: "ctrl+v",
        side7: "ctrl+tab",
        side8: "ctrl+shift+tab",
        side1: "ctrl+z",
        side2: "ctrl+w",
        side6: "super", // Activities overview — a bare modifier tap
        side9: "alt+tab", // Switch application
        side3: "ctrl+y", // Redo
        side10: "ctrl+alt+arrow_left", // Previous workspace
        side11: "printscreen", // Screenshot
        side12: "ctrl+alt+arrow_right", // Next workspace
        fire: "enter",
      },
    },
  },
  {
    id: "preset-default",
    name: "My Setup (macOS)",
    config: {
      ...defaultConfig(),
      // The site owner's own real-world mapping, kept as a preset because
      // it's a genuinely used layout rather than an invented scheme.
      buttonActions: {
        side1: "super+c", // Copy
        side2: "super+v", // Paste
        side3: "ctrl+tab", // Next tab
        side4: "ctrl+arrow_left", // Swipe between windows, left
        side5: "ctrl+arrow_right", // Swipe between windows, right
        side6: "ctrl+shift+tab", // Previous tab
        side8: "super+space", // Spotlight search
        side10: "super+w", // Close tab (Cmd+W on macOS; Ctrl+W does nothing there)
        side12: "ctrl+arrow_up", // Mission Control
        fire: "enter",
      },
    },
  },
  {
    id: "preset-fps",
    name: "FPS / Fast Aim",
    config: {
      pollingRateHz: 1000,
      dpi: [400, 800, 1600, 3200, 6400],
      dpiEnabled: [true, true, true, true, true],
      ledMode: "steady",
      ledColorHex: "e2001a",
      ledBrightness: 255,
      ledSpeed: 3,
      buttonActions: { fire: "dpi-cycle" },
    },
  },
  {
    id: "preset-productivity",
    // Renamed from "Productivity / Low DPI" so it doesn't read as a sibling
    // of the Productivity — <OS> button presets; this one is about sensor
    // and LED settings, not button mappings.
    name: "Low DPI / Precision",
    config: {
      pollingRateHz: 125,
      dpi: [400, 800, 1200, 1600, 1600],
      dpiEnabled: [true, true, true, false, false],
      ledMode: "off",
      ledColorHex: "0000ff",
      ledBrightness: 128,
      ledSpeed: 3,
      buttonActions: { fire: "super+space" },
    },
  },
  {
    id: "preset-rgb",
    name: "RGB Showcase",
    config: {
      pollingRateHz: 1000,
      dpi: [800, 1600, 3200, 6400, 16000],
      dpiEnabled: [true, true, true, true, true],
      ledMode: "rainbow",
      ledColorHex: "e2001a",
      ledBrightness: 255,
      ledSpeed: 5,
      buttonActions: {},
    },
  },
];
