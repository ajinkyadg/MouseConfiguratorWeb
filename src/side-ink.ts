// Text colour for the side-panel keys, taken from the profile's lighting
// colour. A raw LED colour is often unreadable as text (pure blue on a
// dark panel, yellow on a light one), so it is mixed towards white or
// black only as far as needed to reach a readable contrast.

export type RGB = readonly [number, number, number];

// Backgrounds of an assigned key in each theme (see public/styles.css):
// --surface-sunken in Pro, --surface-elevated in Play.
export const KEY_BACKGROUND_LIGHT: RGB = [0xec, 0xee, 0xf1];
export const KEY_BACKGROUND_DARK: RGB = [0x22, 0x22, 0x26];
// WCAG AA for normal-size text.
const MIN_CONTRAST = 4.5;

function luminance([r, g, b]: RGB): number {
  const channel = (c: number) => {
    const s = Math.max(0, Math.min(255, c)) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const hex = (c: RGB) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

/** The profile colour, mixed towards white (dark background) or black
 * (light background) in small steps until it is readable. */
export function readableInk(color: RGB, background: RGB): string {
  const target: RGB = luminance(background) < 0.5 ? [255, 255, 255] : [0, 0, 0];
  for (let step = 0; step <= 20; step++) {
    const t = step / 20;
    const mixed: RGB = [0, 1, 2].map((i) => color[i] + (target[i] - color[i]) * t) as unknown as RGB;
    if (contrastRatio(mixed, background) >= MIN_CONTRAST) return hex(mixed);
  }
  return hex(target);
}

/** Sets the side-panel ink on the editor for both themes, or clears it so
 * the keys use the normal text colour (lighting off or colour-cycling). */
export function setSideInk(root: HTMLElement, color: RGB | null): void {
  if (!color) {
    root.style.removeProperty("--side-ink-light");
    root.style.removeProperty("--side-ink-dark");
    return;
  }
  root.style.setProperty("--side-ink-light", readableInk(color, KEY_BACKGROUND_LIGHT));
  root.style.setProperty("--side-ink-dark", readableInk(color, KEY_BACKGROUND_DARK));
}
