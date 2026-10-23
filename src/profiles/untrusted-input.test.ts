// Hostile or corrupt data through every way data enters the page: imported
// files, saved browser data and profile names. Nothing malformed may come
// out the other side, because it ends up on the mouse or in the page.
import { describe, it, expect } from "vitest";
import { ProfileStore, type KeyValueStorage } from "./profile-store";
import { cleanProfileName, sanitizeM913Config } from "./m913-config-validate";
import { defaultConfig } from "./user-profiles";
import { parseM908ProfileSet, sanitizeM908Profile, serializeM908ProfileSet, defaultM908ProfileSet } from "./m908-profile-store";

class FakeStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

const hostileConfig = {
  pollingRateHz: 3,
  dpi: [400, -1, 1e9, "800", null],
  dpiEnabled: ["yes", false, false, false, false],
  ledMode: "<img src=x onerror=alert(1)>",
  ledColorHex: "zzzzzz",
  ledBrightness: Infinity,
  ledSpeed: -40,
  buttonActions: { side1: "ctrl+c", side2: "<script>", side3: "a".repeat(5000), __proto__: { side4: "x" }, bogus: "a", left: 42 },
};

describe("cleanProfileName", () => {
  it("removes control and direction-override characters and bounds the length", () => {
    expect(cleanProfileName("Work‮gnp.exe\u0000\n\tname", "x")).toBe("Workgnp.exe name");
    expect(cleanProfileName("a".repeat(500), "x")).toHaveLength(60);
  });
  it("keeps ordinary punctuation and non-English letters", () => {
    expect(cleanProfileName("My Setup (macOS) — v2 日本", "x")).toBe("My Setup (macOS) — v2 日本");
  });
  it("falls back for anything that isn't a usable string", () => {
    expect(cleanProfileName(undefined, "Untitled")).toBe("Untitled");
    expect(cleanProfileName({ toString: () => "x" }, "Untitled")).toBe("Untitled");
    expect(cleanProfileName("\u0000​‮", "Untitled")).toBe("Untitled");
  });
});

describe("sanitizeM913Config", () => {
  it("rebuilds a hostile config into one the page's controls could have produced", () => {
    const config = sanitizeM913Config(hostileConfig);
    const d = defaultConfig();
    expect(config.pollingRateHz).toBe(d.pollingRateHz);
    expect(config.dpi).toEqual([400, d.dpi[1], d.dpi[2], d.dpi[3], d.dpi[4]]);
    expect(config.dpiEnabled).toEqual([true, false, false, false, false]);
    expect(config.ledMode).toBe(d.ledMode);
    expect(config.ledColorHex).toBe(d.ledColorHex);
    expect(config.ledBrightness).toBe(d.ledBrightness);
    expect(config.ledSpeed).toBe(1);
    expect(config.buttonActions).toEqual({ side1: "ctrl+c" });
  });
  it("survives values that aren't objects at all", () => {
    for (const raw of [null, undefined, 42, "text", [], true]) expect(() => sanitizeM913Config(raw)).not.toThrow();
  });
});

describe("M913 profile import", () => {
  it("validates every field of an imported file and never trusts its id", () => {
    const store = new ProfileStore(new FakeStorage());
    const imported = store.importProfile(JSON.stringify({ schemaVersion: 1, profile: { id: "../../evil", name: "<b>x</b>‮", config: hostileConfig } }))!;
    expect(imported.id).not.toBe("../../evil");
    expect(imported.name).toBe("<b>x</b>"); // display code escapes it; control characters are gone
    expect(imported.config.buttonActions).toEqual({ side1: "ctrl+c" });
    expect(imported.config.ledMode).toBe(defaultConfig().ledMode);
  });
  it("rejects files that aren't profile exports", () => {
    const store = new ProfileStore(new FakeStorage());
    for (const text of ["", "not json", "null", "[]", '{"profile":{"config":"x"}}', '{"profile":5}']) expect(store.importProfile(text)).toBeNull();
  });
});

describe("M913 saved browser data", () => {
  it("drops malformed entries and validates the rest", () => {
    const storage = new FakeStorage();
    storage.setItem("m913-profiles", JSON.stringify({
      profiles: [null, 7, { id: 1, name: "bad id", config: {} }, { id: "ok", name: "Fine\u0007", config: hostileConfig }, { id: "no-config", name: "x" }],
      selectedProfileID: "missing",
    }));
    const store = new ProfileStore(storage);
    expect(store.profiles.map((p) => [p.id, p.name])).toEqual([["ok", "Fine"]]);
    expect(store.profiles[0].config.buttonActions).toEqual({ side1: "ctrl+c" });
    expect(store.selectedProfileID).toBeNull();
  });
  it("starts empty instead of failing on corrupt data", () => {
    for (const raw of ["{", "null", "42", '{"profiles":"x"}']) {
      const storage = new FakeStorage();
      storage.setItem("m913-profiles", raw);
      expect(new ProfileStore(storage).profiles).toEqual([]);
    }
  });
});

describe("M908 imports and saved data", () => {
  it("drops button actions the mouse couldn't be sent", () => {
    const profile = sanitizeM908Profile({ buttonActions: { button_1: "ctrl+c", button_2: "<script>", button_3: "x".repeat(200), button_4: "0x90000600", nope: "a" } });
    expect(profile.buttonActions).toEqual({ button_1: "ctrl+c", button_4: "0x90000600" });
  });
  it("rebuilds an imported five-profile file field by field", () => {
    const file = JSON.parse(serializeM908ProfileSet(defaultM908ProfileSet()));
    file.profiles[0] = { ...file.profiles[0], lightMode: "<x>", color: ["a", 300, -1], dpiValues: [1, 2, 3, 4, 5], reportRateHz: 9, dpiStartStage: 99 };
    file.activeProfile = 99;
    const set = parseM908ProfileSet(JSON.stringify(file))!;
    const p = set.profiles[0];
    expect(p.lightMode).toBe("static");
    expect(p.color).toEqual([0, 255, 0]);
    expect(p.dpiValues).toEqual([400, 800, 1600, 3200, 6400]);
    expect(p.reportRateHz).toBe(1000);
    expect(p.dpiStartStage).toBeUndefined();
    expect(set.activeProfile).toBe(0);
  });
});
