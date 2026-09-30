// Button editor shared by the M913 and M908 pages: a keypad-style grid of
// tiles (one per physical button) beside a panel that edits whichever tile
// is selected. Something is always selected, so the panel is never empty
// and the grid never jumps; on phones the panel becomes a bottom sheet
// that opens when a tile is tapped.
//
// The page owns the data (getValue/setValue) and the device rules
// (validate/describe); this module owns only the interaction.
import type { ActionCategory } from "./profiles/m913-action-catalog";
import { MODIFIER_ORDER } from "./profiles/shortcut-names";

export interface EditorSlot {
  id: string;
  short: string; // accessible short name: "Side 3"
  tag: string; // small label on the tile: "3", "Left", "DPI +"
  full: string; // panel heading / accessible name: "Side button 3"
  group: string; // EditorGroup.id
}

export interface EditorGroup {
  id: string;
  label: string;
}

export interface ActionDescription {
  name: string;
  keys: string[]; // keycaps, empty for non-keyboard actions
}

export interface ButtonEditorOptions {
  root: HTMLElement;
  groups: EditorGroup[];
  slots: EditorSlot[];
  categories: ActionCategory[];
  getValue(id: string): string; // "" = default / unchanged
  setValue(id: string, value: string): void;
  isChanged(id: string): boolean;
  validate(value: string): string | null; // error message, or null if OK
  describe(value: string): ActionDescription;
  categoryKeys(value: string, category: ActionCategory): string[];
  announce(message: string): void;
  customPlaceholder: string;
  /// Label for each modifier toggle in the key-combo builder, e.g. "⌘ Command"
  /// or "Win" — a function because the M913's naming OS follows the profile.
  modifierLabel(mod: Modifier): { short: string; full: string };
  /// Keys offered by the combo builder, grouped (Letters, Digits, Function…).
  comboKeyGroups: { name: string; keys: { value: string; label: string }[] }[];
  /// Extra page elements shown in the Custom tab (e.g. the syntax reference).
  customExtras?: HTMLElement[];
}

type Modifier = (typeof MODIFIER_ORDER)[number];
type Mode = "actions" | "combo" | "custom";

// KeyboardEvent.code -> the key names the action parsers accept.
const CODE_TO_KEY: Record<string, string> = {
  Enter: "enter", Tab: "tab", Space: "space", Escape: "escape", Backspace: "backspace",
  Delete: "delete", Insert: "insert", Home: "home", End: "end", PageUp: "pageup", PageDown: "pagedown",
  ArrowUp: "arrow_up", ArrowDown: "arrow_down", ArrowLeft: "arrow_left", ArrowRight: "arrow_right",
  Minus: "minus", Equal: "equal", BracketLeft: "lbracket", BracketRight: "rbracket",
  Backslash: "backslash", Semicolon: "semicolon", Quote: "quote", Backquote: "grave",
  Comma: "comma", Period: "dot", Slash: "slash", PrintScreen: "printscreen", CapsLock: "capslock",
};

function keyFromCode(code: string): string | undefined {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F\d{1,2}$/.test(code)) return code.toLowerCase();
  if (/^Numpad\d$/.test(code)) return `num${code.slice(6)}`;
  return CODE_TO_KEY[code];
}

const MODIFIER_CODES = /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function keycaps(keys: string[]): HTMLSpanElement {
  const wrap = el("span", "keycaps");
  for (const key of keys) wrap.append(el("kbd", "", key));
  return wrap;
}

export function createButtonEditor(opts: ButtonEditorOptions) {
  const { root, slots } = opts;
  let selected = slots[0]!.id;
  const tiles = new Map<string, HTMLButtonElement>();
  const phone = matchMedia("(max-width: 760px)");

  // --- Grid ---------------------------------------------------------------
  const map = el("div", "btn-map");
  for (const group of opts.groups) {
    const label = el("p", "tile-group-label", group.label);
    label.id = `tile-group-${group.id}`;
    const grid = el("div", `button-grid group-${group.id}`);
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-labelledby", label.id);
    for (const slot of slots.filter((s) => s.group === group.id)) {
      const tile = el("button", "button-tile");
      tile.type = "button";
      tile.dataset.slot = slot.id;
      tile.setAttribute("aria-controls", "btn-panel");
      tile.addEventListener("click", () => select(slot.id, true));
      tiles.set(slot.id, tile);
      grid.append(tile);
    }
    map.append(label, grid);
  }

  // Arrow keys move between tiles (4 columns, across groups); Tab leaves the
  // grid in one stop — roving tabindex.
  map.addEventListener("keydown", (event) => {
    const order = [...tiles.keys()];
    const index = order.indexOf((event.target as HTMLElement).dataset?.slot ?? "");
    if (index < 0) return;
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 };
    let target: number;
    if (event.key === "Home") target = 0;
    else if (event.key === "End") target = order.length - 1;
    else if (event.key in moves) target = index + moves[event.key]!;
    else return;
    if (target < 0 || target >= order.length) return;
    event.preventDefault();
    select(order[target]!, false);
    tiles.get(order[target]!)!.focus();
  });

  // --- Panel --------------------------------------------------------------
  const panel = el("div", "btn-panel"); // not <section>: that gets the page card style
  panel.setAttribute("role", "region");
  panel.id = "btn-panel";
  panel.setAttribute("aria-labelledby", "btn-panel-title");

  const head = el("div", "panel-head");
  const prev = el("button", "panel-step", "‹");
  prev.type = "button";
  prev.setAttribute("aria-label", "Previous button");
  const next = el("button", "panel-step", "›");
  next.type = "button";
  next.setAttribute("aria-label", "Next button");
  const titleWrap = el("div", "panel-title-wrap");
  const title = el("h3", "panel-title");
  title.id = "btn-panel-title";
  const current = el("span", "panel-current");
  titleWrap.append(title, current);
  const close = el("button", "panel-close", "Done");
  close.type = "button";
  head.append(prev, titleWrap, next, close);

  // Three ways to set a button, one visible at a time: pick a named action,
  // build a key combination, or type raw action syntax.
  const tabList = el("div", "panel-tabs");
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-label", "How to set this button");
  const panes = {} as Record<Mode, HTMLDivElement>;
  const tabs = {} as Record<Mode, HTMLButtonElement>;
  for (const [mode, label] of [["actions", "Actions"], ["combo", "Key combo"], ["custom", "Custom"]] as const) {
    const tab = el("button", "panel-tab", label);
    tab.type = "button";
    tab.id = `btn-tab-${mode}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `btn-pane-${mode}`);
    tab.addEventListener("click", () => showMode(mode, true));
    const pane = el("div", "panel-pane");
    pane.id = `btn-pane-${mode}`;
    pane.setAttribute("role", "tabpanel");
    pane.setAttribute("aria-labelledby", tab.id);
    tabs[mode] = tab;
    panes[mode] = pane;
    tabList.append(tab);
  }
  // Left/right arrows move between tabs (standard tablist keyboard model).
  tabList.addEventListener("keydown", (event) => {
    const order: Mode[] = ["actions", "combo", "custom"];
    const i = order.indexOf(mode);
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const target = order[(i + delta + order.length) % order.length]!;
    showMode(target, false);
    tabs[target].focus();
  });

  // Actions pane.
  const searchLabel = el("label", "visually-hidden", "Search actions");
  searchLabel.htmlFor = "btn-search";
  const search = el("input", "panel-search");
  search.type = "search";
  search.id = "btn-search";
  search.placeholder = "Search — copy, volume, DPI…";
  search.autocomplete = "off";
  const list = el("div", "action-list");
  list.setAttribute("role", "group");
  list.setAttribute("aria-label", "Actions");
  const empty = el("p", "hint action-empty", "Nothing matches — try the Key combo tab.");
  empty.hidden = true;
  panes.actions.append(searchLabel, search, list, empty);

  // Key combo pane: modifier toggles + a key, or record from the keyboard.
  const modRow = el("div", "combo-mods");
  modRow.setAttribute("role", "group");
  modRow.setAttribute("aria-label", "Modifier keys");
  const modChips = {} as Record<Modifier, HTMLButtonElement>;
  for (const mod of MODIFIER_ORDER) {
    const chip = el("button", "mod-chip");
    chip.type = "button";
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => {
      chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
      updateComboPreview();
    });
    modChips[mod] = chip;
    modRow.append(chip);
  }
  const keyRow = el("div", "combo-key-row");
  const keyLabel = el("label", "visually-hidden", "Key");
  keyLabel.htmlFor = "btn-combo-key";
  const keySelect = el("select");
  keySelect.id = "btn-combo-key";
  keySelect.innerHTML =
    `<option value="">Choose a key…</option>` +
    opts.comboKeyGroups
      .map((g) => `<optgroup label="${g.name}">${g.keys.map((k) => `<option value="${k.value}">${k.label}</option>`).join("")}</optgroup>`)
      .join("");
  keySelect.addEventListener("change", updateComboPreview);
  const comboPreview = el("span", "combo-preview");
  const comboUse = el("button", "combo-use", "Use");
  comboUse.type = "button";
  keyRow.append(keyLabel, keySelect, comboPreview, comboUse);
  // Recording is the quickest path, so it comes first; the builder below
  // covers shortcuts the OS won't let a web page capture.
  const record = el("button", "record-btn", "Record shortcut");
  record.type = "button";
  record.setAttribute("aria-pressed", "false");
  const recordHint = el("p", "hint combo-hint", "Or build it: pick modifiers and a key.");
  panes.combo.append(record, recordHint, modRow, keyRow);

  // Custom pane.
  const customRow = el("div", "row");
  const customInput = el("input");
  customInput.type = "text";
  customInput.placeholder = opts.customPlaceholder;
  customInput.setAttribute("aria-label", "Custom action");
  customInput.id = "btn-custom";
  const customUse = el("button", "", "Use");
  customUse.type = "button";
  customRow.append(customInput, customUse);
  panes.custom.append(customRow, el("p", "hint", "Any action the mouse understands."), ...(opts.customExtras ?? []));

  // One message line for whichever pane is showing.
  const panelError = el("p", "panel-error");
  panelError.id = "btn-panel-error";
  panelError.setAttribute("aria-live", "polite");
  customInput.setAttribute("aria-describedby", panelError.id);

  const reset = el("button", "panel-reset link-button", "Reset to default");
  reset.type = "button";

  panel.append(head, tabList, panes.actions, panes.combo, panes.custom, panelError, reset);

  // Built once; filtering only toggles `hidden`.
  const options: { button: HTMLButtonElement; text: string; value: string; group: HTMLElement }[] = [];
  for (const category of opts.categories) {
    const group = el("div", "action-group");
    group.append(el("p", "action-group-label", category.name));
    for (const action of category.actions) {
      const button = el("button", "action-option");
      button.type = "button";
      button.dataset.value = action.value;
      button.append(el("span", "action-name", action.label));
      const keys = opts.categoryKeys(action.value, category);
      if (keys.length) button.append(keycaps(keys));
      button.addEventListener("click", () => assign(action.value));
      group.append(button);
      options.push({ button, text: `${action.label} ${action.value} ${category.name}`.toLowerCase(), value: action.value, group });
    }
    list.append(group);
  }

  root.replaceChildren(map, panel);

  // --- Behaviour ------------------------------------------------------------
  function slotById(id: string) {
    return slots.find((s) => s.id === id)!;
  }

  function assign(value: string) {
    const error = value ? opts.validate(value) : null;
    if (error) {
      panelError.textContent = error;
      return false;
    }
    opts.setValue(selected, value);
    panelError.textContent = "";
    const slot = slotById(selected);
    opts.announce(`${slot.full} set to ${value ? opts.describe(value).name : "default"}`);
    refresh();
    if (!value) loadModeFor("");
    return true;
  }

  function renderTile(slot: EditorSlot) {
    const tile = tiles.get(slot.id)!;
    const value = opts.getValue(slot.id);
    const invalid = !!value && opts.validate(value) !== null;
    const desc = value ? opts.describe(value) : null;
    const line = el("span", "tile-line");
    line.append(el("span", "tile-slot", slot.tag), el("span", "tile-name", desc ? desc.name : "Default"));
    tile.replaceChildren(line);
    if (desc?.keys.length) tile.append(keycaps(desc.keys));
    if (invalid) tile.append(el("span", "tile-note", "Not recognised"));
    const changed = opts.isChanged(slot.id);
    tile.classList.toggle("unchanged", !value);
    tile.classList.toggle("invalid", invalid);
    tile.classList.toggle("changed", changed);
    const isSelected = slot.id === selected;
    tile.classList.toggle("selected", isSelected);
    tile.setAttribute("aria-current", String(isSelected));
    tile.tabIndex = isSelected ? 0 : -1;
    tile.setAttribute(
      "aria-label",
      // Starts with the visible slot label so voice control ("click Side 3") works.
      `${slot.short}: ${desc ? desc.name : "default"}${invalid ? ", not recognised" : ""}${changed ? ", changed" : ""}`,
    );
  }

  function renderPanel() {
    const slot = slotById(selected);
    const value = opts.getValue(selected);
    title.textContent = slot.full;
    current.replaceChildren();
    if (value) {
      const desc = opts.describe(value);
      current.append(el("strong", "", desc.name));
      if (desc.keys.length) current.append(keycaps(desc.keys));
    } else current.append("Default");
    for (const option of options) option.button.setAttribute("aria-pressed", String(option.value === value));
    for (const mod of MODIFIER_ORDER) {
      const { short, full } = opts.modifierLabel(mod);
      modChips[mod].textContent = short;
      modChips[mod].title = full;
      modChips[mod].setAttribute("aria-label", full);
    }
    reset.disabled = !value;
    const order = slots.map((s) => s.id);
    const index = order.indexOf(selected);
    prev.disabled = index === 0;
    next.disabled = index === order.length - 1;
  }

  function refresh() {
    for (const slot of slots) renderTile(slot);
    renderPanel();
  }

  // --- Modes --------------------------------------------------------------
  let mode: Mode = "actions";
  const comboKeyValues = new Set(opts.comboKeyGroups.flatMap((g) => g.keys.map((k) => k.value)));

  // A keyboard combo the builder can represent: known modifiers + one key.
  function asCombo(value: string): { mods: Modifier[]; key: string } | null {
    const parts = value.toLowerCase().split("+");
    const key = parts.pop()!;
    if (!comboKeyValues.has(key) || !parts.every((p) => (MODIFIER_ORDER as readonly string[]).includes(p))) return null;
    return { mods: parts as Modifier[], key };
  }

  function showMode(next: Mode, focus: boolean) {
    stopRecording();
    mode = next;
    for (const m of Object.keys(panes) as Mode[]) {
      panes[m].hidden = m !== next;
      tabs[m].setAttribute("aria-selected", String(m === next));
      tabs[m].tabIndex = m === next ? 0 : -1;
    }
    panelError.textContent = "";
    if (focus) ({ actions: search, combo: keySelect, custom: customInput })[next].focus({ preventScroll: !phone.matches });
  }

  // Open each button on the tab that can show its current value.
  function loadModeFor(value: string) {
    const combo = value && !options.some((o) => o.value === value) ? asCombo(value) : null;
    for (const mod of MODIFIER_ORDER) modChips[mod].setAttribute("aria-pressed", String(!!combo?.mods.includes(mod)));
    keySelect.value = combo?.key ?? "";
    customInput.value = value && !combo && !options.some((o) => o.value === value) ? value : "";
    updateComboPreview();
    showMode(combo ? "combo" : customInput.value ? "custom" : "actions", false);
  }

  function builtCombo(): string {
    const mods = MODIFIER_ORDER.filter((m) => modChips[m].getAttribute("aria-pressed") === "true");
    return keySelect.value ? [...mods, keySelect.value].join("+") : "";
  }

  function updateComboPreview() {
    const combo = builtCombo();
    comboPreview.replaceChildren();
    if (combo) {
      const desc = opts.describe(combo);
      comboPreview.append(desc.keys.length ? keycaps(desc.keys) : el("strong", "", desc.name));
    }
    const error = combo ? opts.validate(combo) : null;
    comboUse.disabled = !combo || !!error;
    panelError.textContent = error ?? "";
  }

  comboUse.addEventListener("click", () => assign(builtCombo()));

  function select(id: string, fromClick: boolean) {
    stopRecording();
    selected = id;
    refresh();
    loadModeFor(opts.getValue(id));
    if (fromClick) {
      if (phone.matches) document.body.classList.add("sheet-open");
      tabs[mode].focus({ preventScroll: !phone.matches });
    }
  }

  function closeSheet() {
    stopRecording();
    document.body.classList.remove("sheet-open");
    tiles.get(selected)?.focus();
  }

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for (const option of options) option.button.hidden = !!q && !option.text.includes(q);
    for (const group of list.querySelectorAll<HTMLElement>(".action-group")) {
      group.hidden = ![...group.querySelectorAll<HTMLButtonElement>(".action-option")].some((b) => !b.hidden);
    }
    empty.hidden = options.some((o) => !o.button.hidden);
  });

  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  function step(delta: number) {
    const order = slots.map((s) => s.id);
    const target = order[order.indexOf(selected) + delta];
    if (target) select(target, false);
  }

  close.addEventListener("click", closeSheet);
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !recording) {
      event.preventDefault();
      closeSheet();
    }
  });

  reset.addEventListener("click", () => assign(""));
  customUse.addEventListener("click", () => {
    const value = customInput.value.trim();
    if (!value) {
      panelError.textContent = "Type an action first.";
      return;
    }
    assign(value);
  });
  customInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      customUse.click();
    }
  });
  customInput.addEventListener("input", () => {
    const value = customInput.value.trim();
    panelError.textContent = value ? opts.validate(value) ?? "" : "";
  });

  // --- Record shortcut ----------------------------------------------------
  let recording = false;
  function stopRecording() {
    if (!recording) return;
    recording = false;
    record.setAttribute("aria-pressed", "false");
    record.textContent = "Record shortcut";
    recordHint.textContent = "Or build it: pick modifiers and a key.";
  }
  record.addEventListener("click", () => {
    if (recording) return stopRecording();
    recording = true;
    record.setAttribute("aria-pressed", "true");
    record.textContent = "Listening… (Esc to cancel)";
    recordHint.textContent = "Press the shortcut now. System ones like ⌘Tab can't be captured — build those below.";
  });
  record.addEventListener("blur", stopRecording);
  record.addEventListener("keydown", (event) => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.code === "Escape" && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
      stopRecording();
      return;
    }
    if (MODIFIER_CODES.test(event.key) || MODIFIER_CODES.test(event.code)) return; // wait for the real key
    const key = keyFromCode(event.code);
    if (!key) {
      recordHint.textContent = `"${event.key}" can't be sent by the mouse — try another key.`;
      return;
    }
    const held = { ctrl: event.ctrlKey, alt: event.altKey, super: event.metaKey, shift: event.shiftKey };
    const combo = [...MODIFIER_ORDER.filter((m) => held[m]), key].join("+");
    const error = opts.validate(combo);
    if (error) {
      recordHint.textContent = error;
      return;
    }
    stopRecording();
    if (assign(combo)) loadModeFor(combo);
  });

  phone.addEventListener("change", () => {
    if (!phone.matches) document.body.classList.remove("sheet-open");
  });

  refresh();
  loadModeFor(opts.getValue(selected));
  return {
    // Re-render after the page changed values (profile load, revert…) —
    // also re-syncs the builder/custom field to the selected button.
    refresh() {
      refresh();
      loadModeFor(opts.getValue(selected));
    },
    select: (id: string) => select(id, false),
  };
}
