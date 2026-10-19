# BUG_20261019_winisd-editor-shows-unstated-fle-kle-hc-hg-as-entered-zero

**Status:** CLOSED, won't change

## Symptom
Load a WinISD project whose [Driver] section has no fLe, KLe, Hc or Hg keys. WinISD's driver editor shows all four as green E (entered) zeros (0.00, 0.000000, 0.000, 0.000). OpenISD shows them as not entered (no value).

## Evidence
- Run record sweep-t429-e150-sealed-edit-vas (winisd_research): editor_after fLe ["0.00","E"], KLe ["0.000000","E"], Hc ["0.000","E"], Hg ["0.000","E"]; its input [Driver] has none of those keys.
- packages/design/test/domain/driver-edit-parity-e150he-44.test.ts: `it.fails` case "fLe, KLe, Hc, Hg after Vas edit" fails as expected (OpenISD mark N, value null).

## Cause
WinISD fills absent keys with zero and marks them entered. OpenISD keeps absence as absence. Which side is right is a data-model call (absent versus entered zero), not decided here. ⚠ WinISD internals unverified beyond the capture.

## Fix
John, 19 Oct 2026 (QO279): keep them blank. No Difference cue: the cue is for significant differences, not trivial ones like this.

## Verification
- packages/design/test/domain/driver-edit-parity-e150he-44.test.ts: "Driver editor: fLe, KLe, Hc, Hg the file leaves out stay blank".
- packages/design/test/fixtures/winisdEditRuns.ts: the same case, run for every edit run that has an editor capture.
