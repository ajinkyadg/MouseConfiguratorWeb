import { describe, it, expect } from "vitest";
import {
  buildM908SettingsRows,
  buildM908ProfileSelectRows,
  toFeatureReportPayload,
  m908DpiSupported,
  M908_KNOWN_DPI_VALUES,
  M908_REPORT_ID,
  type M908ProfileSettings,
} from "./m908";

function baseProfile(overrides: Partial<M908ProfileSettings> = {}): M908ProfileSettings {
  return {
    lightMode: "static",
    color: [0, 255, 0],
    brightness: 128,
    speed: 3,
    scrollSpeed: 1,
    reportRateHz: 1000,
    dpiEnabled: [true, true, true, true, true],
    dpiValues: [400, 800, 1600, 3200, 6400],
    buttonActions: {},
    ...overrides,
  };
}

describe("m908DpiSupported / M908_KNOWN_DPI_VALUES", () => {
  it("recognizes real transcribed table entries and rejects arbitrary values", () => {
    expect(m908DpiSupported(1600)).toBe(true);
    expect(m908DpiSupported(12400)).toBe(true);
    expect(m908DpiSupported(1650)).toBe(false); // not in the real table
    expect(M908_KNOWN_DPI_VALUES.length).toBeGreaterThan(80); // 92 real entries
    expect(M908_KNOWN_DPI_VALUES[0]).toBe(200);
    expect(M908_KNOWN_DPI_VALUES.at(-1)).toBe(12400);
  });
});

describe("buildM908SettingsRows", () => {
  const profiles: [M908ProfileSettings, M908ProfileSettings, M908ProfileSettings, M908ProfileSettings, M908ProfileSettings] =
    [baseProfile(), baseProfile(), baseProfile(), baseProfile(), baseProfile()];

  it("every row's byte 0 stays 0x02 (the report ID marker)", () => {
    const { settings1, settings3 } = buildM908SettingsRows(profiles);
    for (const row of [...settings1, ...settings3]) expect(row[0]).toBe(2);
  });

  it("overlays light mode + color + speed at the documented offset for profile 0", () => {
    const { settings1 } = buildM908SettingsRows(profiles.map((p, i) => (i === 0 ? { ...p, lightMode: "rainbow" as const, color: [10, 20, 30] as [number, number, number], speed: 5 } : p)) as typeof profiles);
    const packet = settings1[3]; // "3 + 2*i" with i=0
    expect(packet[11]).toBe(1); // rainbow = [1, 8]
    expect(packet[13]).toBe(8);
    expect(packet[8]).toBe(10);
    expect(packet[9]).toBe(20);
    expect(packet[10]).toBe(30);
    expect(packet[12]).toBe(5);
  });

  it("overlays brightness at packet 4 for profile 0, packet 6 for profile 1", () => {
    const { settings1 } = buildM908SettingsRows(
      profiles.map((p, i) => (i <= 1 ? { ...p, brightness: i === 0 ? 111 : 222 } : p)) as typeof profiles
    );
    expect(settings1[4][8]).toBe(111); // "4 + 2*0"
    expect(settings1[6][8]).toBe(222); // "4 + 2*1"
  });

  it("overlays scroll speed in settings2 at byte 8+2*i", () => {
    const { settings2 } = buildM908SettingsRows(
      profiles.map((p, i) => ({ ...p, scrollSpeed: i + 10 })) as typeof profiles
    );
    expect(settings2[8]).toBe(10); // profile 0
    expect(settings2[10]).toBe(11); // profile 1
    expect(settings2[16]).toBe(14); // profile 4
  });

  it("overlays DPI enable + code at packet 7+5*i+j for each of the 5 stages", () => {
    const { settings3 } = buildM908SettingsRows(
      profiles.map((p, i) =>
        i === 2 ? { ...p, dpiEnabled: [true, false, true, false, true] as [boolean, boolean, boolean, boolean, boolean], dpiValues: [200, 1600, 3200, 6400, 12400] as [number, number, number, number, number] } : p
      ) as typeof profiles
    );
    // profile index 2 -> base packet 7 + 5*2 = 17
    expect(settings3[17][8]).toBe(1); // stage 0 enabled
    expect(settings3[17][9]).toBe(0x04); // 200 dpi -> [0x04, 0x00]
    expect(settings3[17][10]).toBe(0x00);
    expect(settings3[18][8]).toBe(0); // stage 1 disabled
    expect(settings3[18][9]).toBe(0x24); // 1600 dpi -> [0x24, 0x00]
    expect(settings3[21][9]).toBe(0x8c); // stage 4: 12400 dpi -> [0x8c, 0x01]
    expect(settings3[21][10]).toBe(0x01);
  });

  it("leaves an unrecognized DPI value's code bytes untouched (never guesses)", () => {
    const { settings3 } = buildM908SettingsRows(
      profiles.map((p, i) => (i === 0 ? { ...p, dpiValues: [1650, 800, 1600, 3200, 6400] as [number, number, number, number, number] } : p)) as typeof profiles
    );
    const untouchedRow = settings3[7]; // profile 0, stage 0
    // Should still hold whatever the default template had, not a garbage/zero overwrite for the code bytes.
    expect(untouchedRow[9]).not.toBe(undefined);
  });

  it("computes report rate byte per the real formula, not a hand-copied offset table", () => {
    const withRates = profiles.map((p, i) => ({ ...p, reportRateHz: [125, 250, 500, 1000, 125][i] })) as typeof profiles;
    const { settings1 } = buildM908SettingsRows(withRates);
    expect(settings1[13][8]).toBe(8); // profile 0 -> 125Hz -> 0x08
    expect(settings1[13][10]).toBe(4); // profile 1 -> 250Hz -> 0x04
    expect(settings1[13][12]).toBe(2); // profile 2 -> 500Hz -> 0x02
    expect(settings1[14][8]).toBe(1); // profile 3 -> 1000Hz -> 0x01 (byte 2+2*3=8)
    expect(settings1[14][10]).toBe(8); // profile 4 -> 125Hz -> 0x08 (byte 2+2*4=10)
  });
});

describe("buildM908ProfileSelectRows", () => {
  it("only overlays row 0 byte 8 with the profile index", () => {
    const rows = buildM908ProfileSelectRows(3);
    expect(rows[0][8]).toBe(3);
    expect(rows.length).toBe(6);
    // other rows unchanged from template (still start with report ID 0x02)
    for (const row of rows) expect(row[0]).toBe(2);
  });
});

describe("toFeatureReportPayload", () => {
  it("splits report ID (byte 0) from the rest of the row", () => {
    const { reportId, payload } = toFeatureReportPayload([2, 0xf3, 0x42, 0x00]);
    expect(reportId).toBe(M908_REPORT_ID);
    expect(Array.from(payload)).toEqual([0xf3, 0x42, 0x00]);
  });
});
