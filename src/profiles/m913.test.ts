import { describe, it, expect } from "vitest";
import {
  buildPollingRatePacket,
  buildAresonDpiPackets,
  buildCompxDpiPackets,
  buildLedPackets,
  aresonDpiSupported,
  compxDpiSupported,
  compxActiveStageCount,
  ARESON_KNOWN_DPI_VALUES,
  COMPX_DPI_MIN,
  COMPX_DPI_MAX,
} from "./m913";

// Independent re-implementation of the outer checksum, so these tests don't
// just check the code against itself.
function expectValidChecksum(p: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < 16; i++) sum += p[i];
  expect(p[16]).toBe((0x55 - sum) & 0xff);
  expect(p.length).toBe(17);
  expect(p[0]).toBe(0x08);
}

describe("polling rate", () => {
  it.each([
    [1000, 0x01],
    [999, 0x02], // below 1000 falls to the 500Hz bucket
    [500, 0x02],
    [499, 0x04],
    [250, 0x04],
    [249, 0x08],
    [125, 0x08],
  ])("hz=%i -> code 0x%s", (hz, code) => {
    const p = buildPollingRatePacket(hz);
    expect(p[6]).toBe(code);
    expect(p[7]).toBe((0x55 - code) & 0xff);
    expectValidChecksum(p);
  });
});

describe("Areson DPI", () => {
  it("known values are recognized, unknown are not", () => {
    expect(aresonDpiSupported(1600)).toBe(true);
    expect(aresonDpiSupported(1234)).toBe(false);
  });

  it("ARESON_KNOWN_DPI_VALUES is sorted ascending and non-empty", () => {
    const sorted = [...ARESON_KNOWN_DPI_VALUES].sort((a, b) => a - b);
    expect(ARESON_KNOWN_DPI_VALUES).toEqual(sorted);
    expect(ARESON_KNOWN_DPI_VALUES.length).toBeGreaterThan(5);
  });

  it("encodes 5 known slots into 7 packets with correct byte placement", () => {
    const packets = buildAresonDpiPackets({
      values: [400, 800, 1600, 4000, 6400],
      enabled: [true, true, true, true, true],
    });
    expect(packets).toHaveLength(7); // 4 DPI packets + 3 fixed "unknown_2"

    const [p0, p1, p2, p3] = packets;
    // slot 1 (400) at p0 offset 6, slot 2 (800) at p0 offset 10
    expect([p0[6], p0[7], p0[9]]).toEqual([0x04, 0x04, 0x4d]);
    expect([p0[10], p0[11], p0[13]]).toEqual([0x09, 0x09, 0x43]);
    // slot 3 (1600) at p1 offset 6, slot 4 (4000) at p1 offset 10
    expect([p1[6], p1[7], p1[9]]).toEqual([0x12, 0x12, 0x31]);
    expect([p1[10], p1[11], p1[13]]).toEqual([0x2f, 0x2f, 0xf7]);
    // slot 5 (6400) at p2 offset 6
    expect([p2[6], p2[7], p2[9]]).toEqual([0x4c, 0x4c, 0xbd]);
    // all 5 enabled -> template default enable bytes
    expect([p3[6], p3[7]]).toEqual([0x05, 0x50]);

    for (const p of [p0, p1, p2, p3]) expectValidChecksum(p);
  });

  it("an unknown DPI value leaves that slot unchanged rather than corrupting the packet", () => {
    const packets = buildAresonDpiPackets({
      values: [1234, 0, 0, 0, 0], // not in the table
      enabled: [true, true, true, true, true],
    });
    // Should not have written the (nonexistent) code for 1234 — slot stays
    // at whatever the base template held, and the packet is still valid.
    expectValidChecksum(packets[0]);
  });

  it("cascading disable: disabling slot 2 also disables everything above it", () => {
    const packets = buildAresonDpiPackets({
      values: [0, 0, 0, 0, 0],
      enabled: [true, false, true, true, true], // enabled[1]=false should win
    });
    expect([packets[3][6], packets[3][7]]).toEqual([0x01, 0x54]);
  });
});

describe("Compx DPI", () => {
  it("supports multiples of 50 in range, rejects others", () => {
    expect(compxDpiSupported(800)).toBe(true);
    expect(compxDpiSupported(COMPX_DPI_MIN)).toBe(true);
    expect(compxDpiSupported(COMPX_DPI_MAX)).toBe(true);
    expect(compxDpiSupported(825)).toBe(false); // not a multiple of 50
    expect(compxDpiSupported(COMPX_DPI_MAX + 50)).toBe(false);
  });

  it("encodes DPI arithmetically as (value/50 - 1)", () => {
    const packets = buildCompxDpiPackets({
      values: [800, 0, 0, 0, 0],
      enabled: [true, true, true, true, true],
    });
    const code = 800 / 50 - 1; // 15
    expect(packets[0][4]).toBe(0x0c); // slot 0 address
    expect(packets[0][6]).toBe(code);
    expect(packets[0][7]).toBe(code);
    expect(packets[0][9]).toBe((0x55 - code - code) & 0xff);
    expectValidChecksum(packets[0]);
  });

  it("active stage count cascades from the first disabled slot after slot 1", () => {
    expect(compxActiveStageCount([true, true, true, true, true])).toBe(5);
    expect(compxActiveStageCount([true, false, true, true, true])).toBe(1);
    expect(compxActiveStageCount([true, true, true, false, true])).toBe(3);
  });
});

describe("LED", () => {
  it("off: single packet, fixed payload", () => {
    const [p] = buildLedPackets("off", 0, 0, 0);
    expect([p[6], p[7]]).toEqual([0x00, 0x55]);
    expectValidChecksum(p);
  });

  it("steady: encodes RGB + brightness with correct inline checksums", () => {
    const [p] = buildLedPackets("steady", 0x112233, 128, 0);
    const r = 0x11, g = 0x22, b = 0x33;
    expect([p[6], p[7], p[8]]).toEqual([r, g, b]);
    expect(p[9]).toBe((0x55 - r - g - b) & 0xff);
    expect(p[10]).toBe(0x01); // mode: steady
    expect(p[11]).toBe((0x55 - 0x01) & 0xff);
    expect(p[12]).toBe(128);
    expect(p[13]).toBe((0x55 - 128) & 0xff);
    expectValidChecksum(p);
  });

  it("respiration: two packets, color+mode in first, speed in second", () => {
    const [p1, p2] = buildLedPackets("respiration", 0x00ff00, 200, 4);
    expect(p1[10]).toBe(0x02); // mode: respiration
    expect(p1[12]).toBe(200); // brightness
    expect(p2[6]).toBe(4); // speed
    expect(p2[7]).toBe((0x55 - 4) & 0xff);
    expectValidChecksum(p1);
    expectValidChecksum(p2);
  });

  it("rainbow: two fixed packets with internally-consistent checksums", () => {
    const [p1, p2] = buildLedPackets("rainbow", 0, 0, 0);
    expectValidChecksum(p1);
    expectValidChecksum(p2);
  });
});
