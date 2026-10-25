// Typing speed test page. The rules and scoring live in tools/typing.ts;
// this file draws the words, feeds keystrokes in from a transparent input
// (so phone keyboards and autocorrect work), runs the clock and shows the
// result. Only the best score per test length and the chosen options are
// stored, in localStorage.
import "./site-nav";
import {
  DURATIONS, makeWords, createTest, nextWord, backspace, setCurrent, update, score, charCounts, consistency,
  trickiest, parseChallenge, elapsedMs, type Duration, type TypingTest, type WordOptions,
} from "./tools/typing";

const BEST_KEY = "mouseconfig.typing.best";
const PREFS_KEY = "mouseconfig.typing.prefs";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const box = $<HTMLDivElement>("box");
const wordsEl = $<HTMLDivElement>("words");
const input = $<HTMLInputElement>("type-input");
const currentWordEl = $<HTMLParagraphElement>("current-word");
const timeLeftEl = $<HTMLSpanElement>("time-left");
const liveWpmEl = $<HTMLSpanElement>("live-wpm");
const durationsEl = $<HTMLDivElement>("durations");
const punctuationEl = $<HTMLInputElement>("opt-punctuation");
const numbersEl = $<HTMLInputElement>("opt-numbers");
const resultSection = $<HTMLElement>("result-section");
const challengeEl = $<HTMLParagraphElement>("challenge");
const shareStatus = $<HTMLSpanElement>("share-status");

// --- Stored settings ---------------------------------------------------------------
function readJson<T>(key: string): Partial<T> {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: settings and bests just aren't kept
  }
}
const isDuration = (n: unknown): n is Duration => DURATIONS.includes(n as Duration);
const prefs = readJson<{ duration: number; punctuation: boolean; numbers: boolean }>(PREFS_KEY);
let duration: Duration = isDuration(prefs.duration) ? prefs.duration : 60;
const opts: WordOptions = { punctuation: prefs.punctuation === true, numbers: prefs.numbers === true };
const bests = (): Partial<Record<Duration, number>> => {
  const raw = readJson<Record<string, unknown>>(BEST_KEY);
  const out: Partial<Record<Duration, number>> = {};
  for (const d of DURATIONS) if (typeof raw[d] === "number" && Number.isFinite(raw[d])) out[d] = raw[d] as number;
  return out;
};

// A challenge link: ?challenge=72&t=60
const params = new URLSearchParams(location.search);
const challenge = parseChallenge(params.get("challenge"));
const challengeDuration = Number(params.get("t"));
if (challenge !== null) {
  if (isDuration(challengeDuration)) duration = challengeDuration;
  challengeEl.textContent = `A friend typed ${challenge} WPM on the ${duration}-second test. Can you beat it?`;
  challengeEl.hidden = false;
}

// --- Controls ----------------------------------------------------------------------------
const durationButtons = DURATIONS.map((d) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = `${d}s`;
  b.setAttribute("aria-label", `${d} seconds`);
  b.addEventListener("click", () => {
    duration = d;
    savePrefs();
    if (matchMedia("(pointer: coarse)").matches) box.querySelector(".tt-blur")!.textContent = "Tap here to start typing";
restart();
  });
  durationsEl.append(b);
  return [d, b] as const;
});
punctuationEl.checked = opts.punctuation;
numbersEl.checked = opts.numbers;
for (const [el, key] of [[punctuationEl, "punctuation"], [numbersEl, "numbers"]] as const) {
  el.addEventListener("change", () => {
    opts[key] = el.checked;
    savePrefs();
    if (matchMedia("(pointer: coarse)").matches) box.querySelector(".tt-blur")!.textContent = "Tap here to start typing";
restart();
  });
}
function savePrefs() {
  writeJson(PREFS_KEY, { duration, ...opts });
}

// --- Test state and word rendering ----------------------------------------------------
let test: TypingTest;
let wordEls: HTMLSpanElement[] = [];
let rendered = 0; // index of the word last drawn as current
let raf = 0;
let idleTimer = 0;

function addWords(words: string[]) {
  const frag = document.createDocumentFragment();
  for (const word of words) {
    const w = document.createElement("span");
    w.className = "tt-word";
    for (const ch of word) {
      const c = document.createElement("span");
      c.className = "tt-c";
      c.textContent = ch;
      w.append(c);
    }
    wordEls.push(w);
    frag.append(w);
  }
  wordsEl.append(frag);
}

function drawWord(i: number) {
  const w = wordEls[i];
  if (!w) return;
  const word = test.words[i];
  const typed = test.typed[i] ?? "";
  const cur = test.typed.length - 1;
  w.querySelectorAll(".extra").forEach((e) => e.remove());
  const chars = w.children;
  for (let j = 0; j < word.length; j++) {
    const c = chars[j];
    c.className = "tt-c" + (j < typed.length ? (typed[j] === word[j] ? " ok" : " bad") : "");
  }
  for (const ch of typed.slice(word.length)) {
    const c = document.createElement("span");
    c.className = "tt-c extra";
    c.textContent = ch;
    w.append(c);
  }
  w.classList.toggle("is-wrong", i < cur && typed !== word);
  w.classList.toggle("caret-end", i === cur && typed.length >= word.length);
  if (i === cur && typed.length < word.length) chars[typed.length].classList.add("caret");
}

function syncView() {
  const cur = test.typed.length - 1;
  if (cur !== rendered) {
    drawWord(rendered);
    rendered = cur;
    currentWordEl.textContent = test.words[cur] ?? "";
  }
  drawWord(cur);
  // Keep the current word on the second line once the first is done.
  const el = wordEls[cur];
  if (el) {
    const line = el.offsetHeight;
    wordsEl.style.transform = `translateY(${-Math.max(0, el.offsetTop - line)}px)`;
  }
  // Top up the words well before they run out.
  if (test.words.length - cur < 40) {
    const more = makeWords(60, opts, Math.random, test.words[test.words.length - 1]);
    test.words.push(...more);
    addWords(more);
  }
}

function restart() {
  cancelAnimationFrame(raf);
  for (const [d, b] of durationButtons) {
    b.classList.toggle("active", d === duration);
    b.setAttribute("aria-pressed", String(d === duration));
  }
  test = createTest(makeWords(100, opts), duration);
  wordEls = [];
  wordsEl.replaceChildren();
  wordsEl.style.transform = "";
  addWords(test.words);
  rendered = 0;
  input.value = "";
  currentWordEl.textContent = test.words[0];
  timeLeftEl.textContent = String(duration);
  liveWpmEl.textContent = "";
  resultSection.hidden = true;
  shown = false;
  shareStatus.textContent = "";
  syncView();
  box.classList.add("is-idle");
}

// --- Input ---------------------------------------------------------------------------------
function afterKeystroke() {
  if (test.startedAt !== null && !raf && test.endedAt === null) raf = requestAnimationFrame(frame);
  syncView();
  box.classList.remove("is-idle");
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => box.classList.add("is-idle"), 600);
  if (test.endedAt !== null) finish();
}

input.addEventListener("input", () => {
  if (test.endedAt !== null) return;
  const now = performance.now();
  const parts = input.value.split(" ");
  // Each space moves to the next word; whatever follows is the new word.
  for (let i = 0; i < parts.length - 1; i++) {
    setCurrent(test, parts[i], now);
    nextWord(test, now);
  }
  setCurrent(test, parts[parts.length - 1], now);
  input.value = test.typed[test.typed.length - 1] ?? "";
  afterKeystroke();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    if (matchMedia("(pointer: coarse)").matches) box.querySelector(".tt-blur")!.textContent = "Tap here to start typing";
restart();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    nextWord(test, performance.now());
    input.value = "";
    afterKeystroke();
    return;
  }
  if (event.key === "Backspace" && input.value === "" && backspace(test)) {
    event.preventDefault();
    input.value = test.typed[test.typed.length - 1];
    afterKeystroke();
  }
});

input.addEventListener("focus", () => box.classList.add("is-focused"));
input.addEventListener("blur", () => box.classList.remove("is-focused"));

// Typing anywhere on the page (outside other controls) goes to the test.
addEventListener("keydown", (event) => {
  if (event.target === input || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, select, button, a, summary, [contenteditable]")) return;
  if (event.key === "Escape") return restart();
  if (event.key.length !== 1 || event.key === " " || test.endedAt !== null) return;
  event.preventDefault();
  input.focus({ preventScroll: true });
  input.value += event.key;
  input.dispatchEvent(new Event("input"));
});

$<HTMLButtonElement>("restart").addEventListener("click", () => {
  if (matchMedia("(pointer: coarse)").matches) box.querySelector(".tt-blur")!.textContent = "Tap here to start typing";
restart();
  input.focus();
});
$<HTMLButtonElement>("again").addEventListener("click", () => {
  if (matchMedia("(pointer: coarse)").matches) box.querySelector(".tt-blur")!.textContent = "Tap here to start typing";
restart();
  box.scrollIntoView({ block: "center", behavior: "smooth" });
  input.focus({ preventScroll: true });
});

// --- Clock ---------------------------------------------------------------------------------
function frame() {
  raf = 0;
  const now = performance.now();
  update(test, now);
  const left = Math.max(0, Math.ceil((test.durationMs - elapsedMs(test, now)) / 1000));
  timeLeftEl.textContent = String(left);
  if (elapsedMs(test, now) >= 1000) liveWpmEl.textContent = `${score(test, now).wpm} wpm`;
  if (test.endedAt !== null) return finish();
  raf = requestAnimationFrame(frame);
}

// --- Result ----------------------------------------------------------------------------------
function band(wpm: number): string {
  if (wpm < 30) return "Still learning: keep your eyes on the screen and it'll climb fast.";
  if (wpm < 50) return "About average for an adult.";
  if (wpm < 70) return "Above average: comfortable for office work.";
  if (wpm < 90) return "Fast: enough for most typing-heavy jobs.";
  if (wpm < 120) return "Very fast.";
  return "Competitive-typist territory.";
}

let shown = false; // result drawn for the current test
function finish() {
  cancelAnimationFrame(raf);
  raf = 0;
  if (shown || test.keystrokes === 0) return;
  shown = true;
  input.blur();
  const s = score(test, Infinity);
  timeLeftEl.textContent = "0";
  const counts = charCounts(test);
  const steady = consistency(test.rawSamples);
  const tricky = trickiest(test);
  const all = bests();
  const previousBest = all[duration];
  const isBest = s.wpm > 0 && (previousBest === undefined || s.wpm > previousBest);
  if (isBest) writeJson(BEST_KEY, { ...all, [duration]: s.wpm });

  $("r-wpm").textContent = String(s.wpm);
  $("r-acc").textContent = `${Math.floor(s.accuracy * 100)}%`;
  let verdict = band(s.wpm);
  if (challenge !== null) {
    verdict = s.wpm > challenge
      ? `You beat your friend's ${challenge} WPM by ${s.wpm - challenge}. ` + verdict
      : s.wpm === challenge
        ? `A tie with your friend's ${challenge} WPM. ` + verdict
        : `${challenge - s.wpm} WPM short of your friend's ${challenge}. Try again? ` + verdict;
  }
  if (isBest && previousBest !== undefined) verdict = `New personal best for ${duration} seconds! ` + verdict;
  $("r-verdict").textContent = verdict;

  const stats = $("r-stats");
  stats.replaceChildren();
  const stat = (label: string, value: string) => {
    const t = document.createElement("div");
    t.className = "tt-stat";
    const v = document.createElement("span");
    v.className = "tt-stat-value";
    v.textContent = value;
    const l = document.createElement("span");
    l.className = "tt-label";
    l.textContent = label;
    t.append(v, l);
    stats.append(t);
  };
  stat("Raw WPM", String(s.raw));
  stat("Consistency", steady === null ? "–" : `${steady}%`);
  stat("Right / wrong / extra / missed letters", `${counts.correct} / ${counts.incorrect} / ${counts.extra} / ${counts.missed}`);
  stat("Time", `${s.seconds}s`);
  stat(`Best (${duration}s)`, String(Math.max(s.wpm, previousBest ?? 0)));
  stat("Most-missed keys", tricky.length ? tricky.map((k) => (k.char === " " ? "space" : k.char)).join("  ") : "none");

  resultSection.hidden = false;
  drawChart();
  resultSection.focus({ preventScroll: true });
  resultSection.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function drawChart() {
  const svg = $<HTMLElement>("r-chart") as unknown as SVGSVGElement;
  const title = svg.querySelector("title")!;
  svg.replaceChildren(title);
  const wpm = test.samples;
  const raw = test.rawSamples;
  if (wpm.length < 2) return;
  const W = svg.clientWidth || 600;
  const H = 140;
  const left = 30;
  const bottom = 18;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const top = Math.max(20, ...wpm, ...raw);
  const step = top > 120 ? 50 : top > 60 ? 25 : 10;
  const max = Math.ceil(top / step) * step;
  const x = (i: number) => left + (i / (wpm.length - 1)) * (W - left - 6);
  const y = (v: number) => 6 + (1 - v / max) * (H - bottom - 6);
  const ns = "http://www.w3.org/2000/svg";
  const add = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (text) e.textContent = text;
    svg.append(e);
  };
  for (let v = 0; v <= max; v += step) {
    add("line", { class: "grid", x1: left, x2: W, y1: y(v), y2: y(v) });
    add("text", { class: "axis", x: left - 6, y: y(v) + 4, "text-anchor": "end" }, String(v));
  }
  const lastSec = wpm.length;
  for (const [sec, anchor] of [[1, "start"], [Math.round(lastSec / 2), "middle"], [lastSec, "end"]] as const) {
    add("text", { class: "axis", x: x(sec - 1), y: H - 2, "text-anchor": anchor }, `${sec}s`);
  }
  const points = (values: number[]) => values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  add("polyline", { class: "raw", points: points(raw) });
  add("polyline", { class: "wpm", points: points(wpm) });
  title.textContent = `Speed over the test: from ${wpm[0]} to ${wpm[wpm.length - 1]} WPM, raw peaking at ${Math.max(...raw)}`;
}

// --- Sharing --------------------------------------------------------------------------------
$<HTMLButtonElement>("share").addEventListener("click", async () => {
  const wpm = score(test, Infinity).wpm;
  const url = `${location.origin}/typing-test?challenge=${wpm}&t=${duration}`;
  const text = `I typed ${wpm} WPM on a ${duration}-second typing test. Can you beat it?`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Typing speed test", text, url });
      return;
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    shareStatus.textContent = "Link copied. Paste it to a friend.";
  } catch {
    window.prompt("Copy this challenge link:", url);
  }
});

if (matchMedia("(pointer: coarse)").matches) box.querySelector(".tt-blur")!.textContent = "Tap here to start typing";
if (matchMedia("(pointer: coarse)").matches) box.querySelector(".tt-blur")!.textContent = "Tap here to start typing";
restart();
