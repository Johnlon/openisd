# `winisdAir()` computes moist air at reference conditions instead of WinISD's stored constants

## Status
BLOCKED-ON-HUMAN — diagnosed, a genuine conflict found, no fix applied (see "Diagnosis
2026-08-23" below). Do not revert `winisdAir()` without reading that section first.

## Symptom

With "Ignore humidity and air pressure (as WinISD does)" CHECKED, the Advanced pane's air
density reads 1.20096. WinISD's own constant — the value the flag exists to pin (QO7) — is
1.20095217714682, printed 1.20095. The committed Playwright expectation
`advanced-environment.browser.spec.ts:47` (`toHaveValue('1.20095')`) fails, twice per run
(retry included), on a tree with NO uncommitted engine or managed changes.

## Evidence

- Baseline run 2026-08-23 with the U1 managedProject diff STASHED: same single failure,
  same value. The failure is independent of any uncommitted work (it was first noticed
  during a run that happened to have the U1 diff on disk, which sent suspicion the wrong way).
- `git diff 2ef9bd4 c83e0ad -- packages/engine/src/air.ts`:
  `winisdAir` changed from `{ rho: RHO * (T_REF_K / tempK), c: C * Math.sqrt(tempK / T_REF_K) }`
  (WinISD's stored constants, temperature-scaled) to
  `{ rho: moistAirDensity(tempK, RH_REF_PCT, P_REF_PA), c: moistAirSoundVelocity(...) }`.
- The spec's own comment at :26-27 states the discriminator: "the moist-air model gives
  1.2009621, which rounds to 1.20096 at the 5 dp WinISD uses — 8.3 ppm from its stored
  1.20095217714682."

## Cause

Commit c83e0ad (2026-08-21, ".wpr export fidelity" checkpoint) rewrote `winisdAir()` to
reuse the moist-air model at reference humidity/pressure. Moist air at reference is a
DIFFERENT model from WinISD's stored dry-ish constant: 1.2009621 vs 1.2009522. Consequence
beyond the wrong digit: at the default temperature the ignore branch and the physics branch
now return the SAME numbers, so the checkbox is observably inert exactly where the parity
guarantee is supposed to show.

## Fix

`winisdAir()` returns WinISD's stored constants scaled by temperature, as before c83e0ad:
`rho = RHO_WINISD * (T_REF_K / tempK)`, `c = C_WINISD * sqrt(tempK / T_REF_K)`, with the two
constants declared as WinISD's own stored values (1.20095217714682; velocity constant per
the pre-c83e0ad `RHO`/`C`). Not a loosened assertion — the spec's 1.20095 is the contract.
Whether c83e0ad's rewrite served some .wpr-export need must be checked against that commit
before reverting, so the export fidelity it landed is not broken in exchange.

## Verification

`advanced-environment.browser.spec.ts` green at --workers=1, including "ticking Ignore...
pins the readouts" and the :50-52 ignored-not-reset assertion; the default-view test at :24
(unchecked → 1.20096) still green, proving the two branches once again differ.

## Diagnosis 2026-08-23 — c83e0ad's rewrite was NOT needed for its stated purpose, but a
## naive revert is blocked by a separate, still-open finding. No fix applied.

**c83e0ad's own .wpr-export-fidelity work never touches air.ts.** Read the commit in full:
its `.wpr` changes (`packages/winisd/src/classic/wpr.ts`) are Nd/Rg/alfaVC/dTVC and
Qlf/Qaf/Qpf routing from the design — zero connection to `winisdAir()`/`RHO`/`C`. Confirmed
by grep: `winisdAir()` has exactly one caller in the whole tree (`airFor`'s
`ignoreHumidityAndPressure` branch), and nothing under `packages/winisd/` references it.
The air.ts rewrite was bundled into that "checkpoint" commit for an unrelated reason (see
below), not required by anything it was actually fixing.

**But the rewrite was not arbitrary either — it implements a cited human sign-off.**
`packages/winisd/test/fixtures/winisd-parity/divergences.json`'s (now-stale) entries for this
mechanism cite "AGENTS.md 'Calculation logic — permission gate' sign-off 2026-08-19: 'there
shodk be no base C/Roo variable - calculated or stated only'" as the authorisation for
deleting the frozen `RHO`/`C` constants. That exact quote does not appear anywhere else in
the repo (grepped) — AGENTS.md's actual "Calculation logic" section is a standing PROCESS
gate ("never change calculation logic without explicit human permission in the CURRENT
conversation"), not itself the ruling; the specific sign-off, if real, lives in a
conversation this repo has no other record of. Re-verify this quote's authenticity before
acting on it either way — I could not.

**The archived investigation this was based on says more than "no frozen constant" — it
says the two candidate digits are BOTH real and NEITHER is uniquely correct.**
`bugs/archive/BUG_20260819_engine_speed_of_sound_constant_disagrees_with_wdr_default_in_last_digit.md`
(Status RESOLVED, but read its body): WinISD's `c`/`roo` for a DRIVER resolve as (a) the
driver's own stored value, else (b) derived from the driver's other field, else (c) a live
**app-level Options-dialog setting** openisd has no model of at all — and `...152` vs `...153`
are BOTH genuine WinISD output, from different save-time app-level states, not a rounding
error. That bug's explicit, bolded instruction: **"Do not replace either digit with the
other anywhere in the codebase."** A naive revert to the pre-c83e0ad form does exactly that
substitution (restores `...153`, later "corrected" by me to `...152` — see below), inside a
bug file whose own prior investigation forbids it.

**A follow-on bug is still OPEN on this exact function and has not been actioned:**
`bugs/BUG_20260820_winisdAir_compat_mode_fidelity_questionable_after_c_roo_research.md` —
filed the day after c83e0ad, concludes `winisdAir()`'s temperature-only approximation may not
match what real WinISD's Options-dialog fallback actually produces, and lists "not yet
investigated: whether winisdAir() is used anywhere a real behavioural difference would
surface" as open. This bug (BUG_20260823) and BUG_20260820 are about the same function and
have not been reconciled.

**What I attempted, then reverted (not committed, not left in the tree):** restored
`winisdAir()` to `WINISD_RHO * (T_REF_K/tempK)` / `WINISD_C * sqrt(tempK/T_REF_K)`. While
verifying, found `WINISD_C`'s pre-c83e0ad literal (`343.684120962153`) was itself off by one
ULP from the raw double WinISD actually holds (`343.6841209621523`,
`winisd_research/RE_GHIDRA_FINDINGS.md:472`, which rounds to `...152` at 15 sig figs — matching
`air.test.ts`'s existing oracle, not the deleted `constants.ts` literal). This ULP-level
correction is exactly the substitution BUG_20260819 forbids, discovered only because I made it.
With the fix applied: `air.test.ts` 12/12, `advanced-environment.browser.spec.ts` 4/4 (browser
suite, retried once clean after an unrelated dev-server 500 from a concurrent session's
in-flight edit to `useDesignIO.ts`/`App.vue` — not this fix). BUT
`packages/winisd/test/winisd-parity.test.ts` then failed 14/436: every non-`env-t-303`
scenario's `air.c`/`air.roo` divergence entries in `divergences.json` went stale (now agree
exactly, since restoring the pre-c83e0ad constant makes the ignore-branch match WinISD's
stored pair at default temperature) while `env-t-303` (a non-default-temperature scenario)
correctly kept its OWN specific divergence entries and stayed green — confirming the fixture
data itself independently corroborates that a temperature-scaled-constant model is what real
WinISD's ignore-mode empirically produces (the `env-t-303`/`env-rh-30` goldens are
byte-identical for `c`/`roo` despite `T` differing by 10 K, i.e. WinISD's compatibility pair
does NOT scale with temperature at all in that data — a THIRD finding, distinct from both
c83e0ad's premise and the pre-c83e0ad formula, since the pre-c83e0ad formula DOES scale with
temperature and would still diverge from those two goldens' exact equality). None of the
three candidate models (c83e0ad's moist-air-at-reference, the pre-c83e0ad temperature-scaled
constant, or a genuinely-frozen non-temperature-scaled constant matching the goldens exactly)
has been chosen by a human with all three data points in view at once.

**Recommendation, not a decision:** this needs John (or whoever owns AGENTS.md's permission
gate) to see, in one place: (1) the Playwright spec's exact pin, (2) BUG_20260819's "do not
substitute" instruction, (3) BUG_20260820's open question, (4) the `env-t-303` vs `env-rh-30`
goldens' byte-identical-across-10K finding above, which none of the existing bug files or the
divergences.json cause text currently states. Whatever is decided, `divergences.json`'s stale
"*"-scenario `air.c`/`air.roo` entries and the `env-t-303`-scenario entries' cause text will
need updating to match — deferred here, not touched, since the underlying formula is still
undecided.
