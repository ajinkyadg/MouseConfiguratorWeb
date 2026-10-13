// Share links: one profile packed into the URL fragment
// (https://mouseconfig.app/m908#share=...). The fragment is never sent to
// a server, so sharing needs no backend and nothing is stored anywhere but
// the link itself. Everything read back out of a link is untrusted — it is
// rebuilt field by field before the page sees it. Pure functions only.
import { type LedMode } from "./m913";
import { parseAction, actionComboTokens, MAX_COMBO_TOKENS } from "./m913-buttons";
import { BUTTON_SLOTS } from "./m913-action-catalog";
import { defaultConfig, dpiColorsHexOf, type MouseWebConfig } from "./user-profiles";
import { type M908ProfileSettings } from "./m908";
import { m908ActionSupported, type M908ButtonName } from "./m908-buttons";
import { sanitizeM908Profile } from "./m908-profile-store";

export type ShareMouse = "m913" | "m908";

const SHARE_KEY = "share";
const SHARE_VERSION = 1;
// Real profiles encode to well under 2,000 characters; anything far past
// that isn't one of ours.
const MAX_FRAGMENT_LENGTH = 8000;
const MAX_NAME_LENGTH = 40;
const FALLBACK_NAME = "Shared profile";

function toBase64Url(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(encoded)) return null;
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

// Names from a link end up in menus and dialogs, so keep letters, digits
// and plain punctuation only — no markup characters, no control codes.
export function cleanShareName(name: unknown): string {
  if (typeof name !== "string") return FALLBACK_NAME;
  const cleaned = name
    .replace(/[^\p{L}\p{N} ._()+\-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned || FALLBACK_NAME;
}

export function buildShareUrl(pageUrl: string, mouse: ShareMouse, name: string, profile: unknown): string {
  const url = new URL(pageUrl);
  const payload = toBase64Url(JSON.stringify({ v: SHARE_VERSION, m: mouse, n: cleanShareName(name), p: profile }));
  return `${url.origin}${url.pathname}#${SHARE_KEY}=${payload}`;
}

export function hasShareFragment(hash: string): boolean {
  return hash.replace(/^#/, "").startsWith(`${SHARE_KEY}=`);
}

interface RawShare {
  mouse: string;
  name: string;
  profile: unknown;
}

function readRawShare(hash: string): RawShare | null {
  if (!hasShareFragment(hash) || hash.length > MAX_FRAGMENT_LENGTH) return null;
  const json = fromBase64Url(hash.replace(/^#/, "").slice(SHARE_KEY.length + 1));
  if (json === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const { v, m, n, p } = data as Record<string, unknown>;
  if (v !== SHARE_VERSION || typeof m !== "string" || !p || typeof p !== "object" || Array.isArray(p)) return null;
  return { mouse: m, name: cleanShareName(n), profile: p };
}

export type ShareResult<T> =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "wrong-mouse"; mouse: string }
  | { kind: "ok"; name: string; profile: T };

function readShare<T>(hash: string, mouse: ShareMouse, sanitize: (raw: unknown) => T): ShareResult<T> {
  if (!hasShareFragment(hash)) return { kind: "none" };
  const raw = readRawShare(hash);
  if (!raw) return { kind: "invalid" };
  if (raw.mouse !== mouse) return { kind: "wrong-mouse", mouse: cleanShareName(raw.mouse) };
  return { kind: "ok", name: raw.name, profile: sanitize(raw.profile) };
}

// --- M908 ---

// Raw "0x…" codes are dropped from shared profiles: the person opening the
// link can't tell what one does before applying it.
export function sanitizeSharedM908Profile(raw: unknown): M908ProfileSettings {
  const profile = sanitizeM908Profile(raw);
  const buttonActions: Partial<Record<M908ButtonName, string>> = {};
  for (const [button, action] of Object.entries(profile.buttonActions) as [M908ButtonName, string][]) {
    const value = action.trim().toLowerCase();
    if (!value.startsWith("0x") && m908ActionSupported(value)) buttonActions[button] = value;
  }
  return { ...profile, buttonActions };
}

export function readM908Share(hash: string): ShareResult<M908ProfileSettings> {
  return readShare(hash, "m908", sanitizeSharedM908Profile);
}

// --- M913 ---

const M913_POLLING_RATES = [125, 250, 500, 1000];
const M913_LED_MODES: LedMode[] = ["off", "steady", "respiration", "rainbow"];
const M913_BUTTON_IDS = new Set(BUTTON_SLOTS.map((slot) => slot.id));
const M913_DPI_MIN = 50;
const M913_DPI_MAX = 16000;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

export function sanitizeSharedM913Config(raw: unknown): MouseWebConfig {
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

export function readM913Share(hash: string): ShareResult<MouseWebConfig> {
  return readShare(hash, "m913", sanitizeSharedM913Config);
}
