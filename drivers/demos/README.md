# OpenISD demo drivers

Hand-authored generic demo drivers shipped with the app — **not scraped, not real
products**. Representative T/S values so a first-time user has something to look at.

**Format: `.owdr` only (human decision, 2026-07-31)** — the same record the app writes on
Save-As and bundles from a collection's `openisd.yml`. `.wdr` is never bundled; the app
reads and writes it in memory from this record instead.

Both files still carry the flat `{ inputs: … }` `DriverJSON` shape rather than the
`OpenISDRecord`/YAML shape `ARCHITECTURE.md` AD-8 defines, so they need regenerating when
that shape lands.

- `demo-generic-6.5in-woofer.owdr` — the app's **default driver** on first open (no saved
  selection) and the target of the **"Reset to demo"** button. `DEFAULT_DRIVER` in
  `packages/ui/src/store.ts` is a separate hardcoded literal, not loaded from this file at
  runtime. Keep the two in sync if either changes.
- `demo-generic-1in-tweeter.owdr` — a generic 1" dome tweeter.

## Rules for AI

- These files are **human-authored, not scraper output**. No scraper targets
  `drivers/demos/`; scrapers, batch scripts, and cleanup passes must **leave this
  folder alone**.
- **Do not add `.wdr` files back here.** The standing decision is `.owdr`-only, and the
  bundler ignores `.wdr` entirely, so one added here would simply never reach the app.
- If you edit the demo woofer's parameters, update `DEFAULT_DRIVER` in `store.ts` to match.
