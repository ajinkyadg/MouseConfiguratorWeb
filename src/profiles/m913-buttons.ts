// Button remapping — action parsing + the 8-packet mapping sequence +
// keyboard-key sub-packets. Implemented directly from
// docs/protocol-notes/m913.md's "Button remapping" section and the raw
// data in docs/protocol-notes/m913-button-tables.json.
import tables from "../../docs/protocol-notes/m913-button-tables.json";

export type ActionBytes = [number, number, number, number];
export type Hardware = "areson" | "compx";

const mouseActions = tables.mouseActions as unknown as Record<string, ActionBytes>;
const modifierBits = tables.modifierBits as unknown as Record<string, number>;
const keyCodes = tables.keyCodes as unknown as Record<string, number>;
export const BUTTON_ORDER = tables.buttonIndexOrder as string[];
const compxIndexTranslation = tables.compxIndexTranslation as unknown as Record<string, number>;
const keyAddressBySlot = tables.keyboardKeyAddressByProtocolSlot as unknown as [number, number][];
const defaultMappingAreson = tables.defaultButtonMappingAreson as number[][];
const defaultMappingCompx = tables.defaultButtonMappingCompx as number[][];

export const MAX_COMBO_TOKENS = 3;

interface KeyboardAction {
  mods: number;
  keys: number[];
}

export interface ParsedAction {
  bytes: ActionBytes;
  keyboard?: KeyboardAction;
}

function parseFire(action: string): ActionBytes | null {
  const m = /^fire:(\d+):(\d+)$/.exec(action);
  if (!m) return null;
  const speed = Number(m[1]);
  const times = Number(m[2]);
  if (speed < 3 || speed > 255 || times < 0 || times > 3) return null;
  const checksum = (0x55 - (4 + speed + times)) & 0xff;
  return [4, speed, times, checksum];
}

// Parses an action string ("left", "dpi+", "fire:58:3", "ctrl+shift+z", …)
// into its 4-byte protocol code. Returns null for unrecognized input.
export function parseAction(actionRaw: string): ParsedAction | null {
  const action = actionRaw.trim().toLowerCase();
  if (!action) return null;

  const fire = parseFire(action);
  if (fire) return { bytes: fire };

  if (action in mouseActions) {
    return { bytes: mouseActions[action] };
  }

  const parts = action.split("+").filter(Boolean);
  if (parts.length === 0) return null;

  let mods = 0;
  const keys: number[] = [];
  for (const part of parts) {
    if (part in modifierBits) {
      mods |= modifierBits[part];
    } else if (part in keyCodes) {
      keys.push(keyCodes[part]);
    } else {
      return null;
    }
  }

  if (keys.length === 0) {
    if (mods === 0) return null;
    return { bytes: [0x90, mods, 0, 0], keyboard: { mods, keys } };
  }
  if (keys.length === 1) {
    return { bytes: [0x90, mods, keys[0], 0], keyboard: { mods, keys } };
  }
  if (keys.length > 255) return null;
  return { bytes: [0x90, mods, keys[0], keys.length], keyboard: { mods, keys } };
}

// How many modifiers+keys a binding uses, for checking against
// MAX_COMBO_TOKENS before it's sent — mouse/DPI/media actions have no such
// limit (only keyboard-key bindings are packed into the fixed-size
// sub-packets that impose it).
export function actionComboTokens(actionRaw: string): number {
  const parsed = parseAction(actionRaw);
  if (!parsed?.keyboard) return 0;
  const { mods, keys } = parsed.keyboard;
  let count = keys.length;
  for (let bit = 1; bit <= 0x80; bit <<= 1) {
    if (mods & bit) count++;
  }
  return count;
}

function emptyPacket(): Uint8Array {
  const p = new Uint8Array(17);
  p[0] = 0x08;
  p[1] = 0x07;
  return p;
}

function finalize(p: Uint8Array): Uint8Array {
  let sum = 0;
  for (let i = 0; i < 16; i++) sum += p[i];
  p[16] = (0x55 - sum) & 0xff;
  return p;
}

function buildKeyboardSubPackets(addrHi: number, addrLo: number, action: KeyboardAction): Uint8Array[] {
  const { mods, keys } = action;
  const modBits = [1, 2, 4, 8, 16, 32, 64, 128];

  if ((mods === 0 && keys.length === 1) || (keys.length === 0 && mods !== 0)) {
    const p = emptyPacket();
    p[3] = addrHi;
    p[4] = addrLo;
    p[5] = 0x08;
    if (keys.length === 1) {
      const k = keys[0];
      p[6] = 0x02;
      p[7] = 0x81;
      p[8] = k;
      p[9] = 0x00;
      p[10] = 0x41;
      p[11] = k;
      p[12] = 0x00;
      p[13] = (0x55 - (0x02 + 0x81 + k + 0x41 + k)) & 0xff;
    } else {
      p[6] = 0x02;
      p[7] = 0x80;
      p[8] = mods;
      p[9] = 0x00;
      p[10] = 0x40;
      p[11] = mods;
      p[12] = 0x00;
      p[13] = (0x55 - (0x02 + 0x80 + mods + 0x40 + mods)) & 0xff;
    }
    return [finalize(p)];
  }

  // Modifier+key or multi-key combo: full event list, capacity-checked by
  // the caller via actionComboTokens()/MAX_COMBO_TOKENS before we get here.
  const events: number[] = [];
  for (const bit of modBits) if (mods & bit) events.push(0x80, bit, 0x00);
  for (const k of keys) events.push(0x81, k, 0x00);
  for (const bit of modBits) if (mods & bit) events.push(0x40, bit, 0x00);
  for (let i = keys.length - 1; i >= 0; i--) events.push(0x41, keys[i], 0x00);

  const count = events.length / 3;
  let isum = count;
  for (const b of events) isum += b;
  const inner = (0x55 - isum) & 0xff;

  const p1 = emptyPacket();
  p1[3] = addrHi;
  p1[4] = addrLo;
  p1[5] = 0x0a;
  p1[6] = count;
  for (let i = 0; i < 9 && i < events.length; i++) p1[7 + i] = events[i];
  finalize(p1);

  const p1EventCount = Math.min(9, events.length);
  const remaining = events.length - p1EventCount;
  const p2 = emptyPacket();
  p2[3] = addrHi;
  p2[4] = (addrLo + 0x0a) & 0xff;
  p2[5] = remaining + 1;
  for (let i = 0; i < remaining; i++) p2[6 + i] = events[p1EventCount + i];
  p2[6 + remaining] = inner;
  finalize(p2);

  return [p1, p2];
}

function buildMultimediaSubPacket(addrHi: number, addrLo: number, extra: number, code: number, extra2: number): Uint8Array {
  const p = emptyPacket();
  p[3] = addrHi;
  p[4] = addrLo;
  p[5] = 0x08;
  p[6] = 0x02;
  p[7] = 0x82;
  p[8] = code;
  p[9] = extra;
  p[10] = 0x42;
  p[11] = code;
  p[12] = extra2;
  p[13] = (0x55 - (0x02 + 0x82 + code + extra + 0x42 + code + extra2)) & 0xff;
  return finalize(p);
}

function protocolSlot(buttonId: string, hardware: Hardware): number {
  if (hardware === "compx") return compxIndexTranslation[buttonId];
  return BUTTON_ORDER.indexOf(buttonId);
}

// Builds the full packet sequence to apply a set of button remaps:
// keyboard-key sub-packets first (if any), then the 8 mapping packets.
// `changes` maps button id (from BUTTON_ORDER) -> action string; a button
// not present, or mapped to an empty string, keeps its current/factory
// action (its mapping-packet slot is left at the default template value).
export function buildButtonMappingPackets(changes: Record<string, string>, hardware: Hardware): Uint8Array[] {
  const template = hardware === "compx" ? defaultMappingCompx : defaultMappingAreson;
  const mapping = template.map((raw) => Uint8Array.from(raw));
  const subPackets: Uint8Array[] = [];
  const kbMarker: ActionBytes = [0x05, 0x00, 0x00, 0x50];

  for (const [buttonId, actionStr] of Object.entries(changes)) {
    if (!actionStr) continue;
    const slot = protocolSlot(buttonId, hardware);
    if (slot === undefined || slot < 0) continue;

    const parsed = parseAction(actionStr);
    if (!parsed) continue;

    if (parsed.keyboard) {
      const tokens = actionComboTokens(actionStr);
      if (tokens > MAX_COMBO_TOKENS) {
        // Defense in depth: the combo builder UI already checks this before
        // letting a user apply one, but a quick-pick catalog entry (or any
        // other caller) could still reach here with an oversized binding.
        // Without this check, buildKeyboardSubPackets() would silently
        // write past its 17-byte packet — never throwing, just corrupting
        // data — so refuse explicitly instead.
        throw new Error(
          `"${actionStr}" for button "${buttonId}" uses ${tokens} modifiers+keys — the hardware packet format allows at most ${MAX_COMBO_TOKENS}.`
        );
      }
    }

    const pkt = mapping[Math.floor(slot / 2)];
    const off = slot % 2 === 0 ? 6 : 10;

    if (parsed.bytes[0] === 0x90 && parsed.keyboard) {
      const [addrHi, addrLo] = keyAddressBySlot[slot];
      subPackets.push(...buildKeyboardSubPackets(addrHi, addrLo, parsed.keyboard));
      for (let k = 0; k < 4; k++) pkt[off + k] = kbMarker[k];
    } else if (parsed.bytes[0] === 0x92) {
      const [addrHi, addrLo] = keyAddressBySlot[slot];
      const [, extra, code, extra2] = parsed.bytes;
      subPackets.push(buildMultimediaSubPacket(addrHi, addrLo, extra, code, extra2));
      for (let k = 0; k < 4; k++) pkt[off + k] = kbMarker[k];
    } else {
      for (let k = 0; k < 4; k++) pkt[off + k] = parsed.bytes[k];
    }
  }

  for (const pkt of mapping) finalize(pkt);
  return [...subPackets, ...mapping];
}
