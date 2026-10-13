import { describe, it, expect } from "vitest";
import {
  buildM908SettingsRows,
  buildM908ProfileSelectRows,
  toFeatureReportPayload,
  m908DpiSupported,
  M908_KNOWN_DPI_VALUES,
  M908_REPORT_ID,
  m908DpiRowIndex,
  buildM908ApplySequence,
  m908BrightnessByte,
  type M908FiveProfiles,
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
    expect(settings1[4][8]).toBe(2); // "4 + 2*0": 111 -> level 2
    expect(settings1[6][8]).toBe(3); // "4 + 2*1": 222 -> level 3"
  });

  it("overlays scroll speed in settings2 at byte 8+2*i", () => {
    const { settings2 } = buildM908SettingsRows(
      profiles.map((p, i) => ({ ...p, scrollSpeed: i + 10 })) as typeof profiles
    );
    expect(settings2[8]).toBe(10); // profile 0
    expect(settings2[10]).toBe(11); // profile 1
    expect(settings2[16]).toBe(14); // profile 4
  });

  it("overlays DPI enable + code at packet 7+5*stage+profile for each of the 5 stages", () => {
    const { settings3 } = buildM908SettingsRows(
      profiles.map((p, i) =>
        i === 2 ? { ...p, dpiEnabled: [true, false, true, false, true] as [boolean, boolean, boolean, boolean, boolean], dpiValues: [200, 1600, 3200, 6400, 12400] as [number, number, number, number, number] } : p
      ) as typeof profiles
    );
    // profile index 2 -> rows 9, 14, 19, 24, 29
    expect(settings3[9][8]).toBe(1); // stage 0 enabled
    expect(settings3[9][9]).toBe(0x04); // 200 dpi -> [0x04, 0x00]
    expect(settings3[9][10]).toBe(0x00);
    expect(settings3[14][8]).toBe(0); // stage 1 disabled
    expect(settings3[14][9]).toBe(0x24); // 1600 dpi -> [0x24, 0x00]
    expect(settings3[29][9]).toBe(0x8c); // stage 4: 12400 dpi -> [0x8c, 0x01]
    expect(settings3[29][10]).toBe(0x01);
    // other profiles' rows untouched by profile 2's values
    expect(settings3[7][9]).toBe(0x09); // profile 0 stage 0 = 400 dpi
    expect(settings3[8][9]).toBe(0x09); // profile 1 stage 0 = 400 dpi
  });

  it("DPI rows line up with the template's own memory addresses (6 bytes per stage within a profile)", () => {
    const { settings3 } = buildM908SettingsRows(profiles);
    const address = (row: number[]) => row[2] | (row[3] << 8);
    for (let p = 0; p < 5; p++) {
      const base = address(settings3[m908DpiRowIndex(p, 0)]);
      for (let s = 1; s < 5; s++) expect(address(settings3[m908DpiRowIndex(p, s)])).toBe(base + 6 * s);
    }
    expect(address(settings3[m908DpiRowIndex(0, 0)])).toBe(0x0044);
    expect(address(settings3[m908DpiRowIndex(1, 0)])).toBe(0x0104);
  });

  it("button rows for one profile don't touch another profile's rows", () => {
    const withButton = profiles.map((p, i) => (i === 3 ? { ...p, buttonActions: { button_1: "a" } } : p)) as typeof profiles;
    const plain = buildM908SettingsRows(profiles).settings3;
    const changed = buildM908SettingsRows(withButton).settings3;
    const diffRows = changed.map((row, i) => (row.join() === plain[i].join() ? -1 : i)).filter((i) => i >= 0);
    expect(diffRows).toEqual([35 + 20 * 3 + 6]); // button_1 is slot 6
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

describe("buildM908ApplySequence", () => {
  const five = [0, 1, 2, 3, 4].map((i) => baseProfile({ brightness: 80 * i, scrollSpeed: 20 + i })) as Parameters<typeof buildM908ApplySequence>[0];

  it("writes all five profiles' fields, then selects the active profile last", () => {
    const steps = buildM908ApplySequence(five, 2);
    expect(steps).toHaveLength(4);
    const [s1, s2, s3, select] = steps;
    for (let i = 0; i < 5; i++) {
      expect(s1.rows[4 + 2 * i][8]).toBe(m908BrightnessByte(80 * i));
      expect(s2.rows[0][8 + 2 * i]).toBe(20 + i);
    }
    expect(s2.rows[0]).toHaveLength(64);
    expect(s3.rows).toHaveLength(140);
    expect(select.rows[0][8]).toBe(2);
    expect(select.label).toContain("3");
  });

  it("the settings blocks reset the active-profile address, so select must come after them", () => {
    const [, , s3] = buildM908ApplySequence(five, 4);
    const row33 = s3.rows[33];
    const selectRow = buildM908ProfileSelectRows(4)[0];
    expect(row33.slice(1, 5)).toEqual(selectRow.slice(1, 5)); // same f3 2c 00 02 write
    expect(row33[8]).toBe(0);
  });
});

describe("toFeatureReportPayload", () => {
  it("splits report ID (byte 0) from the rest of the row", () => {
    const { reportId, payload } = toFeatureReportPayload([2, 0xf3, 0x42, 0x00]);
    expect(reportId).toBe(M908_REPORT_ID);
    expect(Array.from(payload)).toEqual([0xf3, 0x42, 0x00]);
  });
});

describe("m908BrightnessByte", () => {
  it("maps the page's 0-255 slider onto the mouse's three levels", () => {
    expect([0, 1, 85, 86, 128, 170, 171, 200, 255].map(m908BrightnessByte)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });

  it("never sends a value outside 1-3, whatever the page holds", () => {
    for (let b = -10; b <= 300; b++) {
      const level = m908BrightnessByte(b);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(3);
    }
  });
});

// Rows below are copied from a USB capture of the official Redragon
// software writing its default profile (500/1000/2000/3000/6200 DPI, red
// wave lighting, 500 Hz) with Shift on side button 11 of profiles 1 and 2.
describe("matches a capture of the official software", () => {
  const official: M908ProfileSettings = {
    lightMode: "wave",
    color: [255, 0, 0],
    brightness: 128,
    speed: 4,
    scrollSpeed: 1,
    reportRateHz: 500,
    dpiEnabled: [true, true, true, true, true],
    dpiValues: [500, 1000, 2000, 3000, 6200],
    buttonActions: {},
  };
  const withShift = { ...official, buttonActions: { button_11: "shift" } };
  const profiles = [withShift, withShift, official, official, official] as M908FiveProfiles;

  // Replays every addressed write (f3 <addr lo> <addr hi> <length>) into a
  // map of mouse memory, so two write sequences can be compared by what
  // they leave in memory rather than by how they split it into packets.
  function memoryAfter(rows: number[][]): Map<number, number> {
    const memory = new Map<number, number>();
    for (const row of rows) {
      if (row[1] !== 0xf3) continue;
      const address = row[2] | (row[3] << 8);
      for (let k = 0; k < row[4]; k++) memory.set(address + k, row[8 + k]);
    }
    return memory;
  }
  const hex = (text: string) => text.split(" ").map((b) => parseInt(b, 16));
  const appMemory = () => {
    const { settings1, settings2, settings3 } = buildM908SettingsRows(profiles);
    return memoryAfter([...settings1, settings2, ...settings3]);
  };
  const expectSameMemory = (capturedRows: string[]) => {
    const memory = appMemory();
    for (const [address, value] of memoryAfter(capturedRows.map(hex))) {
      expect(memory.get(address), `address 0x${address.toString(16)}`).toBe(value);
    }
  };

  it("DPI stages: enabled flag plus the code written twice", () => {
    expectSameMemory([
      "02 f3 44 00 05 00 00 00 01 0b 00 0b 00 00 00 00",
      "02 f3 4a 00 05 00 00 00 01 16 00 16 00 00 00 00",
      "02 f3 50 00 05 00 00 00 01 2d 00 2d 00 00 00 00",
      "02 f3 56 00 05 00 00 00 01 43 00 43 00 00 00 00",
      "02 f3 5c 00 05 00 00 00 01 8c 00 8c 00 00 00 00",
      "02 f3 04 01 05 00 00 00 01 0b 00 0b 00 00 00 00",
      "02 f3 2c 03 05 00 00 00 01 8c 00 8c 00 00 00 00",
    ]);
  });

  it("DPI rows are byte-identical to the captured packets, not just equivalent", () => {
    const { settings3 } = buildM908SettingsRows(profiles);
    expect(settings3[m908DpiRowIndex(0, 0)]).toEqual(hex("02 f3 44 00 05 00 00 00 01 0b 00 0b 00 00 00 00"));
    expect(settings3[m908DpiRowIndex(4, 4)]).toEqual(hex("02 f3 2c 03 05 00 00 00 01 8c 00 8c 00 00 00 00"));
  });

  it("lighting: colour, mode, speed and brightness level for every profile", () => {
    expectSameMemory([
      "02 f3 49 04 07 00 00 00 ff 00 00 02 04 00 02 00",
      "02 f3 51 04 07 00 00 00 ff 00 00 02 04 00 02 00",
      "02 f3 59 04 07 00 00 00 ff 00 00 02 04 00 02 00",
      "02 f3 61 04 07 00 00 00 ff 00 00 02 04 00 02 00",
      "02 f3 69 04 07 00 00 00 ff 00 00 02 04 00 02 00",
    ]);
  });

  it("polling rate for all five profiles", () => {
    expectSameMemory([
      "02 f3 32 00 06 00 00 00 02 00 02 00 02 00 00 00",
      "02 f3 38 00 04 00 00 00 02 00 02 00 00 00 00 00",
    ]);
  });

  it("buttons: Shift on side 11, and the untouched defaults around it", () => {
    expectSameMemory([
      "02 f3 82 00 04 00 00 00 81 00 00 00 00 00 00 00", // left click
      "02 f3 86 00 04 00 00 00 82 00 00 00 00 00 00 00", // right click
      "02 f3 8e 00 04 00 00 00 99 81 03 00 00 00 00 00", // fire button
      "02 f3 9a 00 04 00 00 00 90 00 1e 00 00 00 00 00", // side 1 = "1"
      "02 f3 c2 00 04 00 00 00 90 00 e1 00 00 00 00 00", // side 11 = Shift, profile 1
      "02 f3 82 01 04 00 00 00 90 00 e1 00 00 00 00 00", // side 11 = Shift, profile 2
      "02 f3 32 02 04 00 00 00 90 00 57 00 00 00 00 00", // side 11 default, profile 3
      "02 f3 ae 03 04 00 00 00 8c 00 00 00 00 00 00 00", // scroll down, profile 5
    ]);
  });

  it("DPI above 6200 keeps the four-byte form (no capture covers it yet)", () => {
    const high = profiles.map((p) => ({ ...p, dpiValues: [500, 1000, 2000, 6400, 12400] })) as M908FiveProfiles;
    const { settings3 } = buildM908SettingsRows(high);
    expect(settings3[m908DpiRowIndex(0, 3)]).toEqual(hex("02 f3 56 00 04 00 00 00 01 48 01 00 00 00 00 00"));
    expect(settings3[m908DpiRowIndex(0, 4)]).toEqual(hex("02 f3 5c 00 04 00 00 00 01 8c 01 00 00 00 00 00"));
  });
});
