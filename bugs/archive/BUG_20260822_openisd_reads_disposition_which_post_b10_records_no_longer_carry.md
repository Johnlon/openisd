# openisd gates on `quality.disposition`, which post-B10 records no longer carry

Status: RESOLVED (2026-08-22, task A7)

## Symptom

John's Antigravity ruling (verbatim chain in `winisd_tools/REWORK:463-1205`) makes
`disposition` and `no_ts_published` `exclude=True` — re-emitted records carry NEITHER key.
openisd currently reads the key in at least two gates:

- `scripts/bundle-drivers.mjs` — `isBundlable`'s `disposition === 'ok'` filter: post-B10 the
  key is absent on every record, so NOTHING would bundle (or everything, depending on the
  comparison's falsy path) — B11 breaks either way.
- `packages/ui/src/db/driverRepo.ts::driverHasDqIssues` — reads `quality.disposition` off
  records (alongside its own field checks).

## Evidence

The exclusion verified against the REWORK transcript and the peer session's regenerated
golden ("sole diff is the disposition block no longer serialising"). The two consumer sites
by grep (`disposition` in scripts/ + packages/ui/src/db) as of HEAD.

## Cause

The ruling moved standing from a stored key to a derivation; openisd's consumers still expect
the stored key.

## Fix

Re-verified 2026-08-22 before fixing: `driverHasDqIssues` (HEAD, pre-fix) did NOT read
`quality.disposition` at all — it derived a completeness flag from `Fs`/`Re`/`Sd`/the Q-group
directly, independent of the `disposition` bug this file originally reported. Only
`scripts/bundle-drivers.mjs`'s `isBundlable`/`project` actually read the stored key.

Fix applied: `packages/model/src/driverStanding.ts` (new file, exported at the
`@openisd/model/driverStanding` subpath — `packages/model/package.json`'s `exports` map, so
neither `index.ts` nor `openisdDriver.ts` needed editing) exports `recordStandingIsOk(quality)`
= `quality.missing.length === 0 && quality.parse_errors.length === 0`. Both
`scripts/bundle-drivers.mjs` (`isBundlable`) and `driverRepo.ts::driverHasDqIssues` call it;
neither reads `quality.disposition`/`disposition` any more. `driverHasDqIssues` now ORs the
existing field-completeness check with `!recordStandingIsOk(record.quality)`, so its 15
pre-existing pinned-behaviour tests are unaffected and 2 new tests cover the standing path.

Running the bundler live surfaced a second, separate bug (the CLI-entry guard breaking under
`vite-node`, needed because `@openisd/model` is TS source plain `node` cannot load) —
recorded and fixed separately:
`bugs/BUG_20260822_bundle_drivers_cli_guard_breaks_under_vite_node.md`.

## Bundle composition delta — QO79/QO81 RULED, FINAL

Four gates were compared on today's (pre-B10) corpus, walking all 1969
`winisd_drivers/db/datasheets/**/openisd.yml` records — the history matters because each
intermediate gate was independently proposed, implemented, and then overturned:

- Original gate (stored `disposition==='ok'`): **1526** bundlable — reads a key post-B10
  records do not carry at all; this is the bug this file reports.
- Interim gate 1 (derived `recordStandingIsOk`, missing/parse_errors both empty): **1197**
  bundlable — correctly derives from evidence the corpus does carry, but gates bundling on
  DATASHEET COMPLETENESS. The 564 records this gate excludes (relative to the original 1526)
  are excluded solely because a NON-simulation field — `Cms: 287, Xmax: 260, BL: 32, Mms: 8,
  Qms: 2, Qts: 1` (a record can carry more than one missing field) — is listed in
  `quality.missing`. SETTLED WRONG (QO79).
- Interim gate 2 (`recordIsSimulatable`, `packages/model/src/driverSimulatability.ts` — Fs,
  Re, Sd-or-Vas, ≥2 of Qts/Qes/Qms): **1654** bundlable. Fixed the completeness-gating error
  but replaced it with a narrower one — gating on APP-USABILITY. SETTLED WRONG TOO (QO79
  amended, John, verbatim: "tis is a fail - they shoudl be bundheld with the usual health
  warnings visible in the UI"; QO81, John, verbatim: "it is improtant NOT DRIER GETS EXCLIDED
  BECAUSE OF MISSIG SPEC PARAMS !!!!").
- **FINAL gate (structural readability, `recordConforms()`,
  `packages/model/src/driverConformance.ts` — the same check guarding My Drivers reads):
  1969/1969 bundlable — the FULL corpus.** Every record that parses, has a `specs` container,
  and has a `quality` block with `missing`/`parse_errors` arrays bundles, full stop. Neither
  completeness nor simulatability excludes a record any more; both are settled wrong,
  permanently. `recordIsSimulatable` and `recordStandingIsOk` are DISPLAY INFORMATION ONLY
  now — their one consumer is `driverRepo.ts::driverHasDqIssues`, the ⚠ health-warning badge.
  A driver with no Fs, or no T/S fields at all, ships, appears in the browser, opens in the
  editor, and degrades in a design exactly like a user-created driver with those fields left
  blank.

The 564/1526 stale-`ok`-with-evidence and 239-of-1969 stale-`incomplete`-with-no-evidence split
observed while investigating this (mismatches between the corpus's STORED `disposition` and
its own `missing`/`parse_errors` lists) is a separate, independently-filed corpus defect, not
caused by any of the gates above:
`winisd_tools/bugs/BUG_20260822_stale_disposition_disagrees_with_missing_parse_errors_evidence.md`.

## Verification

`npx vitest run packages/model/test/driverStanding.test.ts
packages/model/test/driverSimulatability.test.ts packages/ui/test/db/bundle-drivers-disposition.test.ts
packages/ui/test/db/driver-has-dq-issues.test.ts packages/ui/test/db/drivers-bundle.test.ts
packages/ui/test/db/myDrivers.test.ts` — 41/41 pass, including the ruling case: a structurally
sound record with no Fs still bundles (`isBundlable` true) AND `driverHasDqIssues` still flags
it (true) — one test, both halves of the ruling. `npx vite-node scripts/bundle-drivers.mjs`
regenerated `drivers-bundle.json` against the live `winisd_drivers` checkout: **1969/1969
records bundled** — the full corpus, 0 excluded — 14,880,109 bytes raw / 571,689 bytes
gzipped. `grep -rn '\.disposition' packages/ui/src packages/model/src scripts` matches only
the type declaration site (`openisdDriver.ts`), never a read.
