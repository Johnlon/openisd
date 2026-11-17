# Sealed box: Qtc keeps its old value when Fsc is typed tiny after a normal Fsc

**Status:** FIXED by T864, 17 Nov 2026 (the sealed solve now blanks Qtc when no volume is reachable from the typed Fsc). Found by the box dependent-value sweep, task T863.
**Found by:** `packages/ui/test/ui/box-dependent-values.browser.spec.ts`, cases "desktop sealed Fsc" and "phone sealed Fsc" (marked `test.fail`, red until fixed).

On a sealed box, type Fsc 82.53 (Vb shows 2.279, Qtc shows 0.8623, both calculated), then type Fsc 0.06602. Vb goes blank, but Qtc keeps showing 0.8623 as a calculated value. A clean project with only Fsc 0.06602 typed shows Qtc blank. So Qtc did not follow Fsc.

Steps (sample project, sealed): type Fsc 82.53, Tab; type Fsc 0.06602, Tab. Read Volume, Fsc, Qtc.
- Shows: Vb blank, Fsc 0.06602, Qtc 0.8623 (calculated).
- Expected (what a clean project shows for the same Fsc): Vb blank, Qtc blank.

Same on desktop (Box tab) and phone (Box tab). Same class as the vented Fb latch fixed in T862 (a calculated box stops following its input once another value goes out of range).

Fix at the source (the sealed-box calculation of Qtc and Vb from Fsc); do not change the sweep.
