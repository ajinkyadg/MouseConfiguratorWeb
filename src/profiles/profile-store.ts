// Owns the user's saved profiles: loads/saves a single localStorage key,
// and provides the CRUD + import/export operations the profile bar UI
// needs. Built-in presets (BUILT_IN_PRESETS) are never persisted here —
// they're a static list the UI shows alongside these. Mirrors
// RedragonM913Configurator's ProfileStore.swift.
import { type UserProfile, type MouseWebConfig, type PersistedProfiles, type ProfileExportFile, uniqueProfileName, normalizeConfig } from "./user-profiles";

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
      const state = JSON.parse(raw) as PersistedProfiles;
      // Older saves may predate newer fields (e.g. dpiColorsHex) — fill
      // them with defaults rather than dropping or rejecting the profile.
      this.profiles = (state.profiles ?? []).map((p) => (p?.config ? { ...p, config: normalizeConfig(p.config) } : p));
      this.selectedProfileID = state.selectedProfileID ?? null;
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
    const name2 = uniqueProfileName(name, this.profiles.map((p) => p.name));
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
    const trimmed = name.trim();
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
    if (!exportFile?.profile?.config) return null;
    const profile: UserProfile = {
      id: crypto.randomUUID(), // never trust an id from an external file
      name: uniqueProfileName(exportFile.profile.name, this.profiles.map((p) => p.name)),
      config: normalizeConfig(exportFile.profile.config),
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
