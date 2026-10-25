import { describe, it, expect } from "vitest";
import {
  createGame, startRun, tick, press, mapKey, keyPosition, levelSpec, hintFor, keyWeight, neighbours, summarize, multiplier,
  COUNTDOWN_MS, FORGIVING_MS, RUN_MS, KEYS, type Game, type KeyNum,
} from "./game";

const rngFixed = (v = 0) => () => v;
function running(): Game {
  const g = createGame();
  startRun(g);
  tick(g, COUNTDOWN_MS, rngFixed());
  expect(g.phase).toBe("running");
  return g;
}
/** Ticks until an enemy is the target, returning its first key. */
function nextTarget(g: Game): KeyNum {
  for (let i = 0; i < 200 && !g.enemies[0]; i++) tick(g, 50, rngFixed());
  return g.enemies[0]!.keys[g.enemies[0]!.step];
}

describe("mapKey", () => {
  it("maps both mice's default side-button keys", () => {
    for (let n = 1; n <= 9; n++) {
      expect(mapKey(`Digit${n}`, String(n))).toBe(n);
      expect(mapKey(`Numpad${n}`, String(n))).toBe(n);
    }
    expect(mapKey("Digit0", "0")).toBe(10);
    expect(mapKey("NumpadAdd", "+")).toBe(11); // M908
    expect(mapKey("Minus", "-")).toBe(11); // M913
    expect(mapKey("NumpadSubtract", "-")).toBe(12); // M908
    expect(mapKey("Equal", "=")).toBe(12); // M913
  });
  it("uses the physical key, not the character, so other keyboard layouts work", () => {
    expect(mapKey("Digit1", "&")).toBe(1); // AZERTY
  });
  it("falls back to the character only when there is no code", () => {
    expect(mapKey("", "7")).toBe(7);
    expect(mapKey("", "=")).toBe(12);
    expect(mapKey("KeyA", "a")).toBeNull();
    expect(mapKey("", "a")).toBeNull();
  });
});

describe("layout and levels", () => {
  it("places keys as on the mouse: up each column, front column first", () => {
    expect(keyPosition(1)).toEqual({ col: 0, row: 2 });
    expect(keyPosition(3)).toEqual({ col: 0, row: 0 });
    expect(keyPosition(12)).toEqual({ col: 3, row: 0 });
  });
  it("introduces keys one column at a time and speeds up", () => {
    expect(levelSpec(1).keys).toEqual([1, 2, 3]);
    expect(levelSpec(2).keys).toEqual([1, 2, 3, 4, 5, 6]);
    expect(levelSpec(6).keys).toHaveLength(12);
    expect(levelSpec(9).travelMs).toBe(2000);
    expect(levelSpec(30).travelMs).toBe(1500); // floor
  });
  it("neighbours are the adjacent keys on the pad, diagonals included", () => {
    expect(neighbours(5).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
    expect(neighbours(1).sort((a, b) => a - b)).toEqual([2, 4, 5]);
  });
  it("hints fade with mastery", () => {
    expect([0, 2, 3, 5, 6].map(hintFor)).toEqual(["full", "full", "outline", "outline", "off"]);
  });
  it("streak multiplier steps at 5, 10 and 20", () => {
    expect([0, 4, 5, 9, 10, 19, 20].map(multiplier)).toEqual([1, 1, 2, 2, 3, 3, 4]);
  });
});

describe("a run", () => {
  it("counts down, then spawns level-1 keys only", () => {
    const g = running();
    const key = nextTarget(g);
    expect([1, 2, 3]).toContain(key);
  });

  it("a correct press defeats the target and scores with a speed bonus", () => {
    const g = running();
    const key = nextTarget(g);
    tick(g, 300);
    press(g, key);
    expect(g.correct).toBe(1);
    expect(g.score).toBe(150); // 100 + 50 for under 600 ms
    expect(g.mastery[key]).toBe(1);
    expect(g.events.some((e) => e.type === "defeat")).toBe(true);
  });

  it("a wrong press costs no life but breaks the streak and brings the hint back", () => {
    const g = running();
    const key = nextTarget(g);
    g.mastery[key] = 5;
    const wrongKey = (key === 1 ? 2 : 1) as KeyNum;
    press(g, wrongKey);
    expect(g.lives).toBe(3);
    expect(g.wrong).toBe(1);
    expect(g.streak).toBe(0);
    expect(g.mastery[key]).toBe(2);
    expect(g.enemies[0].rescued).toBe(true);
  });

  it("in the first 20 seconds an enemy that gets through is sent back, not a lost life", () => {
    const g = running();
    nextTarget(g);
    for (let i = 0; i < 100; i++) tick(g, 50, rngFixed());
    expect(g.lives).toBe(3);
    expect(g.events.some((e) => e.type === "arrive" && !e.lifeLost)).toBe(true);
  });

  it("after 20 seconds an enemy that gets through costs a life; three ends the run", () => {
    const g = running();
    g.time = FORGIVING_MS;
    for (let i = 0; i < 2000 && g.phase === "running"; i++) tick(g, 50, rngFixed());
    expect(g.lives).toBe(0);
    expect(g.phase).toBe("over");
    expect(g.events.some((e) => e.type === "over" && e.reason === "lives")).toBe(true);
  });

  it("ends at 90 seconds with a bonus for lives left", () => {
    const g = running();
    g.time = RUN_MS - 10;
    g.score = 1000;
    tick(g, 20, rngFixed());
    expect(g.phase).toBe("over");
    expect(g.score).toBe(1000 + 300 * 3);
  });

  it("levels up after enough defeats and opens the next column first", () => {
    const g = running();
    for (let i = 0; i < levelSpec(1).defeatsToLevel; i++) {
      const key = nextTarget(g);
      press(g, key);
    }
    expect(g.level).toBe(2);
    const key = nextTarget(g);
    expect([4, 5, 6]).toContain(key); // a new level's keys come first
  });

  it("enemies keep single file: no one overtakes the target", () => {
    const g = running();
    g.level = 3; // two at a time
    for (let i = 0; i < 60; i++) tick(g, 50, rngFixed(0.5));
    expect(g.enemies.length).toBe(2);
    expect(g.enemies[1].progress).toBeLessThan(g.enemies[0].progress);
  });

  it("a held enemy doesn't leap forward when the one ahead goes", () => {
    const g = running();
    g.level = 3;
    const enemy = (id: number, travelMs: number) => ({ id, keys: [1] as KeyNum[], step: 0, travelMs, enteredAt: g.time, frontSince: null, stepStart: null, progress: 0, wrongThisStep: false, missedAny: false, rescued: false, rtTotal: 0 });
    g.enemies = [enemy(1, 10000), enemy(2, 1000)]; // a slow one with a fast one stuck behind it
    g.lastSpawnAt = Infinity;
    for (let i = 0; i < 40; i++) tick(g, 50, rngFixed());
    const held = g.enemies[1].progress;
    press(g, 1);
    tick(g, 50, rngFixed());
    expect(g.enemies[0].id).toBe(2);
    expect(g.enemies[0].progress).toBeLessThan(held + 0.1);
  });

  it("a combo needs both keys in order; a wrong second press restarts it", () => {
    const g = running();
    g.level = 8;
    g.enemies = [{ id: 1, keys: [4, 8], step: 0, travelMs: 5000, enteredAt: g.time, frontSince: g.time, stepStart: g.time, progress: 0, wrongThisStep: false, missedAny: false, rescued: false, rtTotal: 0 }];
    press(g, 4);
    expect(g.enemies[0].step).toBe(1);
    press(g, 9);
    expect(g.enemies[0].step).toBe(0);
    press(g, 4);
    press(g, 8);
    expect(g.enemies).toHaveLength(0);
    expect(g.events.filter((e) => e.type === "defeat")).toHaveLength(1);
  });

  it("weights spawns toward missed and slow keys", () => {
    const g = running();
    expect(keyWeight(g, 2)).toBe(1);
    g.recent[2] = [true, true, true];
    g.rts[2] = [1200, 1100];
    expect(keyWeight(g, 2)).toBe(4);
  });
});

describe("summarize", () => {
  it("reports accuracy, average reaction time and the three slowest keys", () => {
    const g = createGame();
    g.correct = 8; g.wrong = 1; g.arrived = 1;
    g.rts[1] = [400, 500]; g.rts[5] = [900, 1100]; g.rts[9] = [700, 700]; g.rts[12] = [1300, 1500]; g.rts[3] = [300];
    const s = summarize(g);
    expect(s.accuracy).toBeCloseTo(0.8);
    expect(s.slowest.map((x) => x.key)).toEqual([12, 5, 9]);
    expect(s.averageRt).toBe(Math.round([400, 500, 900, 1100, 700, 700, 1300, 1500, 300].reduce((a, b) => a + b) / 9));
    expect(KEYS).toHaveLength(12);
  });
});
