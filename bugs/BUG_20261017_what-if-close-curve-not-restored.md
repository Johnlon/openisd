# What-if Close test: curve picture differs after Close (flaky)

Status: closed (T335)

Spec `what-if-panel.browser.spec.ts` "Learn changes the charts but never the project, and Close puts the curve back" failed in CI run 39023047033 (shard 5): after Close the chart picture hash stayed fef4c90c instead of 7d5bfae5.

Cause: not the app. Close restores the chart every time. The test took its "before" picture while the "Project imported from sample-project.owpr" message still floated over the chart, so the picture contained the message. Under load the message is still there when the picture is taken (reproduced locally: 6 of 6 failures in a CPU-loaded run; the picture 3 s later is fef4c90c with no user action). After Close the message was long gone.

Fix: the spec waits for the "Project imported" message to go before taking the "before" picture.

## Reopened 17 Oct 2026 (bob)

Status: open.

It failed again on GitHub Actions run 39058103437 (land/T367, shard browser 5), after the toast fix: the before picture hash was 7b277318, after Close e2475ec9, unchanged for 20 s. It also failed on land/T340 (runs 39027725227, 39028348390). Locally it passes 6 of 6. CI kept no picture, so the difference is not seen yet.

Likely cause, not proven: the chart draws its text in "Inter", loaded lazily. `GraphPanel.vue` redraws once on `document.fonts.ready` at mount and never again when a later font load finishes. On a slow runner the before picture can be drawn in the fallback font and stay so; Close redraws in Inter, so the two pictures never match. `settledChartPicture` takes two equal samples 100 ms apart as settled, which a frozen fallback picture passes.

Font cause tested and not shown: a spec that delays the Inter font files by 3 s passes on the code as it is (`fonts.ready` already redraws the chart).

Cause unknown. The spec now saves the before and after chart pictures on its next failure (attachments in the CI `test-results/` artifact); the cause is found from those.
