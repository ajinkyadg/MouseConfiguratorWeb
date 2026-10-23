// Reading the five onboard profiles back from an M908. The request format
// (`<report id> f2 <addr lo> <addr hi> <length>`) and the reply layout (the
// same row shape as a write, data from byte 8) come from disassembling
// Redragon's own software — see docs/protocol-notes/m908.md. Every address
// is taken from the rows buildM908SettingsRows writes, so reads and writes
// can't drift apart. Pure functions only.
import {
  buildM908SettingsRows,
  m908BrightnessFromByte,
  m908DpiFromCode,
  m908DpiRowIndex,
  m908LightModeFromBytes,
  m908ReportRateFromByte,
  m908StartStage,
  type M908FiveProfiles,
  type M908ProfileIndex,
  type M908ProfileSettings,
} from "./m908";
import { describeM908Action, M908_BUTTON_NAMES, type M908ButtonName } from "./m908-buttons";
import { defaultM908ProfileSet, type M908ProfileSet } from "./m908-profile-store";

export const M908_READ = 0xf2;
const ACTIVE_PROFILE_ADDRESS = 0x002c;

export interface M908ReadRequest {
  /** Full row, byte 0 = report ID, sized for that report (16 or 64). */
  row: number[];
  address: number;
  length: number;
}

const address = (row: number[]) => row[2] | (row[3] << 8);

function request(reportId: 2 | 3, at: number, length: number): M908ReadRequest {
  const row = new Array<number>(reportId === 3 ? 64 : 16).fill(0);
  row[0] = reportId;
  row[1] = M908_READ;
  row[2] = at & 0xff;
  row[3] = at >> 8;
  row[4] = length;
  return { row, address: at, length };
}

// The addresses each setting lives at, from the write rows themselves.
function layout() {
  const set = defaultM908ProfileSet();
  const { settings1, settings3 } = buildM908SettingsRows(set.profiles);
  return {
    led: [0, 1, 2, 3, 4].map((i) => address(settings1[3 + 2 * i])),
    brightness: [0, 1, 2, 3, 4].map((i) => address(settings1[4 + 2 * i])),
    rate123: address(settings1[13]),
    rate45: address(settings1[14]),
    startStage: [0, 1, 2, 3, 4].map((i) => address(settings3[i])),
    dpiStage: [0, 1, 2, 3, 4].map((i) => [0, 1, 2, 3, 4].map((j) => address(settings3[m908DpiRowIndex(i, j)]))),
    button: [0, 1, 2, 3, 4].map((i) => M908_BUTTON_NAMES.map((_, j) => address(settings3[35 + 20 * i + j]))),
    // What an unset button writes, so a read can leave those unset too.
    defaultButton: [0, 1, 2, 3, 4].map((i) => M908_BUTTON_NAMES.map((_, j) => settings3[35 + 20 * i + j].slice(8, 12))),
  };
}

export function buildM908ReadPlan(): M908ReadRequest[] {
  const at = layout();
  const plan: M908ReadRequest[] = [request(2, ACTIVE_PROFILE_ADDRESS, 1), request(2, at.rate123, 6), request(2, at.rate45, 4)];
  for (let i = 0; i < 5; i++) {
    plan.push(request(2, at.led[i], at.brightness[i] - at.led[i] + 1));
    // One 32-byte read on report 3 covers the starting stage and all five
    // DPI stages, as the official software does.
    plan.push(request(3, at.startStage[i], 0x20));
    for (const buttonAddress of at.button[i]) plan.push(request(2, buttonAddress, 4));
  }
  return plan;
}

/** Puts a reply into the row shape (byte 0 = report ID). Chrome returns
 * the report ID as the first byte on some platforms and not others. */
export function normalizeM908Reply(req: M908ReadRequest, reply: Uint8Array): Uint8Array {
  if (reply.length === req.row.length) return reply;
  if (reply.length === req.row.length - 1) return Uint8Array.of(req.row[0], ...reply);
  throw new Error(`Reply is ${reply.length} bytes, expected ${req.row.length}`);
}

export type M908Memory = Map<number, number>;

/** Stores a reply's data bytes under the addresses they were read from. */
export function storeM908Reply(memory: M908Memory, req: M908ReadRequest, reply: Uint8Array): void {
  const row = normalizeM908Reply(req, reply);
  for (let k = 0; k < req.length; k++) memory.set(req.address + k, row[8 + k]);
}

export interface M908ReadResult {
  set: M908ProfileSet;
  /** What couldn't be decoded and kept its current value. */
  warnings: string[];
}

/** Rebuilds the five profiles from read memory. Scroll speed isn't
 * readable on the M908, so it — and anything else that can't be decoded —
 * keeps its value from `current`. */
export function decodeM908Memory(memory: M908Memory, current: M908ProfileSet): M908ReadResult {
  const at = layout();
  const warnings: string[] = [];
  const byte = (a: number) => memory.get(a);
  const profiles = current.profiles.map((p) => structuredClone(p)) as M908FiveProfiles;

  profiles.forEach((profile: M908ProfileSettings, i) => {
    const n = i + 1;
    const led = at.led[i];
    const [r, g, b, modeA, speed, modeB] = [0, 1, 2, 3, 4, 5].map((k) => byte(led + k));
    if ([r, g, b].every((c) => c !== undefined)) profile.color = [r!, g!, b!];
    const mode = modeA !== undefined && modeB !== undefined ? m908LightModeFromBytes(modeA, modeB) : undefined;
    if (mode) profile.lightMode = mode;
    else warnings.push(`profile ${n} lighting mode`);
    if (speed !== undefined) profile.speed = Math.min(5, Math.max(1, speed));
    const level = byte(at.brightness[i]);
    if (level !== undefined) profile.brightness = m908BrightnessFromByte(level);

    for (let j = 0; j < 5; j++) {
      const stage = at.dpiStage[i][j];
      const enabled = byte(stage);
      const dpi = m908DpiFromCode(byte(stage + 1) ?? -1, byte(stage + 2) ?? -1);
      if (enabled !== undefined) profile.dpiEnabled[j] = enabled === 1;
      if (dpi !== undefined) profile.dpiValues[j] = dpi;
      else warnings.push(`profile ${n} DPI stage ${j + 1}`);
    }
    if (!profile.dpiEnabled.some(Boolean)) profile.dpiEnabled[0] = true;
    const start = byte(at.startStage[i]);
    delete profile.dpiStartStage;
    if (start !== undefined && start < 5 && start !== m908StartStage(profile)) profile.dpiStartStage = start;

    const buttonActions: Partial<Record<M908ButtonName, string>> = {};
    M908_BUTTON_NAMES.forEach((name, j) => {
      const a = at.button[i][j];
      const bytes = [0, 1, 2, 3].map((k) => byte(a + k));
      if (bytes.some((x) => x === undefined)) return;
      if (bytes.every((x, k) => x === at.defaultButton[i][j][k])) return; // factory mapping: leave unset
      buttonActions[name] = describeM908Action(bytes as number[]);
    });
    profile.buttonActions = buttonActions;
  });

  const rates = [byte(at.rate123), byte(at.rate123 + 2), byte(at.rate123 + 4), byte(at.rate45), byte(at.rate45 + 2)];
  rates.forEach((value, i) => {
    const hz = value === undefined ? undefined : m908ReportRateFromByte(value);
    if (hz) profiles[i].reportRateHz = hz;
    else warnings.push(`profile ${i + 1} polling rate`);
  });

  const active = byte(ACTIVE_PROFILE_ADDRESS);
  const activeProfile = (active !== undefined && active < 5 ? active : current.activeProfile) as M908ProfileIndex;
  return { set: { profiles, activeProfile }, warnings };
}
