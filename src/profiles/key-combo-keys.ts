// Non-printable / hard-to-type keys for the "Key Combination" builder's
// Special Keys picker — mirrors the native macOS app's KeyComboKeys
// (Sources/M913Configurator/KeyCombination.swift) group-for-group, so both
// apps offer the same quick-pick keys. Plain letters, digits, and symbol
// characters aren't listed here — those are just typed directly into the
// key field. Names match profiles/m913-buttons.ts's keyCodes table.
export const KEY_COMBO_SPECIAL_GROUPS: { name: string; keys: string[] }[] = [
  { name: "Function", keys: Array.from({ length: 24 }, (_, i) => `f${i + 1}`) },
  {
    name: "Navigation",
    keys: [
      "arrow_up", "arrow_down", "arrow_left", "arrow_right",
      "enter", "return", "tab", "space", "escape", "backspace", "delete",
      "insert", "home", "end", "pageup", "pagedown",
      "capslock", "numlock", "scrolllock", "printscreen", "pause",
    ],
  },
  {
    name: "Symbols",
    keys: ["comma", "dot", "minus", "equal", "semicolon", "quote", "lbracket", "rbracket", "backslash", "slash", "grave"],
  },
  {
    name: "Numpad",
    keys: [
      "num0", "num1", "num2", "num3", "num4", "num5", "num6", "num7", "num8", "num9",
      "numdiv", "numdot", "numenter", "numminus", "nummul", "numplus",
    ],
  },
];
