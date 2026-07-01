# Engine and calculation rules

**Never change any calculation logic without explicit human permission.** This covers:

- Formulas in `src/core/` (alignments, circuit, engine, filters, etc.)
- Physical constants (`RHO`, `C`, end-correction coefficients, etc.)
- `toFixed()` / display precision in stat bar or any rendered output
- Default parameter values that affect computed results

Cross-checks against external tools (micka.de, REW, WinISD, etc.) are **reference only**. A discrepancy does not authorise a fix — document it and stop. The human decides whether a difference warrants a change.

**Before touching any formula:** read `.claude/context/testing-js-core.md` for the unit test contract that must be satisfied.
