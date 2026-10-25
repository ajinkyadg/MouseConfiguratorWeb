// Typing speed test: word generation, keystroke handling and scoring, with
// no DOM or timers so it can be tested. Times are passed in as ms.
//
// Scoring follows the usual typing-test conventions: a "word" is 5
// characters, WPM counts only characters of correctly typed words (plus
// the space after each), raw WPM counts everything typed, and accuracy is
// correct keystrokes over all keystrokes, so fixed mistakes still count.

export const DURATIONS = [15, 30, 60, 120] as const;
export type Duration = (typeof DURATIONS)[number];

// The 200 most common English words, short enough to type at speed.
export const WORDS = (
  "the be of and a to in he have it that for they with as not on she at by this we you do but from or which one would all " +
  "will there say who make when can more if no man out other so what time up go about than into could state only new year " +
  "some take come these know see use get like then first any work now may such give over think most even find day also " +
  "after way many must look before great back through long where much should well people down own just because good each " +
  "those feel seem how high too place little world very still nation hand old life tell write become here show house both " +
  "between need mean call develop under last right move thing general school never same another begin while number part " +
  "turn real leave might want point form off child few small since against ask late home interest large person end open " +
  "public follow during present without again hold govern around possible head consider word program problem however lead " +
  "system set order eye plan run keep face fact group play stand increase early course change help line"
).split(" ");

export interface WordOptions { punctuation: boolean; numbers: boolean }

/** Random words, never the same word twice in a row. With punctuation, some
 * words get a capital, a trailing mark or quotes; with numbers, some are
 * replaced by 1-4 digit numbers. */
export function makeWords(count: number, opts: WordOptions, rng: () => number = Math.random, previous = ""): string[] {
  const out: string[] = [];
  let last = previous;
  let capital = opts.punctuation && !previous;
  for (let i = 0; i < count; i++) {
    let word: string;
    do word = WORDS[Math.floor(rng() * WORDS.length)];
    while (word === last.toLowerCase().replace(/[^a-z]/g, ""));
    if (opts.numbers && rng() < 0.12) word = String(Math.floor(rng() * 10 ** (1 + Math.floor(rng() * 4))));
    if (opts.punctuation) {
      if (capital) word = word[0].toUpperCase() + word.slice(1);
      capital = false;
      const r = rng();
      if (r < 0.08) {
        word += ".";
        capital = true;
      } else if (r < 0.14) word += ",";
      else if (r < 0.16) {
        word += "?";
        capital = true;
      } else if (r < 0.18) word = `"${word}"`;
      else if (r < 0.2) word += ";";
    }
    out.push(word);
    last = word;
  }
  return out;
}

export interface TypingTest {
  words: string[];
  typed: string[]; // what was typed for each word so far; typed.length - 1 is the current word
  durationMs: number;
  startedAt: number | null; // first keystroke
  endedAt: number | null;
  keystrokes: number; // characters entered, including spaces
  correctKeystrokes: number;
  misses: Record<string, number>; // expected character → times mistyped
  samples: number[]; // WPM at each whole second, for the chart
  rawSamples: number[];
}

/** Extra characters typed past the end of a word are kept, up to this many. */
export const MAX_EXTRA = 10;

export function createTest(words: string[], durationSec: Duration): TypingTest {
  return {
    words, typed: [""], durationMs: durationSec * 1000, startedAt: null, endedAt: null,
    keystrokes: 0, correctKeystrokes: 0, misses: {}, samples: [], rawSamples: [],
  };
}

const current = (t: TypingTest) => t.typed.length - 1;
const finished = (t: TypingTest) => t.endedAt !== null;

function start(t: TypingTest, now: number) {
  if (t.startedAt === null) t.startedAt = now;
}

/** Types one character into the current word. */
export function typeChar(t: TypingTest, ch: string, now: number): void {
  if (finished(t)) return;
  const i = current(t);
  const word = t.words[i];
  const typed = t.typed[i];
  if (typed.length >= word.length + MAX_EXTRA) return;
  start(t, now);
  t.keystrokes += 1;
  const expected = word[typed.length];
  if (ch === expected) t.correctKeystrokes += 1;
  else if (expected !== undefined) t.misses[expected] = (t.misses[expected] ?? 0) + 1;
  t.typed[i] = typed + ch;
}

/** Space: moves on to the next word. Ignored at the start of a word. */
export function nextWord(t: TypingTest, now: number): void {
  if (finished(t)) return;
  const i = current(t);
  if (!t.typed[i]) return;
  t.keystrokes += 1;
  if (t.typed[i] === t.words[i]) t.correctKeystrokes += 1;
  t.typed.push("");
  if (current(t) >= t.words.length) t.endedAt = now; // ran out of words
}

/** Backspace. At the start of a word it goes back to the previous one, but
 * only if that word has a mistake: correct words are locked in. Returns
 * whether anything changed. */
export function backspace(t: TypingTest): boolean {
  if (finished(t)) return false;
  const i = current(t);
  if (t.typed[i]) {
    t.typed[i] = t.typed[i].slice(0, -1);
    return true;
  }
  if (i > 0 && t.typed[i - 1] !== t.words[i - 1]) {
    t.typed.pop();
    return true;
  }
  return false;
}

/** Brings the current word in line with an input box's value: deletes back
 * to the shared prefix, then types the rest. Handles autocorrect and
 * delete-word as well as single keys. */
export function setCurrent(t: TypingTest, value: string, now: number): void {
  const i = current(t);
  let shared = 0;
  const typed = t.typed[i];
  while (shared < typed.length && shared < value.length && typed[shared] === value[shared]) shared++;
  t.typed[i] = typed.slice(0, shared);
  for (const ch of value.slice(shared)) typeChar(t, ch, now);
}

export function elapsedMs(t: TypingTest, now: number): number {
  if (t.startedAt === null) return 0;
  return Math.min(t.durationMs, (t.endedAt ?? now) - t.startedAt);
}

/** Records per-second samples and ends the test when time is up. */
export function update(t: TypingTest, now: number): void {
  if (t.startedAt === null || finished(t)) return;
  const elapsed = now - t.startedAt;
  while (t.samples.length < Math.min(Math.floor(elapsed / 1000), t.durationMs / 1000)) {
    const at = t.startedAt + (t.samples.length + 1) * 1000;
    const s = score(t, at);
    t.samples.push(s.wpm);
    t.rawSamples.push(s.raw);
  }
  if (elapsed >= t.durationMs) t.endedAt = t.startedAt + t.durationMs;
}

export interface CharCounts { correct: number; incorrect: number; extra: number; missed: number }

/** Character breakdown over the words typed so far. */
export function charCounts(t: TypingTest): CharCounts {
  const c: CharCounts = { correct: 0, incorrect: 0, extra: 0, missed: 0 };
  t.typed.forEach((typed, i) => {
    const word = t.words[i];
    if (word === undefined) return;
    const done = i < current(t);
    for (let j = 0; j < Math.max(typed.length, done ? word.length : 0); j++) {
      if (j >= word.length) c.extra++;
      else if (j >= typed.length) c.missed++;
      else if (typed[j] === word[j]) c.correct++;
      else c.incorrect++;
    }
  });
  return c;
}

/** Characters that count towards WPM: correct words plus their spaces,
 * and the current word if it's correct so far. */
function wpmChars(t: TypingTest): number {
  let n = 0;
  t.typed.forEach((typed, i) => {
    const word = t.words[i];
    if (word === undefined) return;
    if (i < current(t)) {
      if (typed === word) n += word.length + 1;
    } else if (word.startsWith(typed)) n += typed.length;
  });
  return n;
}

export interface Score { wpm: number; raw: number; accuracy: number; seconds: number }

export function score(t: TypingTest, now: number): Score {
  const ms = elapsedMs(t, now);
  const minutes = ms / 60000;
  const perMinute = (chars: number) => (minutes > 0 ? Math.round(chars / 5 / minutes) : 0);
  return {
    wpm: perMinute(wpmChars(t)),
    raw: perMinute(t.keystrokes),
    accuracy: t.keystrokes ? t.correctKeystrokes / t.keystrokes : 1,
    seconds: Math.round(ms / 1000),
  };
}

/** How steady the speed was: 100 minus the raw-WPM samples' coefficient of
 * variation, in percent. */
export function consistency(samples: number[]): number | null {
  if (samples.length < 3) return null;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  if (!mean) return 0;
  const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
  return Math.max(0, Math.round(100 - (sd / mean) * 100));
}

/** The characters mistyped most often, at least twice each. */
export function trickiest(t: TypingTest, count = 3): { char: string; misses: number }[] {
  return Object.entries(t.misses)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([char, misses]) => ({ char, misses }));
}

/** A challenge score read from the address bar: a whole WPM from 1 to 300. */
export function parseChallenge(value: string | null): number | null {
  if (!value || !/^\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= 300 ? n : null;
}
