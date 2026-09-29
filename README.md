# MouseConfig

Configure gaming mice from your browser — no driver, no vendor software, no
install. Built for the people the vendor tools leave out: **macOS and Linux
owners of Redragon MMO mice**, who otherwise have no way to remap their
buttons at all.

**Live site: [mouseconfig.app](https://mouseconfig.app)**

Everything runs client-side over
[WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API). There
is no backend, no account, and nothing about your device or profiles is ever
uploaded.

## Supported mice

| Mouse | Status | What you can configure |
| --- | --- | --- |
| Redragon M913 Impact Elite | Working, tested on hardware | Polling rate, 5 DPI stages with per-stage indicator colours, LED mode/colour/brightness/speed, all 16 buttons (including key combinations and macOS shortcuts) |
| Redragon M908 Impact | **Beta — never tested on hardware** | All 5 onboard profiles, DPI stages, LED modes, polling rate, scroll speed, button actions |
| Redragon M719 Invader | Not started | — |

The M913 support is verified against a real mouse. **M908 support was built
from public protocol documentation only** — it is structurally correct as
far as the notes go, but no packet has ever reached a physical M908. If you
own one, testing it is the single most useful contribution you can make.

## Also on the site

- **[.jmk file decoder](https://mouseconfig.app/jmk-decoder)** — reads
  Redragon's Windows profile exports, which can't otherwise be opened on
  macOS or Linux. Works without a mouse connected.
- **[DPI checker](https://mouseconfig.app/dpi-checker)** — measures your
  mouse's real DPI by pointer lock over a measured physical distance, and
  tells you whether it got raw (unaccelerated) input.
- **[Sensitivity converter](https://mouseconfig.app/sensitivity-converter)**
  — keeps your aim consistent across a DPI change or a game switch.
- **[Productivity button mapping](https://mouseconfig.app/productivity-setup)**
  — a guide to using the M913's 12 side buttons for work rather than games.

The last three need no WebHID, so they work in any browser, including Safari,
Firefox and mobile.

## Browser support

WebHID is required for the configurators: **Chrome, Edge, Brave or Opera on
desktop**. Safari and Firefox don't implement it, and neither do mobile
browsers; the site says so rather than failing silently.

**macOS 26.6.2 and later** additionally blocks unprivileged processes from
writing HID feature reports to these mice, so Apply fails from a normally
launched browser. The site explains the one-time workaround (launching
Chrome with elevated rights for a throwaway profile) on the homepage.

## Development

Requires Node 20+ (developed on 22/26).

```bash
npm install
npm run dev      # vite dev server
npm test         # vitest — protocol builders, profile stores, tool maths
npm run build    # tsc --noEmit && vite build -> dist/
npm run preview  # serve the built site
```

Pages are plain multi-page HTML with TypeScript modules — no framework, no
router, no CSS build step. Every page must be registered in
`vite.config.ts` under `rollupOptions.input` or the build silently drops it.

In production Cloudflare serves each page at its extensionless path
(`/m908`), so links, canonicals and the sitemap use that form; a small Vite
middleware in `vite.config.ts` mirrors that locally.

### Layout

```
index.html, m908.html, …   one file per page
public/styles.css          shared design tokens and components
src/core/                  WebHID transport, device identification, platform checks
src/profiles/              per-device protocol builders, presets, profile storage
src/tools/                 DPI and sensitivity maths (no device access)
docs/protocol-notes/       what's known about each mouse's USB protocol
```

The protocol layer is deliberately separate from the pages: adding a mouse
means a new module in `src/profiles/` plus a page, not changes to the core.

## Protocol notes and prior art

`docs/protocol-notes/` documents what's known about each device's report
format, including what's still guesswork. Findings there came from public
sources, primarily [dokutan/mouse_m908](https://github.com/dokutan/mouse_m908)
(GPL-3.0) for the M908 family and the MIT-licensed
[UtechSmart Venus Pro protocol spec](https://github.com/Es00bac/UtechSmart-Venus-Pro-Linux-MMO-Mouse-Utility)
for the Areson M913 hardware.

The implementations here are written from the documented report formats
rather than ported from GPL sources, so this project stays independently
licensed.

Anything marked "inferred" or "not verified on hardware" in those notes
means exactly that — treat it with suspicion and confirm before relying on
it.

## Contributing

Useful contributions, roughly in order of value:

1. **Test the M908** and report what works. Nothing beats a real device.
2. **Report your device's identifiers.** The M913's USB product-name string
   still isn't recorded, and several Redragon models share USB IDs with
   other brands — the connect log prints everything needed.
3. **Protocol findings** for any mouse in these families, with evidence.
4. **Bug reports** with the page's log output attached.

Please don't add support for a device you can't test; an untested device
that appears supported is worse than one that's absent.

## License

[Apache License 2.0](LICENSE) — you may use, modify and redistribute this,
including commercially, provided you keep the licence and attribution. It
also grants an explicit patent licence, which a bare MIT licence does not.

## Disclaimer

MouseConfig is an independent project and is not affiliated with, endorsed
by, or sponsored by Redragon or any other hardware brand. Brand and model
names are used only to identify the hardware this tool configures.

Writing settings to a mouse always carries some risk. The code sends only
the documented configuration reports and never touches firmware, but it
comes with no warranty — see the disclaimer above and use it at your own
risk.
