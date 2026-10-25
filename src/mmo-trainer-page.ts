// MMO Mouse Trainer page: draws the game (src/mmo-trainer/game.ts holds the
// rules) on a canvas, with the HUD, the side-button strip and the start,
// pause and end screens as ordinary HTML. Side buttons arrive as normal
// key presses, so nothing connects to the mouse.
import "./site-nav";
import {
  createGame, startRun, tick, press, mapKey, keyPosition, hintFor, levelSpec, summarize,
  COUNTDOWN_MS, RUN_MS, START_LIVES, KEYS, type Enemy, type Game, type KeyNum,
} from "./mmo-trainer/game";

const BEST_KEY = "mouseconfig.mmoTrainer.best";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const coarse = matchMedia("(pointer: coarse)");

const root = document.querySelector<HTMLDivElement>("#game")!;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "") => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};

// --- Page structure -------------------------------------------------------
const hud = el("div", "mt-hud");
const stat = (label: string) => {
  const box = el("div", "mt-stat");
  const value = el("span", "mt-value", "0");
  box.append(el("span", "mt-label", label), value);
  hud.append(box);
  return value;
};
const scoreEl = stat("Score");
const levelEl = stat("Level");
const timeEl = stat("Time");
const livesBox = el("div", "mt-stat mt-lives");
const livesSquares = el("span", "mt-squares");
livesSquares.setAttribute("aria-hidden", "true");
const livesText = el("span", "mt-value");
for (let i = 0; i < START_LIVES; i++) livesSquares.append(el("span"));
livesBox.append(el("span", "mt-label", "Lives"), livesSquares, livesText);
hud.append(livesBox);
const comboBox = el("div", "mt-stat mt-combo");
const comboValue = el("span", "mt-value", "×1");
const comboBar = el("span", "mt-bar");
comboBar.setAttribute("aria-hidden", "true");
for (let i = 0; i < 4; i++) comboBar.append(el("span"));
comboBox.append(el("span", "mt-label", "Combo"), comboValue, comboBar);
hud.append(comboBox);

const stage = el("div", "mt-stage");
const canvas = el("canvas", "mt-field");
canvas.setAttribute("aria-hidden", "true");
const overlay = el("div", "mt-overlay");
stage.append(canvas, overlay);

const strip = el("div", "mt-keys");
strip.setAttribute("role", "group");
strip.setAttribute("aria-label", "Side buttons, laid out as on the mouse");
const keyButtons = new Map<KeyNum, HTMLButtonElement>();
for (const n of KEYS) {
  const b = el("button", "mt-key");
  b.type = "button";
  b.tabIndex = -1; // pressed with the mouse's own buttons; tapping is for touch screens
  const { col, row } = keyPosition(n);
  b.style.setProperty("--c", String(col));
  b.style.setProperty("--r", String(row));
  b.append(el("span", "mt-key-num", String(n)), el("span", "mt-key-note"));
  b.setAttribute("aria-label", `Side button ${n}`);
  b.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    input(n, "touch");
  });
  keyButtons.set(n, b);
  strip.append(b);
}
const stripLabels = el("div", "mt-keys-ends");
stripLabels.setAttribute("aria-hidden", "true");
stripLabels.append(el("span", "", "Front"), el("span", "", "Rear"));

const help = el("p", "mt-help");
help.textContent =
  "Enemies walk in from the right, each with a side-button number. Press that button on your mouse before it reaches you. " +
  "Out of the box the side buttons type 1–9 and 0, then +/− or -/=, so no setup is needed; a keyboard's number row works too. " +
  "The highlighted key shows where to press, and fades as you learn it. Esc pauses.";
const live = el("p", "visually-hidden");
live.setAttribute("aria-live", "polite");
root.append(hud, stage, strip, stripLabels, help, live);
const say = (message: string) => (live.textContent = message);

// --- Theme colours ---------------------------------------------------------
interface Palette { bg: string; text: string; muted: string; accent: string; onAccent: string; success: string; warning: string; danger: string; line: string; enemy: string; combo: string; enemyText: string; font: string; glow: boolean }
let palette: Palette;
function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const light = document.documentElement.dataset.theme === "pro";
  palette = {
    bg: v("--surface-sunken"), text: v("--text"), muted: v("--text-secondary"), accent: v("--accent"), onAccent: v("--on-accent"),
    success: v("--success"), warning: v("--warning"), danger: v("--danger"), line: v("--border"),
    enemy: light ? "#3d4350" : "#2c2c31", combo: light ? "#15171c" : "#3b3b44", enemyText: light ? "#ffffff" : "#f2f2f3",
    font: getComputedStyle(document.body).fontFamily, glow: !light,
  };
}
readPalette();
new MutationObserver(readPalette).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// --- World and canvas -----------------------------------------------------
const H = 420;
let W = 960;
let cssWidth = 0;
const ctx = canvas.getContext("2d")!;
const geometry = () => {
  const narrow = W === 540;
  return { player: narrow ? 56 : 88, danger: narrow ? 120 : 150, spawn: W + 40, lane: 240 };
};
function resize() {
  cssWidth = stage.clientWidth;
  W = cssWidth < 640 ? 540 : 960;
  const cssHeight = Math.round((cssWidth * H) / W);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform((cssWidth * dpr) / W, 0, 0, (cssHeight * dpr) / H, 0, 0);
}
new ResizeObserver(resize).observe(stage);
resize();

// --- State -------------------------------------------------------------------
const game: Game = createGame();
game.touch = coarse.matches;
let paused = false;
let resumeLeft = 0; // countdown after a pause
let now = performance.now();
interface Effect { kind: "cast" | "hit" | "wrong" | "arrive" | "back" | "level"; start: number; dur: number; x: number; y: number; text?: string }
let effects: Effect[] = [];
let shake = { until: 0, size: 0 };
const flash = new Map<KeyNum, { cls: string; until: number }>();
let best = 0;
try {
  best = Number(localStorage.getItem(BEST_KEY)) || 0;
} catch {
  best = 0;
}

const enemyX = (e: Enemy) => {
  const g = geometry();
  return g.spawn - e.progress * (g.spawn - g.danger);
};
const addEffect = (kind: Effect["kind"], dur: number, x: number, y: number, text?: string) => effects.push({ kind, start: now, dur, x, y, text });

// --- Input -------------------------------------------------------------------
function input(n: KeyNum, source: "key" | "touch") {
  if (source === "touch") game.touch = true;
  if (game.phase === "ready") return begin();
  if (game.phase !== "running" || paused || resumeLeft > 0) return;
  setFlash(n, "is-pressed", 120);
  const target = game.enemies[0];
  press(game, n);
  if (target && !game.enemies.includes(target)) addEffect("cast", 180, enemyX(target), geometry().lane);
}

addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, select")) return;
  if (event.key === "Escape" || (event.code === "Space" && (game.phase === "running" || game.phase === "countdown"))) {
    if (game.phase === "running" || game.phase === "countdown") {
      event.preventDefault();
      paused ? resume() : pause();
    }
    return;
  }
  const n = mapKey(event.code, event.key);
  if (n === null) return;
  if (game.phase === "running" || game.phase === "countdown") event.preventDefault();
  if (event.repeat) return;
  input(n, "key");
});
document.addEventListener("visibilitychange", () => document.hidden && pause());
addEventListener("blur", () => pause());

// --- Run control -----------------------------------------------------------
function begin() {
  startRun(game);
  game.touch = coarse.matches;
  paused = false;
  resumeLeft = 0;
  effects = [];
  clearOverlay();
  say("Run started");
}
function pause() {
  if (paused || (game.phase !== "running" && game.phase !== "countdown")) return;
  paused = true;
  showOverlay("paused");
  say("Paused");
}
function resume() {
  if (!paused) return;
  paused = false;
  if (game.phase === "running") resumeLeft = COUNTDOWN_MS;
  clearOverlay();
  say("Resumed");
}
function endRun() {
  game.phase = "over";
  game.enemies = [];
  finish();
}

// --- Overlay screens -------------------------------------------------------
function clearOverlay() {
  overlay.replaceChildren();
  overlay.hidden = true;
}
function button(text: string, primary: boolean, onClick: () => void) {
  const b = el("button", primary ? "primary" : "", text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}
function showOverlay(kind: "start" | "paused") {
  overlay.hidden = false;
  const card = el("div", "mt-card");
  if (kind === "start") {
    card.append(
      el("h2", "", "MMO Mouse Trainer"),
      el("p", "", game.touch ? "Tap the matching key below before each enemy reaches you." : "Press any side button to start."),
    );
    if (best) card.append(el("p", "mt-muted", `Best score: ${best.toLocaleString()}`));
    card.append(button("Start", true, begin));
  } else {
    card.append(el("h2", "", "Paused"), el("p", "mt-muted", `Score ${game.score.toLocaleString()} · Level ${game.level}`));
    const row = el("div", "mt-actions");
    row.append(button("Resume", true, resume), button("End run", false, endRun));
    card.append(row);
  }
  overlay.replaceChildren(card);
  card.querySelector<HTMLButtonElement>("button.primary")?.focus({ preventScroll: true });
}
function finish() {
  const s = summarize(game);
  const newBest = s.score > best;
  if (newBest) {
    best = s.score;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // storage unavailable: the best score just isn't kept
    }
  }
  overlay.hidden = false;
  const card = el("div", "mt-card mt-summary");
  card.append(el("h2", "", "Run over"));
  if (newBest) card.append(el("p", "mt-new-best", "New best!"));
  const tiles = el("div", "mt-tiles");
  const tile = (label: string, value: string) => {
    const t = el("div", "mt-tile");
    t.append(el("span", "mt-tile-value", value), el("span", "mt-label", label));
    tiles.append(t);
  };
  tile("Score", s.score.toLocaleString());
  tile("Accuracy", `${Math.round(s.accuracy * 100)}%`);
  tile("Avg reaction", s.averageRt === null ? "–" : `${s.averageRt} ms`);
  card.append(tiles);
  if (s.slowest.length) {
    card.append(el("p", "mt-muted", "Slowest buttons, marked on the keys below:"));
    const list = el("ol", "mt-slow");
    for (const k of s.slowest) {
      const { col, row } = keyPosition(k.key);
      const where = `${["top", "middle", "bottom"][row]} row, ${["front", "second", "third", "rear"][col]} column`;
      list.append(el("li", "", `Button ${k.key} (${where}): ${k.medianRt} ms${k.misses ? `, ${k.misses} missed` : ""}`));
    }
    card.append(list);
  }
  if (game.touch) card.append(el("p", "mt-muted", "Touch mode run."));
  const row = el("div", "mt-actions");
  row.append(button("Play again", true, begin));
  card.append(row);
  overlay.replaceChildren(card);
  card.querySelector<HTMLButtonElement>("button.primary")?.focus({ preventScroll: true });
  // The key strip marks the slowest three with their typical reaction time.
  for (const n of KEYS) {
    const b = keyButtons.get(n)!;
    const i = s.slowest.findIndex((k) => k.key === n);
    b.querySelector(".mt-key-note")!.textContent = i < 0 ? "" : `${s.slowest[i].medianRt} ms`;
    b.dataset.rank = i < 0 ? "" : String(i + 1);
  }
  say(`Run over. Score ${s.score}, accuracy ${Math.round(s.accuracy * 100)} percent${s.averageRt ? `, average reaction ${s.averageRt} milliseconds` : ""}.`);
}

// --- Events from the game ----------------------------------------------------
function setFlash(n: KeyNum, cls: string, ms: number) {
  flash.set(n, { cls, until: now + ms });
}
function drainEvents() {
  const g = geometry();
  for (const e of game.events) {
    if (e.type === "defeat") {
      addEffect("hit", reduceMotion.matches ? 400 : 420, enemyX(e.enemy), g.lane, `+${e.points}`);
    } else if (e.type === "wrong") {
      addEffect("wrong", reduceMotion.matches ? 700 : 600, g.player, g.lane - 62, `${e.pressed}, not ${e.expected}`);
      if (!reduceMotion.matches) shake = { until: now + 180, size: 4 };
      setFlash(e.pressed, "is-wrong", 400);
    } else if (e.type === "arrive") {
      if (e.lifeLost) {
        addEffect("arrive", 400, g.player, g.lane, "−1");
        if (!reduceMotion.matches) shake = { until: now + 240, size: 6 };
      } else {
        addEffect("back", 600, enemyX(e.enemy), g.lane - 70, "Sent back");
      }
    } else if (e.type === "level") {
      addEffect("level", reduceMotion.matches ? 1400 : 1620, W / 2, 110, `Level ${e.level}`);
      say(`Level ${e.level}`);
    } else if (e.type === "over") {
      finish();
    }
  }
  game.events.length = 0;
}

// --- HUD and keys --------------------------------------------------------------
function updateHud() {
  scoreEl.textContent = game.score.toLocaleString();
  levelEl.textContent = String(game.level);
  const left = game.phase === "running" ? Math.max(0, Math.ceil((RUN_MS - game.time) / 1000)) : game.phase === "over" ? 0 : RUN_MS / 1000;
  timeEl.textContent = `${left}s`;
  livesText.textContent = `${game.lives}/${START_LIVES}`;
  livesSquares.querySelectorAll("span").forEach((s, i) => s.classList.toggle("on", i < game.lives));
  const mult = game.streak >= 20 ? 4 : game.streak >= 10 ? 3 : game.streak >= 5 ? 2 : 1;
  comboValue.textContent = `×${mult}`;
  const [from, to] = mult === 1 ? [0, 5] : mult === 2 ? [5, 10] : mult === 3 ? [10, 20] : [20, 20];
  const filled = to === from ? 4 : Math.floor(((game.streak - from) / (to - from)) * 4);
  comboBar.querySelectorAll("span").forEach((s, i) => s.classList.toggle("on", i < filled));
}
function updateKeys() {
  const front = game.enemies[0];
  const due = front && game.phase === "running" ? front.keys[front.step] : null;
  const pool = levelSpec(game.level).keys;
  for (const n of KEYS) {
    const b = keyButtons.get(n)!;
    const hint = n === due ? (front!.rescued ? "full" : hintFor(game.mastery[n])) : "off";
    b.dataset.hint = game.phase === "running" ? hint : "off";
    b.classList.toggle("is-locked", game.phase === "running" && !pool.includes(n));
    const f = flash.get(n);
    b.classList.toggle("is-wrong", !!f && f.cls === "is-wrong" && f.until > now);
    b.classList.toggle("is-pressed", !!f && f.cls === "is-pressed" && f.until > now);
    if (game.phase !== "over") {
      b.dataset.rank = "";
      b.querySelector(".mt-key-note")!.textContent = "";
    }
  }
}

// --- Drawing ---------------------------------------------------------------------
function roundRect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function text(value: string, x: number, y: number, size: number, color: string, weight = 800) {
  ctx.font = `${weight} ${size}px ${palette.font}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}
// The player: a little caster with the side keypad on their chest.
function drawPlayer(x: number, y: number) {
  const p = palette;
  ctx.fillStyle = p.text;
  ctx.beginPath();
  ctx.arc(x, y - 30, 13, 0, Math.PI * 2);
  ctx.fill();
  roundRect(x - 22, y - 13, 44, 52, 12);
  ctx.fill();
  ctx.fillStyle = p.accent;
  ctx.fillRect(x - 22, y - 13, 44, 5);
  ctx.fillStyle = p.bg;
  for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) ctx.fillRect(x - 15 + c * 8, y + 2 + r * 8, 5, 5);
  // Staff, pointing at the lane.
  ctx.strokeStyle = p.muted;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 34);
  ctx.lineTo(x + 30, y - 34);
  ctx.stroke();
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(x + 30, y - 38, 6, 0, Math.PI * 2);
  ctx.fill();
}
function drawEnemy(e: Enemy, isTarget: boolean) {
  const p = palette;
  const g = geometry();
  const x = enemyX(e);
  const y = g.lane;
  const combo = e.keys.length > 1;
  if (combo) roundRect(x - 40, y - 34, 80, 68, 15);
  else {
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
  }
  ctx.fillStyle = combo ? p.combo : p.enemy;
  ctx.fill();
  ctx.lineWidth = isTarget ? 4 : 2;
  ctx.strokeStyle = isTarget ? p.text : p.muted;
  ctx.stroke();
  if (combo) {
    text(String(e.keys[0]), x - 18, y, 26, e.step > 0 ? p.muted : p.enemyText);
    text("›", x, y, 22, p.enemyText, 700);
    text(String(e.keys[1]), x + 18, y, 26, p.enemyText);
  } else {
    text(String(e.keys[0]), x, y + 1, e.keys[0] >= 10 ? 30 : 36, p.enemyText);
  }
  if (isTarget) {
    // "▶" marker: a small triangle above the target, pointing at it.
    ctx.fillStyle = p.text;
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 54);
    ctx.lineTo(x + 9, y - 54);
    ctx.lineTo(x, y - 42);
    ctx.fill();
    if (x - g.danger < 120) {
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = p.warning;
      ctx.beginPath();
      if (combo) ctx.roundRect(x - 46, y - 40, 92, 80, 18);
      else ctx.arc(x, y, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      text("!", x + (combo ? 52 : 44), y - 36, 22, p.warning);
    }
  }
}
function drawEffects() {
  const p = palette;
  const g = geometry();
  effects = effects.filter((f) => now - f.start < f.dur);
  for (const f of effects) {
    const t = (now - f.start) / f.dur;
    const still = reduceMotion.matches;
    ctx.globalAlpha = still ? 1 : 1 - t;
    if (f.kind === "cast") {
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 4;
      if (p.glow) {
        ctx.shadowColor = p.accent;
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.moveTo(g.player + 30, g.lane - 38);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (f.kind === "hit") {
      const rise = still ? 0 : 16 * t;
      ctx.strokeStyle = p.success;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(f.x - 10, f.y - 2 - rise);
      ctx.lineTo(f.x - 2, f.y + 6 - rise);
      ctx.lineTo(f.x + 12, f.y - 10 - rise);
      ctx.stroke();
      text(f.text ?? "", f.x, f.y - 40 - rise, 16, p.text, 700);
    } else if (f.kind === "wrong") {
      ctx.strokeStyle = p.danger;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(f.x - 12, f.y - 12);
      ctx.lineTo(f.x + 12, f.y + 12);
      ctx.moveTo(f.x + 12, f.y - 12);
      ctx.lineTo(f.x - 12, f.y + 12);
      ctx.stroke();
      text(f.text ?? "", f.x, f.y - 26, 14, p.danger, 700);
    } else if (f.kind === "arrive") {
      ctx.globalAlpha = still ? 0.2 : 0.2 * (1 - t);
      ctx.strokeStyle = p.danger;
      ctx.lineWidth = 2;
      for (let x = -H; x < W; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x + H, 0);
        ctx.stroke();
      }
      ctx.globalAlpha = still ? 1 : 1 - t;
      text(f.text ?? "", f.x + 50, f.y - 50, 22, p.danger);
    } else if (f.kind === "back") {
      text(f.text ?? "", f.x, f.y, 14, p.muted, 600);
    } else if (f.kind === "level") {
      ctx.globalAlpha = 1;
      roundRect(f.x - 180, f.y - 36, 360, 72, 16);
      ctx.fillStyle = p.bg;
      ctx.fill();
      ctx.strokeStyle = p.line;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = p.accent;
      ctx.fillRect(f.x - 180, f.y - 30, 3, 60);
      text(f.text ?? "", f.x, f.y - 8, 26, p.text);
      text("New buttons and faster enemies", f.x, f.y + 20, 13, p.muted, 500);
    }
    ctx.globalAlpha = 1;
  }
}
function draw() {
  const p = palette;
  const g = geometry();
  ctx.save();
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  if (shake.until > now) ctx.translate((Math.random() * 2 - 1) * shake.size, 0);
  // Ground and danger line.
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, g.lane + 44);
  ctx.lineTo(W, g.lane + 44);
  ctx.stroke();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = p.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(g.danger, 40);
  ctx.lineTo(g.danger, H - 40);
  ctx.stroke();
  ctx.setLineDash([]);
  drawPlayer(g.player, g.lane);
  for (let i = game.enemies.length - 1; i >= 0; i--) drawEnemy(game.enemies[i], i === 0);
  drawEffects();
  const countdown = game.phase === "countdown" ? game.countdownLeft : resumeLeft;
  if (countdown > 0 && !paused) text(String(Math.ceil(countdown / (COUNTDOWN_MS / 3))), W / 2, H / 2, 72, p.text);
  ctx.restore();
}

// --- Loop -----------------------------------------------------------------------------
let last = performance.now();
function frame(t: number) {
  now = t;
  const dt = Math.min(50, t - last);
  last = t;
  if (!paused && game.phase !== "over" && game.phase !== "ready") {
    if (resumeLeft > 0) resumeLeft -= dt;
    else tick(game, dt);
  }
  drainEvents();
  updateHud();
  updateKeys();
  draw();
  requestAnimationFrame(frame);
}
showOverlay("start");
requestAnimationFrame(frame);
