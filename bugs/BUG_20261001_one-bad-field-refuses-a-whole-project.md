# BUG_20261001_one-bad-field-refuses-a-whole-project

**Status:** OPEN

## Symptom
A stored or opened project with one field that fails the schema is refused whole: autosave,
open tabs, File → Open and share links all drop the project instead of loading it with that
one field reset.

## Cause
`OpenISDProject.fromOwprText` is one whole-record `safeParse`
([projectSerialization.ts](http://localhost:8000/winisd/openisd/packages/design/domain/project/projectSerialization.ts#L22-L36));
any issue returns errors and no project.

## Fix
Repair, never reset (John, 2026-10-01): remove each failing field, re-parse, load what parses,
and tell the user which fields were reset, with the original text kept for download.
