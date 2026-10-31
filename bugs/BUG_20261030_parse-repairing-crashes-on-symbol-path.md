# BUG_20261030_parse-repairing-crashes-on-symbol-path

**Status:** RESOLVED (T619)

## Symptom
When a schema issue's path holds a symbol, `parseRepairing` throws `TypeError: Cannot convert a
Symbol value to a string` instead of returning its refusal messages.

## Cause
`messagesOf` worded the path with `issue.path.join('.')`, which converts each part implicitly.

## Fix
Convert each part with `String` first; a symbol reads as `Symbol(k)`.

## Test
`packages/design/test/domain/schemaRepair.test.ts`: "an issue at a path holding a symbol is not
repairable and is refused with the symbol named". It had asserted the throw as a "known defect",
which pinned the bug.
