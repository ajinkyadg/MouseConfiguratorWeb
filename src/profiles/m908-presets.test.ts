import { describe, it, expect } from "vitest";
import { M908_BUILT_IN_PRESETS, M908_NEUTRAL_PROFILE } from "./m908-presets";
import { parseM908Action, m908ActionSupported } from "./m908-buttons";
import { buildM908SettingsRows, m908DpiSupported } from "./m908";

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
