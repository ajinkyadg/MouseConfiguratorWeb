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

// Same four presets as the native app (RedragonM913Configurator's
// BuiltInPresets.all), so switching between the two products feels
// consistent. Not persisted, not editable in place.
export const BUILT_IN_PRESETS: UserProfile[] = [
  {
    id: "preset-default",
    name: "Default",
    config: {
      ...defaultConfig(),
      // The user's own real-world mapping (same as their "My Setup"
      // profile) — genuinely useful general-purpose bindings rather than
      // an invented generic scheme.
      buttonActions: {
        side1: "super+c", // Copy
        side2: "super+v", // Paste
        side3: "ctrl+tab", // Next tab
        side4: "ctrl+arrow_left", // Swipe between windows, left
        side5: "ctrl+arrow_right", // Swipe between windows, right
        side6: "ctrl+shift+tab", // Previous tab
        side8: "super+space", // Spotlight search
        side10: "ctrl+w", // Close tab
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
    name: "Productivity / Low DPI",
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
