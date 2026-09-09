# Two test files are empty, so the unit suite fails with "No test suite found"

Status: RESOLVED 2026-09-09

## Symptom

`npm run test:unit` reports two files as failed, with no assertion involved:

```
 FAIL  |ui| test/logic/schemaUpgrade.test.ts [ packages/ui/test/logic/schemaUpgrade.test.ts ]
Error: No test suite found in file /home/john/work/winisd/openisd/packages/ui/test/logic/schemaUpgrade.test.ts
 FAIL  |ui| test/persistence/myDriverRepo.test.ts [ packages/ui/test/persistence/myDriverRepo.test.ts ]
Error: No test suite found in file /home/john/work/winisd/openisd/packages/ui/test/persistence/myDriverRepo.test.ts
```

Both files are zero bytes. They are the only empty `*.test.ts` in the repo:

```
$ find packages -name '*.test.ts' -empty -not -path '*/dist/*'
packages/ui/test/logic/schemaUpgrade.test.ts
packages/ui/test/persistence/myDriverRepo.test.ts
```

## Cause

Both were truncated to zero in commit `a4fcaaf` ("forced commit", 2026-09-01) and have not been
touched since. Neither has a subject any more:

| File | What it tested | State of that subject |
|---|---|---|
| `schemaUpgrade.test.ts` | `packages/ui/src/logic/schemaUpgrade.ts` | deleted — its `STEPS` list was empty and `CURRENT_SCHEMA` was 1, so the seam migrated nothing |
| `myDriverRepo.test.ts` | `packages/persistence/src/repos/myDriverRepo.ts` | rewritten onto the shared saved-library envelope; covered by `packages/persistence/test/savedLibrary.test.ts` |

## Impact

Two permanent red entries in every `npm run test:unit` run, which is a gate the project requires
green. A red suite that is red for a known-harmless reason is the condition under which a real
failure stops being noticed.

## Fix

Both files deleted. Each was zero bytes and neither had a subject left to test:

- `packages/ui/src/logic/schemaUpgrade.ts` does not exist (`ls` reports no such file).
- `myDriverRepo` is exercised by `packages/persistence/test/savedLibrary.test.ts` (5 tests) —
  the only test file in the repo that names it.

## Verification

```
$ find packages -name '*.test.ts' -empty -not -path '*/dist/*'
(no output)
```

Deleting a test that proves nothing is what the suite's own skip message demands ("Make them
run, or delete them"); no coverage was lost, because neither file contained a test.
