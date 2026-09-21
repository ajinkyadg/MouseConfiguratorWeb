import { describe, it, expect } from "vitest";
import {
  copyM908Slot,
  defaultM908ProfileSet,
  loadM908ProfileSet,
  M908_PROFILE_SET_FORMAT,
  M908_PROFILE_SET_STORAGE_KEY,
  parseM908ProfileSet,
  sanitizeM908Profile,
  saveM908ProfileSet,
  serializeM908ProfileSet,
  type KeyValueStorage,
} from "./m908-profile-store";
import { M908_NEUTRAL_PROFILE } from "./m908-presets";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function sampleSet() {
  const set = defaultM908ProfileSet();
  set.profiles[1].color = [1, 2, 3];
  set.profiles[1].buttonActions = { button_1: "ctrl+c" };
  set.profiles[4].dpiValues = [200, 400, 800, 1600, 12400];
  set.profiles[4].reportRateHz = 250;
  set.activeProfile = 3;
  return set;
}

describe("defaultM908ProfileSet", () => {
  it("holds five independent neutral profiles", () => {
    const set = defaultM908ProfileSet();
    expect(set.profiles).toHaveLength(5);
    expect(set.activeProfile).toBe(0);
    set.profiles[0].dpiValues[0] = 200;
    expect(set.profiles[1].dpiValues[0]).toBe(M908_NEUTRAL_PROFILE.dpiValues[0]);
    expect(M908_NEUTRAL_PROFILE.dpiValues[0]).toBe(400);
  });
});

describe("serialize / parse", () => {
  it("round-trips a set, storing the active profile 1-based", () => {
    const set = sampleSet();
    const json = serializeM908ProfileSet(set);
    expect(JSON.parse(json).activeProfile).toBe(4);
    expect(JSON.parse(json).format).toBe(M908_PROFILE_SET_FORMAT);
    expect(parseM908ProfileSet(json)).toEqual(set);
  });

  it("rejects non-JSON, other formats, and the wrong profile count", () => {
    expect(parseM908ProfileSet("not json")).toBeNull();
    expect(parseM908ProfileSet(JSON.stringify({ profiles: [] }))).toBeNull();
    expect(parseM908ProfileSet(JSON.stringify({ format: M908_PROFILE_SET_FORMAT, profiles: [{}, {}] }))).toBeNull();
    // An M913 single-profile export isn't a 5-slot set
    expect(parseM908ProfileSet(JSON.stringify({ schemaVersion: 1, profile: { name: "x" } }))).toBeNull();
  });

  it("falls back to slot 1 for an out-of-range active profile", () => {
    const file = JSON.parse(serializeM908ProfileSet(sampleSet()));
    file.activeProfile = 9;
    expect(parseM908ProfileSet(JSON.stringify(file))?.activeProfile).toBe(0);
  });
});

describe("sanitizeM908Profile", () => {
  it("replaces invalid fields with neutral defaults instead of passing them to the wire", () => {
    const p = sanitizeM908Profile({
      lightMode: "disco",
      color: [300, -5, "x"],
      brightness: 999,
      speed: 0,
      scrollSpeed: "fast",
      reportRateHz: 333,
      dpiEnabled: [false, false, false, false, false],
      dpiValues: [1650, 800, null, 3200, 12400],
      buttonActions: { button_1: "a", not_a_button: "b", button_2: 5, button_3: "  " },
    });
    expect(p.lightMode).toBe("static");
    expect(p.color).toEqual([255, 0, 0]);
    expect(p.brightness).toBe(255);
    expect(p.speed).toBe(1);
    expect(p.scrollSpeed).toBe(M908_NEUTRAL_PROFILE.scrollSpeed);
    expect(p.reportRateHz).toBe(M908_NEUTRAL_PROFILE.reportRateHz);
    expect(p.dpiEnabled).toEqual([true, false, false, false, false]); // never all disabled
    expect(p.dpiValues).toEqual([400, 800, 1600, 3200, 12400]);
    expect(p.buttonActions).toEqual({ button_1: "a" });
  });

  it("treats a non-object as an all-default profile", () => {
    expect(sanitizeM908Profile(null)).toEqual(M908_NEUTRAL_PROFILE);
  });
});

describe("copyM908Slot", () => {
  it("deep-copies one slot over another without touching the source set", () => {
    const set = sampleSet();
    const copied = copyM908Slot(set, 1, 2);
    expect(copied.profiles[2]).toEqual(set.profiles[1]);
    expect(set.profiles[2]).toEqual(M908_NEUTRAL_PROFILE);
    copied.profiles[2].buttonActions.button_2 = "x";
    expect(copied.profiles[1].buttonActions.button_2).toBeUndefined();
    expect(copied.activeProfile).toBe(set.activeProfile);
  });
});

describe("load / save", () => {
  it("persists and restores through storage", () => {
    const storage = memoryStorage();
    expect(saveM908ProfileSet(storage, sampleSet())).toBe(true);
    expect(storage.data.has(M908_PROFILE_SET_STORAGE_KEY)).toBe(true);
    expect(loadM908ProfileSet(storage)).toEqual(sampleSet());
  });

  it("returns null / false instead of throwing when storage is missing, empty, corrupt, or throws", () => {
    expect(loadM908ProfileSet(null)).toBeNull();
    expect(saveM908ProfileSet(null, sampleSet())).toBe(false);
    expect(loadM908ProfileSet(memoryStorage())).toBeNull();
    const corrupt = memoryStorage();
    corrupt.setItem(M908_PROFILE_SET_STORAGE_KEY, "{oops");
    expect(loadM908ProfileSet(corrupt)).toBeNull();
    const throwing: KeyValueStorage = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
    };
    expect(loadM908ProfileSet(throwing)).toBeNull();
    expect(saveM908ProfileSet(throwing, sampleSet())).toBe(false);
  });
});
