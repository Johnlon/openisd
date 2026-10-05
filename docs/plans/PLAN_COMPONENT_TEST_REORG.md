# Plan: component test reorg — remaining coverage

The file reorg is done (2026-10-04): one file per object, rules in
[TESTING_STRATEGY.md](../../TESTING_STRATEGY.md), enforced by
`packages/design/test/architecture-test-files-name-their-object.test.ts`. What is left is coverage.

## Sealed box: missing tests (Box tab only, no Tune)

1. **Loss-model change moves Fsc/Qtc** (`original-box-tab`). Lossless, Conventional Lossy and
   WinISD Lossy give distinct readouts for the same driver and volume. A probe found all three
   identical; resolve that before pinning.
2. **Alignment Cancel leaves state untouched** (`alignment-popup`). Open, change, Cancel: the
   volume and readouts are unchanged. The current Cancel tests assert only that the popup closes.
