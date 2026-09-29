# Professional presets for the 12-button side grid

**Status:** design spec, not implemented. Nothing here has been tested against
real hardware or against the applications named. `[UNVERIFIED]` marks claims
that must be checked before they reach a user-facing page.

**Read first:** [`game-presets.md`](./game-presets.md) §1 (action syntax and the
16 addressable slots) and §2 (the reachability model). This document uses both
without restating them. It also shares that document's §5 (naming and
organisation), §6 (landing pages) and §7 (catalog gaps).

**Relationship to `productivity-setup.html`.** That page is the existing,
published, non-gaming guide, and it describes the shipped `Default` preset
button by button ("side buttons 1 and 2 map to Copy and Paste", "side 3 and
side 6 move forward and backward through your open tabs", and so on). Nothing
in this document changes `Default`, and nothing here should be implemented in a
way that makes that page wrong. `Office Essentials` below is a *new, additional*
preset — `Default` re-tiered for thumb reach — and the page for it should link
to `/productivity-setup` as the origin story rather than competing with it.
One small correction to `Default` is proposed in §3.4; it makes the existing
page's own claim true rather than contradicting it.

---

## 1. Why professional layouts are the harder design problem

Games are generous. A game has one keybind screen, the player controls it, and
the mouse can send whatever the player decides. Professional work is the
opposite: the shortcuts already exist, they were chosen by somebody else, they
differ per application, and — the part that matters most here — **they differ
per operating system in a way this hardware cannot paper over.**

Three constraints shape everything below.

1. **The modifier problem.** macOS uses Command where Windows and Linux use
   Control. An action string is a literal HID combo; `super+c` and `ctrl+c` are
   different bytes on the wire. There is no conditional.
2. **The focus problem.** Application hotkeys only fire when that application
   has focus. A "mute" button that works only when the meeting window is on top
   is a different product from a mute button that always works — and the mute
   button people actually want is the second one, which this hardware cannot
   build (see §5).
3. **The frequency inversion.** In a game, the most-pressed thing is also the
   least dangerous. At work it often isn't: `Cmd+W` is pressed constantly and is
   destructive. The reachability tiers have to be read against *consequence*, not
   just frequency.

---

## 2. Cross-platform strategy

### 2.1 What's actually available

`modifierBits` in `docs/protocol-notes/m913-button-tables.json`:

```
ctrl / ctrl_l / ctrl_r      shift / shift_l / shift_r
alt  / alt_l  / alt_r       super / meta / super_l / super_r / meta_l / meta_r
```

`super` is Left GUI: **Command on macOS, the Windows key on Windows, Super on
Linux.** `ACTION_CATEGORIES` already documents this in a comment on the "Mac
Shortcuts" group and uses it correctly (`super+c` = ⌘C).

> **Finding — the M908's trick is not available here.** `m908-presets.ts` avoids
> the whole problem with hardware actions named `compatibility_copy`,
> `compatibility_paste`, `compatibility_find` and so on: the mouse resolves them
> to the right thing per OS. **The M913 action table contains no
> `compatibility_*` actions whatsoever** — check `mouseActions` in
> `m913-button-tables.json`. Every M913 preset that touches an edit command must
> therefore pick a side. This is the single most important constraint in this
> document.

### 2.2 The answer: per-OS variants, resolved at load

**Every preset in §3, §4 and §6 needs per-OS variants. §5 (meetings) needs
per-OS *and* per-application variants. Only §4.3 (Blender) is OS-agnostic**, and
only because Blender's shortcuts are single keys and numpad keys.

Do **not** ship three near-identical entries in the preset dropdown. Instead:

**Recommended (v1, small):** author each preset once with a `%mod%` placeholder
standing for "the platform's primary command modifier", and resolve it when the
preset is loaded:

```ts
// src/profiles/preset-catalog.ts
const PRIMARY_MOD: Record<PresetOS, string> = { mac: "super", win: "ctrl", linux: "ctrl" };

/** Expands %mod% in every action string of a preset's buttonActions. */
export function resolveForOS(actions: Record<string, string>, os: PresetOS) {
  const mod = PRIMARY_MOD[os];
  return Object.fromEntries(
    Object.entries(actions).map(([slot, a]) => [slot, a.replaceAll("%mod%", mod)])
  );
}
```

So `Office Essentials` stores `side4: "%mod%+c"` once, and becomes `super+c` on
macOS and `ctrl+c` on Windows. This is one string replace in the preset loader;
`parseAction()` never sees a `%mod%` and needs no change.

**What `%mod%` cannot cover**, and why the `os` field on `BuiltInPreset`
(see [`game-presets.md`](./game-presets.md) §5.3) is still needed: window and
desktop management diverge structurally, not just by one modifier. macOS
switches Spaces with `ctrl+arrow_left`; Windows uses `ctrl+super+arrow_left`;
GNOME uses `ctrl+alt+arrow_left`. Redo is `super+shift+z` on macOS and `ctrl+y`
in much of Windows. These are different bindings, not substitutions. So:

- Slots whose binding differs only by modifier → `%mod%`, one preset.
- Slots whose binding differs structurally → per-OS override block on the same
  preset `family`.
- The picker defaults to the detected platform and hides the rest behind a
  "using a different OS?" disclosure. Detection: `navigator.userAgentData
  ?.platform ?? navigator.platform`, treating anything matching `/mac/i` as mac,
  `/win/i` as win, else linux. Always let the user override — people configure
  a mouse on one machine for use on another.

### 2.3 Token budget note

`MAX_COMBO_TOKENS = 3`. Windows shortcuts stay comfortably inside it
(`alt+shift+s` = 3, `ctrl+super+arrow_left` = 3). macOS is where it gets tight:
`super+shift+z` is 3 and fine, but any four-key chord — and a few apps have them —
is impossible. Every binding below has been counted.

---

## 3. `preset-office` — Office Essentials

**Who this is for:** everyone. This is the preset the "best productivity mouse"
claim rests on, and it is the one that must work correctly the instant it is
applied, in every application, with no configuration anywhere else.

**Design rule applied:** consequence beats frequency. Close-tab is one of the
most-pressed shortcuts in existence and is also irreversible-feeling, so it sits
in tier 2 rather than tier 1, with *reopen closed tab* deliberately placed near
it as the antidote. Copy/paste take tier 1 because they are the highest-frequency
harmless pair on any computer.

### 3.1 macOS

| Slot | Position | Tier | Action | Does |
|---|---|---|---|---|
| `side4` | inner-front, top | **1** | `super+c` | Copy |
| `side5` | inner-front, mid | **1** | `super+v` | Paste |
| `side7` | inner-rear, top | **1** | `ctrl+tab` | Next tab |
| `side8` | inner-rear, mid | **1** | `ctrl+shift+tab` | Previous tab |
| `side1` | front, top | 2 | `super+z` | Undo |
| `side2` | front, mid | 2 | `super+w` | Close tab / window |
| `side6` | inner-front, bottom | 2 | `super+space` | Spotlight |
| `side9` | inner-rear, bottom | 2 | `super+tab` | Switch application |
| `side3` | front, bottom | 3 | `super+shift+z` | Redo |
| `side10` | rear, top | 3 | `super+shift+t` | **Reopen closed tab** |
| `side11` | rear, mid | 3 | `super+shift+4` | Screenshot a region |
| `side12` | rear, bottom | 3 | `ctrl+arrow_up` | Mission Control |
| `fire` | — | — | `return` | Enter — matches `Default`'s convention |
| `left` `right` `middle` | — | — | *unchanged* | Middle-click is close-tab in browsers |

Token counts: `super+shift+z`, `super+shift+t`, `super+shift+4`,
`ctrl+shift+tab` are 3 each — at the cap, all legal.

### 3.2 Windows

Same slots, same meanings. Structural differences are marked ▲.

| Slot | Tier | Action | Does |
|---|---|---|---|
| `side4` | **1** | `ctrl+c` | Copy |
| `side5` | **1** | `ctrl+v` | Paste |
| `side7` | **1** | `ctrl+tab` | Next tab |
| `side8` | **1** | `ctrl+shift+tab` | Previous tab |
| `side1` | 2 | `ctrl+z` | Undo |
| `side2` | 2 | `ctrl+w` | Close tab |
| `side6` | 2 | `super+s` | ▲ Windows Search |
| `side9` | 2 | `alt+tab` | ▲ Switch window |
| `side3` | 3 | `ctrl+y` | ▲ Redo (Office/Explorer convention; many apps also accept `ctrl+shift+z`) |
| `side10` | 3 | `ctrl+shift+t` | Reopen closed tab |
| `side11` | 3 | `super+shift+s` | ▲ Snipping Tool region capture |
| `side12` | 3 | `super+tab` | ▲ Task View |
| `fire` | — | `return` | Enter |

**Virtual desktops variant.** `ctrl+super+arrow_left` / `ctrl+super+arrow_right`
are 3 tokens and legal. They do not fit alongside both `alt+tab` and Task View;
offer them as a documented swap for `side9`/`side12` rather than a fourth
preset.

### 3.3 Linux (GNOME)

Identical to Windows for the edit and browser keys. Differences:

```
side6  -> super              (bare modifier: GNOME Activities overview / search)
side9  -> alt+tab            (switch application)
side11 -> printscreen        (screenshot; `super+shift+s` on some spins)
side12 -> ctrl+alt+arrow_right   (next workspace)
side10 -> ctrl+alt+arrow_left    (previous workspace) — displaces reopen-closed-tab
```

`side6` is the bare-modifier binding form, and it is genuinely the right answer
on GNOME, where a tap of Super is the primary way into search.
`[UNVERIFIED]` — whether the firmware sends a clean tap of a bare modifier (as
opposed to holding it, or sending nothing) has not been tested. Test this before
shipping the Linux variant; it also affects the ESO preset in
[`game-presets.md`](./game-presets.md) §4.3. KDE and other desktops diverge
further; ship GNOME, and note in prose that other desktops will want the
"Custom…" field.

### 3.4 Proposed correction to the existing `Default` preset

`BUILT_IN_PRESETS[0]` maps `side10: "ctrl+w"` with the comment "Close tab", and
`productivity-setup.html` tells the reader "Side 10 closes the current tab."
Every other binding in that preset is macOS (`super+c`, `super+v`,
`super+space`, `ctrl+arrow_up` for Mission Control). On macOS, close-tab is
`Cmd+W`; **`Ctrl+W` does nothing in Safari, Chrome or Firefox.**

Recommended one-line fix in `src/profiles/user-profiles.ts`:

```
side10: "super+w",   // Close tab  (was "ctrl+w", which is a no-op on macOS)
```

This is not a contradiction of the published guide — it is what makes the
guide's sentence true. `side3`/`side6` (`ctrl+tab` / `ctrl+shift+tab`) are
correct on macOS browsers and should be left alone.

### 3.5 What Office Essentials deliberately leaves unbound

Left, right and middle click. Middle-click in particular is close-tab in every
browser and paste-primary on X11/Linux, and taking it away would remove more
value than any rebinding could add. Cut, Save and Find are also deliberately
absent: Cut is rare enough not to earn a slot, Save is muscle memory nobody
wants to relearn on a mouse, and Find is one letter from the home row.

---

## 4. Creative presets

### 4.1 `preset-photoshop` — Photoshop

Photoshop is the best case for a thumb grid of anything in this document: its
shortcuts are single letters and bracket keys, which cost nothing in tokens and
are exactly what the left hand keeps travelling for while the right hand is
mid-stroke.

| Slot | Tier | Action | Does |
|---|---|---|---|
| `side4` | **1** | `b` | Brush tool |
| `side5` | **1** | `e` | Eraser tool |
| `side7` | **1** | `lbracket` | Decrease brush size |
| `side8` | **1** | `rbracket` | Increase brush size |
| `side1` | 2 | `v` | Move tool |
| `side2` | 2 | `l` | Lasso |
| `side6` | 2 | `%mod%+z` | Undo (steps back in Photoshop 2019+) |
| `side9` | 2 | `x` | Swap foreground / background colour |
| `side3` | 3 | `%mod%+shift+n` | New layer |
| `side10` | 3 | `%mod%+d` | Deselect |
| `side11` | 3 | `%mod%+0` | Fit on screen |
| `side12` | 3 | `%mod%+s` | Save |
| `fire` | — | `d` | Reset colours to black/white |
| `left` `right` `middle` | — | *unchanged* | Middle-drag pans the canvas — never remap |

Brush size on `side7`/`side8` — a vertical pair in one column — is the direct
application of the "pairs go in a column" rule; it should feel like a rocker.
`%mod%+shift+n` is 3 tokens, at the cap.

**Deliberately unbound:** everything that takes a modifier-plus-drag (those are
mouse gestures, not keys), and layer opacity (number keys, which conflict with
tool shortcuts in a way a preset shouldn't decide for you).

### 4.2 `preset-figma` — Figma

| Slot | Tier | Action | Does |
|---|---|---|---|
| `side4` | **1** | `v` | Move tool |
| `side5` | **1** | `%mod%+d` | Duplicate |
| `side7` | **1** | `f` | Frame tool |
| `side8` | **1** | `t` | Text tool |
| `side1` | 2 | `r` | Rectangle |
| `side2` | 2 | `k` | Scale |
| `side6` | 2 | `%mod%+g` | Group selection |
| `side9` | 2 | `shift+a` | Add auto-layout |
| `side3` | 3 | `%mod%+alt+c` | Copy properties |
| `side10` | 3 | `%mod%+alt+v` | Paste properties |
| `side11` | 3 | `%mod%+slash` | Quick actions / search |
| `side12` | 3 | `shift+2` | Zoom to selection |
| `fire` | — | `%mod%+z` | Undo |

`%mod%+alt+c` and `%mod%+alt+v` are 3 tokens — at the cap and legal. Copy/paste
properties is the standout binding here: it is a two-step operation nobody
remembers and it sits naturally as a column pair on `side3`/`side10`.
`[UNVERIFIED]` Figma's shortcut set changes; re-check against the in-app
shortcut panel before publishing.

### 4.3 `preset-blender` — Blender (OS-agnostic)

**The only preset in this document that needs no per-OS variant**, because
Blender's shortcuts are bare keys and numpad keys. It is also the strongest
value case: Blender's viewport views live on the *numpad*, which is the furthest
thing on the keyboard from the left hand, and laptop users often have no numpad
at all.

| Slot | Tier | Action | Does |
|---|---|---|---|
| `side4` | **1** | `num1` | Front orthographic view |
| `side5` | **1** | `num3` | Right orthographic view |
| `side7` | **1** | `num7` | Top orthographic view |
| `side8` | **1** | `num5` | Toggle orthographic / perspective |
| `side1` | 2 | `numdot` | Frame selected |
| `side2` | 2 | `num0` | Camera view |
| `side6` | 2 | `tab` | Toggle Edit / Object mode |
| `side9` | 2 | `z` | Shading pie menu |
| `side3` | 3 | `shift+a` | Add menu |
| `side10` | 3 | `ctrl+z` | Undo (Blender uses Ctrl on macOS too) |
| `side11` | 3 | `x` | Delete menu |
| `side12` | 3 | `ctrl+s` | Save |
| `fire` | — | `g` | Grab / move |
| `left` `right` `middle` | — | *unchanged* | Middle-drag orbits the viewport — **never remap** |

**Deliberately unbound:** `s` (scale) and `r` (rotate). `g`/`s`/`r` are a triad
and splitting one onto the mouse while the others stay on the keyboard is worse
than leaving all three together; `g` goes on `fire` precisely because `fire` is
outside the grid and the split is therefore obvious rather than confusing.
`[UNVERIFIED]` Blender uses `Ctrl+Z` rather than `Cmd+Z` on macOS in default
keymaps — verify, and if the Industry Compatible keymap is in use, the whole
table changes and should be a separate variant.

### 4.4 `preset-nle` — Video editing (DaVinci Resolve, with Premiere / Final Cut notes)

The one thing every NLE agrees on is **J-K-L transport**. Building the preset
around it means the layout transfers between applications, which is rare enough
to be worth optimising for.

| Slot | Tier | Action | Resolve | Premiere | Final Cut |
|---|---|---|---|---|---|
| `side4` | **1** | `j` | Reverse | Reverse | Reverse |
| `side5` | **1** | `k` | Stop | Stop | Stop |
| `side7` | **1** | `l` | Forward | Forward | Forward |
| `side8` | **1** | `%mod%+b` | Blade / split clip | ▲ `ctrl+k` on Windows, `super+k` on macOS | `super+b` |
| `side1` | 2 | `i` | Mark in | Mark in | Mark in |
| `side2` | 2 | `o` | Mark out | Mark out | Mark out |
| `side6` | 2 | `arrow_left` | Step back 1 frame | same | same |
| `side9` | 2 | `arrow_right` | Step forward 1 frame | same | same |
| `side3` | 3 | `%mod%+z` | Undo | Undo | Undo |
| `side10` | 3 | `a` | Selection tool | Selection tool | ▲ `a` (Select) |
| `side11` | 3 | `t` | Trim edit mode | ▲ `n` (snap) | ▲ `t` (trim) |
| `side12` | 3 | `%mod%+s` | Save | Save | Save |
| `fire` | — | `space` | Play / pause | Play / pause | Play / pause |

`space` goes on `fire` because it is the single most-pressed key in any NLE and
`fire` is the only button on the mouse that neither hand is otherwise using —
and because putting it inside the J-K-L cluster would fight `k`.

**Deliberately unbound:** the ripple/roll/slip/slide trim family, and anything
in Resolve's Fusion or Fairlight pages. Those differ per page *within the same
application*, and a preset that silently means something different depending on
which tab you're on is a preset that trains distrust.

**Ship judgement:** ship the Resolve column only, and put the Premiere and Final
Cut columns on the landing page as a "what to change" table. Three near-identical
presets in the dropdown for one job is exactly the clutter §5.2 of
[`game-presets.md`](./game-presets.md) warns about.

---

## 5. `preset-meetings` — Meetings and communication

### 5.1 The honest constraint, stated first

This section has the largest gap between what people want and what the hardware
can do, and the landing page must lead with it rather than bury it.

> **There is no operating-system-level microphone mute available to this mouse.**
> The M913's action table has `media_mute`, which is *system output* mute — it
> silences your speakers, not your microphone. No mic-mute usage exists in the
> table at all. Every mute binding below is therefore an **application hotkey**,
> which means it only fires when that application has focus.

Practical consequence: press your mute button while you're looking at a
spreadsheet and nothing happens. This is a property of application hotkeys, not
of this mouse — but the person buying a "mute button" does not know that, and
finding out by being heard is the worst possible way to learn it.

Two partial mitigations worth documenting:

- **Zoom has a global shortcut option** (*Settings → Keyboard Shortcuts →
  "Enable Global Shortcut"*). Turning it on is what makes the Zoom variant below
  actually work the way people expect. This should be step 1 of the setup list,
  not a footnote.
- **Windows 11 has a system mute at `super+alt+k`** (3 tokens, legal), but it
  only acts on apps that opt into the platform's call API — Teams does, and most
  others do not
  ([MuteDeck](https://mutedeck.com/blog/2026-02-02-keyboard-mute-button/)).

### 5.2 Zoom — Windows

Shortcuts per [Cal State LA's Zoom/Teams reference](https://www.calstatela.edu/accessibility/zoom-and-teams)
and [Zoom shortcut guides](https://keyshortcuts.net/blog/zoom-shortcuts-guide).

| Slot | Tier | Action | Does |
|---|---|---|---|
| `side4` | **1** | `alt+a` | **Mute / unmute** |
| `side5` | **1** | `alt+v` | Start / stop camera |
| `side7` | **1** | `alt+shift+s` | Share screen |
| `side8` | **1** | `alt+h` | Toggle chat panel |
| `side1` | 2 | `alt+y` | Raise / lower hand |
| `side2` | 2 | `alt+u` | Toggle participants panel |
| `side6` | 2 | `alt+f` | Toggle full screen |
| `side9` | 2 | `alt+r` | Start / stop local recording |
| `side3` | 3 | `alt+q` | **Leave meeting** |
| `side10` | 3 | `media_vol_down` | System volume down |
| `side11` | 3 | `media_vol_up` | System volume up |
| `side12` | 3 | `media_mute` | System **output** mute (not your mic) |
| `fire` | — | `alt+a` | Mute — a second, larger mute button |
| `left` `right` `middle` | — | *unchanged* | |

Design notes worth keeping in the shipped copy:

- **Mute is `side4`, the single best button on the mouse.** Nothing else
  competes for it.
- **Leave meeting is `side3`, one of the four worst.** That is the point. The
  reach is a confirmation dialog made out of anatomy — the tier-3 rule from
  [`game-presets.md`](./game-presets.md) §2.2 doing real work.
- **Mute is on `fire` as well**, deliberately duplicated. Redundancy is correct
  for the one action whose failure is embarrassing, and `fire` has no better job
  during a call.
- `side10`–`side12` are the only OS-level bindings in the preset, which is why
  they still work when the meeting window isn't focused. Say so on the page; it
  is a genuinely useful thing to know.

### 5.3 Zoom — macOS

Same slots, same meanings, different chords:

```
side4 -> super+shift+a    (mute / unmute)
side5 -> super+shift+v    (start / stop camera)
side7 -> super+shift+s    (share screen)
side8 -> super+shift+h    (toggle chat)
side1 -> alt+y            (raise hand)
side2 -> super+u          (participants)
side6 -> super+shift+f    (full screen)
side9 -> super+shift+r    (local recording)
side3 -> super+w          (leave meeting)
side10/11/12, fire        (as Windows; fire -> super+shift+a)
```

All of these are 3 tokens — the macOS Zoom set sits exactly on
`MAX_COMBO_TOKENS` with no headroom. Any Zoom shortcut needing a fourth key is
simply unavailable, and `[UNVERIFIED]` a few of Zoom's less common macOS
shortcuts do use four. Check before expanding this preset.

### 5.4 Microsoft Teams

```
Windows                         macOS
side4 -> ctrl+shift+m           side4 -> super+shift+m     (mute / unmute)
side5 -> ctrl+shift+o           side5 -> super+shift+o     (toggle video)
side7 -> ctrl+shift+e           side7 -> super+shift+e     (share screen)
side8 -> ctrl+shift+k           side8 -> super+shift+k     (raise hand)   [UNVERIFIED]
side3 -> ctrl+shift+h           side3 -> super+shift+h     (leave / hang up) [UNVERIFIED]
side10/11/12 -> media_vol_down / media_vol_up / media_mute
fire  -> ctrl+shift+m           fire  -> super+shift+m
side1 side2 side6 side9 -> none
```

All 3 tokens. Four slots are `none` on purpose — Teams' stable, documented
in-call shortcut set is genuinely small, and padding it with panel toggles that
move between Teams versions would be inventing reliability that isn't there.
Windows users should additionally be told about `super+alt+k`, which Teams
supports as a true system-wide mute and is strictly better than `ctrl+shift+m`
for this purpose.

### 5.5 Google Meet

Meet is the clearest illustration of "deliberately unbound" in this whole
document. It has essentially **two** in-call shortcuts, and they only work while
the Meet browser tab is focused
([Google Workspace Learning Center](https://support.google.com/a/users/answer/9896256?hl=en)).

| Slot | Tier | Action | Does |
|---|---|---|---|
| `side4` | **1** | `%mod%+d` | Mute / unmute microphone |
| `side5` | **1** | `%mod%+e` | Turn camera on / off |
| `side10` | 3 | `media_vol_down` | System volume down |
| `side11` | 3 | `media_vol_up` | System volume up |
| `side12` | 3 | `media_mute` | System output mute |
| `fire` | — | `%mod%+d` | Mute |
| everything else | — | `none` | **Deliberately dead** |

Seven buttons doing nothing is the correct design. Meet does not have seven more
things worth binding, and a preset that invented some would be worse than one
that admits the ceiling. This is also the preset that most needs `none` rather
than omission: omitted slots keep the factory `F1`–`F12`, and browsers use those.

---

## 6. `preset-dev` — Software development (VS Code)

**Who this is for:** the audience most likely to be on macOS or Linux and
therefore completely locked out of Redragon's Windows-only software. Highest
value per user in the whole catalog.

**Design principle:** bind *navigation*, not *typing*. A developer's hands are
already on the keyboard; letters and chords cost nothing. What costs something
is the constant round trip to the command palette, the terminal, and back
through the file-jump history. That is what goes on the thumb.

### 6.1 macOS

| Slot | Tier | Action | Does |
|---|---|---|---|
| `side4` | **1** | `super+p` | Go to File — the most-used command in the editor |
| `side5` | **1** | `super+shift+p` | Command Palette |
| `side7` | **1** | `ctrl+grave` | Toggle integrated terminal |
| `side8` | **1** | `super+shift+f` | Find in files |
| `side1` | 2 | `ctrl+minus` | Navigate **back** |
| `side2` | 2 | `ctrl+shift+minus` | Navigate **forward** |
| `side6` | 2 | `super+b` | Toggle sidebar |
| `side9` | 2 | `f12` | Go to definition |
| `side3` | 3 | `shift+f12` | Find all references |
| `side10` | 3 | `super+shift+g` | Source Control view |
| `side11` | 3 | `f5` | Start / continue debugging |
| `side12` | 3 | `super+grave` | Cycle windows of the current app |
| `fire` | — | `f2` | Rename symbol |
| `left` `right` `middle` | — | *unchanged* | |

Back/forward on `side1`/`side2` is the column-pair rule again, and it is the
binding most developers report missing once they've had it. `ctrl+shift+minus`
is 3 tokens, at the cap.

### 6.2 Windows / Linux

```
side4  -> ctrl+p               (Go to File)
side5  -> ctrl+shift+p         (Command Palette)
side7  -> ctrl+grave           (toggle terminal — same on all platforms)
side8  -> ctrl+shift+f         (find in files)
side1  -> alt+arrow_left       ▲ navigate back
side2  -> alt+arrow_right      ▲ navigate forward
side6  -> ctrl+b               (toggle sidebar)
side9  -> f12                  (go to definition)
side3  -> shift+f12            (find all references)
side10 -> ctrl+shift+g         (Source Control view)
side11 -> f5                   (start / continue debugging)
side12 -> alt+tab              ▲ switch window
fire   -> f2                   (rename symbol)
```

Note that back/forward is one of the structural divergences from §2.2 — macOS VS
Code uses `Ctrl+-` / `Ctrl+Shift+-`, Windows and Linux use `Alt+←` / `Alt+→`.
`%mod%` cannot express that; it needs a per-OS override.

### 6.3 The git gap, stated plainly

**Git operations have no default single-chord hotkeys in VS Code**, and this
mouse cannot type. There is no way to bind "commit", "pull", "push" or "create
branch" to a button with the current action catalog — no macros, no text
sequences, one action per button
([`game-presets.md`](./game-presets.md) §7, items 8 and 9). `side10` opens the
Source Control view and the rest is keyboard work.

Two honest workarounds for the landing page, neither of which the preset can do
for the user:

- Bind the git commands you want to spare keys in VS Code's own keybindings
  (`workbench.action.keybindingsJson`) — e.g. `git.commitAll` to `Ctrl+Alt+C` —
  and then point a mouse button at that chord. 3 tokens, legal.
- Use the F13–F24 trick from the streaming preset: bind unused function keys in
  VS Code, point the mouse at them, and never collide with anything.

The second is the better advice and is worth writing up as its own short section
on the dev preset page, because it generalises to every application in this
document.

### 6.4 Terminal / window-manager variant

For people who live in a terminal rather than an IDE, a documented variant:

```
side4  -> %mod%+t              (new tab)
side5  -> %mod%+d              (split pane — iTerm2/Terminal.app; varies)
side7  -> %mod%+shift+lbracket (previous tab)
side8  -> %mod%+shift+rbracket (next tab)
side1  -> ctrl+c               (interrupt)   ⚠ macOS: this is literally Ctrl, not Cmd
side2  -> ctrl+d               (EOF)         ⚠ likewise
side6  -> ctrl+r               (reverse history search)
side9  -> ctrl+l               (clear screen)
```

`side1`/`side2`/`side6`/`side9` are `ctrl+…` on **every** platform including
macOS — terminal control characters are not Command keys. They must **not** be
written as `%mod%`, and this is precisely the kind of case where a blanket
find-and-replace would silently produce a broken preset. Worth a comment in the
source.

---

## 7. Recommended ship order, revised for productivity-first positioning

1. **Office Essentials** — macOS and Windows variants from one `%mod%` source.
   The broadest audience, works instantly in every application, and it is the
   concrete thing the "best productivity mouse" positioning points at.
2. **Software Development — VS Code** — highest value per user, reaches the
   macOS/Linux audience that has no alternative at all, and generates the most
   word of mouth.
3. **Meetings — Zoom** (with Teams and Meet as siblings) — the clearest
   single-button value story in the catalog ("mute is under your thumb"), the
   easiest page to rank for, and the one that most needs this document's honesty
   about focus and mic-mute to be told well rather than quietly.

Then, in order: Office Essentials (Linux) → Photoshop → NLE → WoW → Blender →
FFXIV → FPS → Figma → OBS → the remaining games.

If the audience is office users rather than MMO players, the answer is the same
three in the same order — which is itself the argument for them. If the audience
is MMO players, see [`game-presets.md`](./game-presets.md) §5.4.

**Do not remove or re-tier the four existing built-ins.** `Default` is described
button by button in `productivity-setup.html`; `Office Essentials` is an
addition beside it, and its page should say exactly that: *"`Default` is the
mapping from our productivity guide. `Office Essentials` is the same idea
re-arranged so the most-used bindings sit where your thumb already rests."*

---

## 8. Catalog gaps specific to professional use

These are in addition to the full list in [`game-presets.md`](./game-presets.md) §7.

| Gap | Consequence | Kind |
|---|---|---|
| No `compatibility_*` actions on the M913 (the M908 has them) | Every edit-command preset must be duplicated or `%mod%`-templated per OS | hardware |
| No microphone mute | Meeting mute is always app-scoped and focus-dependent | hardware |
| No double-click | A staple office binding is unavailable (`three_click` exists; `double_click` does not) | hardware |
| No macros / text sequences | Git commands, boilerplate, email addresses — all impossible | hardware |
| `MAX_COMBO_TOKENS = 3` | macOS Zoom sits exactly at the cap; some 4-key app chords are unreachable | hardware |
| Presets can't declare an OS | Blocks the per-OS variant UX in §2.2 | **software** |
| No `%mod%` resolution in the preset loader | Every preset must be hand-duplicated per OS | **software** |
| Bare-modifier bindings undiscoverable in the combo builder | GNOME's bare-Super overview can't be set from the UI | **software** |
| `media_calc`, `media_email`, `media_search`, `media_home`, `media_computer`, `media_player` are parseable but absent from `ACTION_CATEGORIES` | Six genuinely office-useful actions are hidden behind "Custom…" | **software** |

The four software items are small and all of them block either the gallery or
the professional positioning. They are the right first engineering task.

---

## Changelog

- **v0.1 — 2026-09-29.** First draft, written alongside
  [`game-presets.md`](./game-presets.md) v0.1 in response to the
  productivity-first repositioning. Seven professional/creative presets plus
  per-OS variants; cross-platform strategy; proposed `Default` correction.
  Nothing tested on hardware or against the applications named.

## Sources

- [Cal State LA — Zoom and Teams keyboard shortcuts](https://www.calstatela.edu/accessibility/zoom-and-teams)
- [Zoom keyboard shortcuts guide](https://keyshortcuts.net/blog/zoom-shortcuts-guide)
- [Microsoft Teams keyboard shortcuts cheat sheet](https://fastshortcuts.com/shortcuts/microsoft-teams/)
- [Google Workspace Learning Center — Google Meet keyboard shortcuts](https://support.google.com/a/users/answer/9896256?hl=en)
- [MuteDeck — setting up a keyboard mute button for Zoom, Teams and Meet](https://mutedeck.com/blog/2026-02-02-keyboard-mute-button/)
- [The Software Pro — unmute shortcuts for virtual meetings](https://thesoftwarepro.com/unmute-shortcuts-virtual-meetings-microsoft-teams-zoom-mute-shortcuts/)
- [Elgato — using Stream Deck with any application (the F13–F24 technique)](https://www.elgato.com/us/en/explorer/products/stream-deck/how-to-use-elgato-stream-deck-with-any-application/)
