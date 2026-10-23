import { describe, it, expect } from "vitest";
import {
  buildShareUrl,
  cleanShareName,
  hasShareFragment,
  readM908Share,
  readM913Share,
  sanitizeSharedM908Profile,
} from "./share-link";
import { sanitizeM913Config } from "./m913-config-validate";
import { M908_BUILT_IN_PRESETS, M908_NEUTRAL_PROFILE } from "./m908-presets";
import { BUILT_IN_PRESETS, defaultConfig, normalizeConfig } from "./user-profiles";

const hashOf = (url: string) => new URL(url).hash;
const encode = (value: unknown) => {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
  return "#share=" + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

describe("buildShareUrl", () => {
  it("puts the profile in the fragment only, dropping any query or old fragment", () => {
    const url = buildShareUrl("https://mouseconfig.app/m908?x=1#old", "m908", "Mine", M908_NEUTRAL_PROFILE);
    expect(url.startsWith("https://mouseconfig.app/m908#share=")).toBe(true);
    expect(url).not.toContain("?");
    expect(url).not.toContain("old");
    expect(hashOf(url)).toMatch(/^#share=[A-Za-z0-9_-]+$/); // URL-safe, no padding
  });

  it("keeps real profiles to a link that fits anywhere a URL does", () => {
    for (const preset of M908_BUILT_IN_PRESETS) {
      expect(buildShareUrl("https://mouseconfig.app/m908", "m908", preset.name, preset.profile).length).toBeLessThan(2000);
    }
    for (const preset of BUILT_IN_PRESETS) {
      expect(buildShareUrl("https://mouseconfig.app/", "m913", preset.name, preset.config).length).toBeLessThan(2000);
    }
  });
});

describe("M908 share links", () => {
  it("round-trips every built-in preset exactly", () => {
    for (const preset of M908_BUILT_IN_PRESETS) {
      const shared = readM908Share(hashOf(buildShareUrl("https://mouseconfig.app/m908", "m908", preset.name, preset.profile)));
      expect(shared.kind, preset.id).toBe("ok");
      if (shared.kind === "ok") expect(shared.profile, preset.id).toEqual(preset.profile);
    }
  });

  it("carries the hold-Shift binding", () => {
    const mine = M908_BUILT_IN_PRESETS.find((p) => p.id === "m908-preset-default")!;
    const shared = readM908Share(hashOf(buildShareUrl("https://mouseconfig.app/m908", "m908", mine.name, mine.profile)));
    expect(shared.kind === "ok" && shared.profile.buttonActions.button_11).toBe("shift");
  });

  it("drops raw codes, unknown actions and unknown buttons from a shared profile", () => {
    const profile = sanitizeSharedM908Profile({
      ...M908_NEUTRAL_PROFILE,
      buttonActions: { button_1: "0x9b040000", button_2: "not-a-thing", button_3: "CTRL+C", button_99: "a", button_4: "a" },
    });
    expect(profile.buttonActions).toEqual({ button_3: "ctrl+c", button_4: "a" });
  });

  it("replaces out-of-range values with safe defaults", () => {
    const profile = sanitizeSharedM908Profile({ dpiValues: [1, 2, 3, 4, 5], brightness: 9999, reportRateHz: 7, lightMode: "<script>", color: "red" });
    expect(profile.dpiValues).toEqual(M908_NEUTRAL_PROFILE.dpiValues);
    expect(profile.brightness).toBe(255);
    expect(profile.reportRateHz).toBe(M908_NEUTRAL_PROFILE.reportRateHz);
    expect(profile.lightMode).toBe(M908_NEUTRAL_PROFILE.lightMode);
    expect(profile.color).toEqual(M908_NEUTRAL_PROFILE.color);
  });
});

describe("M913 share links", () => {
  it("round-trips every built-in preset exactly", () => {
    for (const preset of BUILT_IN_PRESETS) {
      const shared = readM913Share(hashOf(buildShareUrl("https://mouseconfig.app/", "m913", preset.name, preset.config)));
      expect(shared.kind, preset.id).toBe("ok");
      if (shared.kind === "ok") {
        expect(shared.profile, preset.id).toEqual(normalizeConfig(preset.config));
        expect(shared.name).toBe(cleanShareName(preset.name));
      }
    }
  });

  it("drops invalid buttons and actions, and fixes bad settings", () => {
    const config = sanitizeM913Config({
      pollingRateHz: 9000,
      dpi: [400, "800", 99999, 1600.5, 3200],
      dpiEnabled: [false, false, false, false, false],
      ledMode: "disco",
      ledColorHex: "#FF00AA",
      ledBrightness: -5,
      ledSpeed: 99,
      buttonActions: { side1: "CTRL+C", side2: "ctrl+shift+alt+z", side3: "nonsense", bogus: "a", left: 5, side4: "a" },
    });
    const d = defaultConfig();
    expect(config.pollingRateHz).toBe(d.pollingRateHz);
    expect(config.dpi).toEqual([400, d.dpi[1], d.dpi[2], d.dpi[3], 3200]);
    expect(config.dpiEnabled).toEqual([true, false, false, false, false]); // a mouse needs one stage
    expect(config.ledMode).toBe(d.ledMode);
    expect(config.ledColorHex).toBe("ff00aa");
    expect(config.ledBrightness).toBe(0);
    expect(config.ledSpeed).toBe(5);
    expect(config.buttonActions).toEqual({ side1: "ctrl+c", side4: "a" });
  });
});

describe("links that are not ours, or not for this mouse", () => {
  it("reports no share when the fragment is something else", () => {
    expect(readM908Share("").kind).toBe("none");
    expect(readM908Share("#settings").kind).toBe("none");
    expect(hasShareFragment("#share=abc")).toBe(true);
    expect(hasShareFragment("#shared")).toBe(false);
  });

  it("rejects damaged, non-JSON, wrong-version and oversized fragments", () => {
    expect(readM908Share("#share=").kind).toBe("invalid");
    expect(readM908Share("#share=%%%").kind).toBe("invalid");
    expect(readM908Share(encode("not json")).kind).toBe("invalid");
    expect(readM908Share(encode([1, 2, 3])).kind).toBe("invalid");
    expect(readM908Share(encode({ v: 2, m: "m908", n: "x", p: {} })).kind).toBe("invalid");
    expect(readM908Share(encode({ v: 1, m: "m908", n: "x", p: "string" })).kind).toBe("invalid");
    expect(readM908Share(encode({ v: 1, m: "m908", n: "x", p: { pad: "a".repeat(9000) } })).kind).toBe("invalid");
    const good = hashOf(buildShareUrl("https://mouseconfig.app/m908", "m908", "x", M908_NEUTRAL_PROFILE));
    expect(readM908Share(good.slice(0, -7)).kind).not.toBe("ok"); // truncated when pasted
  });

  it("refuses a link made for the other mouse", () => {
    const m913 = hashOf(buildShareUrl("https://mouseconfig.app/", "m913", "x", defaultConfig()));
    const m908 = hashOf(buildShareUrl("https://mouseconfig.app/m908", "m908", "x", M908_NEUTRAL_PROFILE));
    expect(readM908Share(m913)).toMatchObject({ kind: "wrong-mouse", mouse: "m913" });
    expect(readM913Share(m908)).toMatchObject({ kind: "wrong-mouse", mouse: "m908" });
  });
});

describe("cleanShareName", () => {
  it("keeps ordinary names, including non-English letters", () => {
    expect(cleanShareName("My Setup (macOS)")).toBe("My Setup (macOS)");
    expect(cleanShareName("Perfil de jogo — ção 日本語")).toBe("Perfil de jogo ção 日本語");
  });

  it("strips markup and control characters so a name can't inject anything", () => {
    const hostile = cleanShareName('<img src=x onerror="alert(1)">&amp;\u0000\n</option><script>');
    expect(hostile).not.toMatch(/[<>&"'=/\u0000-\u001f]/);
    expect(cleanShareName("<<<>>>")).toBe("Shared profile");
  });

  it("limits length and falls back when there is no usable name", () => {
    expect(cleanShareName("a".repeat(500)).length).toBe(40);
    expect(cleanShareName(undefined)).toBe("Shared profile");
    expect(cleanShareName(42)).toBe("Shared profile");
    expect(cleanShareName("   ")).toBe("Shared profile");
  });

  it("a hostile name inside a link comes out clean", () => {
    const shared = readM913Share(encode({ v: 1, m: "m913", n: "</option><script>alert(1)</script>", p: defaultConfig() }));
    expect(shared.kind === "ok" && shared.name).toBe("optionscriptalert(1)script");
  });
});
