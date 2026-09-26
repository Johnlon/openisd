# BUG_20260918_bandpass4-front-chamber-tuning-writes-vented-cell

Status: OPEN (re-verified 2026-09-26) — the tuning targets and vent diameter write `box.vented.*` for every box type; the bandpass4 solve reads `box.bandpass4.chambers.front`.

## Symptom
For a `bandpass4` box, the front-chamber's vent can never be solved through the UI. The
Enclosure/list tab's `Target Tuning Freq` shows `—` for the solved vent length no matter what is
entered, and a vent diameter typed into the pane does not persist to the field (re-reads as
empty).

Detected while strengthening `packages/ui/test/ui/app.browser.spec.ts` (bandpass4 test). The
test entered Ffc `47.8` and vent diameter `5` on the `4th Order Bandpass` enclosure pane; the
field diagnostics at that point:

```json
{"lengthRo":"—","target":"47.80","fbField":"field entered","diam":""}
```

The `Target Tuning Freq` keeps its entered value (`47.80`, class `field` = entered, no DQ) but
the vent length readout stays `—` and the diameter read `""` after entry.

## Cause — the target writes a cell the bandpass4 solve never reads
The bandpass4 box's front chamber is a genuine vent pair:
`[box.bandpass4.chambers.front.tuning_hz, box.bandpass4.vents.front.length_m]`
(packages/design/domain/openisdDomain.ts — the pair `2359` / `2779–2794`).

But the UI's bandpass4-alias target cells bind `project.box.vented.tuning_hz`, the vented box's
cell:

- `packages/ui/src/ui/shells/original/OriginalShell.vue:310` — the Box-tab "front-chamber
  Target Tuning Freq" (`#og-ffc-target`) reads/writes `project.box.vented.tuning_hz`.
- `packages/ui/src/ui/shells/original/OriginalShell.vue` — the enclosure-pane `Target Tuning Freq`
  (`#og-vent-fb-target`) is the same `box.vented.tuning_hz` handle, and
  `activeVent` for a bandpass4 box is `box.bandpass4.vents.front`
  (`packages/ui/src/hooks/OriginalShell-hooks.ts:342-347`).

So entering Ffc writes a cell nothing in the bandpass4 solve reads → the front-vent length can
never be derived → it renders `—`. The vent diameter entry on the pane has the same problem
wiring: `enterVentFieldOn(project, 'ventD', …)` writes the vented box's vent, not the bandpass4
front vent, which is why the diameter re-reads empty.

Consequence wider than the pane: the WPR/export path reads the real cell
`box.bandpass4.chambers.front.tuning_hz` (openIsdProjectToWinIsdProject) — which nothing ever
writes — so a bandpass4 design exports Ff = un-set.

## Should fix
On switching/entering a bandpass4 box, both target controls should bind
`box.bandpass4.chambers.front.tuning_hz` and the vent-diameter control should write
`box.bandpass4.vents.front`, so the front-vent length (and export Ff) can actually solve. Then
re-add the trimmed bandpass4 assertions (Ffc → ~10 cm port) in `app.browser.spec.ts`.

## Related
- `BUG_20260824_bandpass4_frc_readout_spec_fails_on_fresh_default_project.md` (OPEN) — the
  rear-chamber Frc readout reads `box.sealed.resonance_hz` instead of
  `box.bandpass4.chambers.rear.resonance_hz` (OriginalShell-hooks.ts:89-92), so the rear
  chamber's Frc is likewise dead UI.