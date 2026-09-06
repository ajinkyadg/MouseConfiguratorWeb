// Built-in M908 presets. A "preset" is a single profile's settings — the
// site's UI (once wired up) is expected to slot it into whichever of the
// device's 5 onboard profile slots the user picks, leaving the other 4 at
// M908_NEUTRAL_PROFILE (a plain, inoffensive default) since the protocol
// always writes all 5 profiles together (see m908.md).
import type { M908ProfileSettings } from "./m908";

export const M908_NEUTRAL_PROFILE: M908ProfileSettings = {
  lightMode: "static",
  color: [0, 255, 0],
  brightness: 200,
  speed: 3,
  scrollSpeed: 1,
  reportRateHz: 1000,
  dpiEnabled: [true, true, true, true, true],
  dpiValues: [400, 800, 1600, 3200, 6400],
  buttonActions: {},
};

export interface M908Preset {
  id: string;
  name: string;
  profile: M908ProfileSettings;
}

export const M908_BUILT_IN_PRESETS: M908Preset[] = [
  {
    id: "m908-preset-mmo",
    name: "MMO / Ability Bar",
    profile: {
      ...M908_NEUTRAL_PROFILE,
      color: [226, 0, 26],
      dpiValues: [400, 800, 1600, 3200, 6400],
      // The 12 side buttons as a classic MMO ability bar (1-9, 0, -, =) —
      // reachable without leaving the mouse, the same convention MMO mice
      // like the G600/Naga use for quick-slot access.
      buttonActions: {
        button_1: "1",
        button_2: "2",
        button_3: "3",
        button_4: "4",
        button_5: "5",
        button_6: "6",
        button_7: "7",
        button_8: "8",
        button_9: "9",
        button_10: "0",
        button_11: "minus",
        button_12: "equal",
        // Burst-fire on the dedicated fire button rather than a single
        // click — genuinely useful for click-heavy combat, and something
        // a plain click can't do on its own.
        button_fire: "fire:mouse_left:3:0",
        button_dpi_up: "dpi+",
        button_dpi_down: "dpi-",
      },
    },
  },
  {
    id: "m908-preset-productivity",
    name: "Productivity",
    profile: {
      ...M908_NEUTRAL_PROFILE,
      lightMode: "off",
      // Uses the mouse's own "compatibility_*" actions rather than
      // hardcoded key combos (e.g. "ctrl+c") — these are the hardware's
      // built-in OS-shortcut equivalents, named for exactly this reason:
      // they're meant to resolve to the right thing whether the mouse
      // ends up on Windows or Mac, unlike a fixed Ctrl+C/Cmd+C choice
      // that only works on one of them. Unverified against real hardware
      // which OS(es) they actually work correctly on — flag this the
      // first time this preset gets tested for real.
      buttonActions: {
        button_1: "compatibility_copy",
        button_2: "compatibility_paste",
        button_3: "compatibility_switch_window",
        button_4: "compatibility_browser_backward",
        button_5: "compatibility_browser_forward",
        button_6: "compatibility_find",
        button_7: "compatibility_show_desktop",
        button_8: "compatibility_browser_refresh",
        button_fire: "return",
      },
    },
  },
];
