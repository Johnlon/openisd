# The Tune what-if panel's open/closed state is a single global flag — switching focus to another project while Tune is open edits that OTHER project directly, with no what-if protection

Status: OPEN — not fixed. Found while writing a multi-project browser-spec regression test for
the `PROMPT_RELEASE_HARDENING` plan (item 1, the tab UI wired onto the real registry).

## Symptom

1. Open project A. Open its Tune panel (a what-if starts on A).
2. Without closing Tune, switch focus to a different open project B (e.g. via "+ Copy" or the
   Projects list).
3. The Tune panel stays visually open, and its fields now read/write project B's own driver
   fields — but B never had `beginWhatIf()` called on it. Any scrub on the Tune panel while B
   is focused writes DIRECTLY to B's committed state, with none of the what-if
   preview/never-commits protection `docs/design/STATE_MODEL.md` rule 4 requires.

## Cause

`OgTune.vue`'s what-if lifecycle watcher:
```ts
watch(() => presentationState.editDriver, (open) => {
  if (open) { vbSnapshot = project.value.boxVolume_m3(); project.value.beginWhatIf(); }
  else project.value.cancelWhatIf();
}, { immediate: true });
```
depends only on `presentationState.editDriver` — a single, app-wide UI flag (one of the three
approved state stores, deliberately NOT per-project). It does not depend on `project` (the
injected, focus-aware `ComputedRef<ManagedProject>`), so switching focus without toggling
`editDriver` never re-runs this watcher: no `beginWhatIf()` is called on the newly-focused
project, and no `cancelWhatIf()` is called on the one that had it open.

This interaction did not exist before the multi-project registry was wired up (item 1): with
exactly one project ever open, "switch focus while Tune is open" was not a reachable state.

## Fix

Not fixed — needs a product decision, not a guess: should switching focus while Tune is open
(a) close Tune (matching how a driver-picker/what-if-cancelling action already forces this
elsewhere, e.g. `openDriverPicker()`), or (b) begin a NEW what-if on the newly-focused project
and remember to resume A's when focus returns? (a) is far simpler and matches the existing
"any focus-changing action cancels an open what-if" pattern already used elsewhere in this
codebase; (b) preserves the (arguably nice) ability to compare two designs' what-ifs but adds
real complexity to a lifecycle already documented as intentionally simple (`docs/design/
STATE_MODEL.md` rule 4: "there is no Keep/commit control at all").

## Verification

Not applicable — no fix has been applied. To reproduce: open Tune on one project, scrub a
value, use "+ Copy" to open and focus a second project, scrub a value on ITS Tune panel (same
DOM, now bound to the second project) — the second project's committed state changes
immediately, with no cancel/revert path, because no what-if was ever opened on it.
