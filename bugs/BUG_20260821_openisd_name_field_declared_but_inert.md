# `name?: _DerivedField<string>` is declared on the record but has no producer and no consumer

Status: OPEN

## Symptom

`packages/model/src/openisdDriver.ts:93` declares `name?: _DerivedField<string>`.
winisd_tools no longer emits it (its dead `FIELD_DEFINITIONS["name"]` entry was deleted
2026-08-21 during the QO42 field work; the range name reaches the app through the conformed
`model` field instead), and nothing in openisd reads it: grep of `packages/model/src` and
`packages/ui/src` for `record.name` / `name?.value` / `.name.value` returns zero hits.

## Evidence

- Emitter side: winisd_tools `record_registries.py` has no `name` definition; the
  completeness assertion (`test_record_registries.py`) forbids re-adding one without a model
  field.
- Consumer side: zero read sites in openisd (grep above, 2026-08-21).

## Cause

The declaration outlived the producer. A declared field with neither producer nor consumer is
dead surface on the one record shape.

## Fix

Delete the declaration (and any fixture carrying the key becomes INVALID under
`extra="forbid"` semantics — regenerated fixtures follow the model). Small; sequence with the
next model-touching openisd task so it lands before the B10 regeneration defines the final
shape.

## Verification

Closure = declaration gone, typecheck + model suite green, no bundled/regenerated record
carries `name`.
