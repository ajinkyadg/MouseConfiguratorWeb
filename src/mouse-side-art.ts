// Left-side view of the mouse drawn behind the side-panel keys, so the
// keys read as part of a real mouse: low nose rising in a long line to the
// hump about 60% back, a short drop to the tail, the top-shell seam, scroll
// wheel and fire button up front, textured rear grip, thumb shelf under the
// pad, rear light line and a desk shadow. Black in Play, white in Pro
// (Redragon sells both). Colours come from CSS (.mouse-art rules in
// public/styles.css) so it follows the theme and the profile colour. The
// keypad is larger than on the real mouse so the keys can hold their
// descriptions, but it keeps its place (front-of-middle, lower half) and
// its tilt (rear end higher). Decorative only: aria-hidden, no pointer
// events.

const SVG_NS = "http://www.w3.org/2000/svg";

// Drawn in a 1000 × 540 box, of which the page shows only the middle
// (x 100-900, y 60-520) so the keys can be large: nose, tail and hump run
// off the edges. The view keeps its proportions; the side-panel grid takes
// the same aspect ratio, and its padding (in cqi, so 8 units = 1cqi) puts
// the keys inside the keypad housing, which starts at x 150, y 150 and is
// skewed 3° so its rear end sits higher. The body is drawn faded
// (.ma-body) so the keys stand out.
const ART = `
<defs>
  <linearGradient id="ma-shell" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" class="ma-shell-hi"/><stop offset="0.5" class="ma-shell-mid"/><stop offset="1" class="ma-shell-lo"/>
  </linearGradient>
  <linearGradient id="ma-top" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" class="ma-top-hi"/><stop offset="1" class="ma-top-lo"/>
  </linearGradient>
  <linearGradient id="ma-shelf" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" class="ma-shelf-hi"/><stop offset="1" class="ma-shelf-lo"/>
  </linearGradient>
  <linearGradient id="ma-well" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" class="ma-well-hi"/><stop offset="1" class="ma-well-lo"/>
  </linearGradient>
  <radialGradient id="ma-sheen" cx="0.62" cy="0.12" r="0.5">
    <stop offset="0" class="ma-sheen"/><stop offset="1" class="ma-sheen" stop-opacity="0"/>
  </radialGradient>
  <pattern id="ma-grip" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="14" height="14" class="ma-grip-bg"/><rect x="2" y="2" width="10" height="10" rx="2" class="ma-grip-cell"/>
  </pattern>
  <filter id="ma-blur" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="12"/></filter>
  <filter id="ma-glow" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>
</defs>
<ellipse class="ma-floor" cx="495" cy="514" rx="470" ry="12" filter="url(#ma-blur)"/>
<g class="ma-body">
  <ellipse class="ma-wheel" cx="262" cy="92" rx="36" ry="14" transform="rotate(-18 262 92)"/>
  <path class="ma-shell" d="M70 508 C36 506 20 480 18 440 C16 370 16 290 24 230 C80 130 330 40 600 30 C770 22 905 70 955 190 C988 280 990 410 970 478 C960 502 935 508 900 509 L70 508 Z"/>
  <path class="ma-top" d="M24 230 C80 130 330 40 600 30 C770 22 905 70 955 190 C905 100 770 56 605 58 C345 64 96 150 34 252 Z"/>
  <path class="ma-sheen-shape" d="M24 230 C80 130 330 40 600 30 C770 22 905 70 955 190 C905 100 770 56 605 58 C345 64 96 150 34 252 Z"/>
  <path class="ma-seam" d="M34 252 C96 150 345 64 605 58 C770 56 905 100 955 190"/>
  <path class="ma-grip" d="M872 250 C898 240 930 246 956 266 C968 330 968 420 948 480 C922 490 896 492 872 488 Z"/>
  <path class="ma-shelf" d="M120 468 C380 456 760 452 920 462 C952 466 956 498 924 506 L150 508 C112 506 102 474 120 468 Z"/>
  <path class="ma-led-glow" d="M800 44 C880 64 932 112 952 180" filter="url(#ma-glow)"/>
  <path class="ma-led" d="M800 44 C880 64 932 112 952 180"/>
  <rect class="ma-fire" x="58" y="196" width="70" height="26" rx="13" transform="rotate(-38 93 209)"/>
  <rect class="ma-fire-hi" x="64" y="199" width="56" height="5" rx="2.5" transform="rotate(-38 93 209)"/>
</g>
<g transform="translate(150 150) skewY(-3)">
  <rect class="ma-bezel" width="700" height="300" rx="40"/>
  <rect class="ma-well" x="8" y="8" width="684" height="284" rx="33"/>
</g>
`;

export function createMouseSideArt(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "mouse-art");
  svg.setAttribute("viewBox", "100 60 800 460");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.innerHTML = ART; // a fixed drawing; nothing from user data
  return svg;
}
