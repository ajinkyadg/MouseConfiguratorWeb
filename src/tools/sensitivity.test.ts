import { describe, expect, it } from "vitest";
import {
  GAMES,
  cmPer360,
  convertSens,
  edpi,
  findGame,
  formatDistance,
  formatSens,
  inchesPer360,
  sensForNewDpi,
  validateDpi,
  validateSens,
} from "./sensitivity";

describe("cm/360", () => {
  it("matches the well-known CS2 figure (sens 1 @ 800 DPI ≈ 51.95 cm)", () => {
    expect(cmPer360(0.022, 1, 800)).toBeCloseTo(51.955, 2);
    expect(inchesPer360(0.022, 1, 800)).toBeCloseTo(20.4545, 3);
  });

  it("reproduces mouse-sensitivity.com's 20–80 cm/360 ranges at 800 DPI", () => {
    // Valorant 0.204–0.816, Overwatch 2.16–8.66, Apex 0.65–2.6
    expect(cmPer360(0.07, 0.816, 800)).toBeCloseTo(20, 1);
    expect(cmPer360(0.07, 0.204, 800)).toBeCloseTo(80, 0);
    expect(cmPer360(0.0066, 8.66, 800)).toBeCloseTo(20, 1);
    expect(cmPer360(0.0066, 2.16, 800)).toBeCloseTo(80, 0);
    expect(cmPer360(0.022, 2.6, 800)).toBeCloseTo(20, 1);
  });

  it("rejects non-positive input", () => {
    expect(() => cmPer360(0.022, 0, 800)).toThrow(RangeError);
    expect(() => cmPer360(0.022, 1, -1)).toThrow(RangeError);
    expect(() => cmPer360(0.022, NaN, 800)).toThrow(RangeError);
  });
});

describe("same game, new DPI", () => {
  it("keeps sens × DPI constant", () => {
    expect(sensForNewDpi(2, 800, 1600)).toBe(1);
    expect(sensForNewDpi(0.4, 800, 400)).toBe(0.8);
    expect(edpi(sensForNewDpi(1.3, 800, 1200), 1200)).toBeCloseTo(edpi(1.3, 800), 10);
  });

  it("leaves cm/360 unchanged", () => {
    const before = cmPer360(0.07, 0.35, 800);
    const after = cmPer360(0.07, sensForNewDpi(0.35, 800, 3200), 3200);
    expect(after).toBeCloseTo(before, 10);
  });
});

describe("game to game", () => {
  const cs2 = findGame("cs2")!;
  const val = findGame("valorant")!;
  const ow = findGame("ow2")!;

  it("uses the yaw ratio (CS2 → Valorant ÷ 3.1818, CS2 → OW2 × 3.333)", () => {
    expect(convertSens(1, { yaw: cs2.yaw, dpi: 800 }, { yaw: val.yaw, dpi: 800 })).toBeCloseTo(0.3142857, 6);
    expect(convertSens(1, { yaw: cs2.yaw, dpi: 800 }, { yaw: ow.yaw, dpi: 800 })).toBeCloseTo(3.33333, 4);
  });

  it("handles a DPI change at the same time", () => {
    const out = convertSens(1, { yaw: cs2.yaw, dpi: 400 }, { yaw: val.yaw, dpi: 1600 });
    expect(cmPer360(val.yaw, out, 1600)).toBeCloseTo(cmPer360(cs2.yaw, 1, 400), 10);
  });

  it("is an identity for games sharing a yaw", () => {
    const apex = findGame("apex")!;
    expect(convertSens(1.7, { yaw: cs2.yaw, dpi: 800 }, { yaw: apex.yaw, dpi: 800 })).toBeCloseTo(1.7, 12);
  });

  it("lists only games with a unique id and positive yaw", () => {
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
    for (const g of GAMES) expect(g.yaw).toBeGreaterThan(0);
  });
});

describe("formatting", () => {
  it("rounds sensitivity to 4 significant figures, max 4 decimals", () => {
    expect(formatSens(0.3142857)).toBe("0.3143");
    expect(formatSens(3.333333)).toBe("3.333");
    expect(formatSens(2)).toBe("2");
    expect(formatSens(1.5)).toBe("1.5");
    expect(formatSens(51.9545)).toBe("51.95");
    expect(formatSens(0.00123)).toBe("0.0012");
    expect(formatSens(Infinity)).toBe("—");
  });

  it("formats distances with up to two decimals", () => {
    expect(formatDistance(51.9545)).toBe("51.95");
    expect(formatDistance(20)).toBe("20");
    expect(formatDistance(129.87)).toBe("129.9");
  });
});

describe("validation", () => {
  it("accepts dot or comma decimals", () => {
    expect(validateSens("1.25")).toEqual({ ok: true, value: 1.25 });
    expect(validateSens(" 0,4 ")).toEqual({ ok: true, value: 0.4 });
    expect(validateSens(".5")).toEqual({ ok: true, value: 0.5 });
  });

  it("rejects empty, zero, negative, and garbage", () => {
    for (const bad of ["", "0", "-1", "abc", "1e3", "1..2"]) expect(validateSens(bad).ok).toBe(false);
  });

  it("rejects ambiguous thousands separators in DPI", () => {
    expect(validateDpi("1,600").ok).toBe(false);
    expect(validateDpi("1600")).toEqual({ ok: true, value: 1600 });
    expect(validateDpi("10").ok).toBe(false);
    expect(validateDpi("60000").ok).toBe(false);
  });
});
