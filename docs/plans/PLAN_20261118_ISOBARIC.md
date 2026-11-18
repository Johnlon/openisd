# Plan: turn on Iso-Barik (isobaric) driver loading (18 Nov 2026)

Task T919 (turn on Iso-Barik loading), tasks/T919.yml.

## Goal
Pick "Iso-Barik" (two drivers face to face, WinISD's clamshell) on the Driver tab and in New Project, on desktop and phone, and see
the isobaric result: the same Qtc in half the box volume, the pair's impedance, the chart curves WinISD draws.

## The ruling
John, 18 Nov 2026, questions.yml QO953.c38: "A: turn on isobaric (about 1 day)". Context QO953.c33: the clamshell diagram is
right; no distortion work (c34-c37).

## Facts found
- The engine already models it: project field `loading` ('standard' | 'isobaric'), WinISD .wpr [Box] Isobarik read and written,
  motional impedance x2 (engine/circuit.ts), Vas halved by `SealedEngine.arrayVas`, `isobarikPair` in the simulation.
- The block was only in the screens: the New Project radio (desktop) was `disabled` with "(not modelled)", the phone select had a
  "not modelled yet" caption, and the Driver tab's Placement radio was a local ref wired to nothing (no phone control at all).
- New Project always made a standard project (`loading: 'standard'` hard-coded in its Qtc preview and never written to the project).

## Steps
1. Test first: one design test per box type loads the WinISD Iso-Barik .wpr and compares SPL, excursion and impedance with
   WinISD's plotted numbers (sealed test existed; vented, passive radiator, 4th and 6th order bandpass and ABC added from
   winisd_research runs/<box>-w5-isobarik), same tolerances as the two-driver tests (1e-12 relative, excursion 1e-11).
2. One placement control (`DriverPlacement.vue`, hook `DriverPlacement-hooks.ts`, options `DRIVER_PLACEMENT_OPTIONS` in
   packages/design) bound to `project.loading`, on the desktop Driver tab (radios) and the phone Driver tab (select).
3. New Project (desktop radio, phone select) enables Iso-Barik, previews Qtc with it and writes it to the new project.
4. Every Vas readout already goes through the engine's `arrayVas` (Box tab Fsc/Qtc, sealed picker). No copy of the rule in packages/ui.
5. Browser journeys, desktop and phone; before/after pictures; update the picture baselines that change.

## Checks
typecheck; unit-architecture.sh; lint-changed.sh; dupscan; the full packages/design unit suite; the changed browser specs.

## Open
Vented alignment design (`OpenISDDriver.ventedDesign`) uses the single driver's Vas for any driver count and loading. No WinISD
reference run exists for it; left as is and reported.
