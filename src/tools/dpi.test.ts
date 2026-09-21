import { describe, expect, it } from "vitest";
import {
  computeDpi,
  convertDistance,
  deviationLevel,
  deviationPercent,
  driftRatio,
  scaleCorrection,
  summarizeRuns,
  toInches,
  validateDistance,
  validateExpectedDpi,
} from "./dpi";
import { parseDecimal } from "./parse";

describe("distance", () => {
  it("converts cm to inches", () => {
    expect(toInches(10, "cm")).toBeCloseTo(3.937, 3);
    expect(toInches(4, "in")).toBe(4);
    expect(convertDistance(4, "in", "cm")).toBeCloseTo(10.16, 10);
    expect(convertDistance(10.16, "cm", "in")).toBeCloseTo(4, 10);
  });

  it("validates range per unit", () => {
    expect(validateDistance("4", "in")).toEqual({ ok: true, value: 4 });
    expect(validateDistance("10", "cm")).toEqual({ ok: true, value: 10 });
    expect(validateDistance("0.5", "in").ok).toBe(false);
    expect(validateDistance("2", "cm").ok).toBe(false); // < 1 in
    expect(validateDistance("", "cm").ok).toBe(false);
    expect(validateDistance("ten", "cm").ok).toBe(false);
  });
});

describe("computeDpi", () => {
  it("divides counts by inches", () => {
    expect(computeDpi(3200, 4)).toBe(800);
    expect(computeDpi(-3200, 4)).toBe(800); // moved left
    expect(computeDpi(1600 * toInches(10, "cm"), toInches(10, "cm"))).toBeCloseTo(1600, 10);
  });

  it("rejects zero distance", () => {
    expect(() => computeDpi(100, 0)).toThrow(RangeError);
  });
});

describe("deviation", () => {
  it("is signed percent from expected", () => {
    expect(deviationPercent(1552, 1600)).toBeCloseTo(-3, 10);
    expect(deviationPercent(1760, 1600)).toBeCloseTo(10, 10);
  });

  it("buckets by magnitude", () => {
    expect(deviationLevel(-3)).toBe("good");
    expect(deviationLevel(5)).toBe("good");
    expect(deviationLevel(-7.5)).toBe("fair");
    expect(deviationLevel(12)).toBe("off");
  });

  it("validates expected DPI as optional whole number", () => {
    expect(validateExpectedDpi("")).toEqual({ ok: true, value: null });
    expect(validateExpectedDpi("1600")).toEqual({ ok: true, value: 1600 });
    expect(validateExpectedDpi("1,600").ok).toBe(false);
    expect(validateExpectedDpi("1600.5").ok).toBe(false);
    expect(validateExpectedDpi("10").ok).toBe(false);
  });
});

describe("summarizeRuns", () => {
  it("returns null for no runs", () => {
    expect(summarizeRuns([])).toBeNull();
  });

  it("computes mean, range, spread and std dev", () => {
    const s = summarizeRuns([1580, 1600, 1620])!;
    expect(s.count).toBe(3);
    expect(s.mean).toBe(1600);
    expect(s.min).toBe(1580);
    expect(s.max).toBe(1620);
    expect(s.spreadPercent).toBeCloseTo(2.5, 10);
    expect(s.stdDev).toBeCloseTo(Math.sqrt(800 / 3), 10);
  });
});

describe("scaleCorrection", () => {
  it("spots a reading divided by the display scale", () => {
    expect(scaleCorrection(1067, 1600, 1.5)).toEqual({ factor: 1.5, corrected: 1600.5 });
  });

  it("spots a reading multiplied by the display scale", () => {
    const c = scaleCorrection(3200, 1600, 2)!;
    expect(c.factor).toBe(0.5);
    expect(c.corrected).toBe(1600);
  });

  it("stays quiet when scale is 1 or the ratio doesn't match", () => {
    expect(scaleCorrection(800, 1600, 1)).toBeNull();
    expect(scaleCorrection(1550, 1600, 2)).toBeNull();
    expect(scaleCorrection(1000, 0, 2)).toBeNull();
  });
});

describe("driftRatio", () => {
  it("is |y| / |x|", () => {
    expect(driftRatio(1000, -50)).toBe(0.05);
    expect(driftRatio(0, 10)).toBe(0);
  });
});

describe("parseDecimal", () => {
  it("accepts plain and comma decimals", () => {
    expect(parseDecimal("4")).toBe(4);
    expect(parseDecimal("2,5")).toBe(2.5);
    expect(parseDecimal("0,314")).toBe(0.314);
    expect(parseDecimal("5.")).toBe(5);
    expect(parseDecimal(".5")).toBe(0.5);
  });

  it("rejects signs, exponents, thousands separators and junk", () => {
    for (const bad of ["", " ", "-4", "+4", "1e3", "1,600", "1.600.000", "4 in", "0x10", "Infinity"]) {
      expect(parseDecimal(bad)).toBeNull();
    }
  });
});
