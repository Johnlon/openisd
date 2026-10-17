# What-if Close test: curve picture differs after Close (flaky)

Status: closed (T335)

Spec `what-if-panel.browser.spec.ts` "Learn changes the charts but never the project, and Close puts the curve back" failed in CI run 39023047033 (shard 5): after Close the chart picture hash stayed fef4c90c instead of 7d5bfae5.

Cause: not the app. Close restores the chart every time. The test took its "before" picture while the "Project imported from sample-project.owpr" message still floated over the chart, so the picture contained the message. Under load the message is still there when the picture is taken (reproduced locally: 6 of 6 failures in a CPU-loaded run; the picture 3 s later is fef4c90c with no user action). After Close the message was long gone.

Fix: the spec waits for the "Project imported" message to go before taking the "before" picture.

## Reopened, 17 Oct 2026 (T368)

Status: open.

It failed again on GitHub Actions run 39058103437 (land/T367, browser shard 5), after the toast fix: the before picture hash was 7b277318, and after Close e2475ec9, unchanged for 20 s. It also failed on land/T340 (runs 39027725227, 39028348390). Locally it passes 6 of 6.

The same cause turned the visual pictures red on run 39059365743 (land/T367): desktop tab-box, tab-filters and box-vented each differ by 232 pixels.

What the pictures show:
- The only pixels that differ are the chart's tick labels. The curve, the grid and every text outside the chart match.
- The baseline's labels are in Inter. The red run's labels are in DejaVu Sans, the `system-ui` fallback: "1.00k" is 2 px wider and its "1" has a foot, which Inter's has not.
- The text outside the chart is in Inter in the same picture, so Inter had loaded and the chart was not drawn again after it.
- Each red picture was the first desktop chart its worker drew (workers 0, 1, 5).
- e2475ec9 is the chart in Inter: every local run gives it. The What-if "before" picture 7b277318 was the chart in the fallback font, and Close drew it again in Inter.

Not reproduced locally: with the Inter files held back 0–4 s, and the page's CPU slowed 8× and 20× (Chrome emulation), the chart always ends in Inter (e2475ec9). `GraphPanel.vue` redraws on `document.fonts.ready` at mount, and that redraw happens in every local case.

Unknown: why on the CI runner the chart's last draw comes before Inter is usable for the canvas, with no draw after it.
