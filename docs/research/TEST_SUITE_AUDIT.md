# Test-suite audit — duplication and organisation

## Question

The suite reports 2000+ tests. Is it massively duplicated or poorly organised?

## Verdict

**Not massively duplicated. The headline count is a corpus-enumeration artefact. Organisation
is the genuine defect.** Roughly 550 tests (of 2947) can go with no loss of guarded behaviour;
the rest of the cleanup is filing, naming and helper consolidation with no change to the count.

## Data

Method: `npx vitest run --reporter=json` (real, expanded `.each`/loop counts — `vitest list`
under-reports because it prints `.each` templates once) and `npx playwright test --list`.
Static counts from `grep`/`find` over `packages/*/test`. Nothing was edited.

### Totals

| Tier                 | Files   | Tests    |
| -------------------- | ------- | -------- |
| vitest (unit)        | 137     | 2646     |
| Playwright (browser) | 46      | 301      |
| **Total**            | **183** | **2947** |

### Where the count comes from

Five files emit one `it()` per fixture file and account for 1659 of 2646 unit tests (63%):

| File                                                           | Tests | Enumerates                                                           |
| -------------------------------------------------------------- | ----- | -------------------------------------------------------------------- |
| `packages/design/test/winisd/winisd-parity-functional.test.ts` | 451   | scenario × field against WinISD-written goldens                      |
| `packages/design/test/ini/ini.test.ts`                         | 448   | `drivers/matt/*.wdr` byte round-trip at the INI layer                |
| `packages/design/test/winisd/wdr-round-trip-matt.test.ts`      | 424   | `drivers/matt/*.wdr` byte round-trip at the `WinISDDriver` layer     |
| `packages/design/test/winisd/wdr-openisd-round-trip.test.ts`   | 250   | `drivers/sample/winisd/*.wdr` × 3 assertions through `OpenISDDriver` |
| `packages/design/test/winisd/wdr-round-trip.test.ts`           | 86    | `drivers/sample/winisd/*.wdr` byte round-trip at `WinISDDriver`      |

Hand-written tests: ~987 unit + 301 browser ≈ 1290.

Exact-name duplicates across the whole suite: 4 leaf names — `never overwrites an entered
value` ×3, `the sample corpus is the oracle, and it is not empty` ×2, `can actually see the
source it is meant to guard` ×2, one `.each` template.

### Largest hand-written files

| File                                                          | Tests | Lines |
| ------------------------------------------------------------- | ----- | ----- |
| `packages/design/test/domain.test.ts`                         | 91    | 1218  |
| `packages/ui/test/ui/original-skin.browser.spec.ts`           | 60    | 1221  |
| `packages/design/test/engine/advanced-figures.test.ts`        | 30    | 334   |
| `packages/ui/test/logic/driver-editor-solver.browser.spec.ts` | 27    | 457   |
| `packages/design/test/engine/hardening.test.ts`               | 27    | 280   |

## Findings — duplication

| #   | Finding                                               | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Cost                                                           |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| A1  | Matt corpus byte-round-tripped twice, one layer apart | `ini.test.ts` (`parseIni`→`stringifyIni`) and `wdr-round-trip-matt.test.ts` (`WinISDDriver.fromWdrIni`→`toWdr`) both walk `drivers/matt/*.wdr`. `WinISDDriver.toWdrIni` calls `stringifyIni`, so on the 419 files where the driver round-trip is byte-identical the INI check is already proven; the 4 files where the driver test allows key additions (three lacking `Brand=`, `B&C  6PE13.wdr` lacking `VCCon=`/`ParState=`) are the only ones the INI loop checks more strictly. `ini.test.ts` separately holds 12 targeted parser tests and a second loop over the `.wpr` goldens | ~420 redundant tests                                           |
| A2  | Sample corpus byte round-trip also at two layers      | `wdr-round-trip.test.ts` and the `entered values are never touched` leg of `wdr-openisd-round-trip.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ~86                                                            |
| A3  | Engine solver rules re-asserted through the browser   | `logic/driver-editor-solver.browser.spec.ts`: "UI derives Qts from Qes and Qms", "UI prioritizes Row 6 (Dd -> Sd) over Row 20", "UI derives BL from Fs, Mms, Re, and Qes" … 27 Playwright tests. `engine/driver.test.ts` (26) and `domain.test.ts` › "a spec field the record does not state reads through the solver" cover the same rules in ms                                                                                                                                                                                                                                      | 27 slow browser tests asserting engine maths, not UI binding   |
| A4  | E/C/N provenance in 5 files across 2 tiers            | `logic/provenance.test.ts`, `logic/provenance-matches-engine.test.ts`, `logic/driver-editor-provenance.browser.spec.ts`, `logic/driver-provenance-inspector.browser.spec.ts`, `ui/driver-editor-provenance-and-units.browser.spec.ts`                                                                                                                                                                                                                                                                                                                                                  | overlap on "input renders value-e/c/n" and inspector highlight |
| A5  | Browser helpers copy-pasted per spec                  | `numInputByLabel` defined in 4 specs, `openPicker` 4, `setField` 3, `openEditor` 2, `openTune` 2. `packages/ui/test/fixtures.ts` exports one helper, `openAProject`                                                                                                                                                                                                                                                                                                                                                                                                                    | every selector change is N edits                               |

## Findings — organisation

| #   | Finding                                       | Evidence                                                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Scratch probes committed as tests             | `packages/design/test/zz-scratch-sealed-feed.test.ts` — zero assertions, `console.log` only, tracked in git. `packages/ui/test/ui/zz-probe-sealed.browser.spec.ts` — a "probe". Both violate the `build/` rule for throwaway scripts                                                                                                                |
| B2  | Tests of mocks                                | `packages/ui/test/hooks/*.test.ts` (5 files, 15 tests) assert that `createMock…API()` returns its own defaults — `DriverEditorModal-hooks.test.ts` checks `mock.editorTitle === "Edit Project's Driver"`                                                                                                                                            |
| B3  | Directory names do not describe contents      | `packages/ui/test/logic/` holds 8 `*.browser.spec.ts`; `packages/ui/test/ui/` holds 13 unit `*.test.ts`; `packages/ui/test/persistence/` mixes 14 unit and browser files while `packages/persistence/test/` and `packages/design/test/persistence.test.ts` also exist — persistence tests in four places                                            |
| B4  | `packages/design/test/` root is a grab-bag    | 17 loose files: 8 `architecture-*`, `engine-wiring` beside an `engine/` dir, `persistence`, `solver-group-pr-vent`, `vent-pr-group-stubs`, `cell-dq`, `workspace`, `environmentalAxioms` (vs `engine/air.test.ts`)                                                                                                                                  |
| B5  | Source-grep "architecture" tests have no home | 13 files in 3 places: `design/test/architecture-*.test.ts` ×8, `design/test/engine/architecture.test.ts`, `ui/test/ui/architecture*.test.ts` ×4, plus `ui/no-persistence-vocabulary-drift`, `ui/no-domain-value-through-component`, `ui/import-from-declarer-only`, `winisd/ini-lib-is-the-one-ini-parser` — same genre, no shared helper           |
| B6  | Feature clusters fragmented one-bug-per-file  | driver browser: 10 files (`my-drivers`, `my-drivers-failures`, `my-drivers-filtering`, `driver-favorites`, `driver-search-interactive`, `driver-count`, `driver-browser-controls`, `driver-selection`, `driver-scope-chip`, `driver-summary`); driver editor: 8; original shell: 6; vent: 6 across two packages; tune panel: 4. Many hold 1–2 tests |
| B7  | The opposite failure in one file              | `packages/ui/test/ui/original-skin.browser.spec.ts` — 1221 lines, 60 tests                                                                                                                                                                                                                                                                          |
| B8  | Two filename conventions                      | 34 camelCase (`driverDisplay.test.ts`, `cursorFrequency.test.ts`) vs 103 kebab-case                                                                                                                                                                                                                                                                 |
| B9  | Two assertion styles                          | 84 files `node:assert/strict` (the documented rule in `.claude/rules/openisd-engine-tests.md`) vs 31 files vitest `expect`                                                                                                                                                                                                                          |
| B10 | Test rules cite paths that no longer exist    | `.claude/rules/openisd-engine-tests.md` scopes to `packages/engine/test/**` (package deleted); `.claude/rules/openisd-ui-tests.md` cites `test/db/driver-search-interactive.browser.spec.ts` and `test/db/drivers-bundle.test.ts` (now under `test/persistence/`)                                                                                   |

## Proposed actions, in payoff order

| #   | Action                                                                                                                                                                                        | Files                                                               | Count effect       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------ |
| 1   | Delete the two scratch probes (B1)                                                                                                                                                            | `zz-scratch-sealed-feed.test.ts`, `zz-probe-sealed.browser.spec.ts` | −2                 |
| 2   | Collapse A1: keep `ini.test.ts`'s 12 targeted parser tests, drop its Matt-corpus loop; keep one corpus sentinel                                                                               | `packages/design/test/ini/ini.test.ts`                              | −~420              |
| 3   | Collapse A2: fold the byte check of `wdr-round-trip.test.ts` into the per-file block of `wdr-openisd-round-trip.test.ts`                                                                      | `wdr-round-trip.test.ts` → merged                                   | −~86               |
| 4   | Rehome A3: keep 3–4 browser tests proving editor↔solver wiring (one derivation, one clear-cascade, OK/Cancel/Reset); move per-rule cases to `engine/driver.test.ts` where not already present | `driver-editor-solver.browser.spec.ts`                              | −~20 browser tests |
| 5   | Delete mock-default tests (B2)                                                                                                                                                                | `packages/ui/test/hooks/*`                                          | −~15               |
| 6   | Reshape by tier: `packages/ui/test/{unit,browser,static}/`; `packages/design/test/{architecture,engine,domain,winisd,ini}/` with nothing loose at root; fix the rule-file path globs (B10)    | `git mv`; `.claude/rules/openisd-*-tests.md`                        | 0                  |
| 7   | Merge B6 clusters to one file per feature (`driver-browser`, `driver-editor`, `vent`, `tune-panel`); split B7 into `original-shell-{layout,panels,graph}`                                     | listed above                                                        | 0                  |
| 8   | Lift A5 helpers into `packages/ui/test/fixtures.ts`                                                                                                                                           | 12 specs                                                            | 0                  |
| 9   | Normalise B8/B9: kebab-case filenames, `node:assert/strict` everywhere                                                                                                                        | 34 renames, 31 files                                                | 0                  |

Actions 1–5 take the count from ~2947 to ~2400. The remaining bulk — parity goldens (451) and
the `OpenISDDriver` corpus round-trip (250) — is legitimately one test per fixture.

## Verification for each action

- Run only the touched file (`npm test <file>`), then `npm run test:unit`.
- Actions 2–3: before deleting a corpus loop, break `parseIni` quoting on purpose and confirm
  the surviving `wdr-round-trip-matt` loop goes red.
- Action 6: `npx vitest list` and `npx playwright test --list` must print identical test names
  before and after the moves.
- Final gate: `PROCEED=1 bash scripts/health-check.sh` green.

## Open questions for the reviewer

| #   | Question                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Is the INI-layer corpus loop (A1) wanted as an independent gate on `parseIni`/`stringifyIni`, or is the driver-layer loop sufficient proof? If kept, a 4-file fixture (the key-set outliers) covers what the driver loop does not |
| Q2  | Is the browser tier meant to re-prove solver rules (A3) as an end-to-end guard, or only wiring?                                                                                                                                   |
| Q3  | Are the `hooks/` mock tests (B2) guarding something about the hook contract that the component tests do not?                                                                                                                      |
| Q4  | Tier-based (`unit/browser/static`) or feature-based directories for `packages/ui/test/` (action 6)?                                                                                                                               |
