// M913 packet builders, implemented directly from
// docs/protocol-notes/m913.md — not ported from any existing tool's code.

export type LedMode = "off" | "steady" | "respiration" | "rainbow";

export type DpiColors = [number, number, number, number, number]; // 0xRRGGBB per stage

export interface DpiSettings {
  values: [number, number, number, number, number]; // 0 = leave slot unchanged
  enabled: [boolean, boolean, boolean, boolean, boolean];
  // Per-stage indicator colors (the LED color shown when that DPI stage is
  // selected). Optional: Areson falls back to DEFAULT_DPI_COLORS, Compx
  // sends no color packets at all when this is absent.
  colors?: DpiColors;
}

// Factory per-stage indicator colors — exactly what the old constant
// "unknown_2" packets encoded (red, blue, green, yellow, pink). See
// docs/protocol-notes/m913.md, "DPI indicator colors". Decoded from the
// bytes, not yet verified on a real mouse.
export const DEFAULT_DPI_COLORS: Readonly<DpiColors> = [0xff0000, 0x0000ff, 0x00ff00, 0xffff00, 0xff557d];

function emptyPacket(): Uint8Array {
  const p = new Uint8Array(17);
  p[0] = 0x08;
  p[1] = 0x07;
  return p;
}

// Host→device checksum: (0x55 - sum(bytes[0..15])) & 0xFF
function outerChecksum(p: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < 16; i++) sum += p[i];
  return (0x55 - sum) & 0xff;
}

function finalize(p: Uint8Array): Uint8Array {
  p[16] = outerChecksum(p);
  return p;
}

// ---------------------------------------------------------------------
// Polling rate
// ---------------------------------------------------------------------

export function buildPollingRatePacket(hz: number): Uint8Array {
  const code = hz >= 1000 ? 0x01 : hz >= 500 ? 0x02 : hz >= 250 ? 0x04 : 0x08;
  const p = emptyPacket();
  p[4] = 0x00;
  p[5] = 0x02;
  p[6] = code;
  p[7] = (0x55 - code) & 0xff;
  return finalize(p);
}

// ---------------------------------------------------------------------
// DPI — Areson hardware (lookup table, not arithmetic)
//
// Subset from docs/protocol-notes/m913.md. Extend with more entries as
// they're captured — dpi_value_supported() below is honest about only
// recognizing what's in this table so far.
// ---------------------------------------------------------------------

const ARESON_DPI_TABLE: Record<number, [number, number, number]> = {
  100: [0x00, 0x00, 0x55],
  200: [0x02, 0x02, 0x51],
  400: [0x04, 0x04, 0x4d],
  800: [0x09, 0x09, 0x43],
  1000: [0x0b, 0x0b, 0x3f],
  1200: [0x0d, 0x0d, 0x3b],
  1600: [0x12, 0x12, 0x31],
  2000: [0x17, 0x17, 0x27],
  4000: [0x2f, 0x2f, 0xf7],
  5000: [0x3b, 0x3b, 0xdf],
  6400: [0x4c, 0x4c, 0xbd],
  8000: [0x5f, 0x5f, 0x97],
  10000: [0x77, 0x77, 0x67],
  12000: [0x8f, 0x8f, 0x37],
  14000: [0xa7, 0xa7, 0x07],
  16000: [0xbd, 0xbd, 0xdb],
};

export function aresonDpiSupported(dpi: number): boolean {
  return dpi in ARESON_DPI_TABLE;
}

export const ARESON_KNOWN_DPI_VALUES: number[] = Object.keys(ARESON_DPI_TABLE)
  .map(Number)
  .sort((a, b) => a - b);

// ---------------------------------------------------------------------
// DPI indicator colors (formerly the opaque "unknown_2" suffix)
//
// One 4-byte record per stage at addr 0x2c + stage*4: [r, g, b, inner]
// with inner = (0x55 - r - g - b) & 0xFF — the same record shape as the
// LED color and the DPI records at 0x0c + stage*4. Areson writes them two
// per packet (0x2c, 0x34: 8 bytes; 0x3c: 4 bytes), mirroring its DPI value
// packets; Compx writes one per packet.
// ---------------------------------------------------------------------

function writeColorRecord(p: Uint8Array, offset: number, rgb: number): void {
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  p[offset] = r;
  p[offset + 1] = g;
  p[offset + 2] = b;
  p[offset + 3] = (0x55 - r - g - b) & 0xff;
}

export function buildAresonDpiColorPackets(colors: Readonly<DpiColors> = DEFAULT_DPI_COLORS): Uint8Array[] {
  const layout: Array<[addr: number, len: number, stages: number[]]> = [
    [0x2c, 0x08, [0, 1]],
    [0x34, 0x08, [2, 3]],
    [0x3c, 0x04, [4]],
  ];
  return layout.map(([addr, len, stages]) => {
    const p = emptyPacket();
    p[4] = addr;
    p[5] = len;
    stages.forEach((stage, j) => writeColorRecord(p, 6 + j * 4, colors[stage]));
    return finalize(p);
  });
}

export function buildCompxDpiColorPackets(colors: Readonly<DpiColors>): Uint8Array[] {
  return colors.map((rgb, i) => {
    const p = emptyPacket();
    p[4] = 0x2c + i * 0x04;
    p[5] = 0x04;
    writeColorRecord(p, 6, rgb);
    return finalize(p);
  });
}

export function buildAresonDpiPackets(dpi: DpiSettings): Uint8Array[] {
  const p0 = emptyPacket();
  p0[4] = 0x0c;
  p0[5] = 0x08;
  const p1 = emptyPacket();
  p1[4] = 0x14;
  p1[5] = 0x08;
  const p2 = emptyPacket();
  p2[4] = 0x1c;
  p2[5] = 0x04;
  const p3 = emptyPacket();
  p3[4] = 0x02;
  p3[5] = 0x02;
  // template defaults for the "always enabled" case, overwritten below
  p3[6] = 0x05;
  p3[7] = 0x50;

  const setLevel = (p: Uint8Array, offset: number, dpi: number) => {
    const code = ARESON_DPI_TABLE[dpi];
    if (!code) return; // unknown DPI — leave slot unchanged
    p[offset] = code[0];
    p[offset + 1] = code[1];
    p[offset + 3] = code[2]; // note the 1-byte gap at offset+2
  };

  if (dpi.values[0]) setLevel(p0, 6, dpi.values[0]);
  if (dpi.values[1]) setLevel(p0, 10, dpi.values[1]);
  if (dpi.values[2]) setLevel(p1, 6, dpi.values[2]);
  if (dpi.values[3]) setLevel(p1, 10, dpi.values[3]);
  if (dpi.values[4]) setLevel(p2, 6, dpi.values[4]);

  const numEnabled = dpi.enabled.filter(Boolean).length;
  if (numEnabled > 0) {
    if (!dpi.enabled[4]) {
      p3[6] = 0x04;
      p3[7] = 0x51;
    }
    if (!dpi.enabled[3]) {
      p3[6] = 0x03;
      p3[7] = 0x52;
    }
    if (!dpi.enabled[2]) {
      p3[6] = 0x02;
      p3[7] = 0x53;
    }
    if (!dpi.enabled[1]) {
      p3[6] = 0x01;
      p3[7] = 0x54;
    }
  }

  const packets = [p0, p1, p2, p3].map(finalize);
  // The native tool always follows the DPI packets with the color packets;
  // with no colors given these reproduce its fixed bytes exactly.
  return [...packets, ...buildAresonDpiColorPackets(dpi.colors ?? DEFAULT_DPI_COLORS)];
}

// ---------------------------------------------------------------------
// DPI — Compx hardware (arithmetic: code = dpi/50 - 1)
// ---------------------------------------------------------------------

export const COMPX_DPI_MIN = 50;
export const COMPX_DPI_MAX = 12750;
export const COMPX_DPI_STEP = 50;

export function compxDpiSupported(dpi: number): boolean {
  return dpi >= COMPX_DPI_MIN && dpi <= COMPX_DPI_MAX && dpi % COMPX_DPI_STEP === 0;
}

export function compxActiveStageCount(enabled: DpiSettings["enabled"]): number {
  for (let i = 1; i < 5; i++) {
    if (!enabled[i]) return i;
  }
  return 5;
}

export function buildCompxDpiPackets(dpi: DpiSettings): Uint8Array[] {
  const packets: Uint8Array[] = [];
  for (let i = 0; i < 5; i++) {
    if (!dpi.values[i]) continue;
    const p = emptyPacket();
    p[4] = 0x0c + i * 0x04;
    p[5] = 0x04;
    const code = dpi.values[i] / 50 - 1;
    p[6] = code;
    p[7] = code;
    p[9] = (0x55 - code - code) & 0xff;
    packets.push(finalize(p));
  }

  const count = compxActiveStageCount(dpi.enabled);
  const stagePacket = emptyPacket();
  stagePacket[4] = 0x02;
  stagePacket[5] = 0x02;
  stagePacket[6] = count;
  stagePacket[7] = (0x55 - count) & 0xff;
  packets.push(finalize(stagePacket));

  if (dpi.colors) packets.push(...buildCompxDpiColorPackets(dpi.colors));

  return packets;
}

// ---------------------------------------------------------------------
// LED (shared across both hardware revisions)
// ---------------------------------------------------------------------

export function buildLedPackets(
  mode: LedMode,
  color: number, // 0xRRGGBB
  brightness: number, // 0-255, Steady mode only
  speed: number // 1-5, Respiration mode only
): Uint8Array[] {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;

  if (mode === "off") {
    const p = emptyPacket();
    p[4] = 0x58;
    p[5] = 0x02;
    p[6] = 0x00;
    p[7] = 0x55;
    return [finalize(p)];
  }

  if (mode === "rainbow") {
    // Fixed, non-configurable payloads.
    const p1 = Uint8Array.from([0x08, 0x07, 0x00, 0x00, 0x54, 0x08, 0xff, 0x00, 0xff, 0x57, 0x03, 0x52, 0x80, 0xd5, 0x00, 0x00, 0xeb]);
    const p2 = Uint8Array.from([0x08, 0x07, 0x00, 0x00, 0x5c, 0x02, 0x03, 0x52, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x93]);
    return [p1, p2];
  }

  if (mode === "respiration") {
    const p1 = emptyPacket();
    p1[4] = 0x54;
    p1[5] = 0x08;
    p1[6] = r;
    p1[7] = g;
    p1[8] = b;
    p1[9] = (0x55 - r - g - b) & 0xff;
    p1[10] = 0x02; // mode: respiration
    p1[11] = (0x55 - 0x02) & 0xff;
    p1[12] = brightness;
    p1[13] = (0x55 - brightness) & 0xff;

    const p2 = emptyPacket();
    p2[4] = 0x5c;
    p2[5] = 0x02;
    p2[6] = speed;
    p2[7] = (0x55 - speed) & 0xff;

    return [finalize(p1), finalize(p2)];
  }

  // Steady
  const p = emptyPacket();
  p[4] = 0x54;
  p[5] = 0x08;
  p[6] = r;
  p[7] = g;
  p[8] = b;
  p[9] = (0x55 - r - g - b) & 0xff;
  p[10] = 0x01; // mode: steady
  p[11] = (0x55 - 0x01) & 0xff;
  p[12] = brightness;
  p[13] = (0x55 - brightness) & 0xff;
  return [finalize(p)];
}
