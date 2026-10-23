import { describe, it, expect } from "vitest";
import { M908_BUILT_IN_PRESETS, M908_NEUTRAL_PROFILE } from "./m908-presets";
import { parseM908Action, m908ActionSupported } from "./m908-buttons";
import { buildM908SettingsRows, m908DpiSupported, type M908FiveProfiles } from "./m908";

describe("M908_BUILT_IN_PRESETS", () => {
  it("every button action in every preset actually resolves (no silently-dead bindings)", () => {
    for (const preset of M908_BUILT_IN_PRESETS) {
      for (const [button, action] of Object.entries(preset.profile.buttonActions)) {
        expect(m908ActionSupported(action!), `${preset.id}: ${button} -> "${action}"`).toBe(true);
      }
    }
  });

  it("every preset's DPI values are in the real supported table", () => {
    for (const preset of M908_BUILT_IN_PRESETS) {
      for (const dpi of preset.profile.dpiValues) {
        expect(m908DpiSupported(dpi), `${preset.id}: dpi ${dpi}`).toBe(true);
      }
    }
  });

  it("each preset builds valid settings rows without throwing, slotted into profile 0", () => {
    for (const preset of M908_BUILT_IN_PRESETS) {
      const profiles = [preset.profile, M908_NEUTRAL_PROFILE, M908_NEUTRAL_PROFILE, M908_NEUTRAL_PROFILE, M908_NEUTRAL_PROFILE] as const;
      expect(() => buildM908SettingsRows(profiles as Parameters<typeof buildM908SettingsRows>[0])).not.toThrow();
    }
  });

  it("MMO preset maps the 12 side buttons to a 1-9/0/-/= ability bar", () => {
    const mmo = M908_BUILT_IN_PRESETS.find((p) => p.id === "m908-preset-mmo")!;
    expect(parseM908Action(mmo.profile.buttonActions.button_1!)).toEqual(parseM908Action("1"));
    expect(parseM908Action(mmo.profile.buttonActions.button_12!)).toEqual(parseM908Action("equal"));
  });

  it("Productivity preset uses the mouse's own cross-platform compatibility actions, not hardcoded modifiers", () => {
    const productivity = M908_BUILT_IN_PRESETS.find((p) => p.id === "m908-preset-compat")!;
    expect(productivity.profile.buttonActions.button_1).toBe("compatibility_copy");
    expect(productivity.profile.buttonActions.button_2).toBe("compatibility_paste");
  });

  it("carries every M913 preset over, side buttons mapped to button_1..12", () => {
    const ids = M908_BUILT_IN_PRESETS.map((p) => p.id);
    for (const id of ["preset-office-macos", "preset-office-windows", "preset-office-linux", "preset-default", "preset-fps", "preset-productivity", "preset-rgb"]) {
      expect(ids).toContain(`m908-${id}`);
    }
    const mySetup = M908_BUILT_IN_PRESETS.find((p) => p.id === "m908-preset-default")!;
    expect(mySetup.name).toBe("My Setup (macOS)");
    expect(mySetup.profile.buttonActions).toMatchObject({
      button_1: "super+c",
      button_2: "super+v",
      button_3: "ctrl+tab",
      button_4: "ctrl+arrow_left",
      button_10: "super+w",
      button_12: "ctrl+arrow_up",
      button_fire: "enter",
    });
  });

  it("My Setup (macOS) is the owner's exported M908 layout, not the M913 carry-over", () => {
    const mySetup = M908_BUILT_IN_PRESETS.find((p) => p.id === "m908-preset-default")!;
    expect(mySetup.profile).toEqual({
      ...M908_NEUTRAL_PROFILE,
      color: [0, 0, 255],
      brightness: 255,
      buttonActions: {
        button_1: "super+c",
        button_2: "super+v",
        button_3: "ctrl+tab",
        button_4: "ctrl+arrow_left",
        button_5: "ctrl+arrow_right",
        button_6: "ctrl+shift+tab",
        button_8: "super+space",
        button_10: "super+w",
        button_11: "shift",
        button_12: "ctrl+arrow_up",
        button_fire: "enter",
        button_middle: "ctrl+shift+m",
      },
    });
    expect(parseM908Action("shift")).toEqual([0x90, 0x00, 0xe1, 0x00]);
  });

  it("has no duplicate preset ids", () => {
    const ids = M908_BUILT_IN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("translates what the M908 can't express", () => {
    const linux = M908_BUILT_IN_PRESETS.find((p) => p.id === "m908-preset-office-linux")!;
    expect(linux.profile.buttonActions.button_6).toBe("alt+f1"); // bare "super" has no M908 encoding
    const rgb = M908_BUILT_IN_PRESETS.find((p) => p.id === "m908-preset-rgb")!;
    expect(rgb.profile.dpiValues[4]).toBe(12000); // 16000 isn't in the M908's DPI table
    expect(rgb.profile.lightMode).toBe("rainbow");
    const lowDpi = M908_BUILT_IN_PRESETS.find((p) => p.id === "m908-preset-productivity")!;
    expect(lowDpi.profile.reportRateHz).toBe(125);
    expect(lowDpi.profile.dpiEnabled).toEqual([true, true, true, false, false]);
  });
});

describe("Factory default (Redragon) preset", () => {
  it("writes the same lighting, DPI, polling rate and buttons as Redragon's software (USB capture)", () => {
    const factory = M908_BUILT_IN_PRESETS.find((p) => p.id === "m908-preset-factory")!.profile;
    const { settings1, settings3 } = buildM908SettingsRows([factory, factory, factory, factory, factory] as M908FiveProfiles);
    const memory = new Map<number, number>();
    for (const row of [...settings1, ...settings3]) {
      if (row[1] !== 0xf3) continue;
      for (let k = 0; k < row[4]; k++) memory.set((row[2] | (row[3] << 8)) + k, row[8 + k]);
    }
    const captured: [number, number[]][] = [
      [0x0449, [0xff, 0x00, 0x00, 0x02, 0x04, 0x00, 0x02]], // red, wave, speed 4, brightness 2
      [0x0044, [0x01, 0x0b, 0x00, 0x0b, 0x00]], // 500 DPI
      [0x005c, [0x01, 0x8c, 0x00, 0x8c, 0x00]], // 6200 DPI
      [0x0032, [0x02, 0x00, 0x02, 0x00, 0x02]], // 500 Hz
      [0x008e, [0x99, 0x81, 0x03, 0x00]], // fire: 3 left clicks
      [0x00c2, [0x90, 0x00, 0x57, 0x00]], // side 11: numpad +
      [0x00c6, [0x90, 0x00, 0x56, 0x00]], // side 12: numpad -
    ];
    for (const [address, bytes] of captured) {
      bytes.forEach((b, k) => expect(memory.get(address + k), `0x${(address + k).toString(16)}`).toBe(b));
    }
  });
});

