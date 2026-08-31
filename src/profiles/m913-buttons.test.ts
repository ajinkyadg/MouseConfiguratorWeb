import { describe, it, expect } from "vitest";
import { parseAction, actionComboTokens, buildButtonMappingPackets, MAX_COMBO_TOKENS, BUTTON_ORDER } from "./m913-buttons";
import { ACTION_CATEGORIES } from "./m913-action-catalog";

function expectValidChecksum(p: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < 16; i++) sum += p[i];
  expect(p[16]).toBe((0x55 - sum) & 0xff);
  expect(p.length).toBe(17);
}

describe("parseAction", () => {
  it("mouse/special actions", () => {
    expect(parseAction("left")?.bytes).toEqual([1, 1, 0, 83]);
    expect(parseAction("none")?.bytes).toEqual([0, 0, 0, 85]);
  });

  it("fire:speed:times, including the checksum byte", () => {
    // "fire:58:3" is the exact string used in the Fire Button quick-pick category.
    expect(parseAction("fire:58:3")?.bytes).toEqual([4, 58, 3, 20]);
  });

  it("rejects fire speed/times outside the valid range", () => {
    expect(parseAction("fire:2:0")).toBeNull(); // speed must be >= 3
    expect(parseAction("fire:58:4")).toBeNull(); // times must be <= 3
  });

  it("single modifier+key", () => {
    const parsed = parseAction("ctrl+c");
    expect(parsed?.bytes).toEqual([0x90, 0x01, 0x06, 0]);
    expect(parsed?.keyboard).toEqual({ mods: 0x01, keys: [0x06] });
  });

  it("a plain function key with no modifier (Show Desktop = f11)", () => {
    const parsed = parseAction("f11");
    expect(parsed?.bytes).toEqual([0x90, 0, 0x44, 0]); // HID usage 0x44 = F11
    expect(parsed?.keyboard).toEqual({ mods: 0, keys: [0x44] });
  });

  it("multi-key combo encodes key count in byte 3", () => {
    const parsed = parseAction("a+b+c");
    expect(parsed?.bytes).toEqual([0x90, 0, 0x04, 3]);
  });

  it("modifier-only binding", () => {
    expect(parseAction("ctrl")?.bytes).toEqual([0x90, 0x01, 0, 0]);
  });

  it("rejects unrecognized input", () => {
    expect(parseAction("not_a_real_key")).toBeNull();
    expect(parseAction("")).toBeNull();
  });
});

describe("actionComboTokens", () => {
  it("is 0 for non-keyboard actions (no combo limit applies)", () => {
    expect(actionComboTokens("left")).toBe(0);
    expect(actionComboTokens("fire:58:3")).toBe(0);
  });

  it("counts modifiers + keys for keyboard bindings", () => {
    expect(actionComboTokens("ctrl+c")).toBe(2);
    expect(actionComboTokens("ctrl+shift+z")).toBe(3);
  });

  // This is the concrete bug the "Show Desktop" question turned up:
  // "ctrl+alt+super+d" is listed as a quick pick under Windows Shortcuts,
  // but 3 modifiers + 1 key = 4 tokens, one over MAX_COMBO_TOKENS. The
  // hardware's keyboard-key sub-packets physically cannot fit it — this
  // isn't a policy choice, it's a fixed packet-size limit. Selecting this
  // preset can never actually apply successfully.
  it("flags catalog entries that exceed the hardware's combo capacity", () => {
    const overCapacity = ACTION_CATEGORIES.flatMap((c) => c.actions)
      .map((a) => a.value)
      .filter((value) => actionComboTokens(value) > MAX_COMBO_TOKENS);
    expect(overCapacity).toEqual([]);
  });
});

describe("buildButtonMappingPackets", () => {
  it("always returns exactly 8 mapping packets when there are no keyboard bindings", () => {
    const packets = buildButtonMappingPackets({ left: "right", right: "left" }, "areson");
    expect(packets).toHaveLength(8);
    for (const p of packets) expectValidChecksum(p);
  });

  it("writes a direct action to the correct packet/offset for a known button", () => {
    // "fire" is enum index 11 -> packet 5 (11/2=5), offset 10 (odd index).
    const packets = buildButtonMappingPackets({ fire: "dpi-cycle" }, "areson");
    const pkt = packets[5];
    expect([pkt[10], pkt[11], pkt[12], pkt[13]]).toEqual([2, 1, 0, 82]);
  });

  it("leaves untouched buttons at their template default", () => {
    const untouched = buildButtonMappingPackets({}, "areson");
    const withOneChange = buildButtonMappingPackets({ left: "right" }, "areson");
    // Every packet except the one containing "left" (enum 7 -> packet 3,
    // offset 10) should be byte-identical to the untouched template.
    for (let i = 0; i < 8; i++) {
      if (i === 3) continue;
      expect(withOneChange[i]).toEqual(untouched[i]);
    }
  });

  it("a single plain key binding produces exactly one keyboard sub-packet before the 8 mapping packets", () => {
    const packets = buildButtonMappingPackets({ side1: "f11" }, "areson");
    expect(packets).toHaveLength(9); // 1 sub-packet + 8 mapping packets
    expectValidChecksum(packets[0]);
    // side1 = enum index 0 -> mapping packet 0, offset 6, marked as a
    // keyboard-key binding (05 00 00 50).
    expect([packets[1][6], packets[1][7], packets[1][8], packets[1][9]]).toEqual([5, 0, 0, 80]);
  });

  it("a modifier+key combo produces two keyboard sub-packets", () => {
    const packets = buildButtonMappingPackets({ side2: "ctrl+shift+z" }, "areson");
    expect(packets).toHaveLength(10); // 2 sub-packets + 8 mapping packets
    expectValidChecksum(packets[0]);
    expectValidChecksum(packets[1]);
  });

  it("applies the Compx index translation, not the Areson identity mapping", () => {
    // "left" is enum index 7. Under Areson that's packet 3 offset 10.
    // Under Compx, compxIndexTranslation maps left -> protocol slot 0,
    // i.e. packet 0 offset 6.
    const aresonPackets = buildButtonMappingPackets({ left: "right" }, "areson");
    const compxPackets = buildButtonMappingPackets({ left: "right" }, "compx");
    expect([aresonPackets[3][10], aresonPackets[3][11]]).toEqual([1, 2]); // "right" action bytes[0..1]
    expect([compxPackets[0][6], compxPackets[0][7]]).toEqual([1, 2]);
  });

  it("covers every button in BUTTON_ORDER without throwing", () => {
    const changes = Object.fromEntries(BUTTON_ORDER.map((id) => [id, "left"]));
    expect(() => buildButtonMappingPackets(changes, "areson")).not.toThrow();
    expect(() => buildButtonMappingPackets(changes, "compx")).not.toThrow();
  });
});
