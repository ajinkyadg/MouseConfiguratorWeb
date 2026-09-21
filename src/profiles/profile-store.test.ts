import { describe, it, expect, beforeEach } from "vitest";
import { ProfileStore, type KeyValueStorage } from "./profile-store";
import { defaultConfig, uniqueProfileName, dpiColorsHexOf, DEFAULT_DPI_COLORS_HEX, type MouseWebConfig } from "./user-profiles";

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

  it("a profile saved before DPI colors existed loads with default colors", () => {
    const { dpiColorsHex: _omit, ...legacyConfig } = defaultConfig();
    storage.setItem(
      "m913-profiles",
      JSON.stringify({ schemaVersion: 1, profiles: [{ id: "old", name: "Old", config: legacyConfig }], selectedProfileID: "old" })
    );

    const store = new ProfileStore(storage);

    expect(store.profiles[0].config.dpiColorsHex).toEqual(DEFAULT_DPI_COLORS_HEX);
    expect(store.profiles[0].config.dpi).toEqual(legacyConfig.dpi);
  });

  it("importing an export without DPI colors fills in defaults", () => {
    const store = new ProfileStore(storage);
    const { dpiColorsHex: _omit, ...legacyConfig } = defaultConfig();
    const imported = store.importProfile(
      JSON.stringify({ schemaVersion: 1, exportedAt: "2026-01-01T00:00:00Z", profile: { id: "x", name: "Legacy", config: legacyConfig } })
    );
    expect(imported!.config.dpiColorsHex).toEqual(DEFAULT_DPI_COLORS_HEX);
  });

  it("custom DPI colors survive save, reload, and export/import", () => {
    const colors: MouseWebConfig["dpiColorsHex"] = ["112233", "445566", "778899", "aabbcc", "ddeeff"];
    const first = new ProfileStore(storage);
    const saved = first.addProfile("Colors", { ...defaultConfig(), dpiColorsHex: colors });

    const second = new ProfileStore(storage);
    expect(second.profiles[0].config.dpiColorsHex).toEqual(colors);

    const imported = second.importProfile(second.exportProfile(saved));
    expect(imported!.config.dpiColorsHex).toEqual(colors);
  });
});

describe("dpiColorsHexOf", () => {
  it("replaces only missing or malformed entries with defaults", () => {
    const partial = { dpiColorsHex: ["#ABCDEF", "nope", 42, "123456"] } as unknown as MouseWebConfig;
    expect(dpiColorsHexOf(partial)).toEqual(["abcdef", DEFAULT_DPI_COLORS_HEX[1], DEFAULT_DPI_COLORS_HEX[2], "123456", DEFAULT_DPI_COLORS_HEX[4]]);
  });

  it("defaults are the M913's factory colors", () => {
    expect(DEFAULT_DPI_COLORS_HEX).toEqual(["ff0000", "0000ff", "00ff00", "ffff00", "ff557d"]);
  });
});
