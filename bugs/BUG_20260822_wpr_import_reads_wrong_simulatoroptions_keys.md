# `.wpr` import reads the wrong `[SimulatorOptions]` keys — always imports as false

## Status
FIXED — in `parseWprRaw` (`packages/winisd/src/classic/wpr.ts`), the successor to
`useDesignIO.ts`'s `parseWprToState` written for task A6 (FileIO/useDesignIO remediation).

## Symptom
Importing a `.wpr` that has "Simulate voice coil inductance" / "Force flat response" /
"Transmission-line port model" enabled always loads with all three OFF, regardless of what the
file states.

## Evidence
`toWpr()` (the WRITE side, `packages/winisd/src/classic/wpr.ts:253-257`) emits:
```
['VCInd', ...], ['FlatResponse', ...], ['TLPorts', ...]
```
confirmed against the real golden fixture
`packages/winisd/test/fixtures/winisd-parity/goldens/sealed-small.wpr:145-148`:
```
[SimulatorOptions]
VCInd=0
FlatResponse=0
TLPorts=0
```
`useDesignIO.ts`'s `parseWprToState` (the READ side, now deleted) read:
```ts
const vcInductance = simOptSec['vcInductance'] === '1';
const flatResponse = simOptSec['flatResponse'] === '1';
const tlPorts = simOptSec['tlPorts'] === '1';
```
— lower-camel-case keys that never appear in a real `.wpr`. `simOptSec[...]` was always
`undefined`, so all three booleans were always `false`.

## Cause
The reader was hand-written against a guessed key spelling instead of the writer's own keys or
a real golden fixture, and nothing round-tripped a `.wpr` with these flags set through import to
catch the mismatch.

## Fix
`parseWprRaw` reads `VCInd`/`FlatResponse`/`TLPorts` — the same keys `toWpr` writes and the
golden fixtures carry.

## Verification
`packages/winisd/test/classic/wprParse.test.ts` — `parseWprRaw` is exercised against real golden
`.wpr` fixtures under `packages/winisd/test/fixtures/winisd-parity/goldens/`.
