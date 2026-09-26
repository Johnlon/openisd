# BUG 20260916 — OgTune mandatory trio reads `driver.issues()` which is claimed to return `[]` for EMBEDDED drivers even when the cascade has issues (worker2 E)

Status: OPEN (re-verified 2026-09-26) — `project.driver.issues()` returns `[]` while `specs.Qts.dq` holds `inconsistent-inputs`; `OgTune.vue` reads `issues()`.

## What worker2 actually said (verbatim, pasted by the human)

> project.driver.issues() returns [] for an embedded driver while the cascade has issues —
> the fresh-per-access window never gets the project's cached issues. OgTune.vue:128 reads
> exactly that. Queuing as E.

## Plain-English meaning

The Original-skin **Tune** pane paints a "mandatory + unsatisfied" state (red border, marker)
on a field using

    fieldIsMandatoryAndUnsatisfied(project.value.driver.issues(), key)   // OgTune.vue:128

`issues()` is the driver's issue accessor (the domain's per-driver defect list — which fields are
missing/mandatory/inconsistent). "Embedded driver" = a driver copied INTO the project store (a
My-Drivers/wizard pick), vs a referenced library driver. Worker2 claims that for an embedded
driver, `issues()` returns `[]` even when the cascade genuinely has unsatisfied members, so the
Tune pane's red-mandatory indicator never appears. "Fresh-per-access window" = the accessor
re-derives per call rather than reading a project-cached issue list, so it has no memory of the
cascade's state from the moment the project was created.

## Verification status (honest)

- **VERIFIED**: `packages/ui/src/ui/shells/original/OgTune.vue:128` really does read
  `project.value.driver.issues()` into `fieldIsMandatoryAndUnsatisfied`. Real file, real line.
- **NOT YET VERIFIED** (needs test-first proof before the creed permits a source change):
  (a) `issues()` actually returns `[]` for an embedded driver with a defect ridden cascade;
  (b) a project-level cached issues list exists anywhere in the model; (c) whether the
  "fresh-per-access" window is the defect or worker2's theory.

## Why the creed blocks a fix until verification

Same family as the human's wizard/sealed rulings and the signal-pane blur bug: we do not change
source on a reported-but-unproven coupling claim. OgTune.vue:128 is a real consumer, but whether
the value it reads is wrong for embedded drivers is a measured question, answered only by a
failing test that (per creed) MUST use a specific driver + size it intends and must switch to the
Tune tab before waiting on `.de-fld`. No such test exists on disk today.

## Next action (record-only, exactly one)

Red spec first (TDD creed): a browser spec that (1) opens a project with an EMBEDDED driver that
has an unsatisfied mandatory member, (2) switches to the Tune pane explicitly, (3) asserts the
field displays the red-mandatory state. Expected: RED today (if worker2 is right). Fix only after
the human sees the red and rules. No source changes until that ruling.
