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
      // A real starter mapping (left/right/middle/fire kept at their
      // ordinary click actions explicitly, not left "Unchanged") rather
      // than an empty buttonActions — demonstrates clicks, browser
      // navigation, DPI, and LED toggle without touching every one of
      // the 12 side buttons. The rest stay "Unchanged" (factory action).
      buttonActions: {
        left: "left",
        right: "right",
        middle: "middle",
        fire: "fire",
        side1: "forward",
        side2: "backward",
        side3: "dpi+",
        side4: "dpi-",
        side5: "dpi-cycle",
        side6: "led_toggle",
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
