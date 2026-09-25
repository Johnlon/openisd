# Plan: field-key consolidation (one enum, domain-named)

**Status:** proposal (awaiting go-ahead)
**Problem it fixes:** the driver-field identity is spread across parallel collections that
speak different names for the same field, and the UI strips the domain's unit suffixes.

## The corruption (verified)

| Collection | Where | Holds | Verdict |
|---|---|---|---|
| driver spec fields | `design/domain/openisdDomain.ts` | **authoritative domain names** (`Fs_hz`, `KLe`…) | ✅ schema — the source |
| WDR keys | `design/winisd/winisdDriver.ts` | `.wdr` INI keys (`Qts`, `Dia`, `Rt`…) | ✅ a format's own vocabulary |
| WPR / ParState | `design/winisd/winisdProject.ts`, `parstate.ts` | `.wpr` parameter slots ↔ keys | ✅ a format's own vocabulary |
| fieldRegistry | `ui/logic/fields/fieldRegistry.ts` | UI metadata (precision, pane, unit) | ⚠️ metadata is fine, but its `id` is a bare-name copy of the domain name |
| provenance.ts | `ui/logic/provenance.ts` | formulas keyed by field | ✅ a formula map keyed by field — not a field collection |
| editor template | `DriverEditorModal.vue` | `data-field-key` ground truth | ⚠️ correct as the binding, wrong as bare-name literals |
| ~~fieldKeys.ts~~ | ui | a 7th parallel copy | ❌ delete — its content folds into the design-side enum |

**My reaction / the principle:**

- Format-specific names (`.wdr` `Dia` vs domain `Dd_m`, `.wpr` slots) are NOT corruption by
  themselves — each file format genuinely has its own key for a field, and each format's schema
  belongs to its own writer.
- The corruption is TWO things:
  1. **The UI invented a 4th vocabulary** (bare `Fs`) instead of speaking the domain name
     (`Fs_hz`) — so the same quantity has a different name in the domain and the UI.
  2. **The field→format mapping is re-written in many places** (provenance, registry, editor,
     writers) instead of existing in exactly one.
- The rule: **"what is field F's WDR name / WPR slot / label" is answered in exactly one
  table.** Everything else reads it; nothing re-declares a field→name mapping of its own.
  A field is identified by its domain name everywhere the domain owns it; a UI-only
  non-domain field carries a distinct prefix (`meta.…`).

## Target design

**ONE enum lives in `packages/design`** and carries the field's full identity:

```ts
// design/domain/fieldSchema.ts
export const FIELD = {
  Fs_hz:    { label: 'Fs',        wdr: 'Fs' },
  Vas_m3:   { label: 'Vas',       wdr: 'Vas' },
  alfaVC:   { label: 'AlfaVC' },              // no .wdr key
  ...
} as const;
export type FieldName = keyof typeof FIELD;
```

- **The enum member IS the domain name** (`Fs_hz`). The UI speaks the same name — no
  suffix-stripping copy.
- **`label` is intrinsic** to the field (one edit; the reverse lookup is derived, not a
  parallel map).
- **WDR / WPR / format presence** attach to the same field (`wdr: 'Dia'` where the name
  differs; absent where the field is not written). `.wdr` and `.wpr` writers read this table
  instead of their own literal pools.
- **UI-only fields that are NOT domain-bound** get a distinct prefix (e.g. `meta.manufacturer`,
  `meta.comment`) so "domain field" and "not a domain field" are unambiguous.

## Derivation (no parallel copies)

- `SpecField` ← `keyof typeof FIELD` (delete the hand-written union).
- `data-field-key` ← the enum member (`:data-field-key="FIELD.Fs_hz"`).
- `PROVENANCE_MAP` keyed by `FieldName`; `LABEL_TO_FIELD_KEY` derived from `FIELD[].label`.
- `fieldRegistry` ids align to the enum.
- `.wdr`/`.wpr` writers key off the same table.

## Steps

1. Build `design/domain/fieldSchema.ts` from the authoritative domain field list
   (`DRIVER_QUANTITY_NAMES` + the editor's remaining keys), filling label + wdr per field.
2. Rewire the domain's WDR/WPR writers to read it (remove their literal key pools).
3. Derive `SpecField` from the enum; delete the hand-written union.
4. Rekey the editor (`data-field-key` + helper args) to the enum members.
5. Rekey provenance (`PROVENANCE_MAP`, derive `LABEL_TO_FIELD_KEY`).
6. Align `fieldRegistry` ids.
7. Run the affected suites: driver-editor-provenance-and-units, driver-editor, domain
   WDR/WPR round-trip tests, driver-persistence.

## Risks / tests touched

- WDR/WPR round-trip tests (any writer that reads a literal pool must keep byte-identical
  output — this is a rename, not a behaviour change).
- Every spec that binds a driver field by bare name (editor, provenance, persistence).
- The provenance drift test becomes structurally redundant once the editor binds the enum —
  keep it as a regression gate anyway.

## Scope decision

- **Do it now** as the proper fix for the provenance failures (defers the rest of the
  failing-test sweep until it lands), or
- **Park it** in the backlog and land a minimal enum fix first so the failing suite goes green
  this pass.