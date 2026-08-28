# The driver_type gate flags box-type comparisons, because both now spell PR the same way

**Where:** `packages/ui/test/ui/driver-type-chips.test.ts`, the
`no raw driver_type string literals in comparisons` gate.

**Status:** OPEN — the gate is narrowed (below) so it stops firing on box types. The proper
type-aware gate is not built; that needs John's call on cost.

## Symptom

After the box-type vocabulary was unified on John's canon
(`'sealed'|'vented'|'bandpass4'|'bandpass6'|'passive-radiator'|'abc'`, ruling 2026-08-28), the
gate reported six offences that are not driver_type comparisons at all:

```
logic/series.ts:119                     if (box === 'passive-radiator') {
ui/components/BoxTypeDiagram.vue:30     v-show="boxType === 'passive-radiator'"
ui/shells/original/OriginalShell.vue:120  selectedBox.value === 'passive-radiator' ? …
ui/shells/original/OriginalShell.vue:148  selectedBox.value === 'passive-radiator' ? …
ui/shells/original/OriginalShell.vue:901  v-if="selectedBox === 'passive-radiator'"
ui/shells/original/OriginalShell.vue:1064 v-else-if="selectedBox === 'passive-radiator'"
```

Every one compares a BOX TYPE. None involves `driver_type`.

## Cause

`'passive-radiator'` is now a legal value of two unrelated vocabularies:

- **driver_type** — a driver that IS a passive radiator (ruling D7, kebab spelling, 78 records).
- **box type** — an enclosure loaded by a passive radiator (John's canon, 2026-08-28).

The gate matches on text: an equality operator adjacent to the literal
(`(?:[=!]==?\s*['"\`]VALUE['"\`])|…`). That shape proves a comparison happened; it says nothing
about WHAT was compared. While the two vocabularies spelled PR differently (`'pr'` vs
`'passive-radiator'`) the ambiguity was invisible. Unifying the box-type spelling made the
collision real.

This is the failure mode the global rule predicts: *"a mechanical guard MUST test the SHAPE of
the code — an AST, a signature, a runtime attribute — and MUST NOT grep prose for a word… A gate
that fails because a docstring explains the rule it enforces is a broken gate: it manufactures
false positives."* The gate is regex-over-text, so with one string serving two concepts it cannot
be right.

## Fix (applied — a narrowing, not a weakening)

The gate now skips a comparison whose compared expression is a BOX-TYPE identifier
(`box`, `boxType`, `selectedBox`, and `.value` forms). It matches IDENTIFIERS only — never
comments, docstrings or string literals — and its docstring says so, per the global rule's stated
exception for checks that cannot be expressed as a pure shape.

The gate's actual job is undiminished: a `driver_type` comparison against a wire string is still
an offence, and the deliberate-regression check below proves it.

## Fix (NOT applied — needs John)

The honest gate resolves the compared expression's TYPE and flags only driver-type-typed
operands. That needs the TypeScript type checker plus `.vue` template extraction, so it is real
work rather than a tweak. Until then a driver_type comparison that happens to be held in a
variable named `box` would slip through — narrow, but a genuine hole.

## Verification

- `npx vitest run packages/ui/test/ui/driver-type-chips.test.ts` — green with the six box-type
  comparisons present in the tree.
- Deliberate regression: reintroducing a real driver_type wire-string comparison
  (`driverType === 'passive-radiator'`) is still reported. Pinned by a test in the same file so
  the narrowing cannot silently become a blanket exemption.
