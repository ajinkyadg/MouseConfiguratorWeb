# Hardware accuracy reference: drawing a 12-side-button MMO mouse

**Purpose.** This is the reference an illustrator draws MouseConfig's mouse
artwork from. The audience for that artwork is people who *own* an M913, an
M908, a Naga or a G600. They will forgive stylisation. They will not forgive
geometry that proves the artist has never had one under their hand.

**Status.** Research plus design judgement, clearly separated. Every dimension
taken from a published spec or review is cited inline. Every dimension I derived
myself is marked `[JUDGEMENT]` and is a *starting proportion to draw from*, not
a measurement — nothing here has been taken off real hardware with calipers.
If the owner's own mouse reaches a mechanical drawing, that file supersedes
this document for anything it covers.

**Companions.** [`../game-presets.md`](../game-presets.md) §2 defines the
numbering and the reachability tiers. §5 of this document is bound to that
model and must not drift from it. [`../professional-presets.md`](../professional-presets.md)
is the Pro-face counterpart.

**What exists today.** The hero illustration is an inline SVG in `index.html`
(`svg.hero-art`, viewBox `0 0 140 200`): a top-down silhouette with a 3-wide ×
4-tall grid of twelve identical rounded rectangles sitting on the shell's face.
The logo mark is `public/brand/mark.svg`. Both are icons, and §6.2 explains
precisely why the hero geometry cannot be fixed by redrawing it more carefully.

---

## 1. Anatomy and proportions

### 1.1 The published numbers

| Product | L × W × H (mm) | Weight | Source |
|---|---|---|---|
| Redragon M913 Impact Elite | 122.5 × 92 × 42 | 129 g (some listings 170 g) | [TechPowerUp](https://www.techpowerup.com/review/redragon-m913-impact-elite/3.html), [Tom's Hardware](https://www.tomshardware.com/reviews/redragon-m913-impact-elite) |
| Redragon M908 Impact | ~124 × 80 × 43 | 130–167 g, adjustable weights | [RTINGS](https://www.rtings.com/mouse/reviews/redragon/m908), [Redragon](https://redragonshop.com/blogs/community/redragon-impact-m908-vs-impact-elite-m913-an-in-depth-comparative-review-for-mmo-gamers) |
| Razer Naga Trinity | 119 × 74 × 43 | 120 g | [Razer master guide](https://dl.razerzone.com/master-guides/RazerSynapse3/NagaTrinity-00000103-en.pdf), [mousespecs](https://mousespecs.org/razer-naga-trinity/) |
| Logitech G600 | ~119 × 76 × 38 (4.7 × 3.0 × 1.5 in) | 133 g (4.7 oz) | [Legit Reviews](https://www.legitreviews.com/logitech-g600-mmo-gaming-mouse-review_2135/2) |
| Corsair Scimitar RGB Elite | ~119 × 77 × 42 | 122 g | [TechPowerUp](https://www.techpowerup.com/review/corsair-scimitar-rgb-elite-mouse/3.html) |

**The single most important number on that table is the M913's 92 mm width.**
Everything else in the category is 74–80 mm. The M913 is ~15 mm wider than a
Naga, and reviewers consistently name that as its defining physical trait —
"a remarkably wide mouse, which can make it difficult to pick it up during
play, as the side-button panel doesn't leave much room for the thumb"
([Tom's Hardware](https://www.tomshardware.com/reviews/redragon-m913-impact-elite)).
An MMO mouse is a normal mouse with a keypad bolted to its flank, and the
keypad costs real width. **Artwork that draws a slim, elegant silhouette is
drawing something else.**

### 1.2 Proportions to draw from

`[JUDGEMENT]` — derived from the table above, expressed as ratios so the
artwork scales:

- **Length : width : height ≈ 122 : 80 : 42**, or roughly **3 : 2 : 1**.
  Draw the 3:2:1 box first, then carve the shell out of it.
- **Body width without the pad ≈ 68–72 mm.** The pad and its housing add
  8–20 mm of width on the left flank. On the M913, that extra bulge is where
  most of the 92 mm goes.
- **The mouse is not symmetric.** The right flank is a simple concave scoop for
  the ring and little finger; the left flank is a vertical-to-slightly-undercut
  wall that carries the pad. Silhouette asymmetry is free credibility.
- **Hump apex sits 58–65% of the way back from the front tip**, not at the
  midpoint and not at the rear. Reviewers describe the M913 as having "a
  pronounced arch along the top shell that cradles the natural curve of the
  palm, combined with a gently sloped rear section that supports the heel of
  the hand" ([gdgtme](https://www.gdgtme.com/pc-hardware-reviews/redragon-m913-impact-elite-review/)).
  Front of the apex: a long, fairly straight descent to the click panel. Behind
  it: a short, steeper, slightly concave drop to the tail.
- **Front tip height above the desk ≈ 12–16 mm**; the shell does not come down
  to a knife edge. There is a visible lip and a visible shell parting line.

### 1.3 Parts list, front to back

**Main click panel.** Two separate, long trigger surfaces, split by a groove
that runs from the front lip back to roughly 45–50% of the body length. They
are *not* flush with the shell — on every mouse in the table they sit slightly
proud at the front and are dished along their length so the fingertip has a
resting hollow. The groove between them is the single most-recognised feature
of the top view and must be there.

**Scroll wheel.** Sits in the groove, front-of-centre — roughly 22–30% back
from the tip `[JUDGEMENT]`. Only a **3–5 mm sliver of the wheel's circumference
shows above the shell line**; the rest is inside the body. The exposed surface
is ribbed or rubber-treaded (the G600's is "textured", [Legit Reviews](https://www.legitreviews.com/logitech-g600-mmo-gaming-mouse-review_2135/2)),
and the shell opening around it is a recessed slot with visible depth, not a
painted-on rectangle. MMO wheels in this class tilt left and right as two extra
buttons — worth drawing the side gap that makes that possible.

**DPI buttons.** Immediately *behind* the wheel, on the centre spine, before
the hump starts rising. Usually two small buttons stacked fore-and-aft (up/down)
or one rocker. Small — roughly 6 × 4 mm `[JUDGEMENT]`. Note for the copy team:
on the M913, the DPI control is **not remappable** — the protocol exposes no
button index for it ([`../game-presets.md`](../game-presets.md) §1.1). The
artwork should therefore *not* highlight it as a configurable target if the
illustration ever becomes interactive.

**Palm hump and the left rise.** Behind the DPI cluster, the shell rises into
the hump, and on the left side it rises *faster* than on the right, forming the
wall that the pad is cut into.

**Right flank.** A concave scoop, usually with a small ledge or shelf near the
bottom for the little finger to ride on. The G600 and M908 also put a button
here: the G600's **G-Shift** key sits "on the far right, directly under your
ring finger" ([Legit Reviews](https://www.legitreviews.com/logitech-g600-mmo-gaming-mouse-review_2135/4)).

**Side grips.** Both flanks carry a grip inlay — a rubber pad or a moulded
texture (diamond, hex, or fine ribbing) in a distinct panel with a visible
boundary against the shell plastic. On the left this inlay is *below and behind*
the pad, where the thumb's base pad rests. This is one of the highest-value
details in §3.

**Cable / wireless cues.** The cable exits **dead centre of the front tip,
angled upward** — never straight out horizontally, or it drags. It is a braided
sleeve with a visible weave and a moulded strain-relief collar 10–15 mm long.
For the wireless face (the M913 is tri-mode), the alternative cues are a
USB-C receptacle in the same nose position, a small receiver-storage door or
magnetic dongle bay in the underside, and a mode switch on the belly. Do not
draw both a permanent cable and a wireless indicator.

**Underside and feet.** Three to four PTFE feet: a wide arc across the front,
a wide arc across the rear, and a ring around the sensor lens. They are a
different, brighter white-grey than the shell and have visibly rounded,
chamfered edges. The sensor lens sits **slightly forward of the geometric
centre** on most of this category `[JUDGEMENT]`. The M908 additionally has a
weight-cartridge door for its 130–167 g range ([RTINGS](https://www.rtings.com/mouse/reviews/redragon/m908)).

---

## 2. The thumb pad — the part everything depends on

This is the subject of the illustration. Everything in §1 is context for it.

### 2.1 Placement along the length

The pad's front edge starts roughly **25–32 mm back from the front tip**, and
its rear edge lands at roughly **72–80 mm back** `[JUDGEMENT]` — so the pad
occupies about **45–50 mm of length**, or **38–40% of the mouse**, sitting in
the front-of-middle third.

**The failure mode is putting it too far forward.** If the pad's front column
reaches past ~25 mm from the tip, the thumb cannot get to it without the wrist
rotating, and anyone who owns one of these will feel the wrongness before they
can name it. The reachability tiers in [`../game-presets.md`](../game-presets.md)
§2.2 exist *because* the rear columns already cost a grip shift — the pad is
placed as far back as the thumb tolerates, not as far forward as the shell
allows.

### 2.2 Placement in height

The pad's bottom row sits **8–12 mm above the desk plane**, and the top row
lands around **26–32 mm** `[JUDGEMENT]` — so the pad's vertical extent is
about **20–24 mm**, roughly half the mouse's height, in the lower-middle band
of the flank. There is shell above it (the rise to the hump) and shell below it
(the skirt down to the feet). A pad drawn flush to the bottom edge, or
occupying the full height of the flank, is wrong.

### 2.3 The pad is not flat, and this is the whole game

Three separate deformations stack, and a flat grid omits all three:

**(a) It wraps.** The pad follows the flank's curvature around a roughly
vertical axis. The centre columns face the viewer squarely; **the front and
rear columns rotate away by about 15–25°** `[JUDGEMENT]` and foreshorten. In a
true side elevation, the outer columns are visibly narrower than the inner ones
and their highlights fall differently.

**(b) It tilts toward the thumb.** The pad's surface does not face straight out
horizontally. It faces **outward and downward**, typically 10–20° off vertical
`[JUDGEMENT]`, so the buttons present themselves to a thumb that approaches
from below. Reviewers describe the M913's buttons as protruding "at an angle,
which makes them easier to tell apart by feel"
([gdgtme](https://www.gdgtme.com/pc-hardware-reviews/redragon-m913-impact-elite-review/)),
and the G600's as having "angled faces"
([Legit Reviews](https://www.legitreviews.com/logitech-g600-mmo-gaming-mouse-review_2135/4)).

**(c) It waves.** The rows are not straight lines. The same M913 review:
the buttons "are laid in a wave so you can comfortably rest your thumb there
and quickly forget you're touching buttons." The pad's rows follow the arc the
thumb tip sweeps when it pivots at its base — a shallow curve that **rises
toward the rear**. `[JUDGEMENT]` Draw each row as an arc of 4–8° of total rise
front-to-rear, and rotate the pad's whole bounding shape by a similar few
degrees so the rear end sits higher than the front end. This single decision
does more for credibility than any amount of rendering polish.

### 2.4 Button size, pitch and gaps

`[JUDGEMENT]`, derived from a 4-column × 3-row pad over ~47 × 22 mm:

| Quantity | Value | Note |
|---|---|---|
| Column pitch (along the length) | 11–12 mm | 4 columns over ~47 mm |
| Row pitch (vertically) | 7–8 mm | 3 rows over ~22 mm |
| Key face, long axis | 9–10 mm | |
| Key face, short axis | 6–7 mm | |
| Gap between key edges | 1.5–2.5 mm | Narrow. These are close together. |

**The keys are wider than they are tall.** Their long axis runs **front-to-back
along the mouse**, matching the direction the thumb slides. Drawing them as
squares — or, worse, as twelve identical rounded squares on an even pitch — is
the most common tell in the category. Reviewers of the M913 note the buttons
are "quite small and very close together" and can be "a chore" for large hands
([gdgtme](https://www.gdgtme.com/pc-hardware-reviews/redragon-m913-impact-elite-review/)),
and M908 owners describe the side panel as "somewhat awkward and difficult to
press" ([RTINGS](https://www.rtings.com/mouse/reviews/redragon/m908)). The
cramped, tight-packed quality is not a flaw to design out of the illustration.
It is what the thing looks like.

The gaps are **not uniform**. Real pads open up a wider channel between the
inner columns (where the thumb rests) than between the outer ones, and the
whole grid is segmented rather than continuous — the G600's array reads as
"two sets of six", i.e. four rows of three split into two blocks
([Legit Reviews](https://www.legitreviews.com/logitech-g600-mmo-gaming-mouse-review_2135/4)).

### 2.5 Tactile landmarks — draw at least two

A blind-use keypad *must* give the thumb reference points, and every product in
the category solves this differently. **The illustration must show at least one
mechanism, and ideally two.** Documented approaches:

- **Lipped edge keys.** The G600 gives G13 and G16 raised lips "so you can feel
  which side of the array your thumb is resting on", and carries "raised marks
  on a couple of the keys in similar fashion to home-row key demarcations"
  ([Legit Reviews](https://www.legitreviews.com/logitech-g600-mmo-gaming-mouse-review_2135/4)).
  This is the F/J-key idea, transplanted.
- **Alternating textured rows.** On the Corsair Scimitar RGB Elite, "the second
  and fourth rows of buttons are textured to allow for easy identification"
  — half the keys are textured caps, so a thumb scrolling across the pad feels
  smooth/rough/smooth/rough and knows where it is
  ([Legit Reviews](https://www.legitreviews.com/corsair-scimitar-rgb-elite-gaming-mouse-review_217171/2)).
- **Per-button shape differentiation.** On the Naga Trinity side plates, "each
  of these buttons is a slightly different shape to help make them easier to
  sense with your thumb"
  ([Tom's Guide](https://www.tomsguide.com/us/razer-naga-trinity,review-5033.html)).
- **Angled protrusion.** The M913 approach — keys that stand proud at differing
  angles, distinguishable by the angle at which they meet the thumb.
- **A physically movable pad.** The Scimitar's patented **Key Slider**: loosen
  a hex screw in the underside and the whole 12-key panel translates
  fore-and-aft by roughly 8 mm to suit hand size
  ([Legit Reviews](https://www.legitreviews.com/corsair-scimitar-rgb-elite-gaming-mouse-review_217171/2)).
  If the owner's product has any adjustment, the hex socket in the belly is a
  gift of a detail.

**Recommendation for MouseConfig's product** `[JUDGEMENT]`: since it is
positioned productivity-first, use **home-row landmarks on the tier-1 keys**.
[`../game-presets.md`](../game-presets.md) §2.2 defines tier 1 as `side4`,
`side5`, `side7`, `side8` — the four keys the thumb rests on with zero travel.
Raised dimples or a matte texture on exactly those four, and lipped outer edges
on the front column (`side1`–`side3`) and rear column (`side10`–`side12`) to
fence the array, makes the design document and the artwork tell the same story.
That consistency is itself a credibility signal to anyone who reads both.

### 2.6 The thumb rest

Below and behind the pad there is a **thumb shelf** — a ledge or wing that the
thumb's base pad and the webbing sit on, so the thumb can hover over the keys
without the hand bearing weight through it. The M908 has "a thumb rest on the
left and contour finger rest on the right"
([RTINGS](https://www.rtings.com/mouse/reviews/redragon/m908)), and the Naga's
non-12-button plates replace the keys with "a large, ridged thumb rest"
([Tom's Guide](https://www.tomsguide.com/us/razer-naga-trinity,review-5033.html)).
Without this shelf the pad is floating on a wall and the whole illustration
reads as a decal. **Draw the shelf.**

---

## 3. Icon versus real hardware, ranked

Ranked by how fast an owner notices the absence. Items 1–5 are the ones worth
arguing about; 6–10 are polish.

1. **A viewpoint that can actually see the pad.** Not a detail — a
   precondition. See §6.2.
2. **Curvature in the pad: wrap, tilt and wave (§2.3).** A flat rectangular
   grid on a curved body is the single loudest wrongness. Even a line-art
   illustration can carry all three: foreshorten the outer columns, arc the
   rows, rotate the pad's bounding shape a few degrees nose-down.
3. **Non-identical keys.** Twelve identical rounded rectangles on an even pitch
   is the giveaway. Real pads have landmarks, varied shapes, alternating
   textures, uneven channels (§2.4, §2.5). *Any* two keys drawn differently
   from the other ten buys most of the credibility available here.
4. **The thumb shelf under the pad (§2.6).** Its absence makes the keypad look
   painted on rather than cut in.
5. **Parting lines and panel boundaries.** Real mice are assemblies: top shell
   to base, click panel to top shell, grip inlay to flank, pad housing to shell.
   Four or five visible seams, drawn as thin dark lines that *follow the
   surface curvature* rather than running straight, instantly separate an object
   from a pictogram.
6. **Shell thickness at every opening.** The wheel slot, the pad recess and the
   button gaps all show a wall of material with depth. Zero-thickness cutouts
   read as flat.
7. **Grip texture with a boundary.** A rubber inlay that is a *distinct panel*
   with an edge, not a texture floated over the silhouette.
8. **Feet in a different material.** Bright PTFE with chamfered edges, not
   shell-coloured blobs.
9. **The cable's strain relief and upward exit angle**, or the specific
   wireless equivalents (§1.3).
10. **The wheel showing only a sliver.** Amateur drawings consistently expose
    too much of the wheel's circumference.

---

## 4. Play and Pro: what changes, what does not

The site carries two faces — `data-theme="play"` (dark, `--accent #e2001a`) and
`data-theme="pro"` (light, `--accent #b01020`). Both must show the same product.

### 4.1 What must stay identical

**The geometry.** Same silhouette, same pad placement, same key count, same
landmarks, same seams, same feet. If Play and Pro are visibly different shapes,
the site is advertising two products. The theme change is a **material and
lighting change applied to one object.**

`[JUDGEMENT]` The practical implication for the artist: deliver **one geometry
asset with themeable surface treatments**, exactly as `svg.hero-art` already
works — a shared path set whose fills key off CSS custom properties
(`.shell`, `.line`, `.lit`, `.pad` in `public/styles.css`). Do not deliver two
unrelated drawings.

### 4.2 What changes

| Attribute | Play | Pro |
|---|---|---|
| **Finish** | Gloss or semi-gloss on the top shell, with a hard specular highlight running along the hump; textured/diamond grip inlays | Uniform matte or soft-touch; a broad, soft, low-contrast sheen with no hot specular; smooth or finely-ribbed grip |
| **Lighting** | RGB present and legible: pad backlight, scroll-wheel ring, a logo or tail strip. Colour spill onto adjacent shell. | Lighting reduced to one function: a **single monochrome DPI/profile indicator**. No spill, no gradient, no colour cycling. |
| **Colour** | Near-black shell, `--accent` red used generously as light | Graphite or warm dark grey shell, `--accent` used once, small, as a physical detail (an indicator, a ring, a printed mark) |
| **Angularity** | Facets, chamfers, hard creases at the shell transitions; panel lines emphasised | The same masses with the creases softened into fillets; fewer, quieter panel lines |
| **Branding** | Logo mark on the palm hump, backlit, ~14–18 mm | Logo small, unlit, on the tail or the underside; ~8 mm, debossed or tone-on-tone |
| **Cable** | Braided, visible weave | Braided in a matched neutral, or the wireless face (§1.3) — **Pro should prefer the wireless cues** |

### 4.3 The design precedent

This is the MX Master / G502 split, and it is worth naming because it is the
exact positioning MouseConfig's product occupies. The MX Master 3S is described
as having "a similar profile to the Logitech G502 X Plus gaming mouse, just
with fewer sharp edges and definitely no RGB", with a "soft-touch rubber
coating" and a graphite finish that "exudes professional and understated
elegance"
([binaryfork](https://binaryfork.com/logitech-mx-master-3s-review-15545/)).
Same mass distribution, same asymmetry, same thumb-side complexity — different
surface language. That is the recipe.

`[JUDGEMENT]` Because the product is positioned **productivity-first with
gaming secondary**, the Pro face should be the master artwork and Play should
be the variant, not the other way round. It is far easier to add facets, gloss
and light to a restrained form than to sand an aggressive one down into
something that belongs on a desk at work.

---

## 5. Numbering and layout of the 4×3 pad

**Binding constraint.** This section must match
[`../game-presets.md`](../game-presets.md) §2.1 exactly. If that document's
numbering is later corrected against real hardware, this section changes with it.

### 5.1 The grid

**4 columns × 3 rows.** Columns run front-to-back along the mouse's length;
rows run top-to-bottom up the flank. Numbers increase **down each column**, and
columns proceed **front to rear** — the Razer Naga convention the whole category
copied.

```
   front (fingertips)  →  →  →  rear (palm heel)

   row A (top)        [ 1 ]  [ 4 ]  [ 7 ]  [ 10 ]
   row B (middle)     [ 2 ]  [ 5 ]  [ 8 ]  [ 11 ]
   row C (bottom)     [ 3 ]  [ 6 ]  [ 9 ]  [ 12 ]

                       ^tier2  ^tier1 ^tier1  ^tier3
```

In the codebase these are the slots `side1` … `side12`.

> `[UNVERIFIED]`, carried over from `../game-presets.md` §2.1: the physical
> position→number correspondence is inferred from the Naga-family convention
> and from user reports that 10/11/12 are the awkward ones, not from a
> published M913 diagram — Redragon's manual does not print one
> ([manuals.plus](https://manuals.plus/ae/1005004662195682)). **If this is
> confirmed wrong on real hardware, the labels on the artwork are what change;
> the geometry does not.** Build the asset so relabelling is a text edit.

### 5.2 Drawing the numbers

- If a physical number is moulded or printed on a key, it goes on the key face,
  reading along the mouse's length (nose-up), not rotated per-key.
- Real M913/M908 keys are **unmarked**. `[JUDGEMENT]` For a hero shot, prefer
  unmarked keys plus an external callout — markings on a 9 mm key at hero scale
  are unreadable and make the pad look like a calculator. For an explanatory
  diagram, number them.
- Never number them in **reading order across the rows** (1-2-3-4 left to
  right). Anyone who has configured one of these knows the numbers run *down*.
  This is the kind of error that costs trust in one glance.

### 5.3 If the illustration becomes interactive

The site's Buttons section lists twelve rows. Hovering a row should highlight
the matching key on the diagram, and vice versa. Build for that from the start:

- **One `<g>` per key, with a stable id: `side1` … `side12`**, matching the slot
  names in `src/profiles/`. No index arithmetic, no DOM order dependence.
- Inside each group, in this order: **hit area** (an invisible rect padded 2–3 px
  beyond the key, because a 9 × 6 key is below a comfortable touch target), then
  **key face**, then **landmark detail** (dimple, lip, texture), then **optional
  label**.
- **Three visual states**, keyed off a `data-state` attribute so CSS owns the
  appearance: *rest* (theme fill), *hover/linked* (accent stroke plus a lift in
  fill), *assigned* (a subtle persistent marker distinguishing a bound key from
  one set to `none`).
- **Optionally a fourth: tier tint.** The three reachability tiers from
  `../game-presets.md` §2.2 map cleanly onto three fill intensities — tier 1
  (`side4 side5 side7 side8`) strongest, tier 3 (`side3 side10 side11 side12`)
  faintest. This turns the artwork into an argument for the preset design
  rather than decoration. Keep it behind a toggle; it is noise in the default view.
- Accessibility: the hit areas must be real focusable elements with
  `role="button"` and an accessible name ("Side button 5 — currently Copy"), and
  the hover link must also fire on keyboard focus. The pad is the one part of
  the illustration that is not `aria-hidden`.
- Label callouts, if used, leave the pad on **short leader lines going forward
  and up**, into the empty space above the mouse's nose — never across the pad
  itself, and never to the right, where the body is.

---

## 6. Credibility checklist and the mistakes to avoid

### 6.1 The illustration is credible when

- [ ] The pad is visible as a **three-dimensional keypad on a flank**, not a grid
      on a face (§6.2).
- [ ] The pad **wraps, tilts and waves** (§2.3) — outer columns foreshortened,
      rows arced, whole pad rotated a few degrees rear-up.
- [ ] Keys are **wider than tall**, long axis fore-and-aft, gaps of 1.5–2.5 mm
      scale (§2.4).
- [ ] At least two keys carry a **tactile landmark** and are visibly different
      from the other ten (§2.5).
- [ ] The **thumb shelf** exists below and behind the pad (§2.6).
- [ ] The mouse is **wider on the pad side** and the silhouette is asymmetric.
- [ ] The **hump apex is 58–65% back**, with a short steep tail behind it.
- [ ] The **wheel shows a sliver**, sits in a slot with visible depth, and has a
      textured surface.
- [ ] **DPI buttons are behind the wheel** on the spine.
- [ ] **Four or five parting lines** follow the surface curvature.
- [ ] **Feet** are a different material with chamfered edges.
- [ ] The **cable exits the nose upward with strain relief** — or the wireless
      cues are complete and the cable is absent entirely.
- [ ] Numbers, if shown, **run down the columns** (§5.1).

### 6.2 The mistake most likely to be made here — and it is already in the file

**The current `svg.hero-art` is a top-down view of a mouse with the 12-button
pad drawn on its top surface.** In a genuine top-down orthographic view, a pad
mounted on the left flank is either invisible or compressed into a 2–3 mm
sliver of foreshortened edge. So the existing illustration is not a mouse seen
from above with an inaccurate pad — it is a mouse that, read literally, has a
keypad on its back. It also runs the grid **3 wide × 4 tall**, which is the
transpose of §5.1's layout for this orientation, and it draws all twelve keys
as identical rounded rectangles on a perfectly even pitch.

**This is not fixable by redrawing the grid more carefully. The viewpoint has
to change.** The prescription `[JUDGEMENT]`:

> Draw the mouse in a **three-quarter view from the front-left and slightly
> above** — camera roughly 30–40° off the long axis toward the pad side, and
> 20–30° above the desk plane.

That view shows, in one image, the thing that makes this product what it is: the
pad in its own plane, curving away, on a body whose top shell and hump are also
legible. A pure side elevation is the honest fallback if the three-quarter is
too costly, because it at least puts the pad in the picture plane and can carry
the wave and the tilt — but it loses the wheel, the click split and the hump
entirely, which is most of the mouse. A top-down view is the only one of the
three that **structurally cannot** show the subject, and it is the one currently
shipping.

### 6.3 The other recurring mistakes

- **A flat rectangular grid pasted on the side.** Same root cause as above, one
  step less severe: right viewpoint, no curvature.
- **The pad too far forward.** If the front column is within ~25 mm of the tip,
  no thumb reaches it. The category's entire reachability problem
  (`../game-presets.md` §2.2) exists because the pad is already at the rear
  limit of comfort.
- **Twelve identical squares in even rows.** Covered in §3 item 3; it is the
  most common single tell.
- **Too few or too many keys.** Draw exactly twelve and count them. Illustrators
  routinely lose one to a crop or gain one to a rhythm.
- **A slim, symmetric silhouette.** The M913's 92 mm width is the point.
- **RGB as a colour wash over the whole shell.** On real hardware the light
  comes from specific, small emitters — the pad's backlight, a wheel ring, a
  logo, a tail strip — each with a visible boundary and a short falloff. The
  G600's thumb panel is "the only backlit component"
  ([Legit Reviews](https://www.legitreviews.com/logitech-g600-mmo-gaming-mouse-review_2135/2)).
  Lighting everything lights nothing.
- **A cable exiting horizontally or from the side.**
- **A glass-smooth surface with no seams, no texture and no material changes.**
- **Perfect bilateral symmetry in the top view.** The right flank scoops in; the
  left flank bulges out over the pad.
- **Drawing the keys as floating tiles with a shadow gap all round.** They sit
  in a recessed housing with a continuous bezel, not on a plinth.

---

## 7. Reference products to study

| Product | What to take from it |
|---|---|
| **Redragon M913 Impact Elite** — [TechPowerUp](https://www.techpowerup.com/review/redragon-m913-impact-elite/), [Tom's Hardware](https://www.tomshardware.com/reviews/redragon-m913-impact-elite), [RTINGS](https://www.rtings.com/mouse/reviews/redragon/m913-impact-elite), [product page](https://redragonshop.com/products/m913) | The primary subject — MouseConfig's flagship supported device. Take the **92 mm width**, the arched top shell with a sloped rear, the keys that "protrude at an angle" and are "laid in a wave", and the tri-mode wireless cues. Teardown shots on the [build-quality page](https://www.techpowerup.com/review/redragon-m913-impact-elite/4.html) show the pad housing's internal structure. |
| **Redragon M908 Impact** — [RTINGS](https://www.rtings.com/mouse/reviews/redragon/m908), [Redragon comparison](https://redragonshop.com/blogs/community/redragon-impact-m908-vs-impact-elite-m913-an-in-depth-comparative-review-for-mmo-gamers) | The second supported device. Distinctive for the **weight-cartridge door** (130–167 g) in the underside and its explicit **thumb rest left / contoured finger rest right** asymmetry. Owner complaints that the side panel is "awkward and difficult to press" are exactly the ergonomic tension the artwork should acknowledge rather than smooth away. |
| **Razer Naga Trinity / Naga V2 Pro** — [Razer master guide (PDF)](https://dl.razerzone.com/master-guides/RazerSynapse3/NagaTrinity-00000103-en.pdf), [Tom's Guide](https://www.tomsguide.com/us/razer-naga-trinity,review-5033.html), [TechPowerUp teardown](https://www.techpowerup.com/review/razer-naga-v2-pro/4.html) | The category's reference design and the **source of the numbering convention** in §5.1. Distinctive for **magnetically swappable side plates** (16 contact pins) and **per-button shape differentiation** for blind identification. The V2 Pro is the benchmark for thumb-switch feel — "crisp, quiet actuation". |
| **Logitech G600** — [Legit Reviews](https://www.legitreviews.com/logitech-g600-mmo-gaming-mouse-review_2135), [GamersNexus](https://gamersnexus.net/hwreviews/1048-logitech-g600-mmo-mouse), [RTINGS](https://www.rtings.com/mouse/reviews/logitech/g600-mmo-gaming) | The best-documented tactile solution: **lips on the edge keys (G13, G16)** and **home-row raised marks**, plus "angled faces" and the array reading as **two blocks of six**. Also the **G-Shift third-finger button** on the right flank, the pyramidal mass, the matte powder-coat, and the fact that the thumb panel is the *only* backlit component. |
| **Corsair Scimitar RGB Elite** — [Legit Reviews](https://www.legitreviews.com/corsair-scimitar-rgb-elite-gaming-mouse-review_217171/2), [TechPowerUp](https://www.techpowerup.com/review/corsair-scimitar-rgb-elite-mouse/3.html) | The **Key Slider**: the whole pad translates ~8 mm fore-and-aft on a hex screw in the belly. Also **alternating textured rows** (2nd and 4th) as the blind-navigation mechanism. If the owner's product has any pad adjustment, this is the detail language to borrow. |
| **Logitech MX Master 3S** — [binaryfork review](https://binaryfork.com/logitech-mx-master-3s-review-15545/), [Logitech](https://www.logitech.com/en-us/shop/p/mx-master-3s) | Not an MMO mouse — the **Pro-face surface language reference** (§4.3). Soft-touch coating, graphite, no RGB, fillets instead of creases, a form that "fades into office scenery". This is what the Pro theme's artwork should feel like while keeping the M913's geometry. |

**Practical note for the artist.** Product-page hero shots are retouched and
usually shot from angles that flatter rather than inform. For geometry, prefer
**teardown and disassembly photography** (TechPowerUp's build-quality pages for
both the M913 and the Naga V2 Pro), **RTINGS' standardised multi-angle sets**,
and **long-form video reviews paused on hand-on-mouse shots** — a photograph of
a thumb actually resting on the pad settles §2.1 and §2.6 faster than any
dimension in this document.

---

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-29 | First draft. Anatomy, pad geometry, icon-vs-real ranking, Play/Pro split, numbering bound to `../game-presets.md` §2, credibility checklist, reference products. All dimensions cited or marked `[JUDGEMENT]`; none measured off hardware. |
