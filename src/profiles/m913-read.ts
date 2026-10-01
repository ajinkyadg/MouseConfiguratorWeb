// Reading the M913's current configuration back from the mouse (Areson
// hardware). Built from a capture of Redragon's own Windows software doing
// exactly this — see docs/protocol-notes/m913-read.md. Pure functions only:
// the page sends the packets from readPlan() and feeds the replies to
// decodeConfig().
import tables from "../../docs/protocol-notes/m913-button-tables.json";
import { aresonDpiFromCode, type LedMode } from "./m913";
import type { DpiColorsHex, MouseWebConfig } from "./user-profiles";
import { KEY_COMBO_SPECIAL_GROUPS } from "./key-combo-keys";
import { MODIFIER_ORDER } from "./shortcut-names";

type Packet = Uint8Array;

function checksum(p: Packet): number {
  let sum = 0;
  for (let i = 0; i < 16; i++) sum += p[i]!;
  return (0x55 - sum) & 0xff;
}

function packet(bytes: number[]): Packet {
  const p = new Uint8Array(17);
  p.set(bytes);
  p[16] = checksum(p);
  return p;
}

/// Sub-command 0x08: read `len` (≤ 10) bytes at a 16-bit address.
export function buildReadPacket(address: number, len = 0x0a): Packet {
  return packet([0x08, 0x08, 0x00, (address >> 8) & 0xff, address & 0xff, len]);
}

const BUTTON_ORDER = tables.buttonIndexOrder as string[];
const KEY_EVENT_ADDRESSES = (tables.keyboardKeyAddressByProtocolSlot as [number, number][]).map(([hi, lo]) => (hi << 8) | lo);

/// The full request sequence, in the order the Windows software sends it.
/// The three short messages before the reads aren't understood yet, so
/// they're replayed byte for byte (see the protocol notes' open questions).
export function readPlan(): Packet[] {
  const plan = [
    packet([0x08, 0x03]),
    packet([0x08, 0x01, 0x00, 0x00, 0x00, 0x04, 0x03, 0x3a, 0x49, 0x48]),
    buildReadPacket(0x0004, 0x02),
    packet([0x08, 0x02, 0x00, 0x00, 0x00, 0x01, 0x01]),
  ];
  // Settings + button actions: 0x0000–0x009F.
  for (let a = 0x00; a < 0xa0; a += 0x0a) plan.push(buildReadPacket(a));
  // Each keyboard binding's event list: 20 bytes covers up to 6 events.
  for (const base of KEY_EVENT_ADDRESSES) plan.push(buildReadPacket(base), buildReadPacket(base + 0x0a));
  plan.push(packet([0x08, 0x04]));
  return plan;
}

/// Checks a reply against its request and, for reads, returns the data.
/// Throws on a malformed or mismatched reply so a bad read never becomes
/// a "loaded" configuration.
export function parseReply(request: Packet, reply: Uint8Array): Uint8Array | null {
  if (reply.length !== 17 || reply[0] !== 0x09) throw new Error(`Unexpected reply ${hex(reply)}`);
  if (checksum(reply) !== reply[16]) throw new Error(`Reply checksum mismatch: ${hex(reply)}`);
  if (reply[1] !== request[1]) throw new Error(`Reply is for command ${reply[1]}, expected ${request[1]}`);
  if (request[1] !== 0x08) return null;
  if (reply[3] !== request[3] || reply[4] !== request[4]) throw new Error(`Reply is for a different address: ${hex(reply)}`);
  return reply.slice(6, 6 + request[5]!);
}

function hex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(" ");
}

// --- Decoding ----------------------------------------------------------

export type Memory = Map<number, number>;

export interface DecodedConfig {
  config: Partial<MouseWebConfig>;
  /// Things that couldn't be decoded and were left as they were.
  warnings: string[];
}

const MOUSE_ACTIONS = Object.entries(tables.mouseActions as Record<string, number[]>);
const MODIFIER_BITS: Record<string, number> = { ctrl: 0x01, shift: 0x02, alt: 0x04, super: 0x08 };

// keyCodes has aliases (left / arrow_left, return / enter…); name keys the
// way the combo builder and preset tables do.
const PREFERRED_KEYS = new Set([
  ..."abcdefghijklmnopqrstuvwxyz0123456789".split(""),
  ...KEY_COMBO_SPECIAL_GROUPS.flatMap((g) => g.keys),
]);
const KEY_NAMES = new Map<number, string>();
for (const [name, code] of Object.entries(tables.keyCodes as Record<string, number>)) {
  const current = KEY_NAMES.get(code);
  if (!current || (!PREFERRED_KEYS.has(current) && PREFERRED_KEYS.has(name))) KEY_NAMES.set(code, name);
}

const POLLING_BY_CODE: Record<number, number> = { 0x01: 1000, 0x02: 500, 0x04: 250, 0x08: 125 };
const LED_BY_CODE: Record<number, LedMode> = { 0x00: "off", 0x01: "steady", 0x02: "respiration", 0x03: "rainbow" };

function bytes(mem: Memory, address: number, len: number): number[] | null {
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    const v = mem.get(address + i);
    if (v === undefined) return null;
    out.push(v);
  }
  return out;
}

// Most settings are stored as (value, 0x55 - value) pairs.
function checkedByte(mem: Memory, address: number): number | null {
  const pair = bytes(mem, address, 2);
  return pair && ((pair[0]! + pair[1]!) & 0xff) === 0x55 ? pair[0]! : null;
}

function rgbRecord(mem: Memory, address: number): string | null {
  const rec = bytes(mem, address, 4);
  if (!rec || ((rec[0]! + rec[1]! + rec[2]! + rec[3]!) & 0xff) !== 0x55) return null;
  return rec.slice(0, 3).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/// A keyboard binding's event list → "ctrl+shift+tab", "shift", "enter"…
/// Only key-down events matter; modifiers go in MODIFIER_ORDER.
function decodeKeyEvents(mem: Memory, base: number): string | null {
  const count = mem.get(base);
  if (count === undefined || count === 0 || count > 6) return null;
  const events = bytes(mem, base + 1, count * 3);
  if (!events) return null;
  let mods = 0;
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const [type, code] = [events[i * 3]!, events[i * 3 + 1]!];
    if (type === 0x80) mods |= code;
    else if (type === 0x81) {
      const name = KEY_NAMES.get(code);
      if (!name) return null;
      keys.push(name);
    }
  }
  const modNames = MODIFIER_ORDER.filter((m) => mods & MODIFIER_BITS[m]!);
  const combo = [...modNames, ...keys];
  return combo.length ? combo.join("+") : null;
}

function decodeAction(mem: Memory, index: number): string | null {
  const code = bytes(mem, 0x60 + index * 4, 4);
  if (!code) return null;
  if (code[0] === 0x04) return `fire:${code[1]}:${code[2]}`;
  if (code[0] === 0x05 || code[0] === 0x90) {
    const base = KEY_EVENT_ADDRESSES[index];
    return base === undefined ? null : decodeKeyEvents(mem, base);
  }
  const match = MOUSE_ACTIONS.find(([, b]) => b.every((x, i) => x === code[i]));
  return match ? match[0] : null;
}

export function decodeConfig(mem: Memory): DecodedConfig {
  const config: Partial<MouseWebConfig> = {};
  const warnings: string[] = [];

  const polling = checkedByte(mem, 0x00);
  if (polling !== null && POLLING_BY_CODE[polling]) config.pollingRateHz = POLLING_BY_CODE[polling];
  else warnings.push("polling rate");

  // DPI: five 4-byte stage records from 0x0C ([c0, c1, gap, c2]), and the
  // number of enabled stages at 0x02.
  const dpi: number[] = [];
  for (let stage = 0; stage < 5; stage++) {
    const rec = bytes(mem, 0x0c + stage * 4, 4);
    const value = rec ? aresonDpiFromCode([rec[0]!, rec[1]!, rec[3]!]) : undefined;
    if (value === undefined) warnings.push(`DPI stage ${stage + 1}`);
    dpi.push(value ?? 0);
  }
  if (dpi.every((v) => v > 0)) config.dpi = dpi as MouseWebConfig["dpi"];
  const stages = checkedByte(mem, 0x02);
  if (stages !== null && stages >= 1 && stages <= 5) {
    config.dpiEnabled = [0, 1, 2, 3, 4].map((i) => i < stages) as MouseWebConfig["dpiEnabled"];
  } else warnings.push("number of DPI stages");

  const colors = [0, 1, 2, 3, 4].map((i) => rgbRecord(mem, 0x2c + i * 4));
  if (colors.every(Boolean)) config.dpiColorsHex = colors as DpiColorsHex;
  else warnings.push("DPI stage colours");

  // LED: colour record at 0x54, mode at 0x58, brightness at 0x5A, speed at 0x5C.
  const ledColor = rgbRecord(mem, 0x54);
  const ledMode = checkedByte(mem, 0x58);
  const brightness = checkedByte(mem, 0x5a);
  const speed = checkedByte(mem, 0x5c);
  if (ledMode !== null && LED_BY_CODE[ledMode]) config.ledMode = LED_BY_CODE[ledMode];
  else warnings.push("LED mode");
  if (ledColor) config.ledColorHex = ledColor;
  if (brightness !== null) config.ledBrightness = brightness;
  if (speed !== null && speed >= 1 && speed <= 5) config.ledSpeed = speed;

  const buttonActions: Record<string, string> = {};
  BUTTON_ORDER.forEach((button, index) => {
    const action = decodeAction(mem, index);
    if (action === null) warnings.push(`button ${button}`);
    // Plain clicks on their own buttons are the factory default — leave
    // them "unchanged" so Apply doesn't rewrite them needlessly.
    else if (action !== button) buttonActions[button] = action;
  });
  config.buttonActions = buttonActions;

  return { config, warnings };
}
