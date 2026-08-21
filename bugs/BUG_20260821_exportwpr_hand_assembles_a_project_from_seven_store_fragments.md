Status: OPEN

# `exportWpr()` hand-assembles a project from seven scattered fragments

## Symptom

`packages/ui/src/logic/useDesignIO.ts:164-176` builds a `.wpr` by gathering pieces from the
store, the managed project, the clock and a rendered `.wdr` string, because no project object
exists to ask.

## Evidence

```ts
function exportWpr(): void {
  closeTunePanelAfterIO();
  const record = driverRecord.value;
  if (!record) { flash('Cannot export .wpr: no driver has been chosen'); return; }
  const { value: wdr, errors } = OpenISDDriver.fromJsonRecord(record).toWdrText();
  if (!wdr) { flash(`Cannot export .wpr: ${errors[0]?.message ?? 'the driver is incomplete'}`); return; }
  const input = buildWprInput(
    state.box, state.P, engineDriver(), wdr, state.project, new Date(),
    managedProject.ventArea_m2(), curvesData.value,
  );
  download(sanitizeFilename(driverName.value) + '.wpr', toWpr(input), 'text/plain');
}
```

Four distinct defects:

1. **Seven arguments from six different sources** (`:171-173`) — `state.box`, `state.P`,
   `engineDriver()`, the `.wdr` text, `state.project`, `new Date()`,
   `managedProject.ventArea_m2()`, `curvesData.value`. `buildWprInput`'s signature
   (`wprMapping.ts:33-45`) exists only because a project cannot be handed over whole. This is
   the `state.P` duplication defect in its export form — see
   `docs/plans/PLAN_QO60_LAYERING_REMEDIATION.md` objective 2.
2. **`new Date()` called inline** (`:172`) — non-determinism injected at the call site, so the
   output cannot be reproduced by a test and `ModifyDate` cannot be asserted.
3. **The driver is re-derived from a record** (`:169`) — `OpenISDDriver.fromJsonRecord(record)`
   when `managedProject` is in scope and already holds a live driver. The file's own comment
   admits this ("a known gap, QO57").
4. **Error handling interleaved with construction** — two early-return `flash()` calls, so the
   function cannot be exercised without a flash channel.

NOT a defect, and an earlier review claim that was WRONG: embedding the `[Driver]` block as text
is how `.wpr` works. Verified against
`packages/winisd/test/fixtures/winisd-parity/goldens/sealed-small.wpr`, which WinISD itself
wrote and which carries a `[Driver]` section verbatim. `WprInput.driverSection: string`
(`packages/winisd/src/classic/wpr.ts:74`) is the format, not our invention.

`exportWdr()` (`:151`) shares defects 3 and 4.

## Cause

No project object to serialise. `_OpenISDProjectJson` is data, not a facade, so nothing can be
asked "give me your `.wpr`"; the composable therefore reassembles a project from whatever it
can reach.

## Fix

Not fixed, and blocked: the real shape is `project.toWprText(now)` — the project serialises
itself, having asked its own driver for the `[Driver]` section — which needs `OpenISDProject`
to exist as a class (objective 3 of the QO60 plan). Rewriting before that would relocate the
seven-fragment assembly rather than remove it.

Defects 2 and 3 could be fixed independently (inject the clock; read the live driver off
`managedProject`), but both disappear in the objective-3 shape, so doing them separately is
churn.

Related, separately recorded:
`bugs/BUG_20260821_wpr_export_writes_fabricated_constants_over_real_design_state.md`.

## Verification

N/A — open. Afterwards: exporting a `.wpr` takes a project and a timestamp and nothing else, and
the same project with the same timestamp produces byte-identical output every run.
