# MouseConfig — Mark & Hero Illustration Brief

For the designer implementing the logo mark and the hero illustration.
Scope: `public/brand/mark.svg`, the inline `.brand-mark` SVG in the nav, and the
inline `.hero-art` SVG in `index.html`. Everything here is implementable as SVG
and must theme from CSS custom properties — no baked hex values in the artwork.

Owner's note driving this: the mouse artwork should have "a more real life look."
It currently reads as a generic flat icon rather than a piece of hardware someone
would want to own. This brief decides how far to take that, and where not to.

---

## 0. The one-line summary

**The mark gets simpler. The hero gets real.** They are two different objects with
two different jobs, and the most common failure mode here would be to push realism
into both and end up with a smudge at 16px and a slightly-less-flat icon in the hero.

---

## 1. Two jobs, two rules

### 1.1 The mark — identification at a glance

Render contexts, measured from the current code:

| Context | Tile | Glyph | Source |
|---|---|---|---|
| Nav | 1.85rem (~30px) | ~30px, full-bleed tile | inline SVG in `index.html` |
| Favicon (tab) | 16px | 16px | `public/brand/mark.svg` |
| Favicon (bookmark/retina tab) | 32px | 32px | same file |
| Future: apple-touch, OG, store | 180–1024px | same file, upscaled | same file |

**Rule: the mark is a pictogram, not a picture.** It answers "which tab is this?"
in about 40ms of peripheral vision. Realism at 16px is not a stylistic risk, it is
a legibility failure — shading, perspective, cable, contact shadow and material
contrast all collapse into grey mush below ~24px.

What "more realistic" is *allowed* to mean in the mark:
- The silhouette may become a **correct right-handed mouse profile** instead of the
  current symmetric capsule. Asymmetry survives 16px; it is the cheapest realism
  available and costs no shapes.
- The button seam may stop where a real seam stops (see §4).

What it must **not** mean in the mark:
- No gradients, no shading, no highlight, no contact shadow, no perspective, no
  cable, no texture, no more than one accent hue, no third colour.

**Hard budget for the mark:** at most **6 drawn shapes** inside the tile
(1 body contour, 1 seam, 1 wheel, 3 side-button dots — or fewer). If a shape cannot
be distinguished at 16px on a 1x display, delete it rather than shrink it.

### 1.2 The hero — desire, and proof you know the hardware

Render context, measured: `.hero-art { inline-size: clamp(9rem, 17vw, 13.5rem) }`
= **144px to 216px wide**, and `display: none` below the mobile breakpoint. So the
hero illustration is a **desktop-only, ~150–220px-wide object**. That is small.

This matters more than it sounds. It rules out near-photographic rendering not on
taste grounds but on resolution grounds: at 200px wide, specular highlights, micro
texture and subtle ambient occlusion are two or three pixels each and read as noise.
It equally rules out staying flat — at 200px there is ample room for form.

**Rule: the hero is a product render, executed at icon scale.** It must look like an
object with volume, weight, and a light source, built out of a small number of clean
tonal planes.

---

## 2. Style target: flat-shaded vector, 4 tone steps

On the spectrum flat → shaded vector → near-photographic, the target is
**shaded vector, positioned about 60% of the way from flat toward photoreal.**
Concretely:

- **Form comes from filled tonal planes, not from outlines.** Today the hero is a
  stroked wireframe with a transparent body; that is the single largest reason it
  reads as an icon. Replace with filled shapes.
- **Exactly four value steps on the shell**: top plane (lit), upper-left flank
  (mid), lower flank / thumb pad (shadow), and the underside / contact edge
  (darkest). Plus one specular: a single soft hairline along the top ridge.
- **Linear gradients are permitted, two stops maximum, only to soften the meeting
  of two adjacent tone steps on a curved face.** No radial gradients, no mesh
  gradients, no gradient meshes exported from Illustrator, no `filter: blur()`
  except for the one contact shadow.
- **No outline on the outer silhouette.** Let the tonal step against the page
  background define the edge. If the shape disappears against `--surface` in the
  Pro theme (it will — see §5), solve it with the darkest tone step and a contact
  shadow, not by re-adding a 2px stroke.
- **Interior seams are cut lines, not drawn lines**: a 1px dark line paired with a
  1px lighter line below it, so the seam reads as a physical panel gap. This one
  technique does more for "real hardware" than any amount of gradient.

### 2.1 Why vector and not a photo or a raster render

A photoreal raster hero cannot follow the theme. This site has two token sets
(Play: `--bg #0a0a0c`, `--accent #e2001a`; Pro: `--bg #f4f5f7`, `--accent #b01020`)
switched live from the nav with no page reload. A PNG can only be swapped for a
second PNG. That costs:
- two assets to keep in sync forever, plus the `<picture>` / CSS-var plumbing to
  switch them on `[data-theme]`;
- a visible flash or layout settle on theme switch where the rest of the page
  transitions instantly;
- the mouse's red accent locked to whichever red was baked in, so the Pro theme
  would show a Play-red mouse — the exact inconsistency the theme system exists to
  prevent;
- a hard edge or a hard-coded background behind an object photographed on a
  seamless, on a page whose background changes.

**Decision: the hero stays inline SVG, themed entirely from CSS custom properties.**
This is a genuine trade-off and worth naming: we are accepting less material
richness than a render would give, in exchange for the artwork being a first-class
citizen of the theme system. At 200px wide, that trade is clearly correct.

*Judgement call:* if a photoreal product shot is ever wanted, its place is a
dedicated product/launch page for the owner's own mouse, sized ≥600px, on its own
neutral plate, **not** the configurator hero. Do not mix the two in one viewport.

---

## 3. Viewpoint: three-quarter, camera high and to the left

The three candidates, judged on the three things that matter here:

| | Shows the 12-button pad | Recognisable as "mouse" at a glance | Flatters the hardware |
|---|---|---|---|
| **Top-down** | **No — the pad is on the left flank and is invisible from directly above** | Best | Worst: flattens the ergonomic hump that is the whole point of the shell |
| **Profile (pure side)** | Yes, fully and undistorted | Weak — a side-on mouse reads as a shoe, a stone, a blob | Shows the hump, but reads as a technical elevation drawing |
| **Three-quarter** | Yes, foreshortened but complete | Good | Best: shows the hump, the palm swell and the thumb ledge at once |

**Decision: three-quarter.** Camera roughly **35° azimuth toward the mouse's left
flank, 30° elevation**, mouse nose angled up-left, so the viewer sees the top shell,
the full left thumb pad, and a sliver of the front. Not an isometric — a true
one-point-ish perspective with a slight vanishing, because isometric reads as
"infographic," which is the failure mode we are escaping.

The current hero is **top-down, with the 12-key grid drawn on the top face.** That
is not a stylistic weakness, it is a factual error: there is no MMO mouse on which
the side pad is visible from straight above. To anyone who owns one of these mice —
the entire target audience — it says the artwork was drawn by someone who has not
held the product. **Fixing this is the single highest-value change in this brief.**

The mark stays **top-down and abstract.** It is deliberately a different viewpoint
from the hero, and that is fine: a three-quarter perspective form at 16px loses all
its perspective cues and becomes an irregular blob. Consistency between mark and
hero is carried by silhouette proportion, radii and accent discipline — not by
sharing a camera.

---

## 4. Credibility: what must always be shown, and what must never be

The audience owns a 12-side-button MMO mouse and is on this page because vendor
software failed them. They will spot a fake instantly.

### 4.1 Always present (hero)

1. **Right-handed asymmetry.** Shell taller and fuller on the right, a distinct
   thumb ledge protruding left beneath the button pad. A symmetric ambidextrous
   capsule is the tell that the artwork is generic.
2. **The pad on the flank, 3 columns × 4 rows = 12 keys**, with (a) a visible bevel
   or recessed plate where the pad meets the shell, (b) keys that are individually
   raised with their own top highlight and bottom shadow, not flat rectangles, and
   (c) very slightly varying key heights across the arc of the flank — real pads
   curve. 12 is the count the product claims and the count the artwork must show.
3. **A scroll wheel sunk into a slot**, with visible depth on both slot walls and
   a ribbed or notched wheel surface. A floating capsule on the top face, which is
   what exists today, is the second-biggest "icon, not hardware" tell.
4. **The two DPI / profile buttons behind the wheel.** They are on every mouse in
   this class and their absence is noticed.
5. **A main-button seam that terminates correctly** — running from the nose back to
   roughly 55–60% of the body length and stopping at the palm hump, not a line
   bisecting the entire body end to end as it does today.
6. **A cable or port at the nose.** The hero lede says "Plug the cable in" — show a
   short braided USB-C stub leaving the nose, or at minimum the port recess. This
   ties the illustration to the product claim.
7. **A contact shadow.** A soft elliptical shadow under the mouse, offset opposite
   the light. Without it the object floats and nothing else you do will make it feel
   physical. This is non-negotiable.
8. **Two materials, minimum.** Matte main shell vs. a visibly different (darker,
   slightly textured) thumb rest / side grip. One tonal step of difference is enough.

### 4.2 Never present (both mark and hero)

1. **No Redragon logo, dragon emblem, wordmark, or recognisable trade dress.** The
   footer states the project is not affiliated with, endorsed by or sponsored by
   Redragon. Drawing their branding — or a close enough copy of the M913's actual
   shell that it functions as their trade dress — contradicts that statement and
   creates a trademark exposure the disclaimer does not cure. The artwork depicts
   *a* 12-side-button MMO mouse; the page names the specific model in text.
   **This is the line: recognisable as the category, never as a branded product.**
2. **No invented impossible geometry.** Equally, do not "avoid Redragon" by drawing
   a mouse that matches no real product — no floating segments, no impossible
   undercuts, no button counts that don't exist. The shape must be plausible as a
   thing that could be manufactured, and must be consistent with the product the
   owner is actually launching.
3. **No RGB rainbow.** Multi-hue LED strips read as budget gaming peripheral and
   destroy the Pro positioning. The site configures RGB; the brand artwork does not
   advertise it.
4. **No hand, no desk scene, no mousepad texture, no cursor trails, no motion
   streaks, no DPI-arc graphics.** The subject is the hardware.
5. **No third brand colour.** Grey/neutral shell plus one red. Nothing else.
6. **No text inside the artwork.** No "12", no DPI numbers, no labels.

---

## 5. Colour and lighting, per theme

All artwork colour comes from CSS custom properties. The SVG declares no literal
hex except pure `#fff` / `#000` used at low opacity inside `<linearGradient>` stops
for highlight and shade, which is theme-safe.

### 5.1 Shared light rig

Single key light from **upper-left, ~45°**, matching the top-left-to-bottom-right
reading direction of the hero copy. Ambient fill from the lower-right at ~25%. One
rim hairline along the top-right ridge. Same rig in both themes — only the values
change, never the direction. Light direction is a brand constant: every future
illustration uses upper-left key.

### 5.2 Play (dark, `--accent #e2001a`)

The mouse is a **light-grey object on a near-black page**. Counter-intuitive but
correct: on `--bg #0a0a0c` a dark mouse disappears, and the current hero does
exactly that — a transparent body with a `--border-control #46464b` hairline, which
is why it reads as a wireframe rather than an object.

- Shell top plane: `--surface-elevated` lifted ~18% toward white.
- Mid flank: `--surface-elevated`.
- Shadow flank / thumb rest: `--surface` to `--surface-sunken`.
- Seams: `--bg` at 80% opacity for the dark half, white at 8% for the light half.
- Contact shadow: black at 55%, 16px blur, 4px down-right offset.
- **Accent, emissive:** the scroll wheel glows `--accent`, plus a **single soft
  underglow bloom** beneath the left flank (the light spill from the side-pad LEDs),
  rendered as one blurred ellipse at `--accent` / 30%. This is the one place the
  artwork is permitted to look like gaming, and it is the correct place: Play is the
  gaming face.
- The 12 keys themselves stay **unlit grey** — lit keys plus a lit wheel plus a
  bloom is three accent events and tips into cheap. One emissive source, one spill.

### 5.3 Pro (light, `--accent #b01020`)

The mouse is a **mid-grey object on a near-white page**, and this is where the
current artwork is weakest: a white body with a `#b9bec6` hairline on a `#ffffff`
card is close to invisible in the rendered screenshot.

- Shell top plane: white to `--surface-sunken`, i.e. the lit plane is barely below
  page white, so the object still reads bright.
- Mid flank: a true mid grey around 12–15% darker than `--surface-sunken`.
- Shadow flank / thumb rest: ~28% darker. This step is what separates the object
  from the page; do not be timid with it.
- Seams: near-black at 18%, paired with white at 60%.
- Contact shadow: black at 14%, 20px blur, 5px down-right. Softer and wider than
  Play — light-theme shadows are diffuse, not dark.
- **Accent, non-emissive.** Turn the LEDs **off**. Nothing glows in Pro. Instead the
  red appears exactly twice, as pigment rather than light:
  1. the scroll wheel rendered as a **solid `--accent` rubber wheel** — a coloured
     component, the way a red scroll wheel appears on professional hardware, with
     its own top highlight and bottom shade so it reads as a physical part;
  2. a **single `--accent` hairline** along the leading edge of the thumb-pad plate,
     as an anodised trim line.

  This is the key theme distinction and worth stating plainly: **Play lights the red,
  Pro colours it.** Same hue family, same placement, different physics. A glow says
  gaming rig; a red anodised component says tool. That distinction alone carries the
  "best productivity mouse" positioning in a 200px illustration.

- Do **not** reuse Play's bloom at lower opacity in Pro. A dimmed glow on white reads
  as a rendering artefact. Remove the element entirely via the theme.

### 5.4 Implementation

Give the hero SVG classed elements and drive everything from the stylesheet, as the
existing `.hero-art .shell / .line / .lit / .pad` pattern already does. Add a
`.hero-art .glow` that is `opacity: 1` in Play and `display: none` under
`:root[data-theme="pro"]` and the `prefers-color-scheme: light` block — matching how
`--accent-glow` is already set to `none` rather than dimmed in Pro (styles.css:99,
:134). Follow that precedent exactly; it is the established pattern for this site.

---

## 6. Consistency rules for anything drawn later

These bind all future MouseConfig artwork — spot illustrations, empty states, docs
diagrams, the product page for the owner's own mouse.

**Geometry**
- Corner radius ratio: **21.9%** of the shorter side (from the mark's `rx="14"` on a
  64 grid). Applies to tiles, plates, and key caps. Keys in the side pad: radius =
  25% of the key's shorter side.
- Perspective: three-quarter, **35° azimuth / 30° elevation**, nose up-left. Every
  hardware illustration uses this camera. Non-hardware diagrams may be orthographic.
- Light: **upper-left key at 45°**, always. No exceptions, including on diagrams.

**Stroke weight**
- Express strokes as a fraction of the viewBox so they scale predictably. The mark
  is `3.2 / 64 = 5%`. Keep that for the mark.
- Hero and any shaded illustration: **outer contour 0%** (no outline — form is
  tonal), **panel seams 0.9% of viewBox width**, **detail lines 0.6%**.
- At any size, an optical stroke thinner than **1.25 CSS px at 1x** is forbidden —
  it will drop out on non-retina displays. Check before shipping.

**Detail per size** — this is the ladder; pick the tier, do not interpolate:

| Tier | Size | Treatment |
|---|---|---|
| A | ≤ 20px | Silhouette + at most 1 interior mark. No shading. No dots. |
| B | 21–64px | Mark as specified: silhouette, seam, wheel, 3 side dots. Flat. Two colours. |
| C | 65–320px | Shaded vector. 4 tone steps. Contact shadow. One accent event. All of §4.1. |
| D | > 320px | Tier C plus: material texture on the thumb rest, wheel ribbing, port detail, a second specular. Still vector. |

The hero at 144–216px sits in Tier C. **Do not author it at Tier D detail and
scale it down** — it will silt up. Author for the size it renders at.

**What earns the accent colour**
Red is scarce. An element earns `--accent` only if it is one of:
1. the brand tile background;
2. **exactly one** light-emitting or coloured component per illustration (plus its
   single spill in Play only);
3. an interactive/selected state in UI, which is out of this brief's scope.

Inert plastic is never red. If an illustration has two red things, one of them is
wrong.

---

## 7. Verdict on the current artwork

### 7.1 The mark — mostly right, one real bug

**Keep:**
- The rounded accent tile with white glyph. It is legible at 16px, it holds up as a
  favicon, and it gives the nav a solid anchor. The `rx` is well judged.
- The three-dot side-button column. It is the one idea in the identity that says
  *MMO mouse* rather than *mouse*, and it survives to ~20px. This is the strongest
  asset in the current system and should be the thing the identity is built around.
- The overall stroke weight (3.2/64). Correct for the size.

**Fix:**
- **Bug, ship this regardless of any redesign: the nav copy and the file copy have
  diverged.** `public/brand/mark.svg` draws the dots at `cx="12"` with
  `fill="#fff"`. The inline nav SVG in `index.html` draws them at `cx="9.5"` with
  `fill="currentColor"` — and `.brand-mark` sets `color: var(--accent)`, so the dots
  are **red on a red tile, i.e. invisible in the nav**. Confirmed in both rendered
  screenshots: the nav mark shows only the white outline. The signature element of
  the mark is missing from its most-seen placement. Make the dots
  `var(--on-accent)`, restore `cx="12"` so they sit inside the tile with proper
  clearance, and make the two copies byte-identical.
- The silhouette is a **symmetric capsule** — an ambidextrous blob. Give it the
  right-handed asymmetry from §1.1. Cheap, and it is the only realism the mark needs.
- The full-length centre seam bisects the body end to end. Terminate it at ~58%.
- The short vertical wheel stub is ambiguous at 16px. Make it a filled rounded
  capsule rather than a stroked line.

### 7.2 The hero — the concept is right, the execution is an icon

**Keep:**
- The composition: single object, generous space, right side of the hero, hidden on
  mobile. That is a sound layout decision and should not change.
- The 12-count. The grid does show twelve. The count is correct.
- The CSS-variable theming approach (`.shell` / `.line` / `.lit` / `.pad`). This is
  exactly the right architecture and the new artwork should extend it, not replace it.

**Weak:**
1. **The side pad is on the top face.** The factual error, and the reason it fails
   the owner's "real life look" test with anyone who owns one of these mice.
2. **The body is a transparent stroked outline**, so it reads as a wireframe
   diagram, not an object. No volume, no light, no weight.
3. **Symmetric silhouette** — same ambidextrous-blob problem as the mark, but far
   more visible at 200px where asymmetry is affordable.
4. **No contact shadow**, so the object floats.
5. **The `.lit` capsule** floats on the top face rather than sitting in a wheel slot,
   and at `12×26` units it is oversized for a scroll wheel — it reads as a button.
6. **The red arc at the base** (`d="M43 179a40 40 0 0 0 54 0…"`) is unreadable. It is
   presumably a rear LED strip; at this scale it reads as a stray stroke. Cut it.
7. **The three lines at `x="86"`** have no referent — they are decoration standing in
   for detail. Cut them; replace with the DPI buttons, which are real.
8. **Pro theme legibility**: white `--surface-elevated` fill, `#b9bec6` hairline, on
   a white card. The object nearly vanishes. §5.3 fixes this.

**Verdict:** rebuild the hero rather than patch it. The layout, the theming hooks and
the 12-count survive; the drawing does not.

---

## 8. Acceptance checklist

The hero ships when all of these are true:

- [ ] Three-quarter view; the 12-key pad is on the left flank and fully countable.
- [ ] Right-handed asymmetry is unmistakable.
- [ ] Filled tonal planes, 4 steps, no outer contour stroke.
- [ ] Contact shadow present in both themes.
- [ ] Scroll wheel sits in a slot; DPI buttons present; cable or port at the nose.
- [ ] Play: wheel emissive + one soft bloom. Pro: wheel solid red, no glow anywhere.
- [ ] Screenshot at 144px and at 216px, both themes — every key still separable,
      no stroke below 1.25px at 1x.
- [ ] No vendor logo, emblem or recognisable trade dress anywhere in the file.
- [ ] Artwork colours come only from CSS custom properties (plus white/black opacity
      stops inside gradients).
- [ ] Theme switch from the nav produces no flash, no reflow, no stale colour.

The mark ships when:

- [ ] `public/brand/mark.svg` and the inline nav SVG are identical.
- [ ] The three dots are visible in the nav (`var(--on-accent)`, `cx="12"`).
- [ ] Legible and identifiable at 16px on a 1x display, checked as an actual favicon.
- [ ] At most 6 shapes inside the tile; no shading, no gradient, no cable, no shadow.
