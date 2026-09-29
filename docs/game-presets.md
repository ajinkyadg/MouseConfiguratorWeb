# Game presets for the 12-button side grid

**Status:** design spec, not implemented. Nothing here has been tested against
real hardware. Every numeric value and every claim marked `[UNVERIFIED]` is a
hypothesis.

**Companion doc:** [`professional-presets.md`](./professional-presets.md) — the
work/creative/meetings layouts, plus the cross-platform (Cmd vs Ctrl) strategy
that applies to both documents. Read the "Action syntax" and "Reachability
model" sections here first; that doc builds on them.

**Scope:** the M913 profile model (`src/profiles/m913-*`). The M908 has a
different action vocabulary (`compatibility_*` actions, a different `fire:`
syntax) and is out of scope; see "What the M913 cannot do" for why that
matters.

---

## 1. What the hardware and the codebase actually allow

### 1.1 Addressable slots

From `BUTTON_SLOTS` in `src/profiles/m913-action-catalog.ts` and
`buttonIndexOrder` in `docs/protocol-notes/m913-button-tables.json`, there are
**exactly 16 addressable slots**:

```
left  right  middle  fire  side1 … side12
```

> **Finding — there is no DPI-button slot.** The brief assumed a remappable DPI
> button. The protocol's button table has no index for it, so the DPI rocker's
> behaviour is fixed. If you want DPI control under the thumb you must spend a
> side button on `dpi+` / `dpi-` / `dpi-cycle`. Every preset below that touches
> DPI does exactly that, and pays a side button for it.

### 1.2 Action syntax

An action is a single lowercase string. `parseAction()` accepts:

| Form | Examples | Notes |
|---|---|---|
| Mouse action | `left` `right` `middle` `forward` `backward` | `forward`/`backward` are the usual "mouse 4 / mouse 5" |
| DPI | `dpi+` `dpi-` `dpi-cycle` `dpi-loop` | all are *stepped*, none are momentary |
| Device | `led_toggle` `rgb_toggle` `polling_switch` `three_click` `favorites` `disable` `none` | |
| Media | `media_play` `media_next` `media_prev` `media_stop` `media_vol_up` `media_vol_down` `media_mute` | |
| Media (in the table but **not** in the quick-pick catalog) | `media_calc` `media_email` `media_search` `media_home` `media_computer` `media_player` | reachable only via "Custom…" — see §7 |
| Browser | `www_back` `www_forward` `www_refresh` `www_stop` `www_favorites` | |
| Fire | `fire` or `fire:<speed>:<times>`, speed 3–255, times 0–3 | |
| Key | `f5` `grave` `minus` `equal` `arrow_left` `num1` … | key names from `keyCodes` |
| Key combo | `ctrl+c` `super+shift+z` `alt+shift+s` | modifiers: `ctrl` `shift` `alt` `super`/`meta`, plus `_l`/`_r` variants |
| Bare modifier | `ctrl` `shift` `super` | legal: `parseAction` emits `[0x90, mods, 0, 0]` with no key |

**The hard cap.** `MAX_COMBO_TOKENS = 3` in `src/profiles/m913-buttons.ts`.
A token is one modifier *or* one key. `ctrl+shift+1` = 3 tokens, fine.
`ctrl+alt+shift+1` = 4 tokens and `buildButtonMappingPackets()` **throws**.
Every binding in both documents has been counted against this.

### 1.3 Factory default

Out of the box the twelve thumb buttons send **F1–F12**
([Tom's Hardware](https://www.tomshardware.com/reviews/redragon-m913-impact-elite),
[MakeUseOf](https://www.makeuseof.com/redragon-m913-impact-elite-wireless-gaming-mouse-review/)).
That's a useful baseline fact: a preset that leaves a slot alone leaves an F-key
there, not "nothing". Presets that deliberately want a dead button must say
`none` explicitly rather than omitting the key — omitting it keeps the factory
F-key, which is worse than useless in a game that binds F1–F5 to party frames.

---

## 2. The reachability model

### 2.1 Geometry

The pad is **4 columns × 3 rows**. Columns run front-to-back along the mouse's
length; the front column is toward the fingertips, the rear column toward the
heel of the palm. Numbering follows the Razer Naga convention the whole category
copied: numbers increase **down each column**, columns left to right.

```
                    front  →  →  →  rear
   row A (top)       1     4     7     10
   row B (middle)    2     5     8     11
   row C (bottom)    3     6     9     12
                     ^           ^
              front column   inner columns
```

> `[UNVERIFIED]` The physical position→number correspondence is inferred from
> the Naga-family convention and from user reports that "10, 11, 12" are the
> awkward ones (see §2.2), not from an M913 diagram — Redragon's manual does not
> publish one
> ([manuals.plus](https://manuals.plus/ae/1005004662195682)). **Before
> implementing, press each button on real hardware and confirm.** Everything
> below is expressed as *tier → slot list*, so if the numbering turns out to be
> transposed, you re-map the tiers and every preset table follows mechanically.

### 2.2 The tiers

The thumb pivots at its base, roughly level with the bottom-rear of the pad.
Extending forward and slightly up is cheap; curling back toward the palm, or
dropping to the bottom-front corner, is not. Community consensus on the Naga and
G600 is consistent about the failure mode: the rear rows are what force a grip
shift, and the bottom row is where mis-presses and double-presses happen
([mmo-champion](https://www.mmo-champion.com/threads/1295521-Does-anyone-use-those-12-button-mouse-like-Naga-or-G600),
[ESO forums](https://forums.elderscrollsonline.com/en/discussion/615177/are-you-comfortable-using-an-mmo-mouse-12-buttons/p2),
[Legit Reviews on the G600](https://www.legitreviews.com/logitech-g600-mmo-gaming-mouse-review_2135/4)).

| Tier | Slots | Cost | Put here |
|---|---|---|---|
| **1 — home** | `side4` `side5` `side7` `side8` | zero travel; the thumb is already touching them | Anything pressed on the global cooldown. Spammed abilities. Mute. Copy/paste. |
| **2 — flex** | `side1` `side2` `side6` `side9` | one small extension, no grip change | Every-few-seconds actions: cooldowns, interrupts, tab switching, undo |
| **3 — reach** | `side3` `side10` `side11` `side12` | thumb leaves home; grip shifts slightly | Deliberate or destructive: mount, shop, leave meeting, start recording, save. Or `none`. |

**Corollary rules, which the rest of both documents obey:**

1. *Nothing whose failure is expensive goes in tier 1.* Tier 1 gets pressed
   accidentally. "Leave meeting" and "start stream" belong in tier 3 precisely
   *because* tier 3 is slow — the reach is a confirmation dialog made of anatomy.
2. *Nothing latency-critical goes in tier 3.* An interrupt on `side12` is an
   interrupt you miss.
3. *Pairs go in a column, not a row.* Next/previous tab, forward/back, volume
   up/down: put them on two buttons in the same column (e.g. `side7`/`side8`,
   `side1`/`side2`), because the thumb rocks vertically far more accurately than
   it slides fore-and-aft.
4. *Twelve bindings is a target, not a requirement.* Several presets below use
   eight and leave four at `none` on purpose. A grid where every button does
   something you can't remember is worse than a grid with four dead keys you can
   feel.

---

## 3. A shared convention for the game presets

Every game here binds abilities **in the game's own options screen**, not on the
mouse. WoW, FFXIV, ESO and GW2 all natively recognise only mouse buttons 4 and 5;
buttons 6–12 do not exist as far as those games are concerned. The universally
recommended workaround is exactly what this configurator does: make the mouse
send an ordinary keystroke, and bind *that keystroke* in the game
([Blizzard forums](https://us.forums.blizzard.com/en/wow/t/keybinds-tips-with-12-mouse-buttons/719341),
[GW2 forums](https://en-forum.guildwars2.com/topic/46068-question-about-using-mouse-for-keybinds/)).

Consequences the preset pages must state plainly:

- **The mouse preset is half the setup.** The other half is a keybind pass in
  the game. Any landing page that doesn't say so will generate support mail.
- **Pick keys the left hand doesn't want.** A preset that sends `1`–`=` takes
  the number row away from the keyboard. A preset that sends `ctrl+1`–`ctrl+=`
  leaves it alone. Both are legitimate; the presets below make the choice
  explicitly and say which.
- **Left, right and middle stay as they are** in every game preset. Left and
  right are camera control and are never safe to remap. Middle is frequently
  bound *in-game* by the player and should be left for them.

---

## 4. The game presets

### 4.1 `preset-wow-bar1` — World of Warcraft: Action Bar 1

**Player fantasy:** your entire main bar is under your thumb and your left hand
never leaves the movement keys.

**Why these keys.** WoW's Action Bar 1 ships bound to `1 2 3 4 5 6 7 8 9 0 - =`.
Sending exactly those twelve keys means **the preset works with zero in-game
configuration** — the single biggest reason to make this the flagship WoW preset.
The cost is that the number row is now doubled up; that's fine, because the point
of an MMO mouse is that the left hand stops using it.

The three-bar scheme most 12-button owners converge on — bar 1 bare, bar 2 under
Shift, bar 3 under Ctrl, giving 36 abilities from the thumb — is the natural next
step and is documented as a variant below rather than shipped, because it
requires the player to rebind three bars before anything works
([Blizzard forums](https://us.forums.blizzard.com/en/wow/t/how-are-your-keybinds-set/239597),
[mmosetup](https://mmosetup.com/guides/wow-mmo-mouse-setup/)).

| Slot | Position | Tier | Action | Sends | Put this ability on it |
|---|---|---|---|---|---|
| `side1` | front, top | 2 | `1` | 1 | Interrupt |
| `side2` | front, mid | 2 | `2` | 2 | Short-CD cooldown |
| `side3` | front, bottom | 3 | `3` | 3 | Utility / dispel |
| `side4` | inner-front, top | **1** | `4` | 4 | Filler / main spender |
| `side5` | inner-front, mid | **1** | `5` | 5 | Builder — the most-pressed button you own |
| `side6` | inner-front, bottom | 2 | `6` | 6 | AoE |
| `side7` | inner-rear, top | **1** | `7` | 7 | Second spender |
| `side8` | inner-rear, mid | **1** | `8` | 8 | Second builder |
| `side9` | inner-rear, bottom | 2 | `9` | 9 | Defensive |
| `side10` | rear, top | 3 | `0` | 0 | Major cooldown |
| `side11` | rear, mid | 3 | `minus` | - | Trinket / racial |
| `side12` | rear, bottom | 3 | `equal` | = | Mount / out-of-combat |
| `fire` | — | — | `tab` | Tab | Target nearest enemy |
| `left` `right` `middle` | — | — | *unchanged* | | Camera; bind middle in-game |

**Deliberately not bound:** nothing on the grid is left free — this preset's
whole premise is a complete bar. Middle click is left alone because WoW players
overwhelmingly bind it themselves. `fire` gets `tab` rather than a rapid-fire
macro; see §7 on why hardware burst-fire has no place in a preset we publish.

**Hardware limits hit:** none. Every action is a single bare key (1 token).

#### Role overlays (diffs against the base, not separate presets)

*Healer.* Healers need target switching under the thumb more than they need bar
slots 0/-/=; WoW binds `F1`–`F5` to self and party 1–4 by default. Overlay:

```
side3  -> f1     (target self)
side10 -> f2     (party 1)
side11 -> f3     (party 2)
side12 -> f4     (party 3)
```

Bar slots 3, 0, - and = move to the keyboard. `f5` (party 4) does not fit and
stays on the keyboard — an acknowledged gap, and the honest reason healers with
mouseover-macro or click-cast addons usually want the base preset instead. This
overlay is **my design judgement**, not an established convention; the
established healer practice is frame-based click-casting, which is an addon
concern the mouse cannot help with.

*Melee DPS.* No mapping change. Melee wants an interrupt that is never missed
and a defensive that is never fat-fingered: use the base preset and place the
interrupt on bar slot 5 (`side5`, tier 1) and the defensive on bar slot 9
(`side9`, tier 2). This is a guidance overlay, and it is more honest to say so
than to invent a different table.

*Tank.* Tanks press active mitigation on almost every GCD and want it
unmissable, plus more long cooldowns than a DPS. Overlay:

```
side11 -> ctrl+1   (bar 3 slot 1 — long defensive)
side12 -> ctrl+2   (bar 3 slot 2 — second long defensive)
```

Requires binding Action Bar 3 to `Ctrl+1`/`Ctrl+2` in game. 2 tokens each, fine.
Active mitigation goes on `side5`.

#### Documented variant, not shipped: the three-bar grid

`side1..side12` → `ctrl+1 … ctrl+equal`, with the bare number row left to the
keyboard and Shift-bar reached by holding keyboard Shift. 2 tokens per binding.
Ship this as a preset only once there's a page explaining the in-game bar setup;
without that page it looks broken on first press.

---

### 4.2 `preset-ffxiv-ctrl` — Final Fantasy XIV: Ctrl hotbar

**The meaningful difference from WoW.** FFXIV players on keyboard-and-mouse do
*not* vacate the number row. The dominant convention keeps the left hand on
`1`–`5` plus `Q E R F G C V`, and uses Shift for secondary cooldowns and
Ctrl/Alt for long-cooldown and utility abilities
([saltedxiv](https://saltedxiv.com/guides/mouse-keyboard-keybinding-guide),
[Late to the Party Finder](https://latetothepartyfinder.com/ffxiv-hotbar-layouts-and-keybinds-mouse-and-keyboard/)).
So the correct FFXIV preset does **not** duplicate hotbar 1. It gives the thumb a
whole hotbar the keyboard wasn't using.

Hotbar 1 defaults to `1`–`9`, `0`, `-`, `=`
([Square Enix UI guide](https://na.finalfantasyxiv.com/uiguide/know/know-hb/hotbar_shortcut.html)).
This preset sends the Ctrl-modified version of the same twelve.

| Slot | Tier | Action | Sends | Put this on it |
|---|---|---|---|---|
| `side1` | 2 | `ctrl+1` | Ctrl+1 | oGCD — raid buff |
| `side2` | 2 | `ctrl+2` | Ctrl+2 | oGCD — personal buff |
| `side3` | 3 | `ctrl+3` | Ctrl+3 | Role action / utility |
| `side4` | **1** | `ctrl+4` | Ctrl+4 | Weaponskill in the burst window |
| `side5` | **1** | `ctrl+5` | Ctrl+5 | Most-pressed oGCD |
| `side6` | 2 | `ctrl+6` | Ctrl+6 | AoE |
| `side7` | **1** | `ctrl+7` | Ctrl+7 | Second burst-window weaponskill |
| `side8` | **1** | `ctrl+8` | Ctrl+8 | Second most-pressed oGCD |
| `side9` | 2 | `ctrl+9` | Ctrl+9 | Mitigation |
| `side10` | 3 | `ctrl+0` | Ctrl+0 | 2-minute cooldown |
| `side11` | 3 | `ctrl+minus` | Ctrl+- | Sprint / Limit Break |
| `side12` | 3 | `ctrl+equal` | Ctrl+= | Mount / out-of-combat |
| `fire` | — | `tab` | Tab | Target nearest enemy |
| `left` `right` `middle` | — | *unchanged* | | Right-drag is the camera; never remap |

**In-game setup:** in *Character Configuration → Keybind → Hotbar*, confirm which
hotbar owns `Ctrl+1`…`Ctrl+=`. `[UNVERIFIED]` FFXIV's shipped modifier→hotbar
assignment has changed across expansions and is commonly customised; the page
must tell the player to look rather than assert a number.

**Deliberately not bound:** hotbar 1 and the WXHB. A player who wants the mouse
on hotbar 1 instead should use the WoW preset, which is exactly that — worth
saying on the page, since it's a real cross-sell.

**Hardware limits hit:** 2 tokens per binding. A player wanting a *third* mouse
hotbar under `Ctrl+Shift+n` would need 3 tokens (fine), but `Ctrl+Alt+Shift+n`
(4 tokens) is impossible. Say so.

---

### 4.3 `preset-eso` — Elder Scrolls Online: bar + ultimate + quickslot

**The design point of this preset is restraint.** ESO gives you five ability
slots and an ultimate, and weapon swap gives you a *second* set of five on the
same keys. That is eight or nine binds total, not twelve
([ESO forums](https://forums.elderscrollsonline.com/en/discussion/452608/keybindings-for-best-preformance-tips-needed),
[ESO forums](https://forums.elderscrollsonline.com/en/discussion/445261/pc-players-what-keybinds-do-you-use-so-you-can-actually-play/p3)).
Filling the remaining four buttons with something would be padding.

| Slot | Tier | Action | Sends | Meaning |
|---|---|---|---|---|
| `side4` | **1** | `1` | 1 | Ability slot 1 (spammable) |
| `side5` | **1** | `2` | 2 | Ability slot 2 |
| `side7` | **1** | `3` | 3 | Ability slot 3 |
| `side8` | **1** | `4` | 4 | Ability slot 4 |
| `side1` | 2 | `5` | 5 | Ability slot 5 |
| `side2` | 2 | `r` | R | Ultimate |
| `side6` | 2 | `q` | Q | Quickslot (potion) |
| `side9` | 2 | `grave` | \` | Weapon swap — doubles every slot above |
| `side10` | 3 | `ctrl` | Ctrl (bare) | Sneak |
| `side3` `side11` `side12` | 3 | `none` | — | **Deliberately dead** |
| `fire` | — | `e` | E | Interact / synergy |
| `left` `right` `middle` | — | *unchanged* | | Light attack / block |

**Notes.**
- `side10` demonstrates the bare-modifier binding form (`parseAction` accepts a
  modifier with no key). It sends Ctrl held for as long as the button is held.
  **Caveat, and it is a real one:** one thumb cannot hold `side10` and press
  `side5`, so this sneak binding costs you the ability bar while sneaking. That
  is acceptable out of combat and useless in it. `[UNVERIFIED]` — whether the
  firmware actually holds a bare modifier for the duration of the press, versus
  sending a tap, has not been tested. If it taps, drop this binding to `none`.
- `side3`, `side11` and `side12` are `none` rather than omitted. Omitting them
  leaves the factory `F3`, `F11`, `F12` in place, and ESO binds F-keys.
- Block, dodge and bash stay on the keyboard/left-right click. They are timing
  actions that most ESO players already have in muscle memory; moving them to a
  thumb grid is a regression, not an upgrade.

---

### 4.4 `preset-gw2` — Guild Wars 2: weapon bar + profession

GW2 has more to bind than ESO and less structure than WoW: skills `1`–`5`
(weapon), `6` (heal), `7`–`9` (utility), `0` (elite), `F1`–`F5` (profession),
plus weapon swap. Common practice is to put the whole skill bar under the thumb
([GW2 forums](https://en-forum.guildwars2.com/topic/36979-what-kinds-of-keybinds-are-recommended-to-access-all-ability-buttons-in-combat/),
[GW2 wiki user keybinds](https://wiki.guildwars2.com/wiki/User:Wrin/Keybinds)).

| Slot | Tier | Action | Sends | Meaning |
|---|---|---|---|---|
| `side4` | **1** | `2` | 2 | Weapon skill 2 |
| `side5` | **1** | `3` | 3 | Weapon skill 3 |
| `side7` | **1** | `4` | 4 | Weapon skill 4 |
| `side8` | **1** | `5` | 5 | Weapon skill 5 |
| `side9` | 2 | `6` | 6 | Heal |
| `side1` | 2 | `7` | 7 | Utility 1 |
| `side2` | 2 | `8` | 8 | Utility 2 |
| `side6` | 2 | `9` | 9 | Utility 3 |
| `side3` | 3 | `0` | 0 | Elite |
| `side10` | 3 | `f1` | F1 | Profession skill 1 |
| `side11` | 3 | `f2` | F2 | Profession skill 2 |
| `side12` | 3 | `f3` | F3 | Profession skill 3 |
| `fire` | — | `grave` | \` | Weapon swap — pressed constantly in GW2 |
| `left` `right` `middle` | — | *unchanged* | | |

**Deliberately not bound:** skill `1`. It is the auto-attack chain — you press it
once and it repeats. Spending a tier-1 button on it would be the single worst
trade on this grid. Also unbound: `F4`/`F5` (only some professions have them; the
keyboard keeps them), dodge, and mount keys.

**Design judgement flagged:** putting weapon swap on `fire` rather than a side
button is mine. It is the most-pressed non-skill key in GW2 and `fire` is the
only button on this mouse that neither hand is otherwise using.

---

### 4.5 `preset-moba` — MOBA: summoners, items and shop

**The inversion.** In a MOBA the left hand is already parked on `Q W E R` and the
mouse is doing the actual playing. So the thumb grid should take everything
*except* abilities: summoner spells, the six item slots, the trinket, and the
shop/recall/camera cluster.

League defaults: summoner spells on `D` and `F`; item slots on `1`, `2`, `3`,
`5`, `6`, `7`; trinket on `4`
([League wiki — Controls and Hotkeys](https://wiki.leagueoflegends.com/en-us/Controls_and_Hotkeys)).
The odd `1 2 3 / 5 6 7` split is real and catches people out; the preset uses the
real defaults so no in-game rebinding is needed.

| Slot | Tier | Action | Sends | Meaning (League) |
|---|---|---|---|---|
| `side4` | **1** | `d` | D | Summoner spell 1 (Flash, usually) |
| `side5` | **1** | `f` | F | Summoner spell 2 |
| `side7` | **1** | `1` | 1 | Item slot 1 |
| `side8` | **1** | `2` | 2 | Item slot 2 |
| `side1` | 2 | `3` | 3 | Item slot 3 |
| `side2` | 2 | `4` | 4 | Trinket / ward |
| `side6` | 2 | `5` | 5 | Item slot 4 |
| `side9` | 2 | `6` | 6 | Item slot 5 |
| `side3` | 3 | `7` | 7 | Item slot 6 |
| `side10` | 3 | `b` | B | Recall |
| `side11` | 3 | `p` | P | Open shop |
| `side12` | 3 | `ctrl+r` | Ctrl+R | Level up ultimate |
| `fire` | — | `space` | Space | Centre camera on champion |
| `left` `right` `middle` | — | *unchanged* | | Right click is movement; never remap |

**Deliberately not bound:** `Q W E R`. Quick-cast abilities fire at the cursor,
so they'd technically work from the thumb — but the left hand is already there,
and burning four tier-1 buttons on keys that cost nothing is bad economics.
Also unbound: `Tab` (scoreboard), ping keys, and chat.

**Dota 2 variant** (same slots, different keys; Dota's defaults):

```
side4 -> d     side5 -> f      (ability slots D / F on some heroes; else spells)
side7 -> z     side8 -> x      (item slots 1 / 2)
side1 -> c     side2 -> v      (item slots 3 / 4)
side6 -> b     side9 -> n      (item slots 5 / 6)
side3 -> none                  (Dota has 6 item slots, not 7)
side10 -> none  side11 -> none (Dota's shop/courier binds vary too much to ship)
side12 -> none
fire  -> space                 (centre camera on hero)
```
`[UNVERIFIED]` Dota's item-slot defaults have moved between clients. Verify
against a current install before shipping; otherwise ship the League layout only
and mention Dota in prose.

---

### 4.6 `preset-fps` — FPS: utility, comms and DPI

**Fewer binds, on purpose.** An FPS player's left hand is on `WASD` and must stay
there. The thumb grid earns its keep on exactly two things: utility the left hand
can't reach mid-strafe (grenades, gadgets, comms), and DPI.

| Slot | Tier | Action | Sends | Meaning |
|---|---|---|---|---|
| `side4` | **1** | `4` | 4 | Utility / grenade 1 |
| `side5` | **1** | `5` | 5 | Utility / grenade 2 |
| `side7` | **1** | `g` | G | Throw grenade / drop |
| `side8` | **1** | `v` | V | Melee |
| `side1` | 2 | `q` | Q | Last weapon |
| `side2` | 2 | `e` | E | Use / interact |
| `side6` | 2 | `c` | C | Crouch |
| `side9` | 2 | `x` | X | Comms / radio menu |
| `side3` | 3 | `dpi-` | — | Step **down** to sniper DPI |
| `side10` | 3 | `dpi+` | — | Step back **up** |
| `side11` | 3 | `b` | B | Buy menu (CS) / loadout |
| `side12` | 3 | `none` | — | Deliberately dead |
| `fire` | — | `dpi-cycle` | — | Cycle DPI stages (matches the existing built-in FPS preset) |
| `left` `right` `middle` | — | *unchanged* | | |

**The big honest caveat — there is no sniper button.** The classic FPS feature is
*hold* to drop DPI, *release* to restore. The M913's action table has no
momentary DPI action: `dpi+`, `dpi-`, `dpi-cycle` and `dpi-loop` are all stepped
toggles. The two-button `dpi-` / `dpi+` pair on `side3`/`side10` is the closest
this hardware gets, and it is worse: you must remember to press the second one.
`[UNVERIFIED]` — `dpi-loop` is undocumented in the protocol notes and *might*
turn out to be a hold-to-cycle behaviour. It is worth ten minutes on real
hardware, because if it is momentary, this preset gets meaningfully better.

**Why the DPI pair is in tier 3.** Scoping is a deliberate act with a beat of
setup time. The reach is free. An accidental DPI change mid-fight is not.

**Rapid-fire is not shipped.** `fire:58:3` would turn one click into a burst.
Competitive titles' anti-cheat policies treat one-input-many-actions macros as
prohibited (Riot's Vanguard and Blizzard's ToS both cover this), and bans do not
care that the macro lived in firmware. `fire` gets `dpi-cycle` instead. If the
gallery ever exposes burst-fire it should be a separate, explicitly-labelled
"single-player only" preset — not a default.

**Deliberately not bound:** weapon slots `1`–`3` (the left hand reaches those
without leaving WASD), reload, jump, sprint, and push-to-talk. Push-to-talk in
particular wants a button the thumb can *hold* for seconds, which conflicts with
every ability press — keep it on a keyboard key or a dedicated thumb button on
the side of the mouse if one exists.

---

### 4.7 `preset-obs` — Streaming: twelve inert keys

**The design idea:** the mouse should carry no meaning at all. It sends F13–F24 —
keys that physically don't exist on normal keyboards, so nothing else in the OS
or in any game will ever claim them — and OBS decides what each one does
([Elgato](https://www.elgato.com/us/en/explorer/products/stream-deck/how-to-use-elgato-stream-deck-with-any-application/),
[OBS forums](https://obsproject.com/forum/threads/any-way-to-use-f13-f24-keys-for-shortcuts-using-a-stream-deck.143192/)).
This is the only preset here that is genuinely conflict-proof.

| Slot | Tier | Action | Suggested OBS binding |
|---|---|---|---|
| `side4` | **1** | `f16` | Mute/unmute mic — the one you need instantly |
| `side5` | **1** | `f17` | Push-to-talk (hold) |
| `side7` | **1** | `f19` | Scene: Gameplay |
| `side8` | **1** | `f20` | Scene: Full-screen camera |
| `side1` | 2 | `f13` | Scene: Starting soon |
| `side2` | 2 | `f14` | Scene: BRB |
| `side6` | 2 | `f18` | Toggle camera source |
| `side9` | 2 | `f21` | Toggle alert/overlay source |
| `side3` | 3 | `f15` | Scene: Ending |
| `side10` | 3 | `f22` | Start/stop **recording** |
| `side11` | 3 | `f23` | Save replay buffer |
| `side12` | 3 | `f24` | Start/stop **stream** |
| `fire` | — | `media_mute` | System *output* mute (not the mic — see below) |
| `left` `right` `middle` | — | *unchanged* | |

Slot→key is a straight `side<n>` → `f(12+n)` so the table is trivially checkable.
The tiering lives in the *recommended OBS assignment* column, not in the mapping —
which is the right separation, because OBS owns the meaning.

**Limits and caveats:**
- **There is no microphone-mute key anywhere in this action catalog.**
  `media_mute` is system output mute. Mic mute must always go through an
  application hotkey. This bites the meetings preset much harder; see
  [`professional-presets.md`](./professional-presets.md) §5.
- `[UNVERIFIED]` Some OBS builds have had trouble accepting a bare F13–F24 press
  in the hotkey picker ([OBS forums](https://obsproject.com/forum/threads/f13-f24-cant-be-bound-on-their-own.195757/),
  [obs-studio#2377](https://github.com/obsproject/obs-studio/issues/2377)). Test
  on current OBS on macOS, Windows and Linux before this ships; if a platform
  fails, fall back to `ctrl+shift+f1`…`ctrl+shift+f12` (3 tokens, still legal).
- macOS intercepts some function keys at the system level. Needs a real test pass.

---

## 5. Naming and organisation in the UI

### 5.1 Naming scheme

`<Subject> — <Qualifier>`, em dash, subject first so the list sorts usefully:

```
WoW — Action Bar 1
FFXIV — Ctrl Hotbar
ESO — Skill Bar
Guild Wars 2 — Skill Bar
League of Legends — Items & Summoners
FPS — Utility & DPI
Streaming — OBS Hotkeys
Office Essentials — macOS
Office Essentials — Windows
Software Development — VS Code (macOS)
Meetings — Zoom (Windows)
```

Rules: subject is what the player would search for (the game or the job, never
the hardware); qualifier is the layout's angle or the OS, never a version number;
no "Pro"/"Ultimate"/"Elite"; never longer than ~34 characters, because the preset
picker is a dropdown.

### 5.2 Grouping

Four categories, in this order in the UI: **Professional**, **Creative**,
**Gaming**, **System**. Professional first — that is the product's positioning,
and it is also the group the largest number of visitors will want.

### 5.3 The model change

`UserProfile` is persisted (`PersistedProfiles`) and exported
(`ProfileExportFile`); do not add display metadata to it. Add a wrapper instead,
so built-in presets carry gallery/SEO metadata and user profiles stay schema-
stable:

```ts
// src/profiles/preset-catalog.ts  (new)
export type PresetCategory = "professional" | "creative" | "gaming" | "system";
export type PresetOS = "mac" | "win" | "linux";

export interface BuiltInPreset {
  profile: UserProfile;          // exactly today's shape — id, name, config
  category: PresetCategory;
  /** Absent = works the same on every OS. Present = one of a per-OS family. */
  os?: PresetOS;
  /** Presets sharing a family id are the same logical layout, different OS. */
  family?: string;               // "office-essentials"
  /** URL slug for /presets/<slug>; also the deep-link key for ?preset=<slug>. */
  slug: string;
  summary: string;               // one line, gallery card + meta description
  /** True if the preset does nothing useful until the user binds keys in-app. */
  requiresAppSetup: boolean;
}
```

`BUILT_IN_PRESETS` stays as the array of `.profile`s so nothing downstream
breaks; the new catalog is what the gallery and the picker read. When `os` is
set, the picker shows only the entry matching the detected platform by default,
with the others behind a "different OS?" disclosure — never a list of three
near-identical names.

### 5.4 Which three to ship first

**Given the productivity-first positioning (recommended):**

1. **Office Essentials** (macOS + Windows variants) — largest audience, works the
   instant it's applied, zero setup in any other app, and it is the preset the
   "best productivity mouse" claim has to be able to point at.
2. **Software Development — VS Code** — the highest-intent, highest-value
   audience; developers are also the people most likely to be on macOS or Linux
   and therefore locked out of Redragon's own software entirely. Strong
   word-of-mouth per user.
3. **Meetings — Zoom / Teams** — the clearest single-button value story in the
   whole set ("mute is under your thumb"), and the easiest landing page to rank
   for. Ships as per-app variants.

**If the audience is office users rather than MMO players** — the same three, in
the same order. The question resolves to the same answer, which is itself the
argument for the ordering: nothing in the professional set is niche.

**If the audience is MMO players:** 1. WoW — Action Bar 1, 2. FFXIV — Ctrl
Hotbar, 3. FPS — Utility & DPI. WoW first because it is the archetype and
requires no in-game setup; FFXIV second because its convention genuinely differs
and nobody else documents that; FPS third because it reaches the largest
non-MMO audience with the fewest bindings to get wrong.

Whatever ships first, keep the existing four built-ins (`Default`,
`FPS / Fast Aim`, `Productivity / Low DPI`, `RGB Showcase`) in place. `Default`
is referenced by name throughout `productivity-setup.html`; renaming or re-
tiering it would break that page. New presets are additions, not replacements.

---

## 6. What a preset landing page needs

Assuming a gallery of static pages at `/presets` with detail pages at
`/presets/<slug>`, matching the existing hand-written HTML pages
(`productivity-setup.html` is the model for tone, length and structure).

**Per detail page:**

1. **Title / H1 / meta** naming the game or job *and* the mouse class, e.g.
   "Redragon M913 World of Warcraft Button Mapping". `<title>` ≤ 60 chars,
   canonical to `https://mouseconfig.app/presets/<slug>`, OG + Twitter cards
   mirroring the existing pages.
2. **Two-sentence answer at the top.** What the preset does and what it costs to
   set up. Visitors arriving from search have one question.
3. **The mapping table** — slot, physical position ("inner-rear, middle row"),
   action string, what it does. The physical-position column is what makes the
   page useful away from the configurator, and it is what a screenshot-sharer
   will paste into a forum.
4. **An "Open in configurator" button** deep-linking `/?preset=<slug>`. This
   needs a small addition in `src/main.ts`: read the param on load, resolve it
   against the preset catalog, load it into the working config *without*
   writing to the device, and show the normal Apply affordance. Never auto-apply
   from a URL.
5. **A copy-paste JSON block** in `ProfileExportFile` shape, so the page still
   works for someone on a browser without WebHID.
6. **The other half of the setup** — the in-game or in-app keybind steps, as a
   numbered list. Mark the preset `requiresAppSetup` and let the page render a
   warning banner from that flag rather than hand-writing it each time.
7. **"What this leaves unbound, and why."** This section is the credibility of
   the whole gallery. Every preset above has one; use it.
8. **OS switcher** where `family` has more than one member, with the non-matching
   variants rendered in the HTML (so they're indexable) but collapsed.
9. **Structured data:** `HowTo` for the setup steps, `FAQPage` for the
   objections ("Do I need Redragon's software?" "Will this get me banned?"
   "Does it work on Linux?"). `BreadcrumbList` → Home › Presets › <name>.
10. **Internal links** to the configurator, to `/productivity-setup`, to the
    gallery index, and to two sibling presets. Add every page to
    `sitemap.xml` and add a "Presets" entry to the nav dropdown in every page's
    `site-nav`.

**Per gallery index page:** grouped by the four categories, each card showing
name, `summary`, category and an OS badge. This is the page that should rank for
"MMO mouse button mapping" generically.

**One content-quality warning.** Twelve pages that differ only by a table are
thin content and will be treated as doorway pages. Each detail page needs real,
non-templated prose — the reasoning from this document, in the voice of
`productivity-setup.html`, is exactly that prose. Budget ~500–800 words of
genuine argument per page, or ship fewer pages.

---

## 7. What the current action catalog cannot express

Collected so the engineering team can decide what, if anything, to change. Items
marked **hardware** cannot be fixed in software; items marked **software** are
codebase-level gaps.

| # | Gap | Impact | Kind |
|---|---|---|---|
| 1 | **4-token combos.** `MAX_COMBO_TOKENS = 3`, so `ctrl+alt+shift+<key>` is impossible and `buildButtonMappingPackets()` throws. | Blocks the four-modifier hotbar schemes some FFXIV/WoW players use, and some DAW/IDE chords. | hardware |
| 2 | **No momentary DPI shift.** All four DPI actions are stepped. | No sniper button. The headline feature of an FPS mouse cannot be expressed. | hardware |
| 3 | **`dpi-loop` is undocumented.** Not described in the protocol notes. | Might secretly be the momentary behaviour in #2. Worth testing. | unknown |
| 4 | **No microphone mute.** `media_mute` is system *output* mute. There is no mic-mute usage in the table. | Every meeting preset must use per-application hotkeys, which are app-scoped and break when the window isn't focused. | hardware |
| 5 | **No double-click.** `three_click` exists; there is no `double_click`. | A staple office binding is unavailable. | hardware |
| 6 | **No DPI-button slot.** `buttonIndexOrder` has 16 entries and none is the DPI rocker. | DPI control costs a side button. | hardware |
| 7 | **`fire:<speed>:<times>` semantics unknown.** Units of `speed`, and what `times: 0` means, aren't documented. | Can't write a preset that uses it responsibly. | unknown |
| 8 | **No macros or sequences.** One action per button; no text, no multi-step. | "git commit", "type my email", Resolve/Premiere multi-step edits — all impossible. | hardware |
| 9 | **No tap-vs-hold, no layers.** A button can't mean one thing tapped and another held, and can't shift the other eleven. | 12 buttons is a hard ceiling; no 24-binding layer scheme. | hardware |
| 10 | **No OS-aware modifier.** The M908 has `compatibility_copy` etc.; the M913 action table has **no `compatibility_*` actions at all**. | Every Cmd-vs-Ctrl preset must be duplicated per OS. See [`professional-presets.md`](./professional-presets.md) §2. | hardware |
| 11 | **Six media actions are parseable but not in the quick-pick catalog:** `media_calc` `media_email` `media_search` `media_home` `media_computer` `media_player`. | Users can only reach them via "Custom…". Cheap win: add a "Media — Launch" group to `ACTION_CATEGORIES`. | **software** |
| 12 | **Bare-modifier bindings are legal but undiscoverable.** `parseAction("ctrl")` works; the combo builder gives no way to produce it. | ESO sneak, GNOME Activities (bare `super`) can't be set from the UI. | **software** |
| 13 | **Presets can't declare an OS or a category.** `BUILT_IN_PRESETS` is name + config only. | Blocks the gallery and the per-OS variants. Fixed by §5.3. | **software** |
| 14 | **No deep link into a preset.** | Blocks the landing-page strategy. Fixed by §6.4. | **software** |

Items 11–14 are the only ones worth engineering time before the gallery ships.
Items 1, 2, 4, 5, 6, 8 and 9 are the hardware's ceiling and belong in an honest
"what this mouse can't do" section on the site — which, given the competition
doesn't publish one, is worth more than it costs.

---

## Changelog

- **v0.1 — 2026-09-29.** First draft. Seven game presets specified; reachability
  model, naming scheme, gallery spec and catalog-gap list. Nothing tested on
  hardware.

## Sources

- [Tom's Hardware — Redragon M913 Impact Elite review](https://www.tomshardware.com/reviews/redragon-m913-impact-elite)
- [MakeUseOf — Redragon M913 Impact Elite review](https://www.makeuseof.com/redragon-m913-impact-elite-wireless-gaming-mouse-review/)
- [manuals.plus — Redragon M913 user manual](https://manuals.plus/ae/1005004662195682)
- [mmo-champion — "Does anyone use those 12 button mouse like Naga or G600?"](https://www.mmo-champion.com/threads/1295521-Does-anyone-use-those-12-button-mouse-like-Naga-or-G600)
- [Elder Scrolls Online forums — "Are you comfortable using an MMO mouse? 12 buttons"](https://forums.elderscrollsonline.com/en/discussion/615177/are-you-comfortable-using-an-mmo-mouse-12-buttons/p2)
- [Legit Reviews — Logitech G600 MMO mouse review](https://www.legitreviews.com/logitech-g600-mmo-gaming-mouse-review_2135/4)
- [Blizzard forums — "Keybinds tips with 12 mouse buttons"](https://us.forums.blizzard.com/en/wow/t/keybinds-tips-with-12-mouse-buttons/719341)
- [Blizzard forums — "How are your keybinds set?"](https://us.forums.blizzard.com/en/wow/t/how-are-your-keybinds-set/239597)
- [mmosetup — WoW MMO mouse setup](https://mmosetup.com/guides/wow-mmo-mouse-setup/)
- [SaltedXIV — FFXIV mouse & keyboard keybinding guide](https://saltedxiv.com/guides/mouse-keyboard-keybinding-guide)
- [Late to the Party Finder — FFXIV hotbar layouts and keybinds](https://latetothepartyfinder.com/ffxiv-hotbar-layouts-and-keybinds-mouse-and-keyboard/)
- [Square Enix — FFXIV hotbar keybind settings](https://na.finalfantasyxiv.com/uiguide/know/know-hb/hotbar_shortcut.html)
- [ESO forums — "Keybindings for best performance"](https://forums.elderscrollsonline.com/en/discussion/452608/keybindings-for-best-preformance-tips-needed)
- [ESO forums — "PC players, what keybinds do you use"](https://forums.elderscrollsonline.com/en/discussion/445261/pc-players-what-keybinds-do-you-use-so-you-can-actually-play/p3)
- [Guild Wars 2 forums — recommended keybinds for ability access](https://en-forum.guildwars2.com/topic/36979-what-kinds-of-keybinds-are-recommended-to-access-all-ability-buttons-in-combat/)
- [Guild Wars 2 forums — using the mouse for keybinds](https://en-forum.guildwars2.com/topic/46068-question-about-using-mouse-for-keybinds/)
- [Guild Wars 2 Wiki — User:Wrin/Keybinds](https://wiki.guildwars2.com/wiki/User:Wrin/Keybinds)
- [League of Legends Wiki — Controls and Hotkeys](https://wiki.leagueoflegends.com/en-us/Controls_and_Hotkeys)
- [Elgato — using Stream Deck with any application (F13–F24)](https://www.elgato.com/us/en/explorer/products/stream-deck/how-to-use-elgato-stream-deck-with-any-application/)
- [OBS forums — F13–F24 hotkeys with Stream Deck](https://obsproject.com/forum/threads/any-way-to-use-f13-f24-keys-for-shortcuts-using-a-stream-deck.143192/)
- [OBS forums — "F13–F24 can't be bound on their own?"](https://obsproject.com/forum/threads/f13-f24-cant-be-bound-on-their-own.195757/)
- [obs-studio issue #2377 — F13–F24 mis-localized](https://github.com/obsproject/obs-studio/issues/2377)
