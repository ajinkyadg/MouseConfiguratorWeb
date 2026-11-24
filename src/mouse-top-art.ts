// Top-down view of the mouse drawn between the top-button tiles, with a
// leader line from each tile to its button. Front of the mouse at the top.
// Traced from Redragon's M913 and M908 product photos (both share the
// shell): left and right buttons split by a channel holding the wheel and,
// behind it, the two DPI buttons with the DPI LED bars beside them; the
// fire button on the upper-left rim; the thumb wing with the side keypad
// lower on the left; two light strips at the rear. Colours come from CSS
// (.mouse-top-art rules in public/styles.css) so the drawing follows the
// theme and the profile's lighting colour. Decorative: aria-hidden.
//
// The SVG spans the whole tile grid (800 units wide), so the leader lines
// meet the tiles exactly: the grid is laid out in cqi with the same numbers
// (100cqi = 800 units). Keep TILE_* in step with the .has-top rules.

const SVG_NS = "http://www.w3.org/2000/svg";

export type TopPart = "left" | "right" | "middle" | "fire" | "scroll_up" | "scroll_down" | "dpi_up" | "dpi_down";

export interface TopTile {
  part: TopPart;
  col: "l" | "r"; // tile column: left or right of the drawing
  row: number; // 0 = top
}

// Tile grid, in drawing units: columns 230 wide at each edge, rows 60 tall
// every 80, starting 24 down. (In CSS: 28.75cqi, 7.5cqi, 2.5cqi, 3cqi.)
const TILE_W = 230;
const ROW_TOP = 24;
const ROW_STEP = 80;
const ROW_H = 60;

// The mouse is drawn in a 220 × 330 box and scaled to the panel's height.
const BOX_W = 220;
const BOX_H = 330;

const ANCHOR: Record<TopPart, [number, number]> = {
  left: [80, 84],
  right: [158, 84],
  middle: [115, 56],
  scroll_up: [115, 36],
  scroll_down: [115, 76],
  fire: [44, 80],
  dpi_up: [115, 103],
  dpi_down: [115, 128],
};

const MOUSE = `
<path class="mt-body" d="M58 26 C80 6 150 4 172 22 C196 48 212 110 214 170 C216 240 200 300 150 322 C120 334 70 330 46 312 C22 292 8 250 6 205 C4 170 14 140 28 118 C40 100 44 60 58 26 Z"/>
<path class="mt-palm" d="M42 150 C70 160 160 162 208 150 C214 220 200 296 150 318 C120 330 72 326 48 308 C26 290 14 250 14 210 C14 182 26 160 42 150 Z"/>
<path class="mt-part" data-part="left" d="M64 30 C82 13 98 9 110 8 L103 150 C82 150 62 142 46 130 C48 96 54 58 64 30 Z"/>
<path class="mt-part" data-part="right" d="M120 8 C140 8 158 12 168 24 C188 48 202 92 206 140 C182 150 152 152 128 150 Z"/>
<rect class="mt-channel" x="104" y="20" width="22" height="126" rx="10"/>
<g class="mt-part mt-wheel" data-part="middle">
  <rect x="106" y="26" width="18" height="52" rx="9"/>
  <path class="mt-tread" d="M109 36 H121 M109 44 H121 M109 52 H121 M109 60 H121 M109 68 H121"/>
</g>
<path class="mt-arrow" data-part="scroll_up" d="M109 20 L115 13 L121 20"/>
<path class="mt-arrow" data-part="scroll_down" d="M109 84 L115 91 L121 84"/>
<rect class="mt-part" data-part="dpi_up" x="107" y="92" width="16" height="22" rx="5"/>
<rect class="mt-part" data-part="dpi_down" x="107" y="117" width="16" height="22" rx="5"/>
<path class="mt-dpi-led" d="M94 96 l4 -3 M94 106 l4 -3 M94 116 l4 -3 M94 126 l4 -3"/>
<rect class="mt-part" data-part="fire" x="38" y="64" width="12" height="32" rx="6" transform="rotate(-14 44 80)"/>
<g class="mt-pad">
  <rect x="9" y="160" width="14" height="22" rx="4"/><rect x="8" y="186" width="14" height="22" rx="4"/>
  <rect x="8" y="212" width="14" height="22" rx="4"/><rect x="9" y="238" width="14" height="22" rx="4"/>
</g>
<path class="mt-led-glow" d="M50 262 C54 286 66 302 84 312 M200 236 C198 266 188 290 168 306"/>
<path class="mt-led" d="M50 262 C54 286 66 302 84 312 M200 236 C198 266 188 290 168 306"/>
`;

/** Height of the drawing (and of the tile grid) for `rows` rows of tiles. */
export function topArtHeight(rows: number): number {
  return Math.max(300, ROW_TOP + rows * ROW_STEP + 16);
}

export function createMouseTopArt(tiles: TopTile[]): SVGSVGElement {
  const rows = Math.max(...tiles.map((t) => t.row)) + 1;
  const height = topArtHeight(rows);
  const scale = (height - 20) / BOX_H;
  const left = 400 - (BOX_W / 2) * scale;
  const right = 400 + (BOX_W / 2) * scale;
  const top = 10;

  const leaders = tiles.map(({ part, col, row }) => {
    const [ax, ay] = ANCHOR[part];
    const x = left + ax * scale;
    const y = top + ay * scale;
    const ty = ROW_TOP + row * ROW_STEP + ROW_H / 2;
    const tx = col === "l" ? TILE_W + 6 : 800 - TILE_W - 6;
    const ex = col === "l" ? left - 14 : right + 14; // elbow just outside the shell
    return `<path class="mt-leader" data-part="${part}" d="M${tx} ${ty} H${ex.toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}"/>` +
      `<circle class="mt-dot" data-part="${part}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>`;
  });

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "mouse-art mouse-top-art");
  svg.setAttribute("viewBox", `0 0 800 ${height}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  // A fixed drawing plus numbers computed above; nothing from user data.
  svg.innerHTML =
    `<ellipse class="mt-floor" cx="400" cy="${height - 14}" rx="${(BOX_W * scale) / 2}" ry="10"/>` +
    `<g transform="translate(${left.toFixed(1)} ${top}) scale(${scale.toFixed(4)})">${MOUSE}</g>` +
    leaders.join("");
  return svg;
}

/** Marks the parts (button, leader line, dot) for `part` as selected or hovered. */
export function markTopPart(svg: SVGSVGElement, part: string, state: "on" | "hot", value: boolean) {
  for (const node of svg.querySelectorAll(`[data-part="${part}"]`)) node.classList.toggle(state, value);
}
