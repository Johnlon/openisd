# BUG_20261030_projects-archive-accepts-invalid-utf8

**Status:** RESOLVED (T619)

## Symptom
Importing a projects archive whose bytes are not valid UTF-8 was not refused as such. The bytes
were silently repaired (bad bytes became U+FFFD) and the user saw "not valid JSON" or, worse, an
archive with altered project text.

## Cause
`parseProjectsArchive` decoded with `new TextDecoder().decode(bytes)`, which never throws. The
original "not valid UTF-8" refusal sat in a `try/catch` that could never fire, and a coverage
cleanup removed it instead of fixing the decoder.

## Fix
Decode with `new TextDecoder('utf-8', {fatal: true})`; a decode error returns
`{kind: 'failed', reason: 'not valid UTF-8'}` again.

## Test
`packages/design/test/domain/projectsArchive.test.ts`: "bytes that are not valid UTF-8 are refused
as such, not as bad JSON".
