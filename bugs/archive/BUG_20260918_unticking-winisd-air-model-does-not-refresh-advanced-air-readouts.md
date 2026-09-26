# BUG_20260918_unticking-winisd-air-model-does-not-refresh-advanced-air-readouts

Status: CLOSED (re-verified 2026-09-26) — confirmed not a defect: the toggle is honoured; the record's own appendix shows the test's expectation was stale.

Appendix (what the investigation actually showed, for the record):

- The sample fixture (`generateSample.ts`) now stores its own environment: 293.15 K, RH 50 %,
  101325 Pa (S9a fixture rewrite). At RH 50 the WinISD parity model and the moist-air CIPM
  model agree exactly at display precision (c = 343.99, rho = 1.19885 — verified by running
  `Engine.solveEnvironment` for both models at RH 30/50/100), so unticking the checkbox
  correctly leaves the readouts unchanged.
- The test expected c = 343.68 / rho = 1.20096 — the RH **30** values from when the sample
  project carried no stored environment and fell back to the app default (30 %).
- Live probes (`zz-probe-air.browser.spec.ts`, since deleted) confirmed the checkbox write
  reaches the domain (`envUseWinisdAirModel.get()` flips true → false), the `projectChanged`
  tick advances (+6), and a later humidity edit recomputes with the moist-air model
  (RH 55 → 344.06). Reactivity was never broken.
- The original "Evidence" section's implication of a stale computed was wrong: the computed
  re-ran and produced the correct answer — the two models simply agree at RH 50.
