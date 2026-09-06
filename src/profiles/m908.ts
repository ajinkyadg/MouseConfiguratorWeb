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
  brightness: number; // 0-255
  speed: number; // device-defined scale, matches the "speed" template field
  scrollSpeed: number;
  reportRateHz: number; // 125 | 250 | 500 | 1000
  dpiEnabled: [boolean, boolean, boolean, boolean, boolean];
  dpiValues: [number, number, number, number, number]; // must be m908DpiSupported()
  /** Button name -> action string (see profiles/m908-buttons.ts). Buttons
   * not present here keep their current/factory mapping. */
  buttonActions: Partial<Record<M908ButtonName, string>>;
}

function cloneTemplate2D(template: number[][]): number[][] {
  return template.map((row) => [...row]);
}

function reportRateByte(hz: number): number {
  return REPORT_RATE_VALUES[String(hz)] ?? REPORT_RATE_VALUES["125"];
}

// Overlays 5 profiles' settings onto the three default templates at the
// documented byte offsets (see m908.md). All 5 profiles are always sent
// together — this is how the real device's onboard multi-profile storage
// works, there's no "write just one profile's settings" packet.
export function buildM908SettingsRows(profiles: [
  M908ProfileSettings, M908ProfileSettings, M908ProfileSettings, M908ProfileSettings, M908ProfileSettings,
]): { settings1: number[][]; settings2: number[]; settings3: number[][] } {
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
    settings1[4 + 2 * i][8] = profile.brightness;

    // Scroll speed, settings2 byte `8 + 2*i`
    settings2[8 + 2 * i] = profile.scrollSpeed;

    // DPI, settings3 packets `7 + 5*i + j` for stage j (0-4)
    for (let j = 0; j < 5; j++) {
      const code = DPI_CODES[String(profile.dpiValues[j])];
      const row = settings3[7 + 5 * i + j];
      row[8] = profile.dpiEnabled[j] ? 1 : 0;
      if (code) {
        row[9] = code[0];
        row[10] = code[1];
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
export function buildM908ProfileSelectRows(profileIndex: 0 | 1 | 2 | 3 | 4): number[][] {
  const rows = cloneTemplate2D(TEMPLATE_PROFILE);
  rows[0][8] = profileIndex;
  return rows;
}

// Converts a raw 16-byte row (or the 64-byte settings2 row) — whose byte 0
// is always 0x02, matching M908_REPORT_ID — into the (reportId, payload)
// shape WebHID's sendFeatureReport expects, mirroring hid-transport.ts's
// M913 convention of treating byte 0 as the report ID marker rather than
// part of the payload. UNVERIFIED: see file header.
export function toFeatureReportPayload(row: number[]): { reportId: number; payload: Uint8Array } {
  return { reportId: row[0], payload: Uint8Array.from(row.slice(1)) };
}
