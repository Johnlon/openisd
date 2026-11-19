# BUG_20261118_formula-panel-is-a-hand-typed-copy-of-the-engine

**Status:** FIXED in T902

## Symptom
The Driver Editor's formula panel (Inspect Provenance) showed formulas the engine does not use. Hg 10 mm, Xmax 3 mm: the
panel said Hc = 2 × Xmax + Hg (16 mm); the engine gives Hg − 2 × Xmax (4 mm). It listed a Vas route from Sd, Fs and Mms the
engine does not have, and left out engine routes (Qes from η₀, Vas from η₀, η₀ from the motor and from SPL, SPLref, KLe, both
Rme and both Mpow routes, Re from USPL). The passive-radiator editor filtered that copy to decide which formulas a radiator
has: a decision in the UI. Found by the duplicate-logic scan (`_agent_files/dupscan/REPORT.md`, finding 4).

## Cause
`packages/ui/src/logic/provenance.ts` `PROVENANCE_MAP` was 47 hand-typed formula strings, a second statement of the engine's
routes (`packages/design/engine/driver/routes/*`), and drifted from them.

## Fix
Every engine route carries its formula text (`SolveRoute.formulaText`, required). The engine gives the formulas
(`engine.driver.routeFormulas()`, `engine.pr.routeFormulas()`: one per route, in the order the solver tries them). The panel
shows those (`provenanceMap(formulas)`); the radiator editor shows `engine.pr.routeFormulas()`, the routes among the radiator's
own figures. The UI copy is gone. `numVC` loses its panel entry ("numVC = 1, the default"): no engine route works it out, and
the editor has no numVC default since QO900 R1.

## Verification
`packages/ui/test/logic/provenance-from-engine.test.ts` (every panel formula is an engine route with its text and inputs;
every engine route is on the panel; Hc example 4 mm; no Vas route the engine lacks) and the radiator test in
`packages/ui/test/hooks/passiveRadiatorEditor.test.ts`: failed before, pass after.
