# BUG_20260929_box-type-switch-leaves-volume-zero

**Status:** INTERIM FIX SHIPPED (mobile UI hook) — belongs in the domain, per engine's ruling below

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

## Fix (interim)
`packages/ui/src/hooks/boxTypeDefaults.ts` — `createBoxTypeVolumeDefaults`, a `watch(selectedBox,
...)` that, on switching into a type whose own volume is still exactly 0, writes the SAME values
`createProject()` would have written for a fresh project of that type:
- **sealed** — `sealed.volumeForQtc(Qts, Vas_m3, 0.707)` (SEALED_ALIGNMENT_OPTIONS' own "Max flat
  amplitude response").
- **vented** — `vented.alignment('qb3', Fs_hz, QtsLoaded, Vas_m3, Ql)` (VENTED_ALIGNMENT_OPTIONS'
  own "Quasi-butterworth"), writing both `volume_m3` and `tuning_goal_hz`, plus a 5 cm vent
  diameter if none is set (matching the wizard's own default) so the Helmholtz solve has a
  complete input set.
- **box-passive-radiator** — the wizard's own flat 7 L starting volume, `defaultPassiveRadiator()`
  (chart-ready Sd/Cms/Mms), and a 35 Hz tuning goal.
- bandpass4/bandpass6/abc — not covered yet (dual-chamber geometry is more involved).

Wired into `MobileBoxTab-hooks.ts` only. **Engine's ruling (2026-09-29): this belongs in the
domain** — where `boxType` is set, in `packages/design`'s `OpenISDBox`, with a domain test, so
both skins get it uniformly rather than each shell needing its own copy of this hook. The UI-hook
version above is a stopgap to unblock live testing; move/delete it once the domain version lands.

## Verification
`packages/ui/test/ui/mobile-box-tab.browser.spec.ts` — "switching to a never-used box type
defaults its volume instead of showing 0", using `COMPLETE_DRIVER_PROJECT_OWPR` (real T/S params;
the default sample project has none, so the fix's own guard never fires against it).
