// M908 packet builders, implemented directly from
// docs/protocol-notes/m908.md and docs/protocol-notes/m908-tables.json —
// not ported from any existing tool's code. The default templates in the
// tables JSON are transcribed byte values (facts), not copied logic; all
// the overlay logic below is written from scratch.
//
// UNVERIFIED AGAINST REAL HARDWARE — see "Open questions" in m908.md.
// In particular: whether sendFeatureReport needs the leading 0x02 byte
// included in the payload or stripped (this module assumes it's stripped,
// mirroring M913's convention — see buildFeatureReportPayloads below).
import tables from "../../docs/protocol-notes/m908-tables.json";
import { parseM908Action, M908_BUTTON_NAMES, type M908ButtonName } from "./m908-buttons";

const DPI_CODES = tables.dpiCodes as unknown as Record<string, [number, number]>;
const LIGHT_MODE_VALUES = tables.lightModeValues as unknown as Record<string, [number, number]>;
const REPORT_RATE_VALUES = tables.reportRateValues as unknown as Record<string, number>;
const TEMPLATE_PROFILE = tables.defaultProfileTemplate as unknown as number[][];
const TEMPLATE_SETTINGS_1 = tables.defaultSettings1Template as unknown as number[][];
const TEMPLATE_SETTINGS_2 = tables.defaultSettings2Template as unknown as number[];
const TEMPLATE_SETTINGS_3 = tables.defaultSettings3Template as unknown as number[][];

export const M908_REPORT_ID = tables.reportId as number; // 2

export type M908LightMode = keyof typeof LIGHT_MODE_VALUES;

export const M908_KNOWN_DPI_VALUES: number[] = Object.keys(DPI_CODES)
  .map(Number)
  .sort((a, b) => a - b);

export function m908DpiSupported(dpi: number): boolean {
  return String(dpi) in DPI_CODES;
}

export interface M908ProfileSettings {
  lightMode: M908LightMode;
  color: [r: number, g: number, b: number];
  brightness: number; // 0-255 on the page; sent as m908BrightnessByte()
  speed: number; // device-defined scale, matches the "speed" template field
  scrollSpeed: number;
  reportRateHz: number; // 125 | 250 | 500 | 1000
  dpiEnabled: [boolean, boolean, boolean, boolean, boolean];
  dpiValues: [number, number, number, number, number]; // must be m908DpiSupported()
  /** Button name -> action string (see profiles/m908-buttons.ts). Buttons
   * not present here keep their current/factory mapping. */
  buttonActions: Partial<Record<M908ButtonName, string>>;
}

// The mouse stores brightness as a level, not 0-255: the reference
// template and a capture of the official software both write 2 for a
// mid setting, and upstream documents the range as 1-3.
export function m908BrightnessByte(brightness: number): number {
  return Math.min(3, Math.max(1, Math.ceil(brightness / 85)));
}

export function m908LightModeSupported(mode: string): mode is M908LightMode {
  return mode in LIGHT_MODE_VALUES;
}

export const M908_REPORT_RATES_HZ: number[] = Object.keys(REPORT_RATE_VALUES)
  .map(Number)
  .sort((a, b) => a - b);

export type M908ProfileIndex = 0 | 1 | 2 | 3 | 4;

export type M908FiveProfiles = [
  M908ProfileSettings, M908ProfileSettings, M908ProfileSettings, M908ProfileSettings, M908ProfileSettings,
];

/** settings3 row holding DPI stage `stage` (0-4) of onboard profile `profile` (0-4). */
export function m908DpiRowIndex(profile: number, stage: number): number {
  return 7 + 5 * stage + profile;
}

function cloneTemplate2D(template: number[][]): number[][] {
  return template.map((row) => [...row]);
}

function reportRateByte(hz: number): number {
  return REPORT_RATE_VALUES[String(hz)] ?? REPORT_RATE_VALUES["125"];
}

// Overlays 5 profiles' settings onto the three default templates at the
// documented byte offsets (see m908.md). All 5 profiles are always sent
// together — mouse_m908 never writes a subset, and some packets are
// shared between profiles (report rate for 1-3, scroll speed for all 5),
// so there's no known "write just one profile" sequence.
export function buildM908SettingsRows(profiles: M908FiveProfiles): { settings1: number[][]; settings2: number[]; settings3: number[][] } {
  const settings1 = cloneTemplate2D(TEMPLATE_SETTINGS_1);
  const settings2 = [...TEMPLATE_SETTINGS_2];
  const settings3 = cloneTemplate2D(TEMPLATE_SETTINGS_3);

  profiles.forEach((profile, i) => {
    // Light mode (2-byte code) + color + speed, packet `3 + 2*i`
    const lightBytes = LIGHT_MODE_VALUES[profile.lightMode] ?? LIGHT_MODE_VALUES.static;
    const modePacket = settings1[3 + 2 * i];
    modePacket[11] = lightBytes[0];
    modePacket[13] = lightBytes[1];
    modePacket[8] = profile.color[0];
    modePacket[9] = profile.color[1];
    modePacket[10] = profile.color[2];
    modePacket[12] = profile.speed;

    // Brightness, packet `4 + 2*i`
    settings1[4 + 2 * i][8] = m908BrightnessByte(profile.brightness);

    // Scroll speed, settings2 byte `8 + 2*i`
    settings2[8 + 2 * i] = profile.scrollSpeed;

    // DPI, settings3 packets `7 + 5*j + i` for stage j (0-4) — grouped by
    // stage, not by profile. Upstream writes `buffer3[7+5*i+j]` from
    // `_s_dpi_enabled[j][i]`, and that array is indexed [profile][level],
    // so its `i` is the stage and `j` the profile. The template's own
    // address bytes (2-3) agree: rows 7-11 are stage 1 of profiles 1-5
    // (0x0044, 0x0104, 0x01b4, …), each stage 6 bytes after the last.
    for (let j = 0; j < 5; j++) {
      const code = DPI_CODES[String(profile.dpiValues[j])];
      const row = settings3[m908DpiRowIndex(i, j)];
      row[8] = profile.dpiEnabled[j] ? 1 : 0;
      if (code) {
        row[9] = code[0];
        row[10] = code[1];
        // The official software writes five bytes here, repeating the
        // code (X then Y). Only seen in a capture for values up to 6200,
        // where the second byte is 0, so higher values keep the four-byte
        // upstream form until a capture shows what follows them.
        if (code[1] === 0) {
          row[4] = 5;
          row[11] = code[0];
          row[12] = 0;
        }
      }
    }

    // Button mapping, settings3 packets `35 + 20*i + j` for button slot j
    // (0-19), 4 mapping bytes at offsets 8-11. Unrecognized/unspecified
    // buttons keep whatever the template row already had — never guessed.
    for (const [buttonName, actionStr] of Object.entries(profile.buttonActions)) {
      if (!actionStr) continue;
      const slot = M908_BUTTON_NAMES.indexOf(buttonName as M908ButtonName);
      if (slot < 0) continue;
      const bytes = parseM908Action(actionStr);
      if (!bytes) continue;
      const row = settings3[35 + 20 * i + slot];
      row[8] = bytes[0];
      row[9] = bytes[1];
      row[10] = bytes[2];
      row[11] = bytes[3];
    }
  });

  // Report rate: profiles 0-2 on packet 13, profiles 3-4 on packet 14 —
  // formula transcribed directly from source, not a hand-copied offset
  // table (an earlier draft of m908.md had this wrong for profiles 3-4).
  for (let i = 0; i < 3; i++) {
    settings1[13][8 + 2 * i] = reportRateByte(profiles[i].reportRateHz);
  }
  for (let i = 3; i < 5; i++) {
    settings1[14][2 + 2 * i] = reportRateByte(profiles[i].reportRateHz);
  }

  return { settings1, settings2, settings3 };
}

// Builds the profile-select rows (6 x 16 bytes) for switching the active
// onboard profile. Only row 0 byte 8 changes from the template default.
export function buildM908ProfileSelectRows(profileIndex: M908ProfileIndex): number[][] {
  const rows = cloneTemplate2D(TEMPLATE_PROFILE);
  rows[0][8] = profileIndex;
  return rows;
}

export interface M908WriteStep {
  label: string;
  rows: number[][];
}

// The full Apply sequence, in send order. Every Apply rewrites all five
// onboard profiles: the settings blocks are fixed-layout memory writes
// that carry every profile's fields (report rate for profiles 1-3 shares
// one packet, scroll speed for all five shares the 64-byte packet), and
// neither mouse_m908 nor any captured official-software traffic ever
// writes a subset — see m908.md "Onboard profiles".
//
// Profile select goes LAST, matching mouse_m908's CLI (`-c` then `-p`):
// settings block 3 contains its own write to the active-profile address
// (row 33, address 0x002c, value 0), so selecting first would be undone.
export function buildM908ApplySequence(profiles: M908FiveProfiles, activeProfile: M908ProfileIndex): M908WriteStep[] {
  const { settings1, settings2, settings3 } = buildM908SettingsRows(profiles);
  return [
    { label: "Settings block 1 (LED, report rate)", rows: settings1 },
    { label: "Settings block 2 (scroll speed)", rows: [settings2] },
    { label: "Settings block 3 (DPI, buttons)", rows: settings3 },
    { label: `Active profile (${activeProfile + 1})`, rows: buildM908ProfileSelectRows(activeProfile) },
  ];
}

// Converts a raw 16-byte row (or the 64-byte settings2 row) — whose byte 0
// is always 0x02, matching M908_REPORT_ID — into the (reportId, payload)
// shape WebHID's sendFeatureReport expects, mirroring hid-transport.ts's
// M913 convention of treating byte 0 as the report ID marker rather than
// part of the payload. UNVERIFIED: see file header.
export function toFeatureReportPayload(row: number[]): { reportId: number; payload: Uint8Array } {
  return { reportId: row[0], payload: Uint8Array.from(row.slice(1)) };
}
