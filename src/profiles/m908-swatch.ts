// What a profile's lighting looks like, for the colour mark on each
// profile tab. Modes that cycle through colours ignore the profile colour.
import { type M908LightMode, type M908ProfileSettings } from "./m908";

const MULTICOLOR_MODES: ReadonlySet<M908LightMode> = new Set(["rainbow", "breathing_rainbow", "wave", "random", "alternating"]);

export type M908Swatch = { kind: "off" } | { kind: "multicolor" } | { kind: "solid"; hex: string };

export function m908ProfileSwatch(profile: Pick<M908ProfileSettings, "lightMode" | "color">): M908Swatch {
  if (profile.lightMode === "off") return { kind: "off" };
  if (MULTICOLOR_MODES.has(profile.lightMode)) return { kind: "multicolor" };
  const hex = "#" + profile.color.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
  return { kind: "solid", hex };
}
