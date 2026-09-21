// DPI checker page. The user moves the mouse a known physical distance
// while the pointer is locked to the pad; we sum movementX and divide by
// the distance in inches. Math lives in tools/dpi.ts.
//
// Flow, as a small state machine:
//   idle ──Start──▶ locking ──lock granted──▶ armed ──click/Space──▶
//   counting ──click/Space──▶ idle (run recorded)
// Esc (the browser releases the lock) from armed/counting cancels.
// "armed" exists so the user can place the mouse on the first mark,
// lifting it if needed, without any of that movement being counted.
//
// Raw input: Chromium on Windows/macOS honors
// requestPointerLock({ unadjustedMovement: true }), which bypasses OS
// pointer acceleration. Other browsers ignore the option, so we only
// report "raw" when the request with the option succeeded in Chromium.
// See https://web.dev/disable-mouse-acceleration/ and MDN's
// Element.requestPointerLock.
import "./site-nav";
import {
  DEFAULT_DISTANCE,
  MAX_DRIFT_RATIO,
  MIN_COUNTS,
  computeDpi,
  convertDistance,
  deviationLevel,
  deviationPercent,
  driftRatio,
  round,
  scaleCorrection,
  summarizeRuns,
  toInches,
  validateDistance,
  validateExpectedDpi,
  type DistanceUnit,
} from "./tools/dpi";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const pad = $<HTMLDivElement>("pad");
const padTitle = $("pad-title");
const padSub = $("pad-sub");
const padLive = $("pad-live");
const startBtn = $<HTMLButtonElement>("start-btn");
const lockError = $("lock-error");
const unitIn = $<HTMLButtonElement>("unit-in");
const unitCm = $<HTMLButtonElement>("unit-cm");
const distanceUnitLabel = $("distance-unit");
const distanceInput = $<HTMLInputElement>("distance");
const distanceError = $("distance-error");
const expectedInput = $<HTMLInputElement>("expected");
const expectedError = $("expected-error");
const resultEl = $("result");
const resultDpi = $("result-dpi");
const resultDev = $("result-dev");
const resultNotes = $("result-notes");
const announceEl = $("announce");
const runsSection = $("runs-section");
const runsBody = $("runs-body");
const summaryEl = $("summary");
const clearBtn = $<HTMLButtonElement>("clear-btn");

type State = "idle" | "locking" | "armed" | "counting";

interface Run {
  countsX: number;
  countsY: number;
  distance: number;
  unit: DistanceUnit;
  dpi: number;
  raw: boolean;
}

let state: State = "idle";
let unit: DistanceUnit = "cm";
let rawActive = false;
let sumX = 0;
let sumY = 0;
let current: { distance: number; unit: DistanceUnit } | null = null;
let liveFrame = 0;
const runs: Run[] = [];

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtNum = (n: number) => String(round(n, 2));

function announce(text: string) {
  announceEl.textContent = text;
}

// ---------------------------------------------------------------------
// Support check
// ---------------------------------------------------------------------

const hasPointerLock = "requestPointerLock" in Element.prototype && "exitPointerLock" in Document.prototype;
const hasFinePointer = window.matchMedia("(any-pointer: fine)").matches;

if (!hasPointerLock || !hasFinePointer) {
  $("unsupported").hidden = false;
  if (!hasPointerLock) {
    startBtn.disabled = true;
    padTitle.textContent = "This browser doesn't support pointer lock, which the test needs.";
    padSub.textContent = "Try Chrome, Edge, Firefox or Safari on a computer.";
  }
}

/**
 * Chromium is the only engine that honors unadjustedMovement.
 * navigator.userAgentData only exists in Chromium, so its absence means
 * "can't confirm", and we report the input as OS-processed.
 */
function isChromium(): boolean {
  const uaData = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData;
  return !!uaData?.brands?.some((b) => b.brand === "Chromium");
}

// ---------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------

function readDistance(showError: boolean): number | null {
  const r = validateDistance(distanceInput.value, unit);
  const show = !r.ok && (showError || distanceInput.value.trim() !== "");
  distanceError.textContent = show && !r.ok ? r.error : "";
  if (show) distanceInput.setAttribute("aria-invalid", "true");
  else distanceInput.removeAttribute("aria-invalid");
  return r.ok ? r.value : null;
}

function readExpected(): number | null {
  const r = validateExpectedDpi(expectedInput.value);
  expectedError.textContent = r.ok ? "" : r.error;
  if (r.ok) expectedInput.removeAttribute("aria-invalid");
  else expectedInput.setAttribute("aria-invalid", "true");
  return r.ok ? r.value : null;
}

function setUnit(next: DistanceUnit) {
  if (next === unit || state !== "idle") return;
  const prev = unit;
  const r = validateDistance(distanceInput.value, prev);
  unit = next;
  if (r.ok) {
    distanceInput.value =
      r.value === DEFAULT_DISTANCE[prev] ? String(DEFAULT_DISTANCE[next]) : fmtNum(convertDistance(r.value, prev, next));
  }
  for (const [btn, u] of [[unitIn, "in"], [unitCm, "cm"]] as const) {
    btn.setAttribute("aria-pressed", String(u === unit));
    btn.classList.toggle("active", u === unit);
  }
  distanceUnitLabel.textContent = unit;
  readDistance(false);
  renderIdlePad();
}

unitIn.addEventListener("click", () => setUnit("in"));
unitCm.addEventListener("click", () => setUnit("cm"));
distanceInput.addEventListener("input", () => {
  readDistance(false);
  renderIdlePad();
});
distanceInput.addEventListener("blur", () => readDistance(true));
expectedInput.addEventListener("input", () => {
  readExpected();
  if (runs.length) {
    renderLatest();
    renderRuns();
  }
});

// ---------------------------------------------------------------------
// Pad rendering
// ---------------------------------------------------------------------

function setPad(next: State, title: string, sub: string) {
  state = next;
  pad.dataset.state = next;
  padTitle.textContent = title;
  padSub.textContent = sub;
  padLive.hidden = next !== "counting";
  startBtn.hidden = next === "armed" || next === "counting";
  startBtn.disabled = !hasPointerLock || next === "locking";
}

function renderIdlePad() {
  if (state !== "idle" || !hasPointerLock) return;
  const d = validateDistance(distanceInput.value, unit);
  const what = d.ok ? `${fmtNum(d.value)} ${unit}` : "a known distance";
  setPad(
    "idle",
    `Mark two points ${what} apart on your mousepad, then press Start.`,
    "The cursor hides while measuring. Esc cancels at any time.",
  );
  startBtn.textContent = runs.length ? "Measure again" : "Start measuring";
}

function renderLive() {
  liveFrame = 0;
  padLive.textContent = `${fmtInt(Math.abs(sumX))} counts`;
}

// ---------------------------------------------------------------------
// Pointer lock
// ---------------------------------------------------------------------

function waitForLockChange(): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      document.removeEventListener("pointerlockchange", onChange);
      document.removeEventListener("pointerlockerror", onError);
      window.clearTimeout(timer);
    };
    const onChange = () => {
      if (document.pointerLockElement === pad) {
        done();
        resolve();
      }
    };
    const onError = () => {
      done();
      reject(new Error("pointerlockerror"));
    };
    const timer = window.setTimeout(onError, 3000);
    document.addEventListener("pointerlockchange", onChange);
    document.addEventListener("pointerlockerror", onError);
  });
}

/** Resolves true when raw (unaccelerated) input is confirmed. */
async function acquireLock(): Promise<boolean> {
  // Older engines (Safari, older Firefox) return undefined instead of a
  // Promise, and report success or failure only through events.
  const request = (options?: PointerLockOptions): Promise<void> => {
    const waiter = waitForLockChange();
    const p = pad.requestPointerLock(options) as Promise<void> | undefined;
    if (p && typeof p.then === "function") {
      waiter.catch(() => {}); // the promise below is authoritative
      return p;
    }
    return waiter;
  };

  try {
    await request({ unadjustedMovement: true });
    return isChromium();
  } catch (e) {
    // Chromium on Linux (and some other platforms) can't provide raw
    // input and rejects with NotSupportedError; fall back to a plain lock.
    if (e instanceof DOMException && e.name === "NotSupportedError") {
      await request();
      return false;
    }
    throw e;
  }
}

async function start() {
  if (state !== "idle") return;
  lockError.hidden = true;
  const distance = readDistance(true);
  if (distance === null) {
    distanceInput.focus();
    return;
  }
  if (readExpected() === null && expectedInput.value.trim() !== "") {
    expectedInput.focus();
    return;
  }
  current = { distance, unit };
  setPad("locking", "Requesting pointer lock…", "");
  try {
    rawActive = await acquireLock();
  } catch {
    current = null;
    renderIdlePad();
    lockError.textContent =
      "The browser didn't lock the pointer. If you just pressed Esc, wait a second and try again; otherwise check that the page is focused and not in a frame.";
    lockError.hidden = false;
    return;
  }
  // Focus the pad so a Space keyup can't land on (and re-activate) the Start button.
  pad.focus({ preventScroll: true });
  sumX = sumY = 0;
  setPad(
    "armed",
    "Line up the mouse with the first mark, then click or press Space to start counting.",
    "Lift and reposition freely: nothing is counted yet. Esc cancels.",
  );
  announce("Pointer locked. Line up the mouse with the first mark, then click or press Space to start counting.");
}

function beginCounting() {
  sumX = sumY = 0;
  const c = current!;
  setPad(
    "counting",
    `Slide right to the second mark (${fmtNum(c.distance)} ${c.unit}), then click or press Space to stop.`,
    "Keep the mouse flat and the path straight.",
  );
  renderLive();
  announce("Counting. Move to the second mark, then click or press Space.");
}

function finish(viaKeyboard: boolean) {
  const c = current!;
  const x = sumX;
  const y = sumY;
  current = null;
  state = "idle"; // before exiting, so the lock-change handler doesn't treat it as a cancel
  if (document.pointerLockElement) document.exitPointerLock();
  renderIdlePad();

  // Return focus to Start for the next run. After a key press, wait for
  // keyup so a Space release can't click the button we just focused.
  const refocus = () => startBtn.focus({ preventScroll: true });
  if (viaKeyboard) document.addEventListener("keyup", refocus, { once: true });
  else refocus();

  if (Math.abs(x) < MIN_COUNTS) {
    lockError.textContent = `Only ${fmtInt(Math.abs(x))} counts were recorded, too few to measure. Start again and slide the mouse all the way to the second mark before stopping.`;
    lockError.hidden = false;
    return;
  }
  const dpi = computeDpi(x, toInches(c.distance, c.unit));
  runs.push({ countsX: x, countsY: y, distance: c.distance, unit: c.unit, dpi, raw: rawActive });
  renderLatest();
  renderRuns();
  const expected = readExpected();
  announce(
    `Run ${runs.length}: ${fmtInt(dpi)} DPI` +
      (expected ? `, ${describeDeviation(deviationPercent(dpi, expected))}.` : ".") +
      (runs.length > 1 ? ` Average ${fmtInt(summarizeRuns(runs.map((r) => r.dpi))!.mean)} DPI.` : ""),
  );
}

function cancel(message: string) {
  current = null;
  renderIdlePad();
  lockError.textContent = message;
  lockError.hidden = false;
  startBtn.focus({ preventScroll: true });
}

startBtn.addEventListener("click", () => void start());

pad.addEventListener("mousedown", (e) => {
  if (document.pointerLockElement !== pad) return;
  e.preventDefault();
  if (state === "armed") beginCounting();
  else if (state === "counting") finish(false);
});

document.addEventListener("keydown", (e) => {
  if (state !== "armed" && state !== "counting") return;
  if (e.key !== " " && e.key !== "Enter") return;
  e.preventDefault();
  if (e.repeat) return;
  if (state === "armed") beginCounting();
  else finish(true);
});

document.addEventListener("mousemove", (e) => {
  if (state !== "counting" || document.pointerLockElement !== pad) return;
  sumX += e.movementX;
  sumY += e.movementY;
  if (!liveFrame) liveFrame = requestAnimationFrame(renderLive);
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === pad) return;
  if (state === "armed" || state === "counting") {
    cancel("Measurement cancelled: the pointer was released (Esc, or the window lost focus). Nothing was recorded.");
    announce("Measurement cancelled.");
  }
});

// ---------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------

function describeDeviation(pct: number): string {
  const a = Math.abs(pct);
  if (a < 0.05) return "matches your setting";
  return `${round(a, 1)}% ${pct < 0 ? "below" : "above"} your setting`;
}

function deviationSpan(pct: number): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = `dev-${deviationLevel(pct)}`;
  span.textContent = `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${round(Math.abs(pct), 1)}%`;
  return span;
}

function note(text: string, warn = false) {
  const li = document.createElement("li");
  li.textContent = text;
  if (warn) li.className = "warn";
  resultNotes.append(li);
}

function renderLatest() {
  const run = runs[runs.length - 1];
  if (!run) {
    resultEl.hidden = true;
    return;
  }
  resultEl.hidden = false;
  resultDpi.textContent = fmtInt(run.dpi);
  resultNotes.replaceChildren();

  const expected = readExpected();
  resultDev.replaceChildren();
  if (expected) {
    const pct = deviationPercent(run.dpi, expected);
    const span = deviationSpan(pct);
    span.textContent = `${describeDeviation(pct)} (${fmtInt(expected)})`;
    resultDev.append(span);
  }

  note(
    `${fmtInt(Math.abs(run.countsX))} counts over ${fmtNum(run.distance)} ${run.unit} (${fmtNum(toInches(run.distance, run.unit))} in).`,
  );
  if (run.raw) note("Raw input was active, so OS pointer acceleration and pointer speed didn't affect this run.");
  else
    note(
      "This browser can't confirm raw input, so OS pointer acceleration and pointer speed may affect the reading. Turn acceleration off (see below), or use Chrome or Edge on Windows or macOS.",
      true,
    );

  const drift = driftRatio(run.countsX, run.countsY);
  if (drift > MAX_DRIFT_RATIO)
    note(
      `The path drifted vertically by ${Math.round(drift * 100)}% of its length. A slanted path under-reads; try to slide straight across.`,
      true,
    );

  if (expected) {
    const fix = scaleCorrection(run.dpi, expected, window.devicePixelRatio);
    if (fix)
      note(
        `This is off from your setting by almost exactly your display scale (${round(window.devicePixelRatio, 2)}×), which usually means the browser reported scaled pixels rather than counts. Adjusted for that, it's about ${fmtInt(fix.corrected)} DPI. Resetting page zoom to 100% can help.`,
        true,
      );
  }
}

function renderRuns() {
  runsSection.hidden = runs.length === 0;
  runsBody.replaceChildren();
  const expected = readExpected();
  runs.forEach((run, i) => {
    const tr = document.createElement("tr");
    const cells: (string | Node)[] = [
      String(i + 1),
      `${fmtNum(run.distance)} ${run.unit}`,
      fmtInt(Math.abs(run.countsX)),
      fmtInt(run.dpi),
      expected ? deviationSpan(deviationPercent(run.dpi, expected)) : "—",
      run.raw ? "Raw" : "OS-processed",
    ];
    cells.forEach((c, col) => {
      const td = document.createElement("td");
      if (col >= 1 && col <= 4) td.className = "num";
      td.append(c);
      tr.append(td);
    });
    runsBody.append(tr);
  });

  const s = summarizeRuns(runs.map((r) => r.dpi));
  summaryEl.replaceChildren();
  if (!s) return;
  const strong = document.createElement("strong");
  strong.textContent = `${fmtInt(s.mean)} DPI`;
  summaryEl.append(
    s.count === 1 ? "One run so far: " : `Average of ${s.count} runs: `,
    strong,
  );
  if (s.count > 1) summaryEl.append(` (range ${fmtInt(s.min)}–${fmtInt(s.max)}, spread ${round(s.spreadPercent, 1)}%)`);
  if (expected) {
    const pct = deviationPercent(s.mean, expected);
    const span = deviationSpan(pct);
    span.textContent = describeDeviation(pct);
    summaryEl.append(", ", span);
  }
  summaryEl.append(".");
  if (s.count === 1) summaryEl.append(" Do a few more runs for a reliable average.");
  else if (s.spreadPercent > 5)
    summaryEl.append(" The runs disagree by more than 5%: check your marks and keep the path straight.");
}

clearBtn.addEventListener("click", () => {
  runs.length = 0;
  renderLatest();
  renderRuns();
  renderIdlePad();
  lockError.hidden = true;
  announce("Runs cleared.");
  startBtn.focus();
});

pad.tabIndex = -1;
renderIdlePad();
