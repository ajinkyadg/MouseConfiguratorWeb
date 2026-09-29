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
  short: string; // tile label: "Side 3"
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
}

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
  const panel = el("section", "btn-panel");
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
  const current = el("p", "panel-current");
  titleWrap.append(title, current);
  const close = el("button", "panel-close", "Done");
  close.type = "button";
  head.append(prev, titleWrap, next, close);

  const searchLabel = el("label", "visually-hidden", "Search actions");
  searchLabel.htmlFor = "btn-search";
  const search = el("input", "panel-search");
  search.type = "search";
  search.id = "btn-search";
  search.placeholder = "Search actions — copy, volume, DPI…";
  search.autocomplete = "off";

  const list = el("div", "action-list");
  list.setAttribute("role", "group");
  list.setAttribute("aria-label", "Actions");
  const empty = el("p", "hint action-empty", "No action matches. Record a shortcut or use custom text below.");
  empty.hidden = true;

  const recordRow = el("div", "record-row");
  const record = el("button", "record-btn", "Record shortcut");
  record.type = "button";
  record.setAttribute("aria-pressed", "false");
  const recordHint = el("span", "hint", "Press the keys you want this button to send.");
  recordRow.append(record, recordHint);

  const custom = el("details", "custom-action");
  const customSummary = el("summary", "", "Custom action text");
  const customRow = el("div", "row");
  const customInput = el("input");
  customInput.type = "text";
  customInput.placeholder = opts.customPlaceholder;
  customInput.setAttribute("aria-label", "Custom action");
  customInput.id = "btn-custom";
  const customUse = el("button", "", "Use");
  customUse.type = "button";
  const customError = el("p", "custom-error");
  customError.id = "btn-custom-error";
  customError.setAttribute("aria-live", "polite");
  customInput.setAttribute("aria-describedby", customError.id);
  customRow.append(customInput, customUse);
  custom.append(customSummary, customRow, customError);

  const reset = el("button", "panel-reset", "Reset to default");
  reset.type = "button";

  panel.append(head, searchLabel, search, list, empty, recordRow, custom, reset);

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
      customError.textContent = error;
      return false;
    }
    opts.setValue(selected, value);
    customError.textContent = "";
    const slot = slotById(selected);
    opts.announce(`${slot.full} set to ${value ? opts.describe(value).name : "default"}`);
    refresh();
    return true;
  }

  function renderTile(slot: EditorSlot) {
    const tile = tiles.get(slot.id)!;
    const value = opts.getValue(slot.id);
    const invalid = !!value && opts.validate(value) !== null;
    const desc = value ? opts.describe(value) : null;
    tile.replaceChildren(el("span", "tile-slot", slot.short), el("span", "tile-name", desc ? desc.name : "Default"));
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
    current.replaceChildren(value ? "Currently " : "Currently default");
    if (value) {
      const desc = opts.describe(value);
      current.append(el("strong", "", desc.name));
      if (desc.keys.length) current.append(" ", keycaps(desc.keys));
    }
    for (const option of options) option.button.setAttribute("aria-pressed", String(option.value === value));
    const matchesCatalog = options.some((o) => o.value === value);
    customInput.value = value && !matchesCatalog ? value : "";
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

  function select(id: string, fromClick: boolean) {
    stopRecording();
    selected = id;
    customError.textContent = "";
    refresh();
    if (fromClick) {
      if (phone.matches) document.body.classList.add("sheet-open");
      search.focus({ preventScroll: !phone.matches });
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
      customError.textContent = "Type an action first.";
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
    customError.textContent = value ? opts.validate(value) ?? "" : "";
  });

  // --- Record shortcut ----------------------------------------------------
  let recording = false;
  function stopRecording() {
    if (!recording) return;
    recording = false;
    record.setAttribute("aria-pressed", "false");
    record.textContent = "Record shortcut";
    recordHint.textContent = "Press the keys you want this button to send.";
  }
  record.addEventListener("click", () => {
    if (recording) return stopRecording();
    recording = true;
    record.setAttribute("aria-pressed", "true");
    record.textContent = "Listening… (Esc to cancel)";
    recordHint.textContent = "System shortcuts like ⌘Tab can't be captured — pick those from the list.";
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
    assign(combo);
  });

  phone.addEventListener("change", () => {
    if (!phone.matches) document.body.classList.remove("sheet-open");
  });

  refresh();
  return { refresh, select: (id: string) => select(id, false) };
}
