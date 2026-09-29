import { describe, expect, it } from "vitest";
import { describeShortcut, formatCombo } from "./shortcut-names";
import { BUILT_IN_PRESETS } from "./user-profiles";

describe("shortcut names", () => {
  it("formats combos the way each OS writes them", () => {
    expect(formatCombo("super+shift+z", "macos")).toBe("⌘⇧Z");
    expect(formatCombo("ctrl+arrow_up", "macos")).toBe("⌃↑");
    expect(formatCombo("super+shift+s", "windows")).toBe("Win+Shift+S");
    expect(formatCombo("ctrl+alt+arrow_left", "linux")).toBe("Ctrl+Alt+←");
  });

  it("names the same combo differently per OS", () => {
    expect(describeShortcut("super+s", "macos")).toBe("Save · ⌘S");
    expect(describeShortcut("super+s", "windows")).toBe("Search · Win+S");
    expect(describeShortcut("media_play", "macos")).toBeUndefined();
  });

  it("names every button in the per-OS productivity presets", () => {
    for (const [id, os] of [
      ["preset-office-macos", "macos"],
      ["preset-office-windows", "windows"],
      ["preset-office-linux", "linux"],
    ] as const) {
      const preset = BUILT_IN_PRESETS.find((p) => p.id === id)!;
      for (const [slot, value] of Object.entries(preset.config.buttonActions)) {
        expect(describeShortcut(value, os), `${id} ${slot}=${value}`).toBeDefined();
      }
    }
  });
});
