# M913 (Areson) — reading the configuration back

**Provenance**: a USBPcap capture of Redragon's own Windows software reading
the configuration from a real M913 (USB `25a7:fa08`, bcdDevice `0x1333`),
taken by the project owner in a Windows VM on 2026-10-01. The capture itself
isn't committed. Everything below is observed in that capture and cross-checked
against the write format in [m913.md](m913.md); nothing here has been sent from
this site yet.

## Transport

Same channel as writes: `SET_REPORT` (feature, report ID `0x08`) on
interface 1, 17 bytes. The mouse answers each request with a 17-byte
**input report `0x09`** on interrupt endpoint `0x82` (same interface). In
WebHID terms: `sendFeatureReport(0x08, payload16)`, then an `inputreport`
event with `reportId === 0x09`.

Checksum is the same as for writes, on both directions:
`byte[16] = (0x55 - sum(byte[0..15])) & 0xFF`.

## Commands seen, in order

| # | Request (bytes 0–15, checksum omitted) | Reply (report `0x09`) | Notes |
|---|---|---|---|
| 1 | `08 03 00…` | `09 03 00 00 00 01 01 …` | unknown — status/hello |
| 2 | `08 01 00 00 00 04 03 3a 49 48 …` | `09 01 00 00 00 04 42 bd 23 23 …` | unknown — 4-byte exchange (handshake/ID?) |
| 3 | `08 08 00 00 04 02 …` | `09 08 00 00 04 02 03 52 …` | read 2 bytes at `0x0004` |
| 4 | `08 02 00 00 00 01 01 …` | `09 02 00 00 00 01 01 …` | unknown |
| 5… | `08 08 00 HH LL 0a …` | `09 08 00 HH LL 0a d0 … d9` | **read 10 bytes at address `HHLL`** |
| last | `08 04 00…` | `09 04 00 00 00 02 0a 01 …` | finalize (same sub-command as write finalize) |

So **sub-command `0x08` = read**: byte 3–4 = address (big-endian), byte 5 =
length (always `0x0a` here); the reply echoes bytes 1–5 and carries the data
in bytes 6–15. Whether steps 1, 2 and 4 are required before reads is not yet
known — replay them as captured until tested.

## Address map observed

| Range | Contents | Matches write side? |
|---|---|---|
| `0x0000–0x005F` | settings: polling rate at `0x0000` (`01 54` = 1000 Hz + `0x55-x` check byte), DPI stages, LED (`0x54`, `0x5c`) | yes — same value/check-byte pairs the writer sends |
| `0x0060–0x009F` | 16 × 4-byte button actions, in `buttonIndexOrder` | yes — e.g. `01 01 00 53` = left, `05 00 00 50` = keyboard |
| `0x0100–0x02FF` | per-button keyboard event lists, 0x20 apart, addresses = `keyboardKeyAddressByProtocolSlot` | yes |
| `0x0301 + n·0x180` | macro slots; names stored UTF-16LE at the slot start (the owner's: "CopyinKali", "PasteinKali", "goto", "BookMarks", "HoldAlt") | not used by this site |

Keyboard event list format: `count`, then `count` × 3-byte events
`(type, code, 0x00)` — `0x80`/`0x40` = modifier down/up (code = modifier
bits: ctrl 1, shift 2, alt 4, super 8), `0x81`/`0x41` = key down/up (code =
HID usage, as in `keyCodes`), followed by one trailing byte.

## Decoded example (the owner's mouse at capture time)

side1 `super+c`, side2 `super+v`, side3 `ctrl+tab`, side4 `ctrl+left`,
side5 `ctrl+right`, side6 `ctrl+shift+tab`, side7 `shift+super+t`,
side8 `super+space`, side9 `alt+tab`, side10 `super+w`, side11 **`shift`
alone** (events: shift down, shift up — so the firmware stores a bare
modifier), side12 `ctrl+up`, fire `enter`; left/right/middle = default
clicks.

## Open questions before shipping "Load from mouse"

1. Are commands 1, 2 and 4 needed, and what does the 4-byte exchange in
   command 2 mean?
2. Does WebHID deliver input report `0x09` on macOS/Windows/Linux? It's on
   the vendor collection, so it should — and on macOS the write gate may or
   may not also block reads.
3. Compx-hardware M913s: same read command? Untested.
