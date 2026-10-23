import { describe, it, expect } from "vitest";
import { buildM908LargeReadPlan, buildM908ReadPlan, decodeM908Memory, m908ReplyDataBytes, normalizeM908Reply, storeM908Reply, type M908Memory } from "./m908-read";
import { buildM908ApplySequence, buildM908SettingsRows, m908ProfileKey, type M908FiveProfiles } from "./m908";
import { describeM908Action, parseM908Action } from "./m908-buttons";
import { defaultM908ProfileSet } from "./m908-profile-store";
import { M908_BUILT_IN_PRESETS, M908_NEUTRAL_PROFILE } from "./m908-presets";

// A stand-in mouse: f3 rows write memory, f2 rows read it back in the
// reply layout Redragon's software expects (data from byte 8).
function fakeMouse(initial?: M908Memory) {
  const memory: M908Memory = new Map(initial);
  return {
    memory,
    write(row: number[]) {
      if (row[1] !== 0xf3) return;
      const at = row[2] | (row[3] << 8);
      for (let k = 0; k < row[4]; k++) memory.set(at + k, row[8 + k]);
    },
    read(row: number[]): Uint8Array {
      const reply = new Uint8Array(row.length);
      reply.set(row.slice(0, 8));
      const at = row[2] | (row[3] << 8);
      for (let k = 0; k < row[4]; k++) reply[8 + k] = memory.get(at + k) ?? 0;
      return reply;
    },
  };
}

function applyAndRead(profiles: M908FiveProfiles, active: 0 | 1 | 2 | 3 | 4 = 0) {
  const mouse = fakeMouse();
  for (const step of buildM908ApplySequence(profiles, active)) step.rows.forEach((row) => mouse.write(row));
  const read: M908Memory = new Map();
  for (const req of buildM908ReadPlan()) storeM908Reply(read, req, mouse.read(req.row));
  return decodeM908Memory(read, defaultM908ProfileSet());
}

const rowsOf = (profiles: M908FiveProfiles) => {
  const { settings1, settings3 } = buildM908SettingsRows(profiles);
  return [...settings1, ...settings3].map((r) => r.join(","));
};

describe("reading profiles back from the mouse", () => {
  const presets = M908_BUILT_IN_PRESETS.slice(0, 5).map((p) => structuredClone(p.profile)) as M908FiveProfiles;

  it("re-applying what was read writes exactly the same settings bytes", () => {
    const { set, warnings } = applyAndRead(presets, 3);
    expect(warnings).toEqual([]);
    expect(rowsOf(set.profiles)).toEqual(rowsOf(presets));
    expect(set.activeProfile).toBe(3);
  });

  it("recovers each setting in page terms", () => {
    const mine = M908_BUILT_IN_PRESETS.find((p) => p.id === "m908-preset-default")!.profile;
    const five = [mine, mine, mine, mine, mine].map((p) => structuredClone(p)) as M908FiveProfiles;
    five[1] = { ...five[1], lightMode: "breathing", color: [10, 20, 30], speed: 2, brightness: 40, reportRateHz: 250, dpiValues: [200, 1600, 6400, 8000, 12400], dpiEnabled: [false, true, true, true, false], dpiStartStage: 2 };
    const { set } = applyAndRead(five);
    const p1 = set.profiles[0], p2 = set.profiles[1];
    expect(p1.buttonActions.button_11).toBe("shift");
    expect(p1.buttonActions.button_1).toBe("super+c");
    expect(p1.buttonActions.button_fire).toBe("enter");
    expect(p1.buttonActions.button_left).toBeUndefined(); // factory mapping stays unset
    expect(p1.color).toEqual([0, 0, 255]);
    expect(p2).toMatchObject({ lightMode: "breathing", color: [10, 20, 30], speed: 2, reportRateHz: 250, dpiValues: [200, 1600, 6400, 8000, 12400], dpiEnabled: [false, true, true, true, false], dpiStartStage: 2 });
    expect(p2.brightness).toBe(85); // level 1 of 3
  });

  it("reads presets back exactly as the page holds them, so the preset picker recognises them", () => {
    const { set } = applyAndRead(presets);
    set.profiles.forEach((p, i) => expect(m908ProfileKey(p), M908_BUILT_IN_PRESETS[i].id).toBe(m908ProfileKey(presets[i])));
  });

  it("reads the same profiles through 64-byte reports alone", () => {
    const mouse = fakeMouse();
    for (const step of buildM908ApplySequence(presets, 2)) step.rows.forEach((row) => mouse.write(row));
    const plan = buildM908LargeReadPlan();
    expect(plan.every((r) => r.row[0] === 3 && r.row.length === 64 && r.length === 0x20)).toBe(true);
    expect(plan.length).toBeLessThan(40);
    const read: M908Memory = new Map();
    for (const req of plan) storeM908Reply(read, req, mouse.read(req.row));
    const { set, warnings } = decodeM908Memory(read, defaultM908ProfileSet());
    expect(warnings).toEqual([]);
    expect(rowsOf(set.profiles)).toEqual(rowsOf(presets));
    expect(set.activeProfile).toBe(2);
  });

  it("keeps scroll speed from the page, since the mouse can't report it", () => {
    const current = defaultM908ProfileSet();
    current.profiles[0].scrollSpeed = 7;
    const mouse = fakeMouse();
    const read: M908Memory = new Map();
    for (const req of buildM908ReadPlan()) storeM908Reply(read, req, mouse.read(req.row));
    expect(decodeM908Memory(read, current).set.profiles[0].scrollSpeed).toBe(7);
  });

  it("reports what it couldn't decode and keeps the current value", () => {
    const { set, warnings } = decodeM908Memory(new Map(), defaultM908ProfileSet());
    expect(warnings).toContain("profile 1 lighting mode");
    expect(warnings).toContain("profile 5 polling rate");
    expect(set.profiles[0]).toMatchObject({ lightMode: M908_NEUTRAL_PROFILE.lightMode, dpiValues: M908_NEUTRAL_PROFILE.dpiValues });
  });

  it("asks only with the read command, in the official request shape", () => {
    const plan = buildM908ReadPlan();
    expect(plan.every((r) => r.row[1] === 0xf2)).toBe(true);
    expect(plan[0].row.slice(0, 5)).toEqual([0x02, 0xf2, 0x2c, 0x00, 0x01]);
    const led = plan.find((r) => r.address === 0x449)!;
    expect(led.row.slice(0, 5)).toEqual([0x02, 0xf2, 0x49, 0x04, 0x07]);
    const dpi = plan.find((r) => r.address === 0x42)!;
    expect(dpi.row.slice(0, 5)).toEqual([0x03, 0xf2, 0x42, 0x00, 0x20]);
    expect(dpi.row).toHaveLength(64);
    expect(plan).toHaveLength(3 + 5 * (2 + 20));
  });
});

describe("normalizeM908Reply", () => {
  const req = buildM908ReadPlan()[0];
  it("accepts replies with or without the report ID byte", () => {
    const full = Uint8Array.from({ length: 16 }, (_, i) => i);
    expect(normalizeM908Reply(req, full)).toBe(full);
    const short = Uint8Array.from({ length: 15 }, (_, i) => i + 1);
    expect(Array.from(normalizeM908Reply(req, short))).toEqual([2, ...Array.from(short)]);
  });
  it("keeps what a short reply carries instead of failing", () => {
    // Chrome trims replies to the size the device declares for the report.
    const led = buildM908ReadPlan().find((r) => r.address === 0x449)!;
    const memory: M908Memory = new Map();
    const nine = Uint8Array.of(2, 0xf2, 0x49, 0x04, 0x07, 0, 0, 0, 0xab);
    expect(m908ReplyDataBytes(led, nine)).toBe(1);
    expect(storeM908Reply(memory, led, nine)).toBe(1);
    expect([...memory]).toEqual([[0x449, 0xab]]);
    const withoutId = nine.slice(1);
    expect(m908ReplyDataBytes(led, withoutId)).toBe(1);
    expect(m908ReplyDataBytes(led, new Uint8Array(4))).toBe(0);
  });
});

describe("describeM908Action", () => {
  const actions = [
    "left", "right", "middle", "backward", "forward", "dpi+", "dpi-", "dpi-cycle", "scroll_up", "scroll_down",
    "media_play", "media_volume_up", "none", "compatibility_copy",
    "a", "z", "1", "0", "enter", "tab", "space", "f11", "arrow_left", "arrow_up", "numplus", "minus",
    "shift", "ctrl", "super", "alt_r", "ctrl+c", "ctrl+shift+tab", "super+space", "super+shift+3", "ctrl+arrow_up", "ctrl+shift",
    "fire:mouse_left:3:0", "fire:a:5:10", "snipe:400", "macro1", "macro3:5", "macro15:until", "macro2:while",
  ];
  it.each(actions)("%s reads back to the same bytes", (action) => {
    const bytes = parseM908Action(action)!;
    expect(bytes, action).not.toBeNull();
    expect(parseM908Action(describeM908Action(bytes))).toEqual(bytes);
  });
  it("gives readable names where it can", () => {
    expect(describeM908Action([0x90, 0x00, 0xe1, 0x00])).toBe("shift");
    expect(describeM908Action([0x8f, 0x08, 0x06, 0x00])).toBe("super+c");
    expect(describeM908Action([0x99, 0x81, 0x03, 0x00])).toBe("fire:mouse_left:3:0");
  });
  it("falls back to the raw code for bytes it has no name for", () => {
    expect(describeM908Action([0xab, 0xcd, 0xef, 0x01])).toBe("0xabcdef01");
    expect(parseM908Action("0xabcdef01")).toEqual([0xab, 0xcd, 0xef, 0x01]);
  });
});
