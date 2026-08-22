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

## Bundle composition delta — QO79 RULED (John, verbatim: "include / OBVIOUSLY!!!!")

Three gates were compared on today's (pre-B10) corpus, walking all 1969
`winisd_drivers/db/datasheets/**/openisd.yml` records:

- Original gate (stored `disposition==='ok'`): **1526** bundlable — reads a key post-B10
  records do not carry at all; this is the bug this file reports.
- Interim gate (derived `recordStandingIsOk`, missing/parse_errors both empty): **1197**
  bundlable — correctly derives from evidence the corpus does carry, but gates bundling on
  DATASHEET COMPLETENESS. The 564 records this gate excludes (relative to the original 1526)
  are excluded solely because a NON-simulation field — `Cms: 287, Xmax: 260, BL: 32, Mms: 8,
  Qms: 2, Qts: 1` (a record can carry more than one missing field) — is listed in
  `quality.missing`, and are simulatable by every criterion the app has (`Fs>0`, `Re>0`,
  `Sd-or-Vas`, ≥2 of `Qts/Qes/Qms`).
- **QO79-ruled gate (`recordIsSimulatable`, `packages/model/src/driverSimulatability.ts`):
  1654 bundlable.** Gates on APP-USABILITY only — the same Fs/Re/Sd-or-Vas/≥2-Q criteria
  `driverHasDqIssues` already used for its DQ flag. `recordStandingIsOk` no longer gates
  bundling at all; it stays as `driverHasDqIssues`'s DQ-flag input, so a bundled record missing
  a non-simulation field (e.g. `Cms`) ships AND is flagged — never excluded. Completeness-gating
  is settled wrong permanently (John's ruling).

The 564/1526 stale-`ok`-with-evidence and 239-of-1969 stale-`incomplete`-with-no-evidence split
observed while investigating this (mismatches between the corpus's STORED `disposition` and
its own `missing`/`parse_errors` lists) is a separate, independently-filed corpus defect, not
caused by any of the three gates above:
`winisd_tools/bugs/BUG_20260822_stale_disposition_disagrees_with_missing_parse_errors_evidence.md`.

## Verification

`npx vitest run packages/model/test/driverStanding.test.ts
packages/model/test/driverSimulatability.test.ts packages/ui/test/db/bundle-drivers-disposition.test.ts
packages/ui/test/db/driver-has-dq-issues.test.ts packages/ui/test/db/drivers-bundle.test.ts
packages/ui/test/db/myDrivers.test.ts` — 40/40 pass, including the QO79 fixture case (a record
with Fs/Re/Sd/2 Qs but a non-empty `quality.missing` bundles). `npx vite-node
scripts/bundle-drivers.mjs` regenerated `drivers-bundle.json` against the live
`winisd_drivers` checkout: **1654/1969 records bundled** (315 excluded, all genuinely not
simulatable), 13,202,419 bytes raw / 485,581 bytes gzipped. `grep -rn '\.disposition'
packages/ui/src packages/model/src scripts` matches only the type declaration site
(`openisdDriver.ts`), never a read.
