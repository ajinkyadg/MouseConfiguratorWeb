// Quick-pick action catalog for the button remap UI — mirrors the native
// macOS app's category list (Sources/M913Configurator/MouseConfig.swift)
// so both products offer the same common actions, grouped the same way.
// "Custom…" in the UI accepts anything parseAction() recognizes, not just
// what's listed here.

import { shortcutName, type ShortcutOS } from "./shortcut-names";

export interface NamedAction {
  label: string;
  value: string;
  /// Which OS's key glyphs to show for a shortcut entry (⌘ vs Ctrl).
  os?: ShortcutOS;
}

export interface ActionCategory {
  name: string;
  actions: NamedAction[];
}

// Human names for the non-keyboard actions, so nothing in the picker or on
// a tile reads as a protocol token ("media_play", "dpi-").
const LABELS: Record<string, string> = {
  left: "Left click", right: "Right click", middle: "Middle click",
  forward: "Forward", backward: "Back",
  "dpi+": "DPI up", "dpi-": "DPI down", "dpi-cycle": "DPI cycle", "dpi-loop": "DPI loop",
  led_toggle: "Lighting on/off", rgb_toggle: "Next lighting effect", three_click: "Triple click",
  polling_switch: "Switch polling rate", favorites: "Favourites", disable: "Disable button", none: "Do nothing",
  media_play: "Play / pause", media_next: "Next track", media_prev: "Previous track", media_stop: "Stop media",
  media_vol_up: "Volume up", media_vol_down: "Volume down", media_mute: "Mute",
  www_back: "Browser back", www_forward: "Browser forward", www_refresh: "Reload page",
  www_stop: "Stop loading", www_favorites: "Bookmarks",
  fire: "Rapid fire", "fire:58:3": "Burst fire (3 clicks)",
};
const plain = (value: string): NamedAction => ({ label: LABELS[value] ?? value, value });
// Shortcut entries are labelled with what they do on that OS ("Copy"); the
// UI renders the keys (⌘C / Ctrl+C) from `os`.
const shortcut = (os: ShortcutOS) => (value: string): NamedAction => ({
  label: shortcutName(value, os) ?? value,
  value,
  os,
});

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
      "super+c", "super+v", "super+x", "super+z", "super+shift+z",
      "super+a", "super+s", "super+f", "super+t", "super+w", "super+shift+t", "super+q",
      "ctrl+tab", "ctrl+shift+tab",
      "super+tab", "super+space", "super+h", "super+m", "super+comma",
      "super+shift+3", "super+shift+4", "super+shift+5",
      "ctrl+arrow_up", "ctrl+arrow_down", "f11", "f4",
    ].map(shortcut("macos")),
  },
  {
    name: "Windows Shortcuts",
    actions: [
      "ctrl+c", "ctrl+v", "ctrl+x", "ctrl+z", "ctrl+y",
      "ctrl+a", "ctrl+s", "ctrl+f", "ctrl+t", "ctrl+w", "ctrl+shift+t",
      "ctrl+tab", "ctrl+shift+tab", "alt+tab", "super+tab",
      "super+s", "super+shift+s", "printscreen",
      "super+e", "super+d", "super+l",
    ].map(shortcut("windows")),
    // Note: "ctrl+alt+super+d" (Task Manager-style combo) is NOT included
    // here — 3 modifiers + 1 key = 4 tokens, one over the hardware's
    // MAX_COMBO_TOKENS(3) cap for keyboard-key sub-packets. It cannot
    // actually be sent to the mouse; see m913-buttons.test.ts.
  },
  {
    name: "Linux Shortcuts",
    actions: [
      "ctrl+c", "ctrl+v", "ctrl+x", "ctrl+z", "ctrl+y",
      "ctrl+a", "ctrl+s", "ctrl+f", "ctrl+t", "ctrl+w", "ctrl+shift+t",
      "ctrl+tab", "ctrl+shift+tab", "alt+tab", "super", "super+l",
      "ctrl+alt+arrow_left", "ctrl+alt+arrow_right", "printscreen",
    ].map(shortcut("linux")),
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
