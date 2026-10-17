# What-if Close test: curve picture differs after Close (flaky)

Status: closed (T335)

Spec `what-if-panel.browser.spec.ts` "Learn changes the charts but never the project, and Close puts the curve back" failed in CI run 39023047033 (shard 5): after Close the chart picture hash stayed fef4c90c instead of 7d5bfae5.

Cause: not the app. Close restores the chart every time. The test took its "before" picture while the "Project imported from sample-project.owpr" message still floated over the chart, so the picture contained the message. Under load the message is still there when the picture is taken (reproduced locally: 6 of 6 failures in a CPU-loaded run; the picture 3 s later is fef4c90c with no user action). After Close the message was long gone.

Fix: the spec waits for the "Project imported" message to go before taking the "before" picture.
