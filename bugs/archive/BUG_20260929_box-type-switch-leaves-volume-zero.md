# BUG_20260929_box-type-switch-leaves-volume-zero

**Status:** RESOLVED

## Symptom
John, live on his phone, testing an existing project (4 L sealed, real driver T/S params
entered): switching the Box tab's type from sealed to vented left Volume showing 0 instead of a
usable starting point. Every downstream chart then failed:

> Can't plot Group delay — Sweep returned no finite values for group delay.
> Sweep returned no finite values in: maximum SPL. Maximum curves require finite Pe or Xmax
> bounds. Fix the listed inputs to restore this chart.

Switching back to sealed, the same project's charts plot fine — sealed had already been used and
kept its own volume. On the vented Enclosure pane specifically, entering a vent diameter produced
no length/tuning solution at all:

> Can't plot Group delay — length_m cannot be calculated yet - state length_m from
> tuning_goal_hz + Vb_m3 + area_m2 (Helmholtz) (needs tuning_goal_hz, area_m2). Sp cannot be
> calculated yet - state Vent area (Sp) must be greater than zero (needs Sp).

John also confirmed passive radiator shows the same class of failure, and asked for defaults on
every box type: "the app needs to pick defaults for these components that don't cause immediate
errors, sealed should be a vol for flat if none selected same for others, for vent."

## Cause
Every box type's volume (and, for vented, tuning + vent geometry) field is always present and
independently dormant (`Box`'s own doc comment, `packages/design/domain/box/box.ts`) — nothing
ever gave a box type a starting value the first time a project switches into it. The New Project
wizard (`OriginalNewProject-hooks.ts`'s `createProject()`) DOES write a sane starting value, but
only at project creation, for whichever single type the wizard finishes on — never on a
type switch inside an existing project, and never for any of the five types the project is NOT
created as.

A `Vb`/`Fb`/`area_m2` of exactly 0 has no Helmholtz solution, which is what produced both error
sets above — this is a real solver consequence of missing inputs, not a separate charting bug.

**WinISD's own behaviour on a mid-project box-type switch is unverified** — nobody has checked
whether WinISD itself defaults, blanks, or refuses in this situation. This fix is John's own
ruling for OpenISD (2026-09-29), not a parity match.

## Fix
`OpenISDBox.applyStartingValues()` (packages/design): run by `boxType.set()` and by every
`ProjectBuilder` at `build()`. Sealed gets the flat (Qtc 0.707) volume; vented the QB3 design
for the driver as driven plus a 50 mm vent; passive radiator 7 L at 35 Hz with a chart-ready
radiator; bandpass4 a 7 L rear and 10 L front at 35 Hz through a 50 mm vent; bandpass6/abc
nothing. Each write is gated on its own field being unset. The wizard's per-type switch, the
store's `defaultPassiveRadiator` and the interim `boxTypeDefaults.ts` hook are deleted; the
wizard creates through `createProject(driver, b => b.vented().alignment(a))`.

## Verification
`packages/design/test/domain/box-starting-values.test.ts` (every type, the never-overwrite rule,
the builders). `packages/ui/test/ui/mobile-box-tab.browser.spec.ts` — "switching to a never-used box type
defaults its volume instead of showing 0", using `COMPLETE_DRIVER_PROJECT_OWPR` (real T/S params;
the default sample project has none, so the fix's own guard never fires against it).
