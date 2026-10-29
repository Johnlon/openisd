# BUG 2026-10-29 — OpenISD bridge rejects the scraper's grouped voice-coil tuple

## Symptom

Stage 6 refuses tuple-shaped scraper records with `specs.woofer: Unrecognized key: "voice_coil"` and writes no `.wdr` or `openisd.json`. The prior exact run rejected 205 FaitalPRO records and five SEAS records.

## Cause

`packages/design/domain/driverRecordConverter.ts` projects each section field as an independent scalar entry, while the scraper now places Re, BL, each value's basis, coil count, and connection together under `voice_coil`. The converter does not recognize or project that group into OpenISD's per-coil runtime fields.

## Required behavior

Parse one strict tuple input shape. Preserve the fact that Re and BL may have different bases. Convert connection-specific values to the app's per-coil values only when the tuple states a supported connection and coil count. Keep raw readings and the connection reading in the result. If basis is unknown or insufficient, leave the affected app field unavailable with its raw readings and a warning. Reject mixed tuple and flat voice-coil fields; add no fallback shape.

## Evidence

- Tools Stage 5 run `2026-10-28T23-30-55Z-802282` emitted tuple records, including the genuine FaitalPRO 12PR300-8 record at `/home/john/work/winisd/winisd_drivers/db/datasheets/faitalpro/12pr300-8/driver.json`.
- The SB Acoustics source record `/home/john/work/winisd/winisd_drivers/db/datasheets/sb-acoustics/sw26dac76-3-dv/driver.json` has per-coil Re 2.4 Ω, series BL 19.4 T·m, two coils, series connection, and a source connection reading. Stage 5 run: `2026-10-27T01-06-44Z-2844370`.
- OpenISD branch `stray/20261025T131334Z` had no tracked converter/test change for this issue when the bug was opened. The repair is on isolated branch `codex/20261029-voice-coil-tuple` instead.

## Regression plan

Use the two genuine scraper-generated records copied byte-for-byte into `packages/design/test/fixtures/corpus/` with provenance sidecars. Assert correct per-coil app fields and terminal `.wdr` values for the SB series case, unavailable fields plus raw readings for the FaitalPro unknown-basis case, and strict refusal of mixed tuple/flat input. Verify focused converter tests, design typecheck, targeted lint, and bridge build. Then verify Stage 6 through the scraper CLI; never hand-write generated database outputs.

## Status

The bridge repair and test-first regression are implemented on isolated branch
`codex/20261029-voice-coil-tuple` in `/home/john/work/winisd/openisd-codex-tuple`.

Verification on 2026-10-29:

- `bash scripts/quiet-test.sh npx vitest run packages/design/test/winisd/driverYmlToOpenisdAndWdr.test.ts packages/design/test/winisd/bridge-bundle.test.ts` — 41 passed.
- `bash scripts/quiet-test.sh npm run typecheck:design` — passed.
- `bash scripts/quiet-test.sh npx eslint packages/design/domain/driverRecordConverter.ts packages/design/test/winisd/driverYmlToOpenisdAndWdr.test.ts packages/design/winisd/bridge.ts packages/design/domain/index.ts scripts/roundTripGate.mjs` — passed.
- `npm run build:bridge` — passed.
- Scraper Stage 6 with this checkout's bundle projected 205 FaitalPRO and 61 SEAS tuple records, with no failures or attention items; run `2026-10-29T16-36-32Z-1790953` is clean.

The implementation projects only strict tuple input, preserves raw readings, applies per-coil
conversion separately for Re and BL, and leaves unsupported basis/connection values unavailable
with warnings. It rejects tuple-plus-flat input. The fix is committed on
`codex/20261029-voice-coil-tuple` but is not integrated into the OpenISD release branch yet. Keep
this bug open until the receiving OpenISD session integrates it.
