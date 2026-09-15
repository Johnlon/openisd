# UI Live Diagnosis

When a user reports that a screen, layout, spacing, sizing, or styling is wrong, do not guess
from the source or immediately run a build/test cycle.

1. Inspect the live app at `http://localhost:4000/`.
2. Confirm port `4000` is running Vite dev/HMR, not the static preview bundle. If it is down,
   start Vite directly with `npx vite --host 0.0.0.0 --port 4000 --strictPort`; bypass `npm run
   dev` if its `predev` hook would bundle or lint before starting.
3. Capture a screenshot in `build/` and inspect the actual rendered DOM. Measure the relevant
   bounding boxes, computed widths, positions, and text wrapping. The screenshot and measurements
   are the evidence for the diagnosis.
4. Fix the rendered cause, not an assumed source cause. In particular, check flex shrinking,
   grid placement, selector specificity/order, scoped Vue CSS, stale preview bundles, and service
   worker caching.
5. Re-check the live page and capture a second screenshot/measurement after the edit. Keep builds,
   unit tests, and browser suites until the layout is visually correct, unless the user explicitly
   asks for verification first.

Diagnostic browser automation is permitted for screenshots and DOM measurements only. Do not turn
this workflow into a Playwright test run unless the user asks for browser tests.
