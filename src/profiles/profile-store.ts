// Owns the user's saved profiles: loads/saves a single localStorage key,
// and provides the CRUD + import/export operations the profile bar UI
// needs. Built-in presets (BUILT_IN_PRESETS) are never persisted here —
// they're a static list the UI shows alongside these. Mirrors
// RedragonM913Configurator's ProfileStore.swift.
import { type UserProfile, type MouseWebConfig, type PersistedProfiles, type ProfileExportFile, uniqueProfileName } from "./user-profiles";
import { cleanProfileName, sanitizeM913Config } from "./m913-config-validate";

// Matches the subset of the DOM Storage interface this needs — lets tests
// inject an in-memory fake instead of requiring a real browser/jsdom
// localStorage.
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = "m913-profiles";

export class ProfileStore {
  private storage: KeyValueStorage;
  private storageKey: string;
  profiles: UserProfile[] = [];
  selectedProfileID: string | null = null;

  constructor(storage: KeyValueStorage = window.localStorage, storageKey: string = STORAGE_KEY) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.load();
  }

  private load(): void {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return;
    try {
      const state = JSON.parse(raw) as Partial<PersistedProfiles> | null;
      // Saved data is rebuilt field by field like an import: older saves
      // gain new fields' defaults, and anything malformed is dropped
      // rather than sent to the mouse.
      const saved = Array.isArray(state?.profiles) ? state.profiles : [];
      const names: string[] = [];
      for (const p of saved) {
        if (!p || typeof p !== "object" || typeof p.id !== "string" || !p.config) continue;
        const name = uniqueProfileName(cleanProfileName(p.name, "Untitled"), names);
        names.push(name);
        this.profiles.push({ id: p.id.slice(0, 64), name, config: sanitizeM913Config(p.config) });
      }
      const selected = state?.selectedProfileID;
      this.selectedProfileID = typeof selected === "string" && this.profiles.some((p) => p.id === selected) ? selected : null;
    } catch {
      // Corrupt/foreign data under this key — start fresh rather than throw.
    }
  }

  private save(): void {
    const state: PersistedProfiles = {
      schemaVersion: 1,
      profiles: this.profiles,
      selectedProfileID: this.selectedProfileID,
    };
    this.storage.setItem(this.storageKey, JSON.stringify(state));
  }

  addProfile(name: string, config: MouseWebConfig): UserProfile {
    const name2 = uniqueProfileName(cleanProfileName(name, "Untitled"), this.profiles.map((p) => p.name));
    const profile: UserProfile = { id: crypto.randomUUID(), name: name2, config };
    this.profiles.push(profile);
    this.selectedProfileID = profile.id;
    this.save();
    return profile;
  }

  updateProfile(id: string, config: MouseWebConfig): void {
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) return;
    profile.config = config;
    this.save();
  }

  renameProfile(id: string, name: string): void {
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) return;
    const trimmed = cleanProfileName(name, "");
    if (!trimmed) return;
    const existing = this.profiles.filter((p) => p.id !== id).map((p) => p.name);
    profile.name = uniqueProfileName(trimmed, existing);
    this.save();
  }

  deleteProfile(id: string): void {
    this.profiles = this.profiles.filter((p) => p.id !== id);
    if (this.selectedProfileID === id) this.selectedProfileID = null;
    this.save();
  }

  importProfile(jsonText: string): UserProfile | null {
    let exportFile: ProfileExportFile;
    try {
      exportFile = JSON.parse(jsonText) as ProfileExportFile;
    } catch {
      return null;
    }
    if (!exportFile?.profile?.config || typeof exportFile.profile.config !== "object") return null;
    const profile: UserProfile = {
      id: crypto.randomUUID(), // never trust an id from an external file
      name: uniqueProfileName(cleanProfileName(exportFile.profile.name, "Imported profile"), this.profiles.map((p) => p.name)),
      config: sanitizeM913Config(exportFile.profile.config),
    };
    this.profiles.push(profile);
    this.selectedProfileID = profile.id;
    this.save();
    return profile;
  }

  exportProfile(profile: UserProfile): string {
    const exportFile: ProfileExportFile = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profile,
    };
    return JSON.stringify(exportFile, null, 2);
  }
}
