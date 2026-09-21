// Pure math for the DPI checker page (dpi-checker.html). No DOM here so
// it can be unit-tested; the page script owns pointer lock and rendering.
//
// Method: the user moves the mouse a known physical distance while the
// pointer is locked, we sum the horizontal movement deltas the browser
// reports, and DPI (really CPI, counts per inch) = counts / inches.

import { parseDecimal } from "./parse";

export type DistanceUnit = "in" | "cm";

export const CM_PER_INCH = 2.54;

/** Default measuring distance for each unit (4 in ≈ 10.16 cm). */
export const DEFAULT_DISTANCE: Record<DistanceUnit, number> = { in: 4, cm: 10 };

/** Shortest distance we accept — below this, a 1–2 mm placement error is already >2%. */
export const MIN_DISTANCE_INCHES = 1;
/** Longest distance we accept — more than any mousepad needs. */
export const MAX_DISTANCE_INCHES = 40;

/** Fewer counts than this means the mouse barely moved (or the lock failed). */
export const MIN_COUNTS = 50;

export function toInches(distance: number, unit: DistanceUnit): number {
  return unit === "in" ? distance : distance / CM_PER_INCH;
}

export function convertDistance(distance: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return distance;
  return to === "cm" ? distance * CM_PER_INCH : distance / CM_PER_INCH;
}

export type Validation = { ok: true; value: number } | { ok: false; error: string };

export function validateDistance(raw: string, unit: DistanceUnit): Validation {
  const n = parseDecimal(raw);
  if (n === null) return { ok: false, error: "Enter the distance as a number, e.g. " + DEFAULT_DISTANCE[unit] + "." };
  const inches = toInches(n, unit);
  if (inches < MIN_DISTANCE_INCHES || inches > MAX_DISTANCE_INCHES) {
    const lo = unit === "in" ? `${MIN_DISTANCE_INCHES} in` : `${round(MIN_DISTANCE_INCHES * CM_PER_INCH, 1)} cm`;
    const hi = unit === "in" ? `${MAX_DISTANCE_INCHES} in` : `${round(MAX_DISTANCE_INCHES * CM_PER_INCH, 0)} cm`;
    return { ok: false, error: `Use a distance between ${lo} and ${hi}.` };
  }
  return { ok: true, value: n };
}

/** Expected DPI is optional: an empty field is valid and means "not set". */
export function validateExpectedDpi(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw.trim() === "") return { ok: true, value: null };
  const n = parseDecimal(raw);
  if (n === null || !Number.isInteger(n)) return { ok: false, error: "Enter a whole number, e.g. 1600 (no commas)." };
  if (n < 50 || n > 50000) return { ok: false, error: "Enter a DPI between 50 and 50000." };
  return { ok: true, value: n };
}

/** Counts per inch. `counts` may be negative (moved left); only magnitude matters. */
export function computeDpi(counts: number, inches: number): number {
  if (!(inches > 0)) throw new RangeError("inches must be > 0");
  return Math.abs(counts) / inches;
}

/** Signed percentage difference of measured from expected, e.g. -3.2 = 3.2% low. */
export function deviationPercent(measured: number, expected: number): number {
  if (!(expected > 0)) throw new RangeError("expected must be > 0");
  return ((measured - expected) / expected) * 100;
}

export type DeviationLevel = "good" | "fair" | "off";

/**
 * How to color a deviation. This method itself carries a few percent of
 * error (hand placement, a slightly diagonal path), so ±5% is treated as
 * a match and only >10% as clearly off.
 */
export function deviationLevel(percent: number): DeviationLevel {
  const a = Math.abs(percent);
  if (a <= 5) return "good";
  if (a <= 10) return "fair";
  return "off";
}

export interface RunSummary {
  count: number;
  mean: number;
  min: number;
  max: number;
  /** Population standard deviation. */
  stdDev: number;
  /** (max - min) / mean, as a percentage — how consistent the runs were. */
  spreadPercent: number;
}

export function summarizeRuns(dpis: readonly number[]): RunSummary | null {
  if (dpis.length === 0) return null;
  const count = dpis.length;
  const mean = dpis.reduce((a, b) => a + b, 0) / count;
  const min = Math.min(...dpis);
  const max = Math.max(...dpis);
  const variance = dpis.reduce((a, b) => a + (b - mean) ** 2, 0) / count;
  return { count, mean, min, max, stdDev: Math.sqrt(variance), spreadPercent: mean > 0 ? ((max - min) / mean) * 100 : 0 };
}

/**
 * Browsers disagree on movementX units: Chrome/Edge report physical
 * pixels, Firefox reports CSS pixels (so OS display scaling and page zoom
 * divide the numbers), Safari is inconsistent (w3c/pointerlock#42). If
 * the measured/expected ratio lands within `tolerance` of the display
 * scale factor (or its inverse), that — not the sensor — is the likely
 * cause, and this returns the value corrected for it. Otherwise null.
 */
export function scaleCorrection(
  measured: number,
  expected: number,
  devicePixelRatio: number,
  tolerance = 0.04,
): { factor: number; corrected: number } | null {
  if (!(expected > 0) || !(measured > 0) || !(devicePixelRatio > 0)) return null;
  if (Math.abs(devicePixelRatio - 1) < 0.05) return null; // no scaling in play
  const ratio = measured / expected;
  const near = (target: number) => Math.abs(ratio / target - 1) <= tolerance;
  if (near(1 / devicePixelRatio)) return { factor: devicePixelRatio, corrected: measured * devicePixelRatio };
  if (near(devicePixelRatio)) return { factor: 1 / devicePixelRatio, corrected: measured / devicePixelRatio };
  return null;
}

/** Vertical drift above this fraction of horizontal travel is worth warning about. */
export const MAX_DRIFT_RATIO = 0.1;

export function driftRatio(countsX: number, countsY: number): number {
  const x = Math.abs(countsX);
  return x === 0 ? 0 : Math.abs(countsY) / x;
}

export function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
