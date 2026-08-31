// Quick-pick action catalog for the button remap UI — mirrors the native
// macOS app's category list (Sources/M913Configurator/MouseConfig.swift)
// so both products offer the same common actions, grouped the same way.
// "Custom…" in the UI accepts anything parseAction() recognizes, not just
// what's listed here.

export interface NamedAction {
  label: string;
  value: string;
}

export interface ActionCategory {
  name: string;
  actions: NamedAction[];
}

const named = (label: string, value: string): NamedAction => ({ label, value });
const plain = (value: string): NamedAction => ({ label: value, value });

export const ACTION_CATEGORIES: ActionCategory[] = [
  {
    name: "Clicks",
    actions: ["left", "right", "middle", "forward", "backward"].map(plain),
  },
  {
    name: "DPI & Light",
    actions: [
      "dpi+", "dpi-", "dpi-cycle", "dpi-loop",
      "led_toggle", "rgb_toggle", "three_click", "polling_switch", "favorites", "disable", "none",
    ].map(plain),
  },
  {
    name: "Media",
    actions: [
      "media_play", "media_next", "media_prev", "media_stop",
      "media_vol_up", "media_vol_down", "media_mute",
    ].map(plain),
  },
  {
    name: "Browser",
    actions: ["www_back", "www_forward", "www_refresh", "www_stop", "www_favorites"].map(plain),
  },
  {
    name: "Fire Button",
    actions: ["fire", "fire:58:3"].map(plain),
  },
  {
    // super = the Windows/Cmd key. On macOS that's Command (⌘), so
    // "super+c" is macOS's standard ⌘C.
    name: "Mac Shortcuts",
    actions: [
      plain("super+c"), plain("super+v"), plain("super+x"), plain("super+z"), plain("super+shift+z"),
      plain("super+a"), plain("super+s"), plain("super+f"), plain("super+w"), plain("super+q"),
      plain("super+tab"), plain("super+space"), plain("super+h"), plain("super+m"), plain("super+comma"),
      plain("super+shift+3"), plain("super+shift+4"), plain("super+shift+5"),
      named("Mission Control (toggle)", "ctrl+arrow_up"),
      named("App Windows / Exposé (toggle)", "ctrl+arrow_down"),
      named("Show Desktop", "f11"),
      named("Launchpad", "f4"),
    ],
  },
  {
    name: "Windows Shortcuts",
    actions: [
      "ctrl+c", "ctrl+v", "ctrl+x", "ctrl+z", "ctrl+shift+z",
      "ctrl+a", "ctrl+s", "ctrl+f", "alt+tab",
      "super+e", "super+d", "super+l",
    ].map(plain),
    // Note: "ctrl+alt+super+d" (Task Manager-style combo) is NOT included
    // here — 3 modifiers + 1 key = 4 tokens, one over the hardware's
    // MAX_COMBO_TOKENS(3) cap for keyboard-key sub-packets. It cannot
    // actually be sent to the mouse; see m913-buttons.test.ts.
  },
];

export function displayLabel(value: string): string | undefined {
  for (const category of ACTION_CATEGORIES) {
    const found = category.actions.find((a) => a.value === value);
    if (found) return found.label;
  }
  return undefined;
}

export interface ButtonSlotInfo {
  id: string;
  displayName: string;
}

export const BUTTON_SLOTS: ButtonSlotInfo[] = [
  { id: "left", displayName: "Left Click" },
  { id: "right", displayName: "Right Click" },
  { id: "middle", displayName: "Middle Click" },
  { id: "fire", displayName: "Fire Button" },
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `side${i + 1}`,
    displayName: `Side Button ${i + 1}`,
  })),
];
