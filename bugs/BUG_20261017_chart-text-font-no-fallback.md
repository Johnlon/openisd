# Chart tick labels drawn in a changing default font (visual desktop-tab-box flaky)

Status: closed (T348)

Visual spec "desktop tab-box" failed in CI run 39030580994: every chart tick label was smaller and 1-2 px lower than the baseline; panels and chart edges were identical (532 pixels).

Cause: an app bug, a user would see it too. The chart drew its text with the font `9px Inter` and nothing after it. No Inter is installed on the test machines (the page loads none), so the browser fell back to its own default face, which measures as a serif, not the page's sans stack. Which default face the browser picked was not fixed, so the labels changed face and size between runs. It is not a web-font load race: the app loads no font, so waiting for fonts or redrawing on fonts.ready cannot help.

Fix: chart text uses the page's own stack, `"Inter", system-ui, sans-serif` (one constant in the design chart layout). The chart baselines are re-taken once.

Second cause, same screen: the picture is taken while the "Project imported" message still floats over the chart, fading. Under heavy load (10 busy loops, 60 runs, 6 workers) 46 of 60 pictures differed, the message at a different opacity. The visual harness now waits for the message to go before every project screen's picture, and the baselines are re-taken without it.
