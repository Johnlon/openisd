# The .wdr round-trip gate compares each value against itself, so a corrupted file passes

Status: RESOLVED

## Symptom

`checkWdrRoundTrip` returns `{ ok: true }` for a `.wdr` whose computed values have been
deliberately corrupted. Its own test proves it:

```
checkWdrRoundTrip > a stated C (computed) value that disagrees with what re-derivation yields
  → expected a mismatch on the corrupted C-marked key "Znom", got: {"ok":true}
```

The test sets `Znom=999999.999` on a bridge-generated `.wdr` and the gate reports no divergence.

A second test fails the opposite way: the on-disk corpus `winisd.wdr`, which the gate is supposed
to reject for carrying a smaller key set than the app's writer emits, is now accepted.

This gate runs in the bundler's prebuild. Green means "no `.wdr` in the corpus diverges" — a claim
it cannot actually make, so real projection bugs in `.wdr` output ship undetected.

## Evidence

`scripts/roundTripGate.mjs:129-156`. The cycle under test:

```js
driver = WinISDDriver.fromWdrIni(wdrText);
const reserialised = driver.toWdrIni();
...
const before = pairs(wdrText), after = pairs(reserialised);
```

`fromWdrIni` parses INI text into a `WinISDDriver`'s cells and `toWdrIni` prints those same cells
back. Nothing between them re-derives a `C`-marked (computed) field from its `E`-marked (entered)
inputs, so a stated value that disagrees with what its inputs imply is read and written back
unchanged. Each key is compared against itself.

The projection-failure branch immediately above is dead code:

```js
const errors = [];
const blocking = errors.filter(e => e.level === 'error');
if (reserialised == null || blocking.length > 0) {
```

`errors` is a literal empty array that nothing writes to, so `blocking` is always empty.

The key-order half of the gate still works — the "junk text with no key=value lines" test passes,
and it fails there.

## Cause

The gate was written against `packages/model`'s reader, which derived computed fields on import;
its header comment still cites `packages/model/src/openisdDriver.ts:442-477`. During the
`packages/model` → `packages/design` migration the call was rewired to
`WinISDDriver.fromWdrIni`/`toWdrIni`, which is the raw INI parse/print pair in
`packages/design/winisd/` and performs no derivation. The `errors` array is the residue of the
same rewrite: the old call returned `{ value, errors }` and the replacement returns a bare value,
so the array was left empty rather than removed.

The two failing tests are the ones that would have caught it. Both were already failing for an
unrelated migration reason (`conformingRecordToOpenIsdDriver` no longer existing —
`BUG_20260908_bundler_scripts_import_free_functions_that_no_longer_exist.md`), so the gate's own
blindness was hidden behind a louder error.

## Fix

The comparison needs a cycle that re-derives, not one that echoes: read the `.wdr` into an
`OpenISDDriver` through `winIsdDriverTextToOpenIsdDriver`, then write it back out through
`openIsdDriverToWinIsdDriver(...).toWdrIni()`, which recomputes the `C` fields from the entered
inputs via the engine. That is the same pair `packages/ui/src/logic/fileImportExport.ts` uses for
the app's own import/export, so the gate would then be checking the path the app actually runs.

The dead `errors`/`blocking` block goes with it — the real errors are the ones
`winIsdDriverTextToOpenIsdDriver` and `openIsdDriverToWinIsdDriver` report.

Applied, together with one exclusion the restored gate immediately needed. With derivation back in
the cycle the gate reported a `ParState` divergence at slot 46, `VCCon`: `N` in, `E` out. That one
is intended and already documented at `driverYmlToOpenisdAndWdr.ts:240-247` — `VCCon`'s ParState
slot is unproven, so a reader consults only whether the `VCCon=` row is PRESENT, never its mark,
and reading back a row our writer marked `N` therefore yields `entered`. The comment calls it "a
one-time, DOCUMENTED gain of certainty, not a loss, and not a coding error", and a second round
trip is stable. `wdrDriverDiffs` in that same file already excludes `VCCon` for this reason; this
gate did not, so `ParState` is now compared with slot 46 masked, the same exception its sibling
comparator has always made.

## Verification

`npx vitest run packages/ui/test/persistence/round-trip-gate.test.ts` — 6/6.

The check that matters is the corrupted-value test: `Znom` set to `999999.999` on a
bridge-generated `.wdr` was reported `{ok: true}` before the fix and now fails the gate naming
`Znom`. The gate was also confirmed still able to fail on key order (the on-disk corpus `.wdr`
test) and on unparseable input.
