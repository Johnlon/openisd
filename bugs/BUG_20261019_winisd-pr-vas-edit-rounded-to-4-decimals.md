# BUG_20261019_winisd-pr-vas-edit-rounded-to-4-decimals

**Status:** RECORDED — WinISD bug (⚠ mechanism unverified), found by T429 U5 PR-pane edit parity. Not copied: OpenISD uses the typed Vas.

## Symptom
Typed into the PR pane, a Vas with more than 4 decimals acts in WinISD as if it were rounded to 4 decimals.
ND140-PR base, Vas 0.0084 typed to 0.00966: WinISD draws every chart and prints Fp 62.04 as for Vas 0.0097.
A Vas typed with 4 decimals (SB15SFCR-00, 0.0481) matches OpenISD to 1e-9.

## Evidence
- Fixture `packages/design/test/fixtures/winisd-edit-captures/nd140-pr/pr-prvas.json` (run sweep-t429-nd140pr-pr-edit-prvas).
- `packages/design/test/domain/pr-edit-parity-nd140-pr.test.ts`: all 7 charts and Box tab Fp deviate (worst tfmag 0.037 dB, Fp 61.97 vs 62.04).
- Scratch scan of OpenISD Vas against the capture: best match Vas = 0.0097, worst deviation 4e-13 over every chart. Fs scan at the typed Vas cannot match (best 0.23).

## Cause
⚠ unverified: WinISD keeps the PR Vas at 4 decimals on entry. Only the fit above supports it; no other typed figure had more than 4 decimals, so the scope (all PR fields? Vas only?) is not known.

## Fix
None in OpenISD (typed value is used). Record in ACCURACY_IMPROVEMENTS / WINISD_PARITY at U7. A probe typing a 5-decimal figure into other PR fields would settle the scope.

## Verification
The 8 it.fails checks in pr-edit-parity-nd140-pr.test.ts for pr-prvas.
