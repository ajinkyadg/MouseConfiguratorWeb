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

// Drawn in a 1000 × 500 box that keeps its proportions: the side-panel
// grid takes the same 2:1 aspect ratio, and its padding (in cqi, so 10
// units = 1cqi) puts the keys inside the keypad housing, which starts at
// x 190, y 175 and is skewed 3° so its rear end sits higher.
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
<ellipse class="ma-floor" cx="495" cy="474" rx="470" ry="12" filter="url(#ma-blur)"/>
<ellipse class="ma-wheel" cx="262" cy="110" rx="36" ry="14" transform="rotate(-24 262 110)"/>
<path class="ma-shell" d="M70 468 C36 466 20 440 18 400 C16 330 18 285 28 250 C90 170 330 52 600 40 C770 32 905 80 952 190 C985 270 988 380 968 440 C958 462 935 468 900 469 L70 468 Z"/>
<path class="ma-top" d="M28 250 C90 170 330 52 600 40 C770 32 905 80 952 190 C905 110 770 66 605 70 C345 80 110 190 40 272 Z"/>
<path class="ma-sheen-shape" d="M28 250 C90 170 330 52 600 40 C770 32 905 80 952 190 C905 110 770 66 605 70 C345 80 110 190 40 272 Z"/>
<path class="ma-seam" d="M40 272 C110 190 345 80 605 70 C770 66 905 110 952 190"/>
<path class="ma-grip" d="M842 250 C876 238 918 242 952 264 C966 320 966 390 945 440 C912 450 876 452 842 448 Z"/>
<path class="ma-shelf" d="M150 430 C380 410 760 408 920 422 C952 426 956 458 924 466 L170 468 C138 466 130 436 150 430 Z"/>
<path class="ma-led-glow" d="M800 58 C880 76 930 122 950 182" filter="url(#ma-glow)"/>
<path class="ma-led" d="M800 58 C880 76 930 122 950 182"/>
<rect class="ma-fire" x="76" y="232" width="70" height="26" rx="13" transform="rotate(-36 111 245)"/>
<rect class="ma-fire-hi" x="82" y="235" width="56" height="5" rx="2.5" transform="rotate(-36 111 245)"/>
<g transform="translate(190 175) skewY(-3)">
  <rect class="ma-bezel" width="620" height="248" rx="38"/>
  <rect class="ma-well" x="9" y="9" width="602" height="230" rx="31"/>
</g>
`;

export function createMouseSideArt(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "mouse-art");
  svg.setAttribute("viewBox", "0 0 1000 500");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.innerHTML = ART; // a fixed drawing; nothing from user data
  return svg;
}
