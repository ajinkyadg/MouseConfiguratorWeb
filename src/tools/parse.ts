// Shared number parsing for the tool pages' text inputs. The inputs are
// type="text" inputmode="decimal" rather than type="number", because
// number inputs silently return "" for text they can't parse (so we
// couldn't tell "empty" from "invalid") and handle a decimal comma
// inconsistently across browsers and locales.

/**
 * Parse a user-typed non-negative decimal. Accepts a comma as the decimal
 * separator ("2,5"), a leading or trailing separator (".5", "5."), and
 * surrounding whitespace. Rejects everything else — including thousands
 * separators, so "1,600" or "1.600.000" is an error rather than a
 * silently wrong number.
 */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim();
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(s)) return null;
  // "1,600" is ambiguous (1.6 or 1600); refuse it instead of guessing.
  if (/^[1-9]\d{0,2},\d{3}$/.test(s)) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
