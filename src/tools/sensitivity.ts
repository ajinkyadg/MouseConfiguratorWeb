// Pure math for the sensitivity converter page (sensitivity-converter.html).
//
// Model: a game turns the camera by `yaw × sensitivity` degrees for each
// mouse count, so one full 360° turn takes 360 / (yaw × sens × DPI)
// inches of mouse travel. Keeping that distance ("cm/360") the same is
// what keeps aim muscle memory the same, whether the change is a new DPI
// in one game or moving between games.
//
// Yaw constants (degrees per count at sensitivity 1). Only games whose
// value could be checked against a reputable source are listed; engines
// with FOV- or resolution-dependent scaling (Fortnite, Rainbow Six, most
// Unreal/Frostbite titles) are deliberately left out because a single
// constant would be wrong for them.
//
//  - Source / Source 2 (CS2, CS:GO, TF2): `m_yaw` cvar, default 0.022.
//      https://csdb.gg/command/m-yaw/  ("Mouse yaw (horizontal)
//      sensitivity factor", default 0.022)
//  - Apex Legends: built on a Source-derived engine and uses the same
//      0.022 scale. Cross-check: mouse-sensitivity.com's Apex page gives
//      sens 0.65–2.6 at 800 DPI for 80–20 cm/360, which is exactly
//      914.4 / (0.022 × 800 × cm).
//      https://www.mouse-sensitivity.com/n/apex-legends/
//  - Valorant: 0.07. Cross-check: mouse-sensitivity.com gives 0.204–0.816
//      at 800 DPI for 80–20 cm/360 = 914.4 / (0.07 × 800 × cm).
//      https://www.mouse-sensitivity.com/n/valorant/
//  - Overwatch 2: 0.0066. Cross-check: mouse-sensitivity.com gives
//      2.16–8.66 at 800 DPI for 80–20 cm/360 = 914.4 / (0.0066 × 800 × cm).
//      https://www.mouse-sensitivity.com/n/overwatch/
//
// These are hip-fire (unscoped) values; scoped/ADS multipliers are
// game-specific settings on top and aren't converted here.

import { parseDecimal } from "./parse";

export const CM_PER_INCH = 2.54;

export interface Game {
  id: string;
  name: string;
  /** Degrees of rotation per mouse count at sensitivity 1. */
  yaw: number;
}

export const GAMES: readonly Game[] = [
  { id: "cs2", name: "Counter-Strike 2", yaw: 0.022 },
  { id: "csgo", name: "CS:GO", yaw: 0.022 },
  { id: "apex", name: "Apex Legends", yaw: 0.022 },
  { id: "tf2", name: "Team Fortress 2", yaw: 0.022 },
  { id: "valorant", name: "Valorant", yaw: 0.07 },
  { id: "ow2", name: "Overwatch 2", yaw: 0.0066 },
];

export function findGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

/** eDPI: DPI × in-game sensitivity. Only comparable between games with the same yaw. */
export function edpi(sens: number, dpi: number): number {
  return sens * dpi;
}

/** Inches of mouse travel for one full 360° turn. */
export function inchesPer360(yaw: number, sens: number, dpi: number): number {
  assertPositive({ yaw, sens, dpi });
  return 360 / (yaw * sens * dpi);
}

/** Centimetres of mouse travel for one full 360° turn. */
export function cmPer360(yaw: number, sens: number, dpi: number): number {
  return inchesPer360(yaw, sens, dpi) * CM_PER_INCH;
}

/**
 * Same game, new DPI: keep sens × DPI constant so cm/360 is unchanged.
 * Doesn't need the game's yaw — it cancels out.
 */
export function sensForNewDpi(oldSens: number, oldDpi: number, newDpi: number): number {
  assertPositive({ oldSens, oldDpi, newDpi });
  return (oldSens * oldDpi) / newDpi;
}

/**
 * Game to game (optionally with a DPI change too): keep
 * yaw × sens × DPI constant, i.e. the same degrees per inch of travel.
 */
export function convertSens(
  sens: number,
  from: { yaw: number; dpi: number },
  to: { yaw: number; dpi: number },
): number {
  assertPositive({ sens, fromYaw: from.yaw, fromDpi: from.dpi, toYaw: to.yaw, toDpi: to.dpi });
  return (sens * from.yaw * from.dpi) / (to.yaw * to.dpi);
}

/**
 * Round a sensitivity for display: four significant figures (enough that
 * rounding changes cm/360 by <0.05%), never more than four decimals, and
 * no trailing zeros. 0.31428… → "0.3143", 3.3333… → "3.333", 2 → "2".
 */
export function formatSens(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const digits = Math.min(4, Math.max(0, 3 - Math.floor(Math.log10(Math.abs(n)))));
  return trimZeros(n.toFixed(digits));
}

/** cm/360 and in/360 with one or two decimals. */
export function formatDistance(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return trimZeros(n.toFixed(n >= 100 ? 1 : 2));
}

function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

export type Parsed = { ok: true; value: number } | { ok: false; error: string };

export function validateSens(raw: string): Parsed {
  if (raw.trim() === "") return { ok: false, error: "Enter your sensitivity." };
  const n = parseDecimal(raw);
  if (n === null) return { ok: false, error: "Use a plain number, e.g. 1.25 or 0,4." };
  if (n <= 0) return { ok: false, error: "Sensitivity must be greater than 0." };
  if (n > 1000) return { ok: false, error: "That's higher than any game allows — check the value." };
  return { ok: true, value: n };
}

export function validateDpi(raw: string): Parsed {
  if (raw.trim() === "") return { ok: false, error: "Enter a DPI." };
  const n = parseDecimal(raw);
  if (n === null) return { ok: false, error: "Use a plain number without commas, e.g. 1600." };
  if (n < 50 || n > 50000) return { ok: false, error: "DPI must be between 50 and 50000." };
  return { ok: true, value: n };
}

function assertPositive(values: Record<string, number>) {
  for (const [k, v] of Object.entries(values)) {
    if (!(v > 0) || !Number.isFinite(v)) throw new RangeError(`${k} must be a positive number`);
  }
}
