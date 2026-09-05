import { describe, it, expect } from "vitest";
import { decodeJmkButtonTable, jmkToButtonActions } from "./jmk-import";

const BUTTON_TABLE_START = 640;
const BUTTON_RECORD_STRIDE = 40;

// Builds a minimal synthetic .jmk buffer with only the button table
// populated (real files are ~11KB with a header/macro region this module
// doesn't touch) — enough to exercise the decoder without embedding a real
// personal export as a fixture.
function buildJmkFixture(records: Array<[modifier: number, key: number] | null>): Uint8Array {
  const size = BUTTON_TABLE_START + records.length * BUTTON_RECORD_STRIDE;
  const bytes = new Uint8Array(size);
  records.forEach((record, i) => {
    if (!record) return;
    const [modifier, key] = record;
    const offset = BUTTON_TABLE_START + i * BUTTON_RECORD_STRIDE;
    bytes[offset] = modifier;
    bytes[offset + 1] = key;
  });
  return bytes;
}

describe("decodeJmkButtonTable", () => {
  it("decodes Cmd+C and Ctrl+C for the same key byte, differing only by modifier", () => {
    const mac = buildJmkFixture([[0x08, 0x43]]);
    const windows = buildJmkFixture([[0x01, 0x43]]);
    expect(decodeJmkButtonTable(mac)[0]).toEqual({ index: 1, action: "super+c" });
    expect(decodeJmkButtonTable(windows)[0]).toEqual({ index: 1, action: "ctrl+c" });
  });

  it("decodes non-printable keys via their VK-style byte", () => {
    const bytes = buildJmkFixture([
      [0x01, 0x09], // Ctrl+Tab
      [0x03, 0x09], // Ctrl+Shift+Tab
      [0x01, 0x25], // Ctrl+Left
      [0x09, 0x27], // Ctrl+Super+Right
      [0x00, 0x2e], // plain Delete, no modifier
    ]);
    const results = decodeJmkButtonTable(bytes);
    expect(results.slice(0, 5).map((r) => r.action)).toEqual([
      "ctrl+tab",
      "ctrl+shift+tab",
      "ctrl+arrow_left",
      "ctrl+super+arrow_right",
      "delete",
    ]);
  });

  it("treats a fully zeroed record as unmapped, not Ctrl+<nul>", () => {
    const bytes = buildJmkFixture([[0x00, 0x00]]);
    expect(decodeJmkButtonTable(bytes)[0]).toEqual({ index: 1, action: null });
  });

  it("reports an unrecognized key byte as null rather than guessing", () => {
    const bytes = buildJmkFixture([[0x00, 0xfe]]);
    expect(decodeJmkButtonTable(bytes)[0]).toEqual({ index: 1, action: null });
  });

  it("always returns exactly 12 slots, in side1..side12 order", () => {
    const bytes = buildJmkFixture(new Array(12).fill([0x00, 0x00]));
    const results = decodeJmkButtonTable(bytes);
    expect(results.map((r) => r.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("jmkToButtonActions", () => {
  it("omits unmapped slots and keys the rest by side number", () => {
    const bytes = buildJmkFixture([
      [0x08, 0x43], // side1: Cmd+C
      [0x00, 0x00], // side2: unmapped
      [0x08, 0x56], // side3: Cmd+V
    ]);
    expect(jmkToButtonActions(bytes)).toEqual({
      side1: "super+c",
      side3: "super+v",
    });
  });
});
