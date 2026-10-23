// M908/M719 button-mapping action parser, implemented directly from
// docs/protocol-notes/m908.md's "Button mapping" section — not ported
// from any existing tool's code. The lookup tables it reads (special
// actions, keyboard modifier bits, snipe-DPI bytes) are transcribed facts
// shared across the whole mouse_m908 device family, not M908-specific.
import familyTables from "../../docs/protocol-notes/redragon-family-keycodes.json";
import m913Tables from "../../docs/protocol-notes/m913-button-tables.json";

const SPECIAL_ACTIONS = familyTables.specialActions as unknown as Record<string, [number, number, number, number]>;
const SNIPE_DPI_VALUES = familyTables.snipeDpiValues as unknown as Record<string, number>;

// Confirmed identical to this family's own _c_keyboard_key_values table
// (both are the standard USB HID keyboard usage codes) — reused directly
// rather than duplicating ~175 entries.
const KEY_CODES = m913Tables.keyCodes as unknown as Record<string, number>;

const MODIFIER_BITS: Record<string, number> = {
  ctrl_l: 1, shift_l: 2, alt_l: 4, super_l: 8,
  ctrl_r: 16, shift_r: 32, alt_r: 64, super_r: 128,
  // single-sided aliases, matching the site's existing M913 action syntax
  ctrl: 1, shift: 2, alt: 4, super: 8,
};

export const M908_BUTTON_NAMES = [
  "button_left", "button_right", "button_middle", "button_fire",
  "button_dpi_up", "button_dpi_down",
  "button_1", "button_2", "button_3", "button_4", "button_5", "button_6",
  "button_7", "button_8", "button_9", "button_10", "button_11", "button_12",
  "scroll_up", "scroll_down",
] as const;

export type M908ButtonName = (typeof M908_BUTTON_NAMES)[number];
export type M908ActionBytes = [number, number, number, number];

const U8_MAX = 255;

function parseFire(action: string): M908ActionBytes | null {
  const m = /^fire:([a-z0-9_]+):(\d+):(\d+)$/.exec(action);
  if (!m) return null;
  const [, keyName, repeatsStr, delayStr] = m;

  let keyCode: number | undefined;
  if (keyName === "mouse_left") keyCode = 0x81;
  else if (keyName === "mouse_right") keyCode = 0x82;
  else if (keyName === "mouse_middle") keyCode = 0x84;
  else keyCode = KEY_CODES[keyName];
  if (keyCode === undefined) return null;

  const repeats = Number(repeatsStr);
  const delay = Number(delayStr);
  if (repeats > U8_MAX || delay > U8_MAX) return null;

  return [0x99, keyCode, repeats, delay];
}

function parseSnipe(action: string): M908ActionBytes | null {
  const m = /^snipe:(\d+)$/.exec(action);
  if (!m) return null;
  const dpiByte = SNIPE_DPI_VALUES[m[1]];
  if (dpiByte === undefined) return null; // only 200-1100 DPI in 100-steps are documented
  return [0x9a, 0x01, dpiByte, dpiByte];
}

function parseMacro(action: string): M908ActionBytes | null {
  const m = /^macro(\d+)(?::(\d+|until|while))?$/.exec(action);
  if (!m) return null;
  const slot = Number(m[1]);
  if (slot < 1 || slot > 15) return null;

  const modifier = m[2];
  if (modifier === "until") return [0x91, slot - 1 + 0x3f, 0xff, 0xff];
  if (modifier === "while") return [0x91, slot - 1 + 0x7f, 0xff, 0xff];

  const repeats = modifier ? Number(modifier) : 1;
  if (repeats > U8_MAX) return null;
  return [0x91, slot - 1, repeats, 0x00];
}

function parseKeyboardKey(action: string): M908ActionBytes | null {
  const parts = action.split("+").filter(Boolean);
  if (parts.length === 0) return null;

  // A trailing modifier ("shift", "ctrl+shift") is sent as a key in its own
  // right: the family's key table lists the modifiers at HID usages
  // 0xE0-0xE7, in the same order as their modifier bits.
  const keyPart = parts[parts.length - 1];
  const trailingModifierBit = MODIFIER_BITS[keyPart];
  const keyCode = trailingModifierBit !== undefined ? 0xe0 + Math.log2(trailingModifierBit) : KEY_CODES[keyPart];
  if (keyCode === undefined) return null;

  let modifierByte = 0;
  for (const modifierName of parts.slice(0, -1)) {
    const bit = MODIFIER_BITS[modifierName];
    if (bit === undefined) return null;
    modifierByte |= bit;
  }

  return modifierByte === 0 ? [0x90, 0x00, keyCode, 0x00] : [0x8f, modifierByte, keyCode, 0x00];
}

// Parses an action string ("left", "dpi-cycle", "fire:a:5:10", "snipe:400",
// "macro3:until", "ctrl+shift+c", "0x90000600") into its 4-byte protocol
// code. Returns null for unrecognized input — never guesses.
export function parseM908Action(actionRaw: string): M908ActionBytes | null {
  const action = actionRaw.trim().toLowerCase();
  if (!action) return null;

  const hexMatch = /^0x([0-9a-f]{8})$/.exec(action);
  if (hexMatch) {
    const hex = hexMatch[1];
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      parseInt(hex.slice(6, 8), 16),
    ];
  }

  if (action in SPECIAL_ACTIONS) return [...SPECIAL_ACTIONS[action]] as M908ActionBytes;

  return parseFire(action) ?? parseSnipe(action) ?? parseMacro(action) ?? parseKeyboardKey(action);
}

export function m908ActionSupported(action: string): boolean {
  return parseM908Action(action) !== null;
}

// --- Reading a mapping back from the mouse ---

const MODIFIER_NAMES = ["ctrl", "shift", "alt", "super", "ctrl_r", "shift_r", "alt_r", "super_r"];
const FIRE_MOUSE_KEYS: Record<number, string> = { 0x81: "mouse_left", 0x82: "mouse_right", 0x84: "mouse_middle" };

const sameBytes = (a: readonly number[] | null, b: readonly number[]) => !!a && a.length === b.length && a.every((x, i) => x === b[i]);

// One name per HID usage, chosen so it parses back to the same key: some
// key names ("left", "right") are also mouse actions on their own.
const KEY_NAME_BY_CODE = new Map<number, string>();
// "arrow_up" reads better than "up", so those names go first.
const KEY_NAMES = Object.entries(KEY_CODES).sort(([a], [b]) => Number(b.startsWith("arrow_")) - Number(a.startsWith("arrow_")));
for (const [name, code] of KEY_NAMES) {
  if (KEY_NAME_BY_CODE.has(code) || !/^[a-z0-9_]+$/.test(name)) continue;
  if (sameBytes(parseM908Action(name), [0x90, 0x00, code, 0x00])) KEY_NAME_BY_CODE.set(code, name);
}

function keyName(code: number): string | undefined {
  if (code >= 0xe0 && code <= 0xe7) return MODIFIER_NAMES[code - 0xe0];
  return KEY_NAME_BY_CODE.get(code);
}

function candidateFor(b: readonly number[]): string | undefined {
  const [kind, b1, b2, b3] = b;
  for (const [name, bytes] of Object.entries(SPECIAL_ACTIONS)) if (sameBytes(bytes, b)) return name;
  if (kind === 0x90 && b1 === 0 && b3 === 0) return keyName(b2);
  if (kind === 0x8f && b3 === 0) {
    const key = keyName(b2);
    const mods = MODIFIER_NAMES.filter((_, i) => b1 & (1 << i));
    return key && mods.length ? [...mods, key].join("+") : undefined;
  }
  if (kind === 0x99) {
    const key = FIRE_MOUSE_KEYS[b1] ?? keyName(b1);
    return key ? `fire:${key}:${b2}:${b3}` : undefined;
  }
  if (kind === 0x9a && b1 === 0x01 && b2 === b3) {
    const dpi = Object.entries(SNIPE_DPI_VALUES).find(([, v]) => v === b2)?.[0];
    return dpi ? `snipe:${dpi}` : undefined;
  }
  if (kind === 0x91) {
    if (b2 === 0xff && b3 === 0xff && b1 >= 0x7f && b1 < 0x7f + 15) return `macro${b1 - 0x7f + 1}:while`;
    if (b2 === 0xff && b3 === 0xff && b1 >= 0x3f && b1 < 0x3f + 15) return `macro${b1 - 0x3f + 1}:until`;
    if (b1 < 15 && b3 === 0) return b2 === 1 ? `macro${b1 + 1}` : `macro${b1 + 1}:${b2}`;
  }
  return undefined;
}

/** The action string for 4 mapping bytes read from the mouse. Anything this
 * page has no name for comes back as a raw "0x…" code, which the parser
 * accepts, so applying it again writes the same bytes. */
export function describeM908Action(bytes: readonly number[]): string {
  const b = bytes.slice(0, 4);
  const name = candidateFor(b);
  if (name && sameBytes(parseM908Action(name), b)) return name;
  return "0x" + b.map((x) => (x & 0xff).toString(16).padStart(2, "0")).join("");
}
