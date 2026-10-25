import { describe, it, expect } from "vitest";
import { contrastRatio, KEY_BACKGROUND_DARK, KEY_BACKGROUND_LIGHT, readableInk, type RGB } from "./side-ink";

const rgbOf = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as RGB;

describe("readableInk", () => {
  const colours: RGB[] = [[0, 0, 255], [255, 255, 0], [0, 255, 0], [255, 0, 234], [226, 0, 26], [255, 255, 255], [0, 0, 0], [216, 223, 216], [128, 128, 128]];

  it.each(colours)("rgb(%i, %i, %i) is readable on both themes' keys", (...color) => {
    for (const bg of [KEY_BACKGROUND_LIGHT, KEY_BACKGROUND_DARK]) {
      expect(contrastRatio(rgbOf(readableInk(color as unknown as RGB, bg)), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("leaves a colour alone when it is already readable", () => {
    expect(readableInk([140, 10, 25], KEY_BACKGROUND_LIGHT)).toBe("#8c0a19");
    expect(readableInk([0, 255, 0], KEY_BACKGROUND_DARK)).toBe("#00ff00");
  });

  it("adjusts only as far as needed when a colour is just short of readable", () => {
    expect(contrastRatio([226, 0, 26], KEY_BACKGROUND_LIGHT)).toBeLessThan(4.5);
    const adjusted = rgbOf(readableInk([226, 0, 26], KEY_BACKGROUND_LIGHT));
    expect(contrastRatio(adjusted, KEY_BACKGROUND_LIGHT)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(adjusted, KEY_BACKGROUND_LIGHT)).toBeLessThan(5.5); // a small step, not black
  });

  it("keeps the hue: blue stays bluish on dark, yellow stays yellowish on light", () => {
    const [r, g, b] = rgbOf(readableInk([0, 0, 255], KEY_BACKGROUND_DARK));
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
    const [yr, yg, yb] = rgbOf(readableInk([255, 255, 0], KEY_BACKGROUND_LIGHT));
    expect(yr).toBeGreaterThan(yb);
    expect(yg).toBeGreaterThan(yb);
  });
});
