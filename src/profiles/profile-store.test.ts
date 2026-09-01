import { describe, it, expect, beforeEach } from "vitest";
import { ProfileStore, type KeyValueStorage } from "./profile-store";
import { defaultConfig, uniqueProfileName } from "./user-profiles";

class FakeStorage implements KeyValueStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("uniqueProfileName", () => {
  it("returns the base name when there's no collision", () => {
    expect(uniqueProfileName("Gaming", ["Other"])).toBe("Gaming");
  });
  it("appends a suffix on collision", () => {
    expect(uniqueProfileName("Gaming", ["Gaming"])).toBe("Gaming 2");
  });
  it("finds the first free suffix", () => {
    expect(uniqueProfileName("Gaming", ["Gaming", "Gaming 2", "Gaming 3"])).toBe("Gaming 4");
  });
});

describe("ProfileStore", () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();
  });

  it("addProfile persists and selects it", () => {
    const store = new ProfileStore(storage);
    const profile = store.addProfile("Gaming", defaultConfig());

    expect(store.profiles.map((p) => p.name)).toEqual(["Gaming"]);
    expect(store.selectedProfileID).toBe(profile.id);
  });

  it("addProfile disambiguates duplicate names", () => {
    const store = new ProfileStore(storage);
    store.addProfile("Gaming", defaultConfig());
    store.addProfile("Gaming", defaultConfig());

    expect(store.profiles.map((p) => p.name)).toEqual(["Gaming", "Gaming 2"]);
  });

  it("updateProfile changes config for an existing profile only", () => {
    const store = new ProfileStore(storage);
    const profile = store.addProfile("Gaming", defaultConfig());

    store.updateProfile(profile.id, { ...defaultConfig(), pollingRateHz: 125 });
    expect(store.profiles[0].config.pollingRateHz).toBe(125);

    // A nonexistent id must be a no-op, not a crash or a stray insert.
    store.updateProfile("does-not-exist", defaultConfig());
    expect(store.profiles).toHaveLength(1);
  });

  it("renameProfile disambiguates against other profiles", () => {
    const store = new ProfileStore(storage);
    store.addProfile("Gaming", defaultConfig());
    const second = store.addProfile("Office", defaultConfig());

    store.renameProfile(second.id, "Gaming");

    expect(new Set(store.profiles.map((p) => p.name))).toEqual(new Set(["Gaming", "Gaming 2"]));
  });

  it("deleteProfile clears selection only if it was selected", () => {
    const store = new ProfileStore(storage);
    const first = store.addProfile("Gaming", defaultConfig());
    const second = store.addProfile("Office", defaultConfig());

    store.deleteProfile(first.id);

    expect(store.profiles.map((p) => p.name)).toEqual(["Office"]);
    expect(store.selectedProfileID).toBe(second.id);
  });

  it("a second store reading the same storage sees what the first persisted", () => {
    const first = new ProfileStore(storage);
    first.addProfile("Gaming", defaultConfig());

    const second = new ProfileStore(storage);

    expect(second.profiles.map((p) => p.name)).toEqual(["Gaming"]);
  });

  it("export then import round-trips with a fresh id", () => {
    const store = new ProfileStore(storage);
    const config = { ...defaultConfig(), buttonActions: { fire: "enter" } };
    const original = store.addProfile("Gaming", config);

    const json = store.exportProfile(original);
    const imported = store.importProfile(json);

    expect(imported).not.toBeNull();
    expect(imported!.id).not.toBe(original.id);
    expect(imported!.config).toEqual(original.config);
    expect(imported!.name).toBe("Gaming 2"); // "Gaming" already exists

    const importedAgain = store.importProfile(json);
    expect(importedAgain!.name).toBe("Gaming 3");
  });

  it("importing malformed JSON returns null rather than throwing", () => {
    const store = new ProfileStore(storage);
    expect(store.importProfile("not json")).toBeNull();
    expect(store.profiles).toHaveLength(0);
  });

  it("importing well-formed JSON missing a profile returns null", () => {
    const store = new ProfileStore(storage);
    expect(store.importProfile(JSON.stringify({ schemaVersion: 1 }))).toBeNull();
  });
});
