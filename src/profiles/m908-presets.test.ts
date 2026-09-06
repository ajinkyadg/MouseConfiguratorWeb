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
    const productivity = M908_BUILT_IN_PRESETS.find((p) => p.id === "m908-preset-productivity")!;
    expect(productivity.profile.buttonActions.button_1).toBe("compatibility_copy");
    expect(productivity.profile.buttonActions.button_2).toBe("compatibility_paste");
  });
});
