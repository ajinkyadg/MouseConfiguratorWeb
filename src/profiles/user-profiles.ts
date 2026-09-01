// Profile model — a named, JSON-serializable snapshot of the full working
// configuration (polling/DPI/LED/buttons). Mirrors the native macOS app's
// MouseProfile/PersistedProfiles/ProfileExportFile shapes field-for-field
// (see RedragonM913Configurator/Sources/M913Configurator/Profile.swift) so
// a profile exported from one is structurally the same shape as the
// other's, even though each app's own field currently isn't cross-loaded.
import type { LedMode } from "./m913";

export interface MouseWebConfig {
  pollingRateHz: number;
  dpi: [number, number, number, number, number];
  dpiEnabled: [boolean, boolean, boolean, boolean, boolean];
  ledMode: LedMode;
  ledColorHex: string; // no leading '#', matching the native app's convention
  ledBrightness: number;
  ledSpeed: number;
  buttonActions: Record<string, string>;
}

export function defaultConfig(): MouseWebConfig {
  return {
    pollingRateHz: 1000,
    dpi: [400, 800, 1600, 3200, 6400],
    dpiEnabled: [true, true, true, true, true],
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
        side3: "super+tab", // Tab right (app switcher forward)
        side4: "ctrl+arrow_right", // Swipe between windows, right
        side5: "ctrl+arrow_left", // Swipe between windows, left
        side6: "super+shift+tab", // Tab left (app switcher backward)
        side10: "super+shift+4", // Screenshot (selection)
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
