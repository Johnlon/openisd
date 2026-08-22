# openisd gates on `quality.disposition`, which post-B10 records no longer carry

Status: OPEN

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

Not yet applied. Direction: openisd derives standing locally from what records DO carry
(`quality.missing` + `quality.parse_errors` — same total derivation the python model uses),
in ONE place both consumers share. Must land before B11 (the bundle rebuild); belongs
naturally with A7 (catalogue/bundle work).

## Verification

Closure = both consumers read the shared derivation; a post-B10-shaped fixture (no
disposition key) bundles/classifies identically to its pre-B10 twin; picker spec green.
