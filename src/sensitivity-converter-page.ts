// Sensitivity converter page. All math lives in tools/sensitivity.ts;
// this file wires inputs to results, with inline validation. Results
// update as you type; a debounced visually-hidden sentence announces the
// outcome to screen readers so every keystroke isn't read out.
import "./site-nav";
import {
  GAMES,
  cmPer360,
  convertSens,
  edpi,
  findGame,
  formatDistance,
  formatSens,
  inchesPer360,
  sensForNewDpi,
  validateDpi,
  validateSens,
  type Parsed,
} from "./tools/sensitivity";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------------
// Field plumbing
// ---------------------------------------------------------------------

interface Field {
  read(): Parsed;
}

/**
 * Validate a text input on every change. An error shows immediately for
 * a non-empty invalid value; an empty field only complains once the user
 * has left it, so clearing a field to retype it isn't met with red text.
 */
function field(input: HTMLInputElement, validate: (raw: string) => Parsed, onChange: () => void): Field {
  const errorEl = document.getElementById(`${input.id}-error`)!;
  let touched = false;

  const render = () => {
    const r = validate(input.value);
    const show = !r.ok && (touched || input.value.trim() !== "");
    errorEl.textContent = show && !r.ok ? r.error : "";
    if (show) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    return r;
  };

  input.addEventListener("input", () => {
    render();
    onChange();
  });
  input.addEventListener("blur", () => {
    touched = true;
    render();
  });
  return { read: render };
}

function fillGameSelect(select: HTMLSelectElement, selectedId: string) {
  for (const g of GAMES) {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name;
    opt.selected = g.id === selectedId;
    select.append(opt);
  }
}

function debounce(fn: () => void, ms: number) {
  let t: number | undefined;
  return () => {
    window.clearTimeout(t);
    t = window.setTimeout(fn, ms);
  };
}

// Don't announce the initial render, only results the user caused.
let ready = false;

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

// ---------------------------------------------------------------------
// 1. Same game, new DPI
// ---------------------------------------------------------------------

const dcGame = $<HTMLSelectElement>("dc-game");
fillGameSelect(dcGame, "");
const dcResult = $<HTMLOutputElement>("dc-result");
const dcEdpi = $("dc-edpi");
const dcCm = $("dc-cm");
const dcIn = $("dc-in");
const dcAnnounce = $("dc-announce");

let dcSentence = "";
const dcSpeakLater = debounce(() => (dcAnnounce.textContent = dcSentence), 600);
const dcSpeak = () => {
  if (ready) dcSpeakLater();
};

const dcSens = field($("dc-sens"), validateSens, updateDpiChange);
const dcOld = field($("dc-old-dpi"), validateDpi, updateDpiChange);
const dcNew = field($("dc-new-dpi"), validateDpi, updateDpiChange);
dcGame.addEventListener("change", updateDpiChange);

function updateDpiChange() {
  const s = dcSens.read();
  const o = dcOld.read();
  const n = dcNew.read();
  if (!s.ok || !o.ok || !n.ok) {
    dcResult.textContent = "—";
    dcEdpi.textContent = dcCm.textContent = dcIn.textContent = "—";
    dcSentence = "Fix the highlighted field to see a result.";
    dcSpeak();
    return;
  }
  const newSens = sensForNewDpi(s.value, o.value, n.value);
  const shown = formatSens(newSens);
  dcResult.textContent = shown;
  dcEdpi.textContent = fmtInt(edpi(s.value, o.value));

  const game = findGame(dcGame.value);
  if (game) {
    dcCm.textContent = formatDistance(cmPer360(game.yaw, s.value, o.value));
    dcIn.textContent = formatDistance(inchesPer360(game.yaw, s.value, o.value));
  } else {
    dcCm.textContent = dcIn.textContent = "Pick a game";
  }
  dcSentence = `New sensitivity at ${fmtInt(n.value)} DPI: ${shown}.`;
  dcSpeak();
}

// ---------------------------------------------------------------------
// 2. Game to game
// ---------------------------------------------------------------------

const gcFromGame = $<HTMLSelectElement>("gc-from-game");
const gcToGame = $<HTMLSelectElement>("gc-to-game");
fillGameSelect(gcFromGame, "cs2");
fillGameSelect(gcToGame, "valorant");
const gcSensInput = $<HTMLInputElement>("gc-sens");
const gcFromDpiInput = $<HTMLInputElement>("gc-from-dpi");
const gcToDpiInput = $<HTMLInputElement>("gc-to-dpi");
const gcResult = $<HTMLOutputElement>("gc-result");
const gcResultLabel = $("gc-result-label");
const gcCm = $("gc-cm");
const gcIn = $("gc-in");
const gcFromEdpi = $("gc-from-edpi");
const gcToEdpi = $("gc-to-edpi");
const gcFromEdpiLabel = $("gc-from-edpi-label");
const gcToEdpiLabel = $("gc-to-edpi-label");
const gcAnnounce = $("gc-announce");

let gcSentence = "";
const gcSpeakLater = debounce(() => (gcAnnounce.textContent = gcSentence), 600);
const gcSpeak = () => {
  if (ready) gcSpeakLater();
};

const gcSens = field(gcSensInput, validateSens, updateGameConvert);
const gcFromDpi = field(gcFromDpiInput, validateDpi, updateGameConvert);
const gcToDpi = field(gcToDpiInput, validateDpi, updateGameConvert);
gcFromGame.addEventListener("change", updateGameConvert);
gcToGame.addEventListener("change", updateGameConvert);

let lastConverted: string | null = null;

function updateGameConvert() {
  const from = findGame(gcFromGame.value)!;
  const to = findGame(gcToGame.value)!;
  gcResultLabel.textContent = `${to.name} sensitivity`;
  gcFromEdpiLabel.textContent = `eDPI in ${from.name}`;
  gcToEdpiLabel.textContent = `eDPI in ${to.name}`;

  const s = gcSens.read();
  const fd = gcFromDpi.read();
  const td = gcToDpi.read();
  if (!s.ok || !fd.ok || !td.ok) {
    lastConverted = null;
    gcResult.textContent = "—";
    gcCm.textContent = gcIn.textContent = gcFromEdpi.textContent = gcToEdpi.textContent = "—";
    gcSentence = "Fix the highlighted field to see a result.";
    gcSpeak();
    return;
  }
  const out = convertSens(s.value, { yaw: from.yaw, dpi: fd.value }, { yaw: to.yaw, dpi: td.value });
  const shown = formatSens(out);
  lastConverted = shown;
  gcResult.textContent = shown;
  gcCm.textContent = formatDistance(cmPer360(from.yaw, s.value, fd.value));
  gcIn.textContent = formatDistance(inchesPer360(from.yaw, s.value, fd.value));
  gcFromEdpi.textContent = fmtInt(edpi(s.value, fd.value));
  gcToEdpi.textContent = fmtInt(edpi(out, td.value));
  gcSentence = `${to.name} sensitivity: ${shown}.`;
  gcSpeak();
}

$("gc-swap").addEventListener("click", () => {
  const fromGame = gcFromGame.value;
  gcFromGame.value = gcToGame.value;
  gcToGame.value = fromGame;
  const fromDpi = gcFromDpiInput.value;
  gcFromDpiInput.value = gcToDpiInput.value;
  gcToDpiInput.value = fromDpi;
  // Carry the converted value over so swapping twice round-trips.
  if (lastConverted !== null) gcSensInput.value = lastConverted;
  updateGameConvert();
});

// Enter in a field shouldn't reload the page.
for (const form of document.querySelectorAll("form")) form.addEventListener("submit", (e) => e.preventDefault());

updateDpiChange();
updateGameConvert();
ready = true;
