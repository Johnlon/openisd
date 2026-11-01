# Defect-pinning sweep, 1 Nov 2026

Scope: 777 files from `git ls-files 'packages/**/*.test.ts' 'packages/**/*.spec.ts'`.
Gate: `packages/design/test/architecture-tests-never-pin-a-defect.test.ts`.
Result: 0 tests pin a defect as correct. 1 stale FIXME removed. 0 skips found.

## it.fails / test.fails (the "9")

5 call sites plus 4 comment lines. All 5 call sites name an existing bug file.

| Where | Verdict | Line |
|---|---|---|
| packages/design/test/domain/driver-edit-parity-e150he-44.test.ts:187, :197 | ok | right expectation under it.fails; BUG_20261019_winisd-numvc-is-not-a-simulation-input |
| packages/design/test/domain/pr-edit-parity-nd140-pr.test.ts:46 | ok | BUG_20261003_winisd-pr-sd-edit-ignored, BUG_20261019_winisd-pr-vas-edit-rounded-to-4-decimals |
| packages/design/test/domain/pr-edit-parity-sb15sfcr-00.test.ts:42 | ok | BUG_20261003_winisd-pr-sd-edit-ignored |
| packages/design/test/fixtures/winisdEditRuns.ts:143 | ok | BUG_20261019_winisd-numvc..., BUG_20261019_winisd-bp4-group-delay-is-rounding-noise-from-200-hz |
| driver-edit-parity-w5.test.ts:24, pr-edit-parity-*:18/:17, winisdEditRuns.ts:106, vented-plausibility-cells.test.ts:76, sampleProject.test.ts:6 | ok | comments or prose, not calls |

## Skips and soft asserts

| Signal | Hits | Verdict |
|---|---|---|
| it/test/describe .skip, .todo, .fixme, xit, xtest, xdescribe | 0 | ok |
| expect.soft | 55, all in packages/ui/test/ui/new-project-wizard-walk.browser.spec.ts | ok: collects all mismatches of a driver walk; each is the right expectation |

## Phrase hits ("for now", "currently", "today", "as implemented", "matches current", "legacy behaviour", TODO, FIXME, HACK, quirk, workaround, known defect/bug, pins the bug, documents the bug, current (wrong), asserts the throw)

| file:line | Verdict | Line |
|---|---|---|
| ui/test/scripts/bundle-drivers-disposition.test.ts:101 | was stale, fixed | FIXME said the badge assertion was dropped; bug is RESOLVED and badge is asserted in bundledIndexRows.test.ts; FIXME replaced by a pointer |
| design/test/domain/appContext.test.ts:18 | ok | platformUser has no OS source; null is the stated design |
| design/test/domain/box-alignments.test.ts:127 | ok | stale comment ("today the cell reads not-available"); assertions are the golden values (63.1762 Hz, 0.5995) |
| design/test/winisd/scraper-driver-json-projection.test.ts:15,41,42 | ok | "today's" = the scraper's current output shape, a fixture, not a defect |
| design/test/winisd/wdr-driver-type-tag.test.ts:7 | ok | documents the no-tag fallback as designed |
| design/test/winisd/openIsdProjectToWinIsdProject.test.ts:322 | ok | "today" is a date stamp |
| ui/test/logic/appState-issues.test.ts:12 | ok | TODO(box-wizard) in prose; unsized new project is current design |
| ui/test/logic/provenance.test.ts:31 | ok | coverage note: 31 fields not yet held to the check; no wrong value asserted |
| ui/test/scripts/round-trip-gate.test.ts:82 | ok | asserts the record passes (right); comment is history |
| ui/test/ui/cloudSync.original.browser.spec.ts:19 | ok | "as today": toolbar button count, a layout fact |
| architecture-no-casts.test.ts:36,85,122 | unclear | "passes for now / exempt for now, QO100": an exemption allowlist in a gate, owned by QO100 |
| architecture-no-record-types-in-barrel:45, architecture-notify:33,136, architecture.test.ts:679,687, driver-editor-template:379,381, driver-browser/field-cursor/num-input/original-box-tab (currently rendered/shipped) | ok | descriptive wording, nothing wrong asserted |

## toThrow / rejects / null on product actions

| Where | Verdict | Line |
|---|---|---|
| design/test/domain/box-alignments.test.ts:234 | ok | builder refuses a solver write to Vb; programmer-error guard, not a product action |
| design/test/domain/driver-edit.test.ts:101 | ok | loading a driver onto itself is refused by design |
| design/test/domain/project-signal.test.ts:53,144-147 | ok | setters reject out-of-range drive; spec'd (10 mV floor) |
| design/test/domain/*-json-schema, reader-verdict | ok | schema rejects malformed external data at the boundary |
| persistence/test/bundledRepo*.test.ts | ok | 404 and malformed index reject with the URL named |
| design/test/domain/project/project-id.test.ts:110, stored-text.test.ts:116 | ok | textWithId returns null on non-project text; the caller handles it |
| ui/test/ui/new-project-wizard.browser.spec.ts:386 | ok | helper throws when the record states no Xmax; asserts the record has none |
| ui/test/fixtures.ts:91,165,285 | unclear | `.catch(() => {})` in a fixture helper swallows a poll timeout; cleanup, no asserted product behaviour |
| remaining toBeNull / toBeUndefined / toEqual([]) hits | ok | empty inputs and absent values the design says are absent |

No parse/import/open/pick/save test asserts a throw where a bug file or the code says it should not.
