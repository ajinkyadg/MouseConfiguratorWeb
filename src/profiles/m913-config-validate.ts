// Validation for M913 profiles coming from outside the page's own
// controls: imported files, share links, saved browser data and .jmk
// imports. Every field is rebuilt from the untrusted value, so nothing the
// page's controls couldn't produce ever reaches the mouse.
import { type LedMode } from "./m913";
import { parseAction, actionComboTokens, MAX_COMBO_TOKENS } from "./m913-buttons";
import { BUTTON_SLOTS } from "./m913-action-catalog";
import { defaultConfig, dpiColorsHexOf, type MouseWebConfig } from "./user-profiles";

const MAX_NAME_LENGTH = 60;

/** A profile name safe to keep and show: no control or direction-override
 * characters, bounded length. Display code must still escape it. */
export function cleanProfileName(name: unknown, fallback: string): string {
  if (typeof name !== "string") return fallback;
  const cleaned = name
    .replace(/\p{Cc}/gu, " ")
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned || fallback;
}

const M913_POLLING_RATES = [125, 250, 500, 1000];
const M913_LED_MODES: LedMode[] = ["off", "steady", "respiration", "rainbow"];
const M913_BUTTON_IDS = new Set(BUTTON_SLOTS.map((slot) => slot.id));
const M913_DPI_MIN = 50;
const M913_DPI_MAX = 16000;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

export function sanitizeM913Config(raw: unknown): MouseWebConfig {
  const d = defaultConfig();
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const dpi = d.dpi.map((fallback, i) => {
    const v = Array.isArray(r.dpi) ? r.dpi[i] : undefined;
    return typeof v === "number" && Number.isInteger(v) && v >= M913_DPI_MIN && v <= M913_DPI_MAX ? v : fallback;
  }) as MouseWebConfig["dpi"];

  const dpiEnabled = d.dpiEnabled.map((fallback, i) =>
    Array.isArray(r.dpiEnabled) && typeof r.dpiEnabled[i] === "boolean" ? (r.dpiEnabled[i] as boolean) : fallback
  ) as MouseWebConfig["dpiEnabled"];
  if (!dpiEnabled.some(Boolean)) dpiEnabled[0] = true;

  const buttonActions: Record<string, string> = {};
  if (r.buttonActions && typeof r.buttonActions === "object" && !Array.isArray(r.buttonActions)) {
    for (const [button, action] of Object.entries(r.buttonActions as Record<string, unknown>)) {
      if (!M913_BUTTON_IDS.has(button) || typeof action !== "string") continue;
      const value = action.trim().toLowerCase();
      if (value && value.length <= 60 && parseAction(value) && actionComboTokens(value) <= MAX_COMBO_TOKENS) {
        buttonActions[button] = value;
      }
    }
  }

  const ledColor = typeof r.ledColorHex === "string" ? r.ledColorHex.replace(/^#/, "").toLowerCase() : "";

  return {
    pollingRateHz: M913_POLLING_RATES.includes(r.pollingRateHz as number) ? (r.pollingRateHz as number) : d.pollingRateHz,
    dpi,
    dpiEnabled,
    dpiColorsHex: dpiColorsHexOf({ dpiColorsHex: r.dpiColorsHex as MouseWebConfig["dpiColorsHex"] }),
    ledMode: M913_LED_MODES.includes(r.ledMode as LedMode) ? (r.ledMode as LedMode) : d.ledMode,
    ledColorHex: /^[0-9a-f]{6}$/.test(ledColor) ? ledColor : d.ledColorHex,
    ledBrightness: clampInt(r.ledBrightness, d.ledBrightness, 0, 255),
    ledSpeed: clampInt(r.ledSpeed, d.ledSpeed, 1, 5),
    buttonActions,
  };
}
