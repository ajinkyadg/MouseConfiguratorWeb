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

const KEY_LABELS: Record<string, string> = {
  arrow_up: "↑ Up", arrow_down: "↓ Down", arrow_left: "← Left", arrow_right: "→ Right",
  escape: "Esc", pageup: "Page Up", pagedown: "Page Down", capslock: "Caps Lock",
  numlock: "Num Lock", scrolllock: "Scroll Lock", printscreen: "Print Screen",
  comma: ", Comma", dot: ". Period", minus: "- Minus", equal: "= Equals", semicolon: "; Semicolon",
  quote: "' Quote", lbracket: "[ Left bracket", rbracket: "] Right bracket",
  backslash: "\\ Backslash", slash: "/ Slash", grave: "` Backtick",
  numdiv: "Num /", numdot: "Num .", numenter: "Num Enter", numminus: "Num -", nummul: "Num *", numplus: "Num +",
};

function keyLabel(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  if (/^num\d$/.test(key)) return `Num ${key.slice(3)}`;
  if (key.length === 1 || /^f\d+$/.test(key)) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/// Every key the combo builder offers, grouped for a <select>: letters and
/// digits first (the common case), then the special groups above. `accept`
/// lets a device drop keys its protocol can't send.
export function comboKeyGroups(accept: (key: string) => boolean = () => true) {
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  const digits = "0123456789".split("");
  return [
    { name: "Letters", keys: letters },
    { name: "Digits", keys: digits },
    ...KEY_COMBO_SPECIAL_GROUPS,
  ]
    .map((g) => ({ name: g.name, keys: g.keys.filter(accept).map((value) => ({ value, label: keyLabel(value) })) }))
    .filter((g) => g.keys.length);
}
