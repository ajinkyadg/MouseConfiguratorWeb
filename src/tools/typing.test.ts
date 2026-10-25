import { describe, expect, it } from "vitest";
import {
  WORDS, makeWords, createTest, typeChar, nextWord, backspace, setCurrent, update, score, charCounts,
  consistency, trickiest, parseChallenge, MAX_EXTRA,
} from "./typing";

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};
const typeWord = (t: ReturnType<typeof createTest>, word: string, now: number) => {
  for (const ch of word) typeChar(t, ch, now);
  nextWord(t, now);
};

describe("makeWords", () => {
  it("uses the word list and never repeats a word back to back", () => {
    const words = makeWords(500, { punctuation: false, numbers: false });
    expect(words).toHaveLength(500);
    for (let i = 0; i < words.length; i++) {
      expect(WORDS).toContain(words[i]);
      if (i) expect(words[i]).not.toBe(words[i - 1]);
    }
  });

  it("capitalises the first word and the word after a full stop", () => {
    // first word: pick "the", mark → "." ; second: pick "be", no mark
    const words = makeWords(2, { punctuation: true, numbers: false }, seq(0, 0.05, 0.01, 0.9));
    expect(words).toEqual(["The.", "Be"]);
  });

  it("puts in numbers when asked", () => {
    const words = makeWords(300, { punctuation: false, numbers: true });
    expect(words.some((w) => /^\d+$/.test(w))).toBe(true);
  });
});

describe("typing", () => {
  it("scores correct words at 5 characters per word", () => {
    const t = createTest(["hello", "world", "again"], 60);
    typeWord(t, "hello", 0);
    typeWord(t, "world", 0);
    // 12 characters (two words plus spaces) in 6 s = 2.4 words in 0.1 min
    const s = score(t, 6000);
    expect(s.wpm).toBe(24);
    expect(s.raw).toBe(24);
    expect(s.accuracy).toBe(1);
  });

  it("leaves wrong words out of WPM but not raw, and counts fixed mistakes against accuracy", () => {
    const t = createTest(["cat", "dog", "pig", "cow"], 60);
    typeWord(t, "cat", 0);
    typeChar(t, "x", 0);
    backspace(t);
    typeWord(t, "dog", 0);
    typeWord(t, "pog", 0);
    const s = score(t, 60000);
    expect(s.wpm).toBe(Math.round(8 / 5)); // "cat " + "dog "
    expect(s.raw).toBe(Math.round(13 / 5));
    expect(s.accuracy).toBeCloseTo(10 / 13); // the x, the p, and the space ending a wrong word
    expect(charCounts(t)).toEqual({ correct: 8, incorrect: 1, extra: 0, missed: 0 });
  });

  it("starts the clock on the first keystroke", () => {
    const t = createTest(["one", "two"], 15);
    expect(t.startedAt).toBeNull();
    typeChar(t, "o", 500);
    expect(t.startedAt).toBe(500);
  });

  it("ignores space at the start of a word", () => {
    const t = createTest(["one", "two"], 15);
    nextWord(t, 0);
    expect(t.typed).toEqual([""]);
    expect(t.keystrokes).toBe(0);
  });

  it("counts skipped letters as missed and letters past the end as extra, up to a limit", () => {
    const t = createTest(["abc", "de", "f"], 15);
    typeWord(t, "a", 0);
    typeWord(t, "de" + "z".repeat(20), 0);
    expect(t.typed[1]).toHaveLength(2 + MAX_EXTRA);
    expect(charCounts(t)).toEqual({ correct: 3, incorrect: 0, extra: MAX_EXTRA, missed: 2 });
  });

  it("lets backspace return to a wrong word but not a correct one", () => {
    const t = createTest(["ab", "cd", "ef"], 15);
    typeWord(t, "ab", 0);
    expect(backspace(t)).toBe(false);
    typeWord(t, "cx", 0);
    expect(backspace(t)).toBe(true);
    expect(t.typed).toEqual(["ab", "cx"]);
    backspace(t);
    typeWord(t, "d", 0);
    expect(t.typed).toEqual(["ab", "cd", ""]);
  });

  it("syncs with an input box, including autocorrect and delete-word", () => {
    const t = createTest(["their", "x"], 15);
    setCurrent(t, "thier", 0);
    setCurrent(t, "their", 0); // autocorrect swaps the last letters
    expect(t.typed[0]).toBe("their");
    expect(t.keystrokes).toBe(8);
    setCurrent(t, "", 0);
    expect(t.typed[0]).toBe("");
  });

  it("records a sample per second and ends on time", () => {
    const t = createTest(makeWords(100, { punctuation: false, numbers: false }), 15);
    typeChar(t, t.words[0][0], 0);
    update(t, 3500);
    expect(t.samples).toHaveLength(3);
    update(t, 20000);
    expect(t.samples).toHaveLength(15);
    expect(t.endedAt).toBe(15000);
    typeChar(t, "a", 21000);
    expect(t.keystrokes).toBe(1);
    expect(score(t, 99999).seconds).toBe(15);
  });

  it("ends when the words run out", () => {
    const t = createTest(["a"], 60);
    typeWord(t, "a", 2000);
    expect(t.endedAt).toBe(2000);
  });

  it("finds the most mistyped characters", () => {
    const t = createTest(["eee", "rr", "t"], 60);
    for (const ch of "xxx") typeChar(t, ch, 0);
    nextWord(t, 0);
    typeChar(t, "x", 0);
    nextWord(t, 0);
    expect(trickiest(t)).toEqual([{ char: "e", misses: 3 }]);
  });
});

describe("helpers", () => {
  it("rates steady speed as consistent", () => {
    expect(consistency([60, 60, 60])).toBe(100);
    expect(consistency([30, 90, 30, 90])).toBe(50);
    expect(consistency([60, 60])).toBeNull();
  });

  it("only accepts a sensible whole-number challenge", () => {
    expect(parseChallenge("72")).toBe(72);
    expect(parseChallenge("0")).toBeNull();
    expect(parseChallenge("301")).toBeNull();
    expect(parseChallenge("7e1")).toBeNull();
    expect(parseChallenge("<b>")).toBeNull();
    expect(parseChallenge(null)).toBeNull();
  });
});
