# Mouse Configurator (Web)

A free, browser-based configurator for gaming mice, starting with the
Redragon M913 Impact Elite. No install required — runs entirely client-side
via [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API).

Sister project: [RedragonM913Configurator](../RedragonM913Configurator) is
the native macOS app this is spun out from — that one stays as-is (paid,
native, all platforms via libusb+admin elevation). This project is a
separate product: free, ad-supported, browser-only, multi-model.

## Why a separate project

- Different distribution model (web, ad-monetized) vs. the native app
  (paid, signed/notarized `.app`).
- Different technical approach: WebHID instead of libusb, so it only needs
  a compatible browser (Chrome/Edge — WebHID isn't supported in Safari or
  Firefox) and no admin/root elevation.
- The USB report protocol for each mouse needs an independent
  implementation here, not a port of `m913-ctl` — that project is
  GPL-3.0, and this one needs to stay decoupled from it license-wise (its
  own clean-room protocol implementation, based on public report format
  info, not on m913-ctl's source).

## Plan (not yet built)

1. Prove out the M913 alone end-to-end in the browser: WebHID connect →
   read/write the same report structure `m913-ctl` uses → apply polling
   rate / DPI / LED / button remaps.
2. Once that works, generalize into a device-profile system (one module per
   supported mouse: report format + button/action map) so adding a new
   model doesn't require touching the core app.
3. Ship as a static site (no backend needed for the configurator itself)
   with display ads, and a GitHub Sponsors / Buy-Me-a-Coffee link.
4. Naming/branding: avoid leading with any one manufacturer's trademark in
   the site's own name/domain (e.g. avoid "redragon-*.com") — describe
   compatibility per-model instead ("Works with: Redragon M913, ...").

## Status

Just scaffolded — no code yet. Tech stack (plain JS vs. a framework, hosting,
domain) still to be decided.
