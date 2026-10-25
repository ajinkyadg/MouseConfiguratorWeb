// MMO Mouse Trainer: game rules, with no DOM or timers so it can be tested.
// The page calls tick() with elapsed game time and press() with mapped
// keys; everything time-based uses game time, so pausing just stops ticks.

export type KeyNum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export const KEYS: KeyNum[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Where each side button sits (front column first, numbers up each column):
//   top 3 6 9 12 / middle 2 5 8 11 / bottom 1 4 7 10. row 0 = top.
export function keyPosition(k: KeyNum): { col: number; row: number } {
  return { col: Math.floor((k - 1) / 3), row: 2 - ((k - 1) % 3) };
}

/** Side buttons send ordinary keys by default: 1-9 and 0 on both mice, then
 * numpad +/− (M908) or -/= (M913). Matched by `code` (layout-independent),
 * with `key` as a fallback. */
export function mapKey(code: string, key: string): KeyNum | null {
  const byCode: Record<string, KeyNum> = {
    NumpadAdd: 11, Minus: 11, NumpadSubtract: 12, Equal: 12, Digit0: 10, Numpad0: 10,
  };
  if (code in byCode) return byCode[code];
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (digit) return Number(digit[1]) as KeyNum;
  if (code) return null;
  if (/^[1-9]$/.test(key)) return Number(key) as KeyNum;
  if (key === "0") return 10;
  if (key === "+" || key === "-") return 11;
  if (key === "=") return 12;
  return null;
}

export interface LevelSpec { keys: KeyNum[]; travelMs: number; maxEnemies: number; spawnGapMs: number; combo: number; comboNeighboursOnly: boolean; defeatsToLevel: number }
const k = (n: number) => KEYS.slice(0, n);
const LEVELS: LevelSpec[] = [
  { keys: k(3), travelMs: 4500, maxEnemies: 1, spawnGapMs: 600, combo: 0, comboNeighboursOnly: false, defeatsToLevel: 6 },
  { keys: k(6), travelMs: 4000, maxEnemies: 1, spawnGapMs: 500, combo: 0, comboNeighboursOnly: false, defeatsToLevel: 7 },
  { keys: k(6), travelMs: 3400, maxEnemies: 2, spawnGapMs: 1000, combo: 0, comboNeighboursOnly: false, defeatsToLevel: 7 },
  { keys: k(9), travelMs: 3200, maxEnemies: 2, spawnGapMs: 950, combo: 0, comboNeighboursOnly: false, defeatsToLevel: 8 },
  { keys: k(9), travelMs: 2800, maxEnemies: 2, spawnGapMs: 900, combo: 0, comboNeighboursOnly: false, defeatsToLevel: 8 },
  { keys: k(12), travelMs: 2800, maxEnemies: 2, spawnGapMs: 850, combo: 0, comboNeighboursOnly: false, defeatsToLevel: 9 },
  { keys: k(12), travelMs: 2800, maxEnemies: 3, spawnGapMs: 1000, combo: 0.2, comboNeighboursOnly: true, defeatsToLevel: 10 },
  { keys: k(12), travelMs: 2200, maxEnemies: 3, spawnGapMs: 900, combo: 0.35, comboNeighboursOnly: false, defeatsToLevel: 14 },
];
export function levelSpec(level: number): LevelSpec {
  if (level <= LEVELS.length) return LEVELS[level - 1];
  const travelMs = Math.max(1500, 2000 - 100 * (level - 9));
  return { keys: k(12), travelMs, maxEnemies: 3, spawnGapMs: 800, combo: 0.5, comboNeighboursOnly: false, defeatsToLevel: 14 };
}

export const RUN_MS = 90_000;
export const COUNTDOWN_MS = 2400;
export const FORGIVING_MS = 20_000;
export const START_LIVES = 3;
const MAX_MASTERY = 6;
/** Share of the lane enemies keep between them; the page raises it on narrow screens. */
export const QUEUE_SPACING = 0.14;

export type HintState = "full" | "outline" | "off";
export function hintFor(mastery: number): HintState {
  return mastery <= 2 ? "full" : mastery <= 5 ? "outline" : "off";
}

export interface Enemy {
  id: number;
  keys: KeyNum[]; // 1, or 2 for a combo
  step: number; // index of the key to press next
  travelMs: number;
  enteredAt: number; // game time it entered the lane (shifted when bounced back)
  frontSince: number | null; // game time it became the target
  stepStart: number | null; // when the current key became due (for reaction time)
  progress: number; // 0 at the right edge, 1 at the player
  wrongThisStep: boolean;
  missedAny: boolean;
  rescued: boolean; // hint forced back to full for this enemy
  rtTotal: number; // reaction time summed over a combo's presses
}

export type GameEvent =
  | { type: "defeat"; enemy: Enemy; points: number; rt: number }
  | { type: "step"; enemy: Enemy; key: KeyNum }
  | { type: "wrong"; pressed: KeyNum; expected: KeyNum }
  | { type: "arrive"; enemy: Enemy; lifeLost: boolean }
  | { type: "level"; level: number }
  | { type: "over"; reason: "time" | "lives" };

export interface Game {
  phase: "ready" | "countdown" | "running" | "over";
  time: number; // game time in ms, from the end of the countdown
  countdownLeft: number;
  level: number;
  defeatsThisLevel: number;
  lives: number;
  score: number;
  streak: number;
  correct: number;
  wrong: number;
  arrived: number;
  enemies: Enemy[];
  mastery: Record<KeyNum, number>;
  recent: Record<KeyNum, boolean[]>; // last 5 appearances: true = missed
  rts: Record<KeyNum, number[]>; // first-try reaction times
  lastKey: KeyNum | null;
  lastSpawnAt: number;
  forcedNewKeys: KeyNum[]; // a new level's keys, used for its first spawns
  nextId: number;
  touch: boolean;
  spacing: number; // QUEUE_SPACING, or more where the lane is short
  events: GameEvent[]; // drained by the page each frame
}

const perKey = <T>(make: () => T) => Object.fromEntries(KEYS.map((n) => [n, make()])) as Record<KeyNum, T>;

export function createGame(): Game {
  return {
    phase: "ready", time: 0, countdownLeft: COUNTDOWN_MS, level: 1, defeatsThisLevel: 0, lives: START_LIVES,
    score: 0, streak: 0, correct: 0, wrong: 0, arrived: 0, enemies: [],
    mastery: perKey(() => 0), recent: perKey(() => []), rts: perKey(() => []),
    lastKey: null, lastSpawnAt: -Infinity, forcedNewKeys: [], nextId: 1, touch: false, spacing: QUEUE_SPACING, events: [],
  };
}

export function startRun(game: Game): void {
  Object.assign(game, createGame(), { phase: "countdown", touch: game.touch, spacing: game.spacing });
}

export function multiplier(streak: number): number {
  return streak >= 20 ? 4 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Spawn weight: missed or slow keys come up more often. */
export function keyWeight(game: Game, key: KeyNum): number {
  const misses = Math.min(2, game.recent[key].filter(Boolean).length);
  const slow = game.rts[key].length > 0 && median(game.rts[key]) > 900 ? 1 : 0;
  return Math.min(4, 1 + misses + slow);
}

function pickKey(game: Game, pool: KeyNum[], rng: () => number, exclude: KeyNum | null): KeyNum {
  const candidates = pool.filter((n) => n !== exclude);
  const options = candidates.length ? candidates : pool;
  const weights = options.map((n) => keyWeight(game, n));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r < 0) return options[i];
  }
  return options[options.length - 1];
}

export function neighbours(key: KeyNum): KeyNum[] {
  const { col, row } = keyPosition(key);
  return KEYS.filter((n) => {
    const p = keyPosition(n);
    return n !== key && Math.abs(p.col - col) <= 1 && Math.abs(p.row - row) <= 1;
  });
}

function spawn(game: Game, rng: () => number): void {
  const spec = levelSpec(game.level);
  let first: KeyNum;
  const forced = game.forcedNewKeys.filter((n) => n !== game.lastKey);
  if (forced.length) {
    first = forced[Math.floor(rng() * forced.length)];
    game.forcedNewKeys = game.forcedNewKeys.filter((n) => n !== first);
  } else {
    first = pickKey(game, spec.keys, rng, game.lastKey);
  }
  const keys: KeyNum[] = [first];
  if (!forced.length && spec.combo > 0 && rng() < spec.combo) {
    const pool = spec.comboNeighboursOnly ? neighbours(first).filter((n) => spec.keys.includes(n)) : spec.keys;
    keys.push(pickKey(game, pool, rng, first));
  }
  const travelMs = spec.travelMs * (keys.length > 1 ? 1.5 : 1);
  game.enemies.push({
    id: game.nextId++, keys, step: 0, travelMs, enteredAt: game.time, frontSince: null, stepStart: null,
    progress: 0, wrongThisStep: false, missedAny: false, rescued: false, rtTotal: 0,
  });
  game.lastKey = keys[keys.length - 1];
  game.lastSpawnAt = game.time;
}

function becomeFront(game: Game): void {
  const front = game.enemies[0];
  if (front && front.frontSince === null) {
    front.frontSince = game.time;
    front.stepStart = game.time;
  }
}

function recordAppearance(game: Game, key: KeyNum, missed: boolean): void {
  game.recent[key] = [...game.recent[key], missed].slice(-5);
}

function miss(game: Game, key: KeyNum): void {
  game.mastery[key] = Math.max(0, game.mastery[key] - 3);
}

function endRun(game: Game, reason: "time" | "lives"): void {
  if (game.phase === "over") return;
  game.phase = "over";
  if (reason === "time") game.score += 300 * game.lives;
  game.enemies = [];
  game.events.push({ type: "over", reason });
}

/** Advances the game by dt ms. */
export function tick(game: Game, dt: number, rng: () => number = Math.random): void {
  if (game.phase === "countdown") {
    game.countdownLeft -= dt;
    if (game.countdownLeft <= 0) {
      game.phase = "running";
      game.time = 0;
    }
    return;
  }
  if (game.phase !== "running") return;
  game.time += dt;
  if (game.time >= RUN_MS) return endRun(game, "time");

  const spec = levelSpec(game.level);
  if (game.enemies.length < spec.maxEnemies && game.time - game.lastSpawnAt >= spec.spawnGapMs) spawn(game, rng);
  becomeFront(game);

  // Move enemies in single file; nobody overtakes the one ahead. A held
  // enemy's clock is wound back to match, so it doesn't leap forward when
  // the one ahead goes.
  let limit = Infinity;
  for (const enemy of game.enemies) {
    const raw = (game.time - enemy.enteredAt) / enemy.travelMs;
    if (raw > limit) enemy.enteredAt = game.time - limit * enemy.travelMs;
    enemy.progress = Math.min(raw, limit);
    limit = enemy.progress - game.spacing;
  }

  const front = game.enemies[0];
  if (!front) return;
  // Late hint: past 60% of the lane with no press, show the key in full.
  const due = front.keys[front.step];
  if (!front.rescued && hintFor(game.mastery[due]) !== "full" && front.progress >= 0.6 && !front.wrongThisStep) front.rescued = true;

  if (front.progress >= 1) {
    if (game.time < FORGIVING_MS) {
      // Early on, an enemy that gets through is sent back instead of costing a life.
      front.enteredAt = game.time - front.travelMs * 0.5;
      front.rescued = true;
      game.events.push({ type: "arrive", enemy: front, lifeLost: false });
      return;
    }
    game.enemies.shift();
    game.lives -= 1;
    game.arrived += 1;
    game.streak = 0;
    miss(game, due);
    recordAppearance(game, due, true);
    game.events.push({ type: "arrive", enemy: front, lifeLost: true });
    if (game.lives <= 0) return endRun(game, "lives");
    becomeFront(game);
  }
}

/** Handles a side-button press. */
export function press(game: Game, key: KeyNum): void {
  if (game.phase !== "running") return;
  const front = game.enemies[0];
  if (!front) return;
  const expected = front.keys[front.step];
  if (key !== expected) {
    game.wrong += 1;
    game.streak = 0;
    front.wrongThisStep = true;
    front.missedAny = true;
    front.rescued = true;
    miss(game, expected);
    if (front.step > 0) front.step = 0; // a wrong second press restarts the combo
    front.stepStart = game.time;
    game.events.push({ type: "wrong", pressed: key, expected });
    return;
  }

  game.correct += 1;
  const rt = game.time - (front.stepStart ?? game.time);
  const clean = !front.wrongThisStep && !front.rescued && rt < 1000;
  if (!front.wrongThisStep) game.rts[key].push(rt);
  if (clean) game.mastery[key] = Math.min(MAX_MASTERY, game.mastery[key] + 1);
  front.rtTotal += rt;

  if (front.step < front.keys.length - 1) {
    front.step += 1;
    front.stepStart = game.time;
    front.wrongThisStep = false;
    game.events.push({ type: "step", enemy: front, key });
    return;
  }

  game.enemies.shift();
  for (const n of front.keys) recordAppearance(game, n, front.missedAny);
  game.streak += 1;
  const base = front.keys.length > 1 ? 250 : 100;
  const bonus = front.rtTotal < 600 ? 50 : 0;
  const points = (base + bonus) * multiplier(game.streak);
  game.score += points;
  game.events.push({ type: "defeat", enemy: front, points, rt: front.rtTotal });

  game.defeatsThisLevel += 1;
  if (game.defeatsThisLevel >= levelSpec(game.level).defeatsToLevel) {
    const before = levelSpec(game.level).keys;
    game.level += 1;
    game.defeatsThisLevel = 0;
    const added = levelSpec(game.level).keys.filter((n) => !before.includes(n));
    game.forcedNewKeys = [...added];
    game.events.push({ type: "level", level: game.level });
  }
  becomeFront(game);
}

export interface Summary {
  score: number;
  accuracy: number; // 0-1
  averageRt: number | null;
  level: number;
  slowest: { key: KeyNum; medianRt: number; misses: number }[];
}

export function summarize(game: Game): Summary {
  const attempts = game.correct + game.wrong + game.arrived;
  const all = KEYS.flatMap((n) => game.rts[n]);
  const slowest = KEYS.filter((n) => game.rts[n].length >= 2)
    .map((n) => ({ key: n, medianRt: Math.round(median(game.rts[n])), misses: game.recent[n].filter(Boolean).length }))
    .sort((a, b) => b.medianRt - a.medianRt)
    .slice(0, 3);
  return {
    score: game.score,
    accuracy: attempts ? game.correct / attempts : 0,
    averageRt: all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : null,
    level: game.level,
    slowest,
  };
}
