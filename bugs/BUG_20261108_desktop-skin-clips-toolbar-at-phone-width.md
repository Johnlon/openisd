# Desktop skin in a phone-sized window: toolbar buttons run off the right edge

Status: RESOLVED (T734, 8 Nov 2026). Found by John's AI live review, round 3.

With the desktop skin at 374 px wide (a phone that chose "Switch to desktop view", or a narrow desktop window) the toolbar was one non-wrapping row. Info, the cursor readout, Reset all charts and Maximise sat past the right edge (up to x 1121) and were cut off by the window. At 1024 px the Reset and Maximise buttons were cut too.

Fix: the toolbar, its icon group and the cursor readout wrap onto more lines instead of running on. Spec: `packages/ui/test/ui/desktop-toolbar-fits-window.browser.spec.ts` (374 x 705 and 1024 x 768, every toolbar button inside the window).
