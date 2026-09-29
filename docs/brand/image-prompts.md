# MouseConfig image prompt pack

Prompts for generating photorealistic imagery of a 12-side-button productivity/MMO
mouse, matched to the MouseConfig site (Play theme `#0b0b0c` / `#e2001a`, Pro theme
`#f4f5f7` / `#b01020`).

Written September 2026. Model behaviour moves fast — re-check the two or three
model notes below before a big run.

- [0. Read this first](#0-read-this-first)
- [1. Which generator](#1-which-generator)
- [2. The canonical object description](#2-the-canonical-object-description-copy-this-verbatim)
- [3. The shots](#3-the-shots)
- [4. Holding the product consistent](#4-holding-the-product-consistent-across-generations)
- [5. The twelve buttons — the hard part](#5-the-twelve-buttons--the-hard-part)
- [6. Honesty and legal constraints](#6-honesty-and-legal-constraints)
- [7. What to do with the output](#7-what-to-do-with-the-output)
- [8. Is a generated hero actually better than the SVG?](#8-is-a-generated-hero-actually-better-than-the-svg)

---

## 0. Read this first

Three things govern every prompt in this file:

1. **No brand marks, ever.** The site states it is unaffiliated with Redragon. The
   mouse in these images is an unbranded industrial-design study. Every prompt
   carries "no logos, no brand names, no text on the product" and every generated
   image gets checked for hallucinated lettering before it ships. See §6.
2. **The mouse does not exist yet.** These are illustrative renders for a hero and
   for social cards. They must not be used anywhere a buyer would reasonably read
   them as photographs of a shippable product. See §6.
3. **Generators cannot count to twelve.** Plan for the button pad to come out wrong
   most of the time and plan the fallback before you start. See §5.

---

## 1. Which generator

Primary versions below are written for **Nano Banana Pro** (Gemini 3 Pro Image) and
**Seedream** (5.0 Pro / 4.5). Both were, as of this writing, the two models being
recommended specifically for product and catalogue imagery — Nano Banana Pro for
batch-to-batch consistency and multi-reference control (up to ~14 reference images),
Seedream for 4K commercial-catalogue realism and multi-image campaign sets. **FLUX.2
[pro]** is the third option and the best one if you want high-resolution output cheaply
in bulk.

| | Nano Banana Pro | Seedream 5.0 / 4.5 | FLUX.2 [pro] |
|---|---|---|---|
| Prompt style | Long natural-language paragraph; it reads instructions, so you can tell it "exactly twelve, arranged four rows by three columns" and it will at least try | Long natural language, responds well to explicit camera/lighting spec | Subject + action + style + context, **30–80 words works best**; word order matters, earliest terms weighted highest |
| Negative prompt | No separate negative field — fold exclusions into the prompt as positive statements | No reliable separate negative field on most hosts; same approach | **No negative prompt field at all.** BFL's own guidance: say "sharp focus throughout", not "no blur" |
| Aspect ratio | `aspect_ratio` (1:1, 16:9, 9:16, 21:9, 3:2 …), `resolution` 1K / 2K / 4K | Ratio string + native 4K | `width`/`height` in multiples of 16, up to 4MP; ratios 21:9 → 9:21 |
| References | ~14 images | ~10 images | up to 8 at 1MP output (fewer at higher res) |
| Seed | Exists, but **treat reproducibility as weak** — reported to vary background, perspective and styling noticeably across seeds even with the same prompt | Seed available; more stable within a batch | Seed integer up to 4294967295, the most seed-stable of the three |

**Portable prompt discipline.** Every prompt is written as prose that works on all
three. The "negative prompt" block is kept separate because Midjourney (`--no`) and
Stable-Diffusion-family models take it literally, while on Nano Banana Pro / Seedream /
FLUX.2 you **rewrite it as the positive sentence given underneath and append it to the
main prompt**. Do not paste a "no X, no Y" list into FLUX.2 — it will draw X and Y.

**Midjourney adaptation** (v7-era syntax, if the owner prefers it): append
`--ar 16:9 --style raw --stylize 120 --no logo, text, watermark, extra buttons` and
use `--sref` plus `--cref`-style reference pinning for consistency. Midjourney gives
the prettiest lighting of the four and the worst button count; treat it as a source of
hero *mood*, not of hero *accuracy*.

---

## 2. The canonical object description (copy this verbatim)

The single biggest lever on consistency is that the physical object is described with
**the same words in the same order every time**. Do not paraphrase between shots. This
block is the product bible; the per-shot prompts wrap it.

> A modern right-handed ergonomic computer mouse, unbranded, matte charcoal-black
> polycarbonate shell with a soft satin finish, gently arched back rising to a high
> hump toward the rear, a pronounced thumb shelf on the left side, two separated
> primary click plates with a narrow seam down the centre, a rubberised scroll wheel
> recessed between them with a thin crimson light strip glowing inside it, one small
> oval DPI button behind the wheel, a square honeycomb-textured grip panel on the right
> flank, a low-profile braided cable exiting the front nose, and on the left flank a
> flat rectangular side panel carrying a keypad of exactly twelve small square buttons
> laid out in four rows of three columns, each button a slightly domed square with a
> 1 mm gap between neighbours, faintly backlit crimson from beneath.

Colour anchors to use verbatim when needed: `#0b0b0c` near-black, `#e2001a` crimson
accent (Play), `#f4f5f7` cool off-white, `#b01020` deeper oxblood red (Pro).

---

## 3. The shots

Five shots. Each earns its place: one hero per theme, one social card, one proof shot
of the feature the whole product is about, one credibility shot for the productivity
positioning.

---

### Shot 1 — Play hero (dark)

**Purpose.** Replace or complement the inline SVG hero art on the dark Play theme.
Sits to the right of the H1 at roughly 420×600 CSS px in the current layout.
**Where used.** `index.html` hero, Play theme only.

**Prompt**

> Studio product photograph of a modern right-handed ergonomic computer mouse,
> unbranded, matte charcoal-black polycarbonate shell with a soft satin finish, gently
> arched back rising to a high hump toward the rear, a pronounced thumb shelf on the
> left side, two separated primary click plates with a narrow seam down the centre, a
> rubberised scroll wheel recessed between them with a thin crimson light strip glowing
> inside it, one small oval DPI button behind the wheel, a square honeycomb-textured
> grip panel on the right flank, a low-profile braided cable exiting the front nose, and
> on the left flank a flat rectangular side panel carrying a keypad of exactly twelve
> small square buttons laid out in four rows of three columns, each button a slightly
> domed square with a 1 mm gap between neighbours, faintly backlit crimson from beneath.
> The mouse is turned three-quarters toward the camera with its left flank and the
> twelve-button pad clearly visible and in focus. It floats on a seamless near-black
> background, hex #0b0b0c, with no visible horizon line. Lighting is a large soft
> overhead key from camera left, a tight crimson rim light along the right edge of the
> shell picking out the silhouette, and a second dim cool rim on the left for
> separation; deep controlled shadows, specular highlights reading as long soft streaks
> on the satin plastic. Shot on a Hasselblad X2D with an 80 mm lens at f/8, focus
> stacked so the entire body is sharp, camera slightly above the mouse at a 20-degree
> downward angle. Low-key commercial advertising aesthetic, crimson #e2001a as the only
> saturated colour in the frame, neutral cool grey shadows, clean and restrained. The
> product surface is completely blank — no logos, no brand names, no printed lettering,
> no icons of any kind anywhere on the mouse. Generous empty background space on the
> right third of the frame.

**Negative prompt** (Midjourney / SD family)

> text, lettering, logo, brand name, watermark, signature, numbers on buttons, RGB
> rainbow lighting, gamer neon, blue LEDs, reflective glossy plastic, cluttered
> background, desk surface, hands, fingers, multiple mice, warped perspective, fisheye,
> distorted symmetry, extra buttons, missing buttons, smeared keypad, jpeg artifacts,
> chromatic aberration

**FLUX.2 / Nano Banana Pro / Seedream equivalent** — append instead:

> Every surface is unlabelled and blank. The only light colour in the scene is crimson;
> all other lighting is neutral white. The background is empty seamless black with
> nothing else in the frame. A single mouse, no hands, no desk.

**Settings.** `aspect_ratio 3:2` (or 2:3 if you want a portrait hero closer to the
current SVG's 140×200 proportion), resolution 2K minimum — generate large and
downscale, it hides the plastic-texture tells. Fix the seed once you like a result.

---

### Shot 2 — Pro hero (light)

**Purpose.** The same mouse on the light Pro theme, so the two themes read as one
product photographed twice, not two products.
**Where used.** `index.html` hero, Pro theme only.

**Do this as an edit, not a fresh generation.** Feed the *approved* Shot 1 image in as
a reference and change only the environment. That is far more reliable than re-rolling
the description. Prompt:

> Using the attached mouse exactly as it is — identical shape, identical proportions,
> identical twelve-button side pad in four rows of three, identical cable and scroll
> wheel — re-light and re-photograph it on a clean seamless cool off-white background,
> hex #f4f5f7. High-key studio lighting: a large softbox directly overhead and a second
> from camera left, two white bounce cards filling the shadow side, producing soft open
> shadows and a faint contact shadow directly beneath the mouse. The scroll-wheel light
> strip and the side-pad backlighting glow a deeper oxblood red, hex #b01020, at low
> intensity. Same camera position and same three-quarter angle as the attached image,
> 80 mm lens at f/8, focus stacked. Bright, calm, editorial product photography for a
> professional software product. The product surface is completely blank — no logos, no
> brand names, no printed lettering anywhere.

**Negative prompt** (MJ / SD)

> text, logo, brand name, watermark, grey background, dark background, harsh shadows,
> blown highlights, colour cast, different mouse shape, changed button layout, extra
> buttons, hands, desk clutter

**Positive rewrite for models without a negative field:**

> The background is pure even off-white with nothing else in it. Shadows stay soft and
> open with detail retained; highlights stay under control. Shape and button layout are
> unchanged from the reference.

**Settings.** Same aspect ratio and resolution as Shot 1 — the two heroes must crop
identically or the theme switch will jump. If your host exposes an image-strength /
denoise control, keep it low (≈0.25–0.35) so geometry survives.

---

### Shot 3 — Open Graph / social share card (1200×630)

**Purpose.** The link preview on X, LinkedIn, Slack, Discord, iMessage.
**Where used.** `og:image` / `twitter:image`.

**The constraint that matters:** it will most often be seen at roughly 300 px wide in a
timeline. So: one large subject, hard silhouette, strong colour contrast, nothing in
the outer 5% (platforms crop), and **no small text baked into the image**. Put the
wordmark on afterwards in vector, not in the generator — none of these models can be
trusted with brand typography, and a misspelled "MouseConfg" on every share is a
permanent embarrassment.

**Prompt**

> Wide cinematic product photograph, 1200 by 630 proportions, of a modern right-handed
> ergonomic computer mouse, unbranded, matte charcoal-black polycarbonate shell with a
> soft satin finish, high arched rear hump, pronounced left thumb shelf, two separated
> click plates, a recessed rubberised scroll wheel with a thin crimson light strip
> glowing inside, and on the left flank a flat rectangular side panel carrying a keypad
> of exactly twelve small square buttons laid out in four rows of three columns, faintly
> backlit crimson. The mouse sits large in the right half of the frame, turned
> three-quarters toward the camera so the twelve-button flank faces the viewer, cropped
> so the cable leaves the frame. Seamless near-black background, hex #0b0b0c, with a
> very subtle dark radial falloff toward the corners. Dramatic low-key lighting: one
> large soft key from upper camera left, a strong crimson rim light hex #e2001a tracing
> the entire top edge and right silhouette of the shell, a faint crimson pool of glow on
> the surface beneath. Shot on an 85 mm lens at f/5.6, eye-level with the mouse, shallow
> falloff at the edges of frame. The left half of the frame is empty dark negative space
> reserved for a logo to be added later. Bold, high-contrast, legible as a small
> thumbnail. The product is completely blank — no logos, no lettering, no text anywhere
> in the image.

**Negative prompt** (MJ / SD)

> any text, letters, words, watermark, logo, UI elements, browser window, busy
> background, low contrast, subject too small, centred composition, multiple objects,
> border, frame, vignette artifacts

**Positive rewrite:**

> The frame contains one object only, filling the right half, against empty dark space
> on the left. No writing of any kind appears anywhere in the image.

**Settings.** Generate at 16:9 or 1.91:1 at 2K and crop to exactly 1200×630. Then
composite the MouseConfig wordmark and mark (`public/brand/mark.svg`) into the left
negative space as vector before export. **Check it at 300 px wide** before shipping —
if the twelve buttons turn to mush at thumbnail size, that is fine and expected; if the
silhouette turns to mush, re-roll.

---

### Shot 4 — Twelve-button side pad, macro detail

**Purpose.** This is the product's entire thesis. It is also the shot most likely to
fail (§5) — but it is the one worth fighting for, because a macro crop is the *easiest*
place to get twelve buttons right (they are large in frame) and the easiest place to
retouch if not.
**Where used.** The productivity-mapping guide page, feature section, possibly a second
social card.

**Prompt**

> Extreme close-up macro product photograph of the left side panel of an unbranded matte
> charcoal-black ergonomic computer mouse. The panel is a flat rectangle filling most of
> the frame, and it carries a keypad of exactly twelve small square buttons. The buttons
> are arranged in a strict rectangular grid: four rows stacked vertically, three columns
> across — row one has three buttons, row two has three buttons, row three has three
> buttons, row four has three buttons, twelve buttons in total and no others. Each
> button is a slightly domed square of matte black plastic with crisply chamfered edges
> and a one-millimetre dark gap separating it from its neighbours, lit faintly from
> beneath by a thin crimson glow leaking around each edge, hex #e2001a. Above the grid
> the charcoal shell curves away out of focus; below it a pronounced thumb shelf catches
> a soft highlight. Lighting is a single large softbox from upper camera left raking
> across the panel to reveal the soft-touch texture of the plastic, plus a subtle crimson
> rim along the top edge, against a near-black seamless background hex #0b0b0c. Shot on
> a 100 mm macro lens at f/11, focus stacked so every button in the grid is tack sharp,
> camera perpendicular to the panel and perfectly square to it so the grid reads as a
> clean rectangle with no perspective keystoning. Precise, technical, tactile,
> high-end industrial-design photography. The buttons are completely blank — no numbers,
> no letters, no symbols, no icons printed on them.

**Negative prompt** (MJ / SD)

> numbers on buttons, letters on buttons, icons, text, logo, watermark, uneven grid,
> irregular spacing, five buttons, nine buttons, ten buttons, sixteen buttons, merged
> buttons, smeared keys, circular buttons, keyboard keys, calculator, phone keypad,
> perspective distortion, tilted grid, shallow depth of field, blurred buttons

**Positive rewrite:**

> Each of the twelve buttons is blank and unmarked. The grid is perfectly regular, four
> rows by three columns, with even spacing and every button the same size and the same
> square shape. The whole grid is in sharp focus and square to the camera.

**Settings.** `aspect_ratio 3:2` or 1:1, 2K–4K. Generate at least 12–16 candidates;
expect to keep one or two. See §5 before you start.

---

### Shot 5 — On a real desk (productivity lifestyle)

**Purpose.** Carries the positioning. This shot is what says "best productivity mouse"
rather than "gaming peripheral" — so the context is an adult working desk, not an RGB
battlestation.
**Where used.** Productivity guide page header, About/positioning section, a social
card variant for a productivity audience.

**Prompt**

> Natural-light lifestyle photograph of a tidy modern home-office desk in the late
> afternoon. On a pale oak desktop sits a modern right-handed ergonomic computer mouse,
> unbranded, matte charcoal-black polycarbonate shell with a soft satin finish, high
> arched rear hump, pronounced left thumb shelf, a recessed rubberised scroll wheel with
> a thin crimson light strip glowing inside, and on its left flank a flat rectangular
> side panel carrying a keypad of exactly twelve small square buttons laid out in four
> rows of three columns, faintly backlit crimson. The mouse is the sharp foreground
> subject in the right third of the frame, angled so its twelve-button flank faces the
> camera, resting on a dark grey felt desk mat. Behind it and softly out of focus: the
> lower edge of a slim aluminium laptop showing an indistinct bright spreadsheet, a low
> mechanical keyboard in muted grey, a ceramic mug of black coffee, a closed notebook
> and a pen, and a small trailing plant near a window. Warm directional daylight enters
> from a window at camera left, raking across the desk, throwing a long soft shadow to
> the right and catching a warm highlight along the mouse's arched back; the room
> beyond is calm and neutral in tone. Shot on a 50 mm lens at f/2.2, camera low and
> close at desk height, shallow depth of field with only the mouse and the mat in focus,
> creamy background falloff. Warm neutral colour grade, muted greys and oak tones with
> crimson as the single accent, quiet and professional, editorial workplace photography.
> Candid and unstyled, no gaming decor. The mouse and every visible device are
> completely blank — no logos, no brand names, no readable text anywhere in the image.

**Negative prompt** (MJ / SD)

> RGB lighting, neon, LED strips, gaming chair, headset, dual curved monitors, dark room,
> cluttered desk, cables tangled, logo, brand name, readable text, screen UI, watermark,
> hands, person, oversaturated, HDR halo, tilt-shift, fake bokeh balls

**Positive rewrite:**

> The room is calm and neutral, lit only by daylight. The desk holds only the items
> listed and nothing else. All screens and devices are blank or too defocused to read,
> and no writing appears anywhere. Nobody is in the frame.

**Settings.** `aspect_ratio 3:2` or 16:9, 2K. This shot tolerates a wrong button count
far better than the others — at f/2.2 with the pad slightly turned, "roughly a dense
grid of small buttons" reads correctly to the eye. It is the cheapest of the five to
get right, and a good one to shoot first to lock the object's look.

---

## 4. Holding the product consistent across generations

Ranked by how much they actually help.

**1. Reference images. This is the technique that matters.** Pick one approved
generation as the canonical hero, then produce every other shot as a reference-guided
edit of it rather than a fresh text-to-image roll. All three primary models take
multiple references (Nano Banana Pro ~14, Seedream ~10, FLUX.2 [pro] up to 8), and this
is the only method here that reliably preserves silhouette, proportion and finish.
Practical order: generate Shot 5 or Shot 1 until the object itself is right → that
becomes `ref-hero.png` → Shots 2, 3, 4 are all edits of it. Reliability: good for
overall shape and colour, moderate for fine detail, **poor for the button count**,
which drifts even under reference guidance.

**2. The verbatim canonical description (§2).** Same words, same order, every prompt.
These models weight early tokens more heavily (explicitly so on FLUX.2), so re-ordering
the clauses genuinely changes the object. Paraphrasing is how you end up with three
different mice. Reliability: good, and free.

**3. A one-frame "turnaround sheet" as a second reference.** Once you have an approved
hero, generate a single 3×1 image — same mouse from left, three-quarter and top — and
keep it as a permanent second reference attached to every subsequent prompt. This helps
the model understand the object in the round instead of re-inventing the hidden side.
Reliability: moderate-to-good; it is the trick catalogue shoots use.

**4. Image-to-image from the site's own SVG.** You can render the `hero-art` SVG to PNG
and feed it as a structural reference. Honest assessment: **this is good for silhouette
and for pad placement, and it is the most reliable way to get a correct 4×3 grid into
the frame** (§5), but it will not give you a convincing photograph on its own — the SVG
is a flat top-down line drawing and the model has to invent all the three-dimensional
form. Use it as a *layout* reference at low strength alongside a photographic reference,
or use it for compositing rather than for generation.

**5. Seeds. Least reliable of the five — do not build the plan on them.** A fixed seed
plus an unchanged prompt gets you a near-identical image on FLUX.2 (seed integer up to
4294967295), but the moment you change a word the image changes wholesale. Nano Banana
Pro in particular has been reported to vary background, perspective and styling
substantially across seeds. Seeds are useful for *re-fetching a result you liked* and
for A/B-ing one changed clause; they are not a cross-shot consistency mechanism.

**What none of this gives you:** guaranteed identity. Budget for the dark and light
heroes to need a manual pass in an editor (colour-match the shell, align the crop) so
they genuinely read as the same object across the theme switch.

---

## 5. The twelve buttons — the hard part

**Say it plainly: generators cannot count to twelve, and this will be the main cost of
the project.** Ask for twelve buttons in a 4×3 grid and you will get nine, or fourteen,
or a smeared block of bumps, or a perfect 3×4 grid with one extra half-button hanging
off the bottom. This is not a prompt-quality problem, it is a known and measured
limitation: benchmark work through 2025–2026 (NumBench, "Make It Count", CountLoop)
shows text-to-image models fail systematically on exact object counts, and that **prompt
refinement alone does not fix it** — one study tested explicit grid-refinement prompts
("2 by 7 apples") and found nearly every model failed to honour both numbers.

The findings do point one useful direction: **coordinated grid layouts fail less badly
than free-form scatter**. Counts in the low teens are the survivable range, and a
regular grid measurably narrows the gap. So the odds are improvable, just not to 100%.

### Prompt strategies that improve the odds

- **State the count three ways in one sentence.** Total, then structure, then
  row-by-row enumeration: *"exactly twelve small square buttons, arranged in four rows
  of three columns — row one has three buttons, row two has three, row three has three,
  row four has three, twelve in total and no others."* Redundant enumeration is the
  single most effective phrasing trick available.
- **Add the closing "and no others."** Models tend to over-produce; an explicit
  termination clause helps slightly.
- **Make the pad big in frame.** The macro shot (Shot 4) succeeds far more often than
  the wide hero, because the pad occupies enough pixels for the structure to resolve.
  Counting accuracy collapses as instances get smaller. Generate the pad at macro scale
  even if you need it small.
- **Square the camera to the panel.** Perspective keystoning makes the model lose the
  grid. "Camera perpendicular to the panel, no perspective distortion" earns its place.
- **Describe the gaps, not just the buttons.** "A one-millimetre gap between
  neighbours" produces separated keys instead of a merged waffle.
- **Use the reasoning-capable model.** Nano Banana Pro follows structured counting
  instructions noticeably better than diffusion-only models, because it reasons over
  the prompt before rendering. If one model is going to land a 4×3 grid, it is that one.
- **Generate in volume and select.** 12–20 candidates per pad shot, then pick. This is
  the real workflow. Budget for it.
- **Never ask for the count in text.** Do not let it print "12" on the product.

### The fallback plan — decide this now, not after 200 failed generations

Ranked, cheapest first:

1. **Crop or angle it away.** In Shot 5 (lifestyle) and in the OG card at thumbnail
   size, a slightly turned, partly shadowed pad reads as "lots of buttons" and nobody
   counts. Use generated pads only where they are small or oblique.
2. **Retouch the winner.** Take the best generated pad, then in an editor clone one
   clean button and stamp a correct 4×3 grid over the generated one, matching the
   original's lighting gradient. Twenty minutes of work, completely reliable, and the
   lighting is already right because you are reusing the model's own pixels.
3. **Composite the pad from the SVG.** The `hero-art` SVG already contains a
   geometrically perfect 4×3 grid of twelve rounded rectangles at `x=36/48/60`,
   `y=90/105/120/135`. Render it, perspective-transform it onto the generated flank,
   then add a soft inner shadow, a specular gradient matching the key light, and the
   crimson under-glow. This is the guaranteed-correct route for the macro shot and is
   what to reach for if selection fails.
4. **Give up on photoreal for the pad and keep the vector.** Perfectly legitimate: a
   photographic hero with a clean vector-diagram callout of the twelve buttons beside it
   is honest, correct, and arguably communicates the feature better than a macro photo
   does. See §8.

---

## 6. Honesty and legal constraints

**No brand identity, actual or implied.** The site states it is unaffiliated with
Redragon. Therefore:

- Every prompt above carries an explicit no-logo clause, and every output gets a
  zoomed check for hallucinated lettering, fake logos, and invented model numbers
  before it ships. Generators routinely stamp plausible-looking gibberish brand marks
  onto product surfaces.
- Do not prompt with "Redragon", "M913", or any other manufacturer's name, and do not
  feed a photograph of a real Redragon mouse as a reference image. Generating a
  recognisable replica of a specific commercial product and using it in your own
  marketing is the exact risk this whole pack exists to avoid. The design described in
  §2 is deliberately generic — an ergonomic shell with a 4×3 thumb pad is a whole
  product category, not one company's design.
- The same applies to the props in Shot 5: no readable laptop logos, no recognisable
  keyboard branding.

**Do not misrepresent an unmanufactured product.** Where each shot is and is not fair:

| Use | Verdict |
|---|---|
| Hero art on the homepage, clearly the site's own illustration of what it configures | **Fine.** This is decorative/illustrative. |
| OG/social card | **Fine**, same reasoning. |
| Feature or guide page illustrating how a 12-button pad is laid out | **Fine.** |
| Press or launch page for "the Panther Tech productivity mouse" | **Only with a visible label** such as "Design render — not a photograph." |
| A store page, pre-order page, crowdfunding page, or anything with a price and a buy button, for a mouse that has not been manufactured | **Not acceptable.** A generated render presented as product photography to someone about to pay is deceptive, and in most jurisdictions is a straightforward consumer-protection problem. Ship real photographs of real hardware, or label the render unmistakably and prominently. |

**One more.** The current site sells nothing and configures a third-party mouse. The
moment the owner's own mouse has a buy path, this table stops being advice and starts
being compliance. Revisit it then.

---

## 7. What to do with the output

**Formats and sizes**

| Asset | Export | Sizes |
|---|---|---|
| Play hero | AVIF + WebP, `<picture>` with AVIF first | 1x and 2x of the rendered box (≈420×600 and 840×1200) |
| Pro hero | same | same, identical crop to the Play hero |
| OG card | **PNG or JPEG only** — several platforms still do not render AVIF/WebP previews | exactly 1200×630, one file |
| Pad macro | AVIF + WebP | 2x of its rendered width, no larger |
| Lifestyle | AVIF + WebP | 2x of rendered width |

**Weight budget.** The site scores 100 on Lighthouse performance; a careless hero will
cost it. Targets: **hero ≤ 60 KB** for the AVIF at 1x, ≤ 120 KB at 2x; **OG card ≤ 200
KB** (it is not on the critical path, but Slack and Discord fetch it); in-page images
≤ 80 KB each. Rules that keep you there:

- Generate at 2K–4K, then **downscale hard** before encoding. Downscaling is what makes
  AVIF cheap and also conveniently destroys the fine plastic-texture artifacts that
  give AI renders away.
- AVIF at quality ~55–62 is usually indistinguishable here and roughly half the WebP
  size. Matte plastic on a flat background compresses extremely well.
- Always set explicit `width`/`height` so nothing shifts — CLS is part of that 100.
- The hero is the LCP element. Give it `fetchpriority="high"` and **do not** lazy-load
  it. Lazy-load everything below the fold.
- Watch the dark hero for banding in the background gradient. If it bands, add a touch
  of monochrome noise before encoding rather than raising quality — it is cheaper.

**The theme-switch problem, stated honestly.** The current hero is an inline SVG, so it
recolours instantly with CSS custom properties and costs zero bytes of network. A raster
hero cannot do that. Your options are all worse than what you have:

- Ship **two images** and swap them (`<picture>` with `prefers-color-scheme`, or a `src`
  swap on the theme toggle). Costs double the bytes, and unless you preload both, the
  first theme switch shows a visible pop or a blank gap.
- Ship **one image** that works on both backgrounds. Requires a transparent PNG/WebP
  with no background lighting — which throws away exactly the rim-lit drama that made
  you want a photograph.
- Keep the SVG for the hero and use raster only where the theme is fixed (OG card, guide
  pages). This is the cheapest option and the one that preserves the 100.

---

## 8. Is a generated hero actually better than the SVG?

My honest read, having looked at both themes rendered: **probably not for the hero
itself, and clearly yes for the social card.**

The case against a generated hero:

- The existing SVG is doing real work. It is theme-aware for free, weighs nothing, is
  crisp at every density, and — critically — **it shows exactly twelve buttons in a
  correct 4×3 grid, every time, because you drew it.** That is the product's entire
  proposition, rendered accurately, for zero effort. A generated hero puts your single
  most important product claim at the mercy of the one thing these models are worst at.
- A dark, minimal, line-art hero is also stylistically *correct* for what this site is:
  a fast, free, technical, open-source browser tool. A glossy advertising render would
  make it look like a storefront, which is a positioning downgrade, and it would sit
  oddly next to a page that explicitly configures somebody else's mouse.
- And the mouse does not exist yet. A photorealistic hero of a product you cannot ship
  is the shakiest of the five shots on §6 grounds.

Where generated imagery clearly wins:

- **The OG card.** The SVG cannot become a good 1200×630 social image — line art at
  thumbnail size disappears, and social previews are where visual richness buys actual
  clicks. This is the highest-value shot in the pack.
- **The lifestyle desk shot.** Nothing vector can do this, and it is what makes
  "productivity mouse" credible rather than asserted. Second-highest value.
- **The pad macro**, if and only if the count lands or gets composited — a tactile
  close-up sells the feature in a way a diagram cannot.

**What I would actually do:** improve the vector hero instead of replacing it — add
depth with a subtle gradient shell, a soft cast shadow, a proper glow on the scroll
strip and the pad, maybe an isometric three-quarter view instead of the current flat
top-down — and spend the generation budget on Shots 3 and 5, where raster genuinely
buys something the SVG can't. Then, if the owner's own mouse is ever manufactured,
photograph it for real and retire the renders entirely.
