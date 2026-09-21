// The M908 page's 5-slot onboard profile set: what the editor holds, what
// localStorage keeps between visits, and the JSON export/import format.
// Pure functions only — the page owns the DOM and the actual storage
// object, so all of this is testable without a browser.
//
// Why a set of five instead of one profile: every Apply rewrites all five
// onboard profiles at once (see m908.ts buildM908ApplySequence and
// m908.md "Onboard profiles"), so the editor has to hold all five or it
// would silently overwrite four of them with defaults.
import {
  m908DpiSupported,
  m908LightModeSupported,
  M908_REPORT_RATES_HZ,
  type M908FiveProfiles,
  type M908ProfileIndex,
  type M908ProfileSettings,
} from "./m908";
import { M908_BUTTON_NAMES, type M908ButtonName } from "./m908-buttons";
import { M908_NEUTRAL_PROFILE } from "./m908-presets";

export const M908_PROFILE_COUNT = 5;
export const M908_PROFILE_SET_STORAGE_KEY = "m908-profile-set";
export const M908_PROFILE_SET_FORMAT = "mouseconfig-m908-profile-set";

export interface M908ProfileSet {
  profiles: M908FiveProfiles;
  /** Which onboard profile the mouse switches to after Apply (0-4). */
  activeProfile: M908ProfileIndex;
}

interface M908ProfileSetFile {
  format: typeof M908_PROFILE_SET_FORMAT;
  schemaVersion: 1;
  activeProfile: number; // 1-5 in the file, for humans reading it
  profiles: M908ProfileSettings[];
}

/** Same subset of the DOM Storage interface profile-store.ts uses. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isM908ProfileIndex(n: unknown): n is M908ProfileIndex {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n < M908_PROFILE_COUNT;
}

export function defaultM908ProfileSet(): M908ProfileSet {
  return {
    profiles: Array.from({ length: M908_PROFILE_COUNT }, () => structuredClone(M908_NEUTRAL_PROFILE)) as M908FiveProfiles,
    activeProfile: 0,
  };
}

function clampByte(value: unknown, fallback: number, min = 0, max = 255): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

// Rebuilds one profile field by field from untrusted JSON, falling back to
// the neutral default for anything missing or out of range — so a
// hand-edited or older file can never put bytes on the wire the UI
// couldn't have produced.
export function sanitizeM908Profile(raw: unknown): M908ProfileSettings {
  const d = M908_NEUTRAL_PROFILE;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const color = Array.isArray(r.color) && r.color.length === 3
    ? (r.color.map((c, i) => clampByte(c, d.color[i])) as [number, number, number])
    : ([...d.color] as [number, number, number]);

  const dpiEnabled = Array.from({ length: 5 }, (_, j) =>
    Array.isArray(r.dpiEnabled) && typeof r.dpiEnabled[j] === "boolean" ? r.dpiEnabled[j] : d.dpiEnabled[j]
  ) as M908ProfileSettings["dpiEnabled"];
  // The mouse needs at least one DPI stage; mouse_m908 refuses to disable the last one.
  if (!dpiEnabled.some(Boolean)) dpiEnabled[0] = true;

  const dpiValues = Array.from({ length: 5 }, (_, j) => {
    const v = Array.isArray(r.dpiValues) ? r.dpiValues[j] : undefined;
    return typeof v === "number" && m908DpiSupported(v) ? v : d.dpiValues[j];
  }) as M908ProfileSettings["dpiValues"];

  const buttonActions: Partial<Record<M908ButtonName, string>> = {};
  if (r.buttonActions && typeof r.buttonActions === "object") {
    for (const [name, action] of Object.entries(r.buttonActions as Record<string, unknown>)) {
      if ((M908_BUTTON_NAMES as readonly string[]).includes(name) && typeof action === "string" && action.trim()) {
        buttonActions[name as M908ButtonName] = action.trim();
      }
    }
  }

  return {
    lightMode: typeof r.lightMode === "string" && m908LightModeSupported(r.lightMode) ? r.lightMode : d.lightMode,
    color,
    brightness: clampByte(r.brightness, d.brightness),
    speed: clampByte(r.speed, d.speed, 1, 5),
    scrollSpeed: clampByte(r.scrollSpeed, d.scrollSpeed),
    reportRateHz: typeof r.reportRateHz === "number" && M908_REPORT_RATES_HZ.includes(r.reportRateHz) ? r.reportRateHz : d.reportRateHz,
    dpiEnabled,
    dpiValues,
    buttonActions,
  };
}

export function serializeM908ProfileSet(set: M908ProfileSet): string {
  const file: M908ProfileSetFile = {
    format: M908_PROFILE_SET_FORMAT,
    schemaVersion: 1,
    activeProfile: set.activeProfile + 1,
    profiles: set.profiles,
  };
  return JSON.stringify(file, null, 2);
}

/** Parses an exported/persisted set. Returns null if it isn't one. */
export function parseM908ProfileSet(json: string): M908ProfileSet | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const file = data as Partial<M908ProfileSetFile>;
  if (file.format !== M908_PROFILE_SET_FORMAT || !Array.isArray(file.profiles) || file.profiles.length !== M908_PROFILE_COUNT) {
    return null;
  }
  const active = typeof file.activeProfile === "number" ? file.activeProfile - 1 : 0;
  return {
    profiles: file.profiles.map(sanitizeM908Profile) as M908FiveProfiles,
    activeProfile: isM908ProfileIndex(active) ? active : 0,
  };
}

/** Returns a new set with slot `from` deep-copied into slot `to`. */
export function copyM908Slot(set: M908ProfileSet, from: M908ProfileIndex, to: M908ProfileIndex): M908ProfileSet {
  const profiles = set.profiles.map((p) => structuredClone(p)) as M908FiveProfiles;
  profiles[to] = structuredClone(set.profiles[from]);
  return { profiles, activeProfile: set.activeProfile };
}

// Storage can be missing or throw (private windows, blocked site data,
// quota) — the page must keep working without it, so both of these
// swallow errors and report success/failure instead.
export function loadM908ProfileSet(storage: KeyValueStorage | null): M908ProfileSet | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(M908_PROFILE_SET_STORAGE_KEY);
    return raw ? parseM908ProfileSet(raw) : null;
  } catch {
    return null;
  }
}

export function saveM908ProfileSet(storage: KeyValueStorage | null, set: M908ProfileSet): boolean {
  if (!storage) return false;
  try {
    storage.setItem(M908_PROFILE_SET_STORAGE_KEY, serializeM908ProfileSet(set));
    return true;
  } catch {
    return false;
  }
}
