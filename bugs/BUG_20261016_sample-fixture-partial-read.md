# BUG_20261016_sample-fixture-partial-read

**Status:** FIXED (T258)

## Symptom
On GitHub Actions (a fresh checkout), a browser spec failed with the console error
`Could not read "sample-project.owpr": not valid JSON` (cloudSync.original, run 38977294733, shard 6).
It never showed on the laptop.

## Cause
The sample projects are generated on first use (`packages/ui/test/fixtures/sampleProject.ts`
`ensureSampleProject`, and `generateSample.ts` imported by some specs). In a fresh checkout every
browser worker finds them missing and runs the generator at the same time. `writeFileSync` empties the
file before it writes, so a worker reading at that moment got part of the file. The laptop already had
the files, so it never regenerated them during a run.

Repro: `bash scripts/ci/sample-fixture-race.sh <checkout>` (four generators at once and a reader):
before the fix, 4 of 168,494 reads were not valid JSON; after, 0 in two runs.

## Fix
`generateSample.ts` writes each file to `<file>.<pid>.partial` and renames it into place. A rename within
one folder is atomic: a reader sees the old file or the new one, never part of one.
