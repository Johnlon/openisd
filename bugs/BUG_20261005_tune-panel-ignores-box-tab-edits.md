# BUG_20261005_tune-panel-ignores-box-tab-edits

**Status:** DONE 2026-10-05 — does not reproduce on current code; two tests now pin it.

## Symptom

With the Tune panel open, a box volume typed on the Box tab did not show in the Tune panel's Vb
field. A volume typed in Tune did show on the Box tab, so the sync went one way only.

## Steps

1. Open a project, open the Tune panel (Driver tab → What-if).
2. Go to the Box tab and type a new Volume, then leave the field.
3. The Tune panel's Vb still shows the old volume.

## Cause

The Tune panel's Vb is a cached computed (`vb_m3` in `OriginalTune-hooks.ts`). The project
registry hands out the same project instance for its whole life, so reading only the project
never invalidated that cache: a write from another panel left Vb answering the old volume.

## Fix

`vb_m3` reads `projectChanged` as well as the project (landed 2026-09-25, with the Tune-blur
fix). No code change in this pass. Probed 2026-10-05 for every box type, on the sample and the
complete-driver project: Tune's Vb follows each Box tab edit.

## Done

- `packages/ui/test/hooks/OriginalTune-hooks.test.ts`, "shows a volume written by another
  panel, as the Box tab writes it": runs the hook client-side (`runHook`), where computeds cache.
  It fails when the `projectChanged` read is removed from `vb_m3`, and passes with it.
- `packages/ui/test/ui/tune-panel.browser.spec.ts`, "a volume typed on the Box tab shows in the
  open Tune panel": the same through the real Box tab and Tune panel.
