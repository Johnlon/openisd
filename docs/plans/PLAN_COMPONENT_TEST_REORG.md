# Plan: component test reorg — remaining coverage

The file reorg is done (2026-10-04): one file per object, rules in
[TESTING_STRATEGY.md](../../TESTING_STRATEGY.md), enforced by
`packages/design/test/architecture-test-files-name-their-object.test.ts`. What is left is coverage.

## Tune panel: one-way sync (open bug)

Editing a field in the Tune panel (e.g. Fb) updates the Box tab; editing the same field on the
Box tab does not update an open Tune panel. Write the failing test in
`tune-panel.browser.spec.ts` first, then fix the tuner's binding to the live project fields.

## Sealed box: missing tests (Box tab only, no Tune)

1. **Loss-model change moves Fsc/Qtc** (`original-box-tab`). Lossless, Conventional Lossy and
   WinISD Lossy give distinct readouts for the same driver and volume. A probe found all three
   identical; resolve that before pinning.
2. **Alignment Cancel leaves state untouched** (`alignment-popup`). Open, change, Cancel: the
   volume and readouts are unchanged. The current Cancel tests assert only that the popup closes.
