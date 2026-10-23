import { describe, it, expect } from "vitest";
import { m908ProfileSwatch } from "./m908-swatch";

describe("m908ProfileSwatch", () => {
  it("shows the profile colour for single-colour modes", () => {
    expect(m908ProfileSwatch({ lightMode: "static", color: [0, 0, 255] })).toEqual({ kind: "solid", hex: "#0000ff" });
    expect(m908ProfileSwatch({ lightMode: "breathing", color: [226, 0, 26] })).toEqual({ kind: "solid", hex: "#e2001a" });
    expect(m908ProfileSwatch({ lightMode: "reactive_button", color: [1, 2, 3] })).toEqual({ kind: "solid", hex: "#010203" });
  });

  it("marks colour-cycling modes as multicolour, whatever colour is stored", () => {
    for (const lightMode of ["rainbow", "breathing_rainbow", "wave", "random", "alternating"] as const) {
      expect(m908ProfileSwatch({ lightMode, color: [0, 255, 0] })).toEqual({ kind: "multicolor" });
    }
  });

  it("marks lighting turned off", () => {
    expect(m908ProfileSwatch({ lightMode: "off", color: [255, 255, 255] })).toEqual({ kind: "off" });
  });

  it("never produces an invalid colour from out-of-range values", () => {
    expect(m908ProfileSwatch({ lightMode: "static", color: [300, -5, 12.6] })).toEqual({ kind: "solid", hex: "#ff000d" });
  });
});
