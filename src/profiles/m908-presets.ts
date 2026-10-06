// Built-in M908 presets. A "preset" is a single profile's settings — the
// M908 page loads it into whichever of the 5 onboard profile slots is
// being edited and leaves the other 4 slots as they are (the protocol
// always writes all 5 together, so the page holds all 5 — see
// m908-profile-store.ts and m908.md). M908_NEUTRAL_PROFILE is the plain
// default a fresh slot starts from.
import { m908DpiSupported, type M908LightMode, type M908ProfileSettings } from "./m908";
import type { M908ButtonName } from "./m908-buttons";
import type { LedMode } from "./m913";
import { BUILT_IN_PRESETS, type UserProfile } from "./user-profiles";

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

// --- The M913 presets, carried over ------------------------------------
//
// The M908 has the same 12-button side panel, so every M913 preset
// (Productivity per OS, My Setup, FPS, Low DPI, RGB) is offered here too,
// derived from the M913 list rather than copied so the two can't drift.
// Only what the M908 can't express is translated.

const LIGHT_MODE: Record<LedMode, M908LightMode> = {
  off: "off",
  steady: "static",
  respiration: "breathing",
  rainbow: "rainbow",
};

// Actions the M908's documented format has no encoding for.
const ACTION_OVERRIDES: Record<string, string> = {
  // A bare modifier (GNOME Activities on the M913 Linux preset). Alt+F1 is
  // GNOME's other default shortcut for the same overview.
  super: "alt+f1",
};

function m908Button(m913Button: string): M908ButtonName | null {
  const side = /^side(\d+)$/.exec(m913Button);
  if (side) return `button_${side[1]}` as M908ButtonName;
  return ({ fire: "button_fire", left: "button_left", right: "button_right", middle: "button_middle" } as const)[
    m913Button as "fire" | "left" | "right" | "middle"
  ] ?? null;
}

// The M908 only accepts DPI values from its table; step down to the
// nearest one it has (16000 → 12000).
function m908Dpi(dpi: number): number {
  if (m908DpiSupported(dpi)) return dpi;
  return [12000, 8000, 6400, 3200, 1600, 1200, 800, 400, 200].find((v) => v <= dpi && m908DpiSupported(v)) ?? 400;
}

function fromM913(preset: UserProfile): M908Preset {
  const { config } = preset;
  const buttonActions: M908ProfileSettings["buttonActions"] = {};
  for (const [button, action] of Object.entries(config.buttonActions)) {
    const target = m908Button(button);
    if (target) buttonActions[target] = ACTION_OVERRIDES[action] ?? action;
  }
  const rgb = parseInt(config.ledColorHex, 16);
  return {
    id: `m908-${preset.id}`,
    name: preset.name,
    profile: {
      ...M908_NEUTRAL_PROFILE,
      lightMode: LIGHT_MODE[config.ledMode],
      color: [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff],
      brightness: config.ledBrightness,
      speed: config.ledSpeed,
      reportRateHz: config.pollingRateHz,
      dpiEnabled: [...config.dpiEnabled],
      dpiValues: config.dpi.map(m908Dpi) as M908ProfileSettings["dpiValues"],
      buttonActions,
    },
  };
}

// The site owner's own M908 layout, exported from the M908 page. It
// replaces the carried-over M913 "My Setup" because it uses buttons that
// preset doesn't (hold Shift on side 11, a middle-click shortcut).
const M908_MY_SETUP: M908Preset = {
  id: "m908-preset-default",
  name: "My Setup (macOS)",
  profile: {
    ...M908_NEUTRAL_PROFILE,
    color: [0, 0, 255],
    brightness: 255,
    buttonActions: {
      button_1: "super+c", // Copy
      button_2: "super+v", // Paste
      button_3: "ctrl+tab", // Next tab
      button_4: "ctrl+arrow_left", // Swipe between windows, left
      button_5: "ctrl+arrow_right", // Swipe between windows, right
      button_6: "ctrl+shift+tab", // Previous tab
      button_8: "super+space", // Spotlight search
      button_10: "super+w", // Close tab
      button_11: "shift", // Hold Shift
      button_12: "ctrl+arrow_up", // Mission Control
      button_fire: "enter",
      button_middle: "ctrl+shift+m",
    },
  },
};

export const M908_BUILT_IN_PRESETS: M908Preset[] = [
  ...BUILT_IN_PRESETS.map((preset) => (preset.id === "preset-default" ? M908_MY_SETUP : fromM913(preset))),
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
    id: "m908-preset-compat",
    // Renamed so it isn't confused with the per-OS Productivity presets
    // above: this one uses the mouse's own built-in shortcut actions.
    name: "Built-in shortcuts (untested)",
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
