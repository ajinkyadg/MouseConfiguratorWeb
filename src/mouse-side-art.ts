// Left-side view of the mouse drawn behind the side-panel keys, so the
// keys read as part of a real mouse: shell with its hump and top-shell
// seam, rounded nose and tail, thumb shelf, fire button, recessed keypad
// housing, rear light line and a desk shadow. Black in Play, white in Pro
// (Redragon sells both). Colours come from CSS (.mouse-art rules in
// public/styles.css) so it follows the theme and the profile colour. The
// keypad is enlarged relative to the body so the keys can hold their
// descriptions. Decorative only: aria-hidden, no pointer events.

const SVG_NS = "http://www.w3.org/2000/svg";

// Drawn in a 1000 × 560 box stretched over the side-panel grid. The
// keypad housing (x 126-824, y 90-481) lines up with the grid's padding in
// public/styles.css: 15% left, 20% right, 5rem top, 4.5rem bottom.
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
<ellipse class="ma-floor" cx="505" cy="548" rx="480" ry="16" filter="url(#ma-blur)"/>
<path class="ma-shelf" d="M48 490 C250 516 700 520 930 492 Q976 488 972 516 Q966 548 906 552 C680 562 300 562 86 554 Q20 550 20 520 Q22 492 48 490 Z"/>
<path class="ma-shell" d="M70 500 C30 496 14 440 18 330 C22 200 55 120 140 72 C300 22 520 10 660 16 C820 24 940 80 985 200 C1003 300 996 420 948 486 C860 505 400 508 70 500 Z"/>
<path class="ma-top" d="M18 330 C22 200 55 120 140 72 C300 22 520 10 660 16 C820 24 940 80 985 200 C930 110 830 62 690 56 C520 50 320 64 170 112 C90 140 40 200 28 300 Z"/>
<path class="ma-sheen-shape" d="M28 300 C40 200 90 140 170 112 C320 64 520 50 690 56 C830 62 930 110 985 200 C996 260 996 300 990 330 C700 250 380 250 30 330 Z"/>
<path class="ma-seam" d="M28 300 C40 200 90 140 170 112 C320 64 520 50 690 56 C830 62 930 110 976 200"/>
<path class="ma-grip" d="M846 238 C880 230 930 236 972 262 C984 330 982 410 944 470 C910 480 876 482 846 478 Z"/>
<path class="ma-led-glow" d="M830 74 C900 92 952 136 980 196" filter="url(#ma-glow)"/>
<path class="ma-led" d="M830 74 C900 92 952 136 980 196"/>
<rect class="ma-fire" x="26" y="176" width="76" height="30" rx="14" transform="rotate(-28 64 191)"/>
<rect class="ma-fire-hi" x="32" y="179" width="62" height="6" rx="3" transform="rotate(-28 64 191)"/>
<rect class="ma-bezel" x="126" y="90" width="698" height="391" rx="54"/>
<rect class="ma-well" x="138" y="102" width="674" height="367" rx="46"/>
`;

export function createMouseSideArt(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "mouse-art");
  svg.setAttribute("viewBox", "0 0 1000 560");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.innerHTML = ART; // a fixed drawing; nothing from user data
  return svg;
}
