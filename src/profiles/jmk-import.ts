// Decodes .jmk profile files exported by Redragon's official Windows
// configuration software, so a config someone shares as a .jmk file
// (forums, Discord, etc.) can be imported here even though Mac/Linux users
// have no way to open it with the official software.
//
// Reverse-engineered from real sample exports (a "MacProfile.jmk" and a
// "WindowsProfile.jmk" of the same underlying config) by diffing the two
// and confirming known bindings (Cmd+C / Ctrl+C for Copy, Cmd+V / Ctrl+V
// for Paste, etc.) against the resulting byte differences. Facts only —
// byte offsets, the modifier bitmask, and the key-byte scheme — no code
// was available to reference, this is a from-scratch structural read.
//
// Confirmed:
//  - The button table starts at byte 640 and holds 12 fixed 40-byte
//    records in order (side1..side12): byte 0 of each record is a
//    modifier bitmask, byte 1 is the key.
//  - Modifier bitmask matches the standard USB HID keyboard modifier
//    byte: Ctrl=1, Shift=2, Alt=4, Super(Cmd/Win)=8 — confirmed for Ctrl
//    and Super directly (Copy/Paste, Ctrl+Win+arrow virtual-desktop
//    switching on the Windows export); Shift/Alt are inferred from the
//    same standard, not independently confirmed against a real sample.
//  - The key byte uses Windows virtual-key-style codes: plain ASCII for
//    letters/digits, standard VK codes for non-printable keys (arrows,
//    tab, enter, space, delete, F-keys, backspace, escape).
//
// Not decoded (out of scope for this version): buttons bound to a named
// custom macro (recorded keystroke sequences, e.g. side7/side8 in the
// sample files) use a completely different encoding elsewhere in the
// file and are reported as unrecognized rather than guessed at.
const BUTTON_TABLE_START = 640; // byte offset of side1's modifier byte
const BUTTON_RECORD_STRIDE = 40; // bytes between consecutive button records
const BUTTON_COUNT = 12; // side1..side12, one record each, in table order

// Matches m913-button-tables.json's modifierBits values exactly (both are
// the standard USB HID keyboard modifier byte) — see file header.
const MODIFIER_BITS: [bit: number, token: string][] = [
  [1, "ctrl"],
  [2, "shift"],
  [4, "alt"],
  [8, "super"],
];

// jmk key byte -> the site's own key-name tokens (must match the spelling
// in m913-button-tables.json's keyCodes, since the decoded action string
// is parsed later by profiles/m913-buttons.ts's parseAction()).
const NAMED_KEY_TOKENS: Record<number, string> = {
  0x08: "backspace",
  0x09: "tab",
  0x0d: "enter",
  0x1b: "escape",
  0x20: "space",
  0x25: "arrow_left",
  0x26: "arrow_up",
  0x27: "arrow_right",
  0x28: "arrow_down",
  0x2e: "delete",
};

function keyByteToToken(byte: number): string | null {
  if (byte >= 0x41 && byte <= 0x5a) return String.fromCharCode(byte).toLowerCase(); // A-Z
  if (byte >= 0x30 && byte <= 0x39) return String.fromCharCode(byte); // 0-9
  if (byte >= 0x70 && byte <= 0x7b) return `f${byte - 0x70 + 1}`; // F1-F12
  return NAMED_KEY_TOKENS[byte] ?? null;
}

function modifierByteToTokens(byte: number): string[] {
  return MODIFIER_BITS.filter(([bit]) => byte & bit).map(([, token]) => token);
}

export interface JmkButtonMapping {
  /** 1-based button slot: 1 = side1, 2 = side2, etc. */
  index: number;
  /** Action string in the site's own format (e.g. "super+c"), or null if
   * the slot is unmapped or uses a named custom macro (not decoded here). */
  action: string | null;
}

// Reads the 12-slot direct-action button table. Buttons bound to a named
// custom macro (see file header) have key byte 0 here and decode to null
// — their real binding lives in a different part of the file this module
// doesn't parse.
export function decodeJmkButtonTable(bytes: Uint8Array): JmkButtonMapping[] {
  const results: JmkButtonMapping[] = [];
  for (let i = 0; i < BUTTON_COUNT; i++) {
    const recordStart = BUTTON_TABLE_START + i * BUTTON_RECORD_STRIDE;
    const modifierByte = bytes[recordStart];
    const keyByte = bytes[recordStart + 1];
    const keyToken = keyByte === 0 ? null : keyByteToToken(keyByte);

    if (keyToken === null) {
      results.push({ index: i + 1, action: null });
      continue;
    }

    const action = [...modifierByteToTokens(modifierByte), keyToken].join("+");
    results.push({ index: i + 1, action });
  }
  return results;
}

// Convenience wrapper producing a buttonActions-shaped object (see
// lib/plan.ts / profiles/user-profiles.ts's MouseWebConfig), ready to
// merge into a profile. Unmapped/unrecognized slots are simply omitted.
export function jmkToButtonActions(bytes: Uint8Array): Record<string, string> {
  const actions: Record<string, string> = {};
  for (const { index, action } of decodeJmkButtonTable(bytes)) {
    if (action) actions[`side${index}`] = action;
  }
  return actions;
}
