import { describe, it, expect } from "vitest";
import { parseM908Action, m908ActionSupported } from "./m908-buttons";

describe("parseM908Action — special actions (fixed lookup)", () => {
  it("matches real transcribed values from _c_keycodes", () => {
    expect(parseM908Action("left")).toEqual([0x81, 0x00, 0x00, 0x00]);
    expect(parseM908Action("dpi-cycle")).toEqual([0x88, 0x00, 0x00, 0x00]);
    expect(parseM908Action("compatibility_copy")).toEqual([0x8e, 0x01, 0xff, 0x12]);
    expect(parseM908Action("none")).toEqual([0x00, 0x00, 0x00, 0x00]);
  });
});

describe("parseM908Action — keyboard keys, with and without modifiers", () => {
  it("plain key uses byte0=0x90", () => {
    expect(parseM908Action("c")).toEqual([0x90, 0x00, 0x06, 0x00]); // HID usage 0x06 = 'c'
  });

  it("single modifier uses byte0=0x8f and the modifier bit", () => {
    expect(parseM908Action("ctrl+c")).toEqual([0x8f, 0x01, 0x06, 0x00]);
  });

  it("multiple modifiers OR their bits together", () => {
    expect(parseM908Action("ctrl+shift+c")).toEqual([0x8f, 0x03, 0x06, 0x00]);
  });

  it("supports the family's explicit left/right-side modifier names too", () => {
    expect(parseM908Action("ctrl_r+c")).toEqual([0x8f, 16, 0x06, 0x00]);
  });

  it("rejects an unrecognized key", () => {
    expect(parseM908Action("ctrl+madeupkey")).toBeNull();
  });
});

describe("parseM908Action — fire", () => {
  it("encodes key/repeats/delay", () => {
    expect(parseM908Action("fire:a:5:10")).toEqual([0x99, 0x04, 5, 10]); // 'a' = 0x04
  });

  it("supports mouse buttons as the fired key", () => {
    expect(parseM908Action("fire:mouse_left:3:0")).toEqual([0x99, 0x81, 3, 0]);
  });

  it("rejects repeats/delay beyond a byte", () => {
    expect(parseM908Action("fire:a:300:0")).toBeNull();
  });
});

describe("parseM908Action — snipe", () => {
  it("encodes a documented snipe DPI value", () => {
    expect(parseM908Action("snipe:400")).toEqual([0x9a, 0x01, 0x09, 0x09]);
  });

  it("rejects an undocumented snipe DPI value rather than guessing", () => {
    expect(parseM908Action("snipe:1234")).toBeNull();
  });
});

describe("parseM908Action — macro", () => {
  it("plain macro reference, default 1 repeat", () => {
    expect(parseM908Action("macro3")).toEqual([0x91, 2, 1, 0x00]);
  });

  it("macro with an explicit repeat count", () => {
    expect(parseM908Action("macro3:5")).toEqual([0x91, 2, 5, 0x00]);
  });

  it("macro repeat-until-pressed-again", () => {
    expect(parseM908Action("macro1:until")).toEqual([0x91, 0x3f, 0xff, 0xff]);
  });

  it("macro repeat-while-held", () => {
    expect(parseM908Action("macro1:while")).toEqual([0x91, 0x7f, 0xff, 0xff]);
  });

  it("rejects an out-of-range macro slot", () => {
    expect(parseM908Action("macro16")).toBeNull();
  });
});

describe("parseM908Action — raw hex escape hatch", () => {
  it("parses 0xNNNNNNNN directly", () => {
    expect(parseM908Action("0x90000600")).toEqual([0x90, 0x00, 0x06, 0x00]);
  });
});

describe("m908ActionSupported", () => {
  it("mirrors parseM908Action's null-ness", () => {
    expect(m908ActionSupported("left")).toBe(true);
    expect(m908ActionSupported("not-a-real-action")).toBe(false);
  });
});
