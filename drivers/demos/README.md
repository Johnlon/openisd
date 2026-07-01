# Resonate demo drivers

Hand-authored generic demo drivers shipped with the app — **not scraped, not real
products**. Representative T/S values so a first-time user has something to look at.

- `demo-generic-6.5in-woofer.wdr` — the app's **default driver** on first open (no
  saved selection) and the target of the **"Reset to demo"** button in the driver
  library. Mirrored by `DEFAULT_DRIVER` in `packages/ui/src/store.js` — keep the two
  in sync if either changes.
- `demo-generic-1in-tweeter.wdr` — a generic 1" dome tweeter.

## Rules for AI

- These files are **human-authored, not scraper output**. No scraper targets
  `drivers/demos/`; scrapers, batch scripts, and cleanup passes must **leave this
  folder alone** (same status as `drivers/matt/`).
- They appear in the in-app driver browser because `drivers/demos` is listed in
  `drivers/sources.json` and picked up by `scripts/bundle-drivers.mjs`.
- If you edit the demo woofer's parameters, update `DEFAULT_DRIVER` in
  `store.js` to match, and re-run the bundler.
