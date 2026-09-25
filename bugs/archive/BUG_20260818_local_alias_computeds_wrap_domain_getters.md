# Local `computed`/`const` aliases wrap a single domain-object read with a second name, across the UI layer

# Status
FIXED 2026-08-18 — all 9 instances resolved. The 5 single-use-site rows (`ventArea`,
`boxResonance`'s `prFh` leg, `brand`, `portPipeResonance`, `prVas`, `prFs`, `prFsMass`, `prQms`
in `OriginalShell.vue`; `fixes`/`faults` in `DiagnosticsModal.vue`) were inlined at their call
sites. The 4 `store.ts` multi-use exports (`driver`, `projectToPersist`, `driverErrors`,
`driverConsistencyIssues`) were converted from `computed` values to plain functions — see "Fix
applied" below for why that, not deletion, is the correct fix for this shape.

## Rule violated

ARCHITECTURE.md §5, new invariant **"No local alias for a domain-object read (human ruling
2026-08-18)"**, added in the same change as this file. A `computed`/`ref`/`const` whose entire
body is one passthrough call to a domain-object getter is a second name for a value that already
has one — the call should happen at the point of use instead.

Trigger case (already fixed correctly for the CALCULATION, but still an alias):
`packages/ui/src/ui/shells/original/OriginalShell.vue:143-145`:
```ts
const ventArea = computed<number>(() => {
  return managedProject.ventArea_m2();
});
```

## Instances found

### `packages/ui/src/logic/store.ts`

| lines | code | aliases | use sites |
|---|---|---|---|
| 400-403 | `export const driver = computed<Driver \| null>(() => { void _version.value; return managedProject.toDriver(); });` | `managedProject.toDriver()` | many: `App.vue`, `OgTune.vue`, `OriginalShell.vue`, `useApplicationIO.ts`, `GraphPanel.vue`, `driverFigures.ts`, others |
| 406-409 | `export const projectToPersist = computed(() => { void _version.value; return managedProject.recordToPersist(); });` | `managedProject.recordToPersist()` | `store.ts` internally only (`driverRecord`, line 419) |
| 435-438 | `export const driverErrors = computed<DriverError[]>(() => { void _version.value; return managedProject.errors(); });` | `managedProject.errors()` | `GraphPanel.vue`, `store.ts` (`driverWarnings`), `OriginalShell.vue` |
| 439-442 | `export const driverConsistencyIssues = computed<ConsistencyIssue[]>(() => { void _version.value; return managedProject.consistencyIssues(); });` | `managedProject.consistencyIssues()` | `OgTune.vue`, `store.ts` |

Each carries a `void _version.value;` line before the return — a reactivity-trigger idiom, not
added logic — so the body is still "one call plus a version bump," the shape the rule targets.

`driverName` (store.ts:418-422) and `driverWarnings` (store.ts:444) are **not** in scope: the
first combines two `metaCell()` reads with `.filter().join()`, the second `.map()`s over another
computed — both add real logic beyond a bare passthrough.

### `packages/ui/src/ui/shells/original/OriginalShell.vue`

| lines | code | aliases | use sites |
|---|---|---|---|
| 143-145 | `const ventArea = computed<number>(() => { return managedProject.ventArea_m2(); });` | `managedProject.ventArea_m2()` | this file only (the trigger case) |
| 139-141 | `const boxResonance = computed<number \| null>(() => selectedBox.value === 'pr' ? prFh.value : rearResonance.value);` | routes between two ALREADY-ALIASED computeds (`prFh`, `rearResonance`), no logic of its own | this file |
| 676 | `const brand = computed(() => managedProject.metaCell('brand').value);` | `managedProject.metaCell('brand').value` | one template binding, line 1142 |

`model` (line 677: `managedProject.metaCell('model').value || driverName.value`) is **not** in
scope — the `||` fallback is real logic.

### `packages/ui/src/ui/components/DiagnosticsModal.vue`

| lines | code | aliases | use sites |
|---|---|---|---|
| 25 | `const fixes = computed<QuickFix[]>(() => faultLog.applicable());` | `faultLog.applicable()` | this file only |
| 26 | `const faults = computed(() => faultLog.faults);` | `faultLog.faults` (property read, same shape) | this file only |

## Fix applied (single-use-site rows)

`ventArea`, `prFh` (folded into `boxResonance`'s ternary), `brand`, `portPipeResonance`, `prVas`,
`prFs`, `prFsMass`, `prQms` in `OriginalShell.vue`, and `fixes`/`faults` in
`DiagnosticsModal.vue` — all deleted; each former reference now calls the domain-object getter
(or `faultLog` method) directly at its point of use. `boxResonance` itself is KEPT as a
`computed` (3 template use sites, genuine memoization) but its body now calls
`managedProject.prSystemTuning_hz()` directly instead of through the deleted `prFh` alias — the
rule's "or adds real branching" carve-out applies once it no longer routes between two
already-aliased names. `sealedRes`/`rearResonance`/`rearQtc` are also KEPT: `sealedRes` is a
shared computation feeding two distinct derived readouts (`rearResonance` reads `.Fsc`,
`rearQtc` reads `.Qtc`, each also has 2 template use sites) — extracting a field with `?? null`
is the same "real logic" shape the rule already exempts for `model` (`... || driverName.value`).

## Fix applied (store.ts multi-use-site rows: `driver`, `projectToPersist`, `driverErrors`,
`driverConsistencyIssues`)

These are genuinely a different shape from the single-use-site rows: `driver` / `driverErrors` /
`driverConsistencyIssues` each carried a `void _version.value;` line before their return — the
ONLY reactive dependency in their body, since `managedProject.toDriver()` / `.errors()` /
`.consistencyIssues()` touch no Vue `ref`/`reactive` internally (they read private class
fields). That line is what makes Vue re-run on `managedProject.subscribe()` firing (a what-if
scrub, a driver load, etc.) — a bare `computed()` wrapping one of these calls with NO version
read would compute once and cache forever.

**Resolution: converted `driver`, `projectToPersist`, `driverErrors`, `driverConsistencyIssues`
from `computed` VALUES to plain FUNCTIONS** (`driver(): Driver | null`, etc.), same shape
`driverMetaCell(field)` already used. This is the rule's own prescribed fix, not a workaround —
"Call the getter at the point of use" applies exactly as well to a store.ts-level export as to a
component-local one; the `_version` bridge is legitimate infrastructure that belongs in ONE
place (store.ts, which already owns the `_version` ref), and moving from `computed`+`.value` to
`function`+`()` keeps that ONE place while removing the second-name-for-a-value shape. Vue's
reactivity tracking is dynamic-scope, not lexical — a `_version.value` read inside a plain
function still registers as a dependency of whichever computed/render effect calls that function
synchronously, so no caller loses reactivity.

All ~13 call sites updated (`.value` → `()`): `OriginalShell.vue`, `GraphPanel.vue`,
`OgTune.vue`, `useApplicationIO.ts`, `store.ts` internally (`driverWarnings`, `syncedP`, `_doSweep`,
`allIssues`, `driverRecord`), `original-skin.browser.spec.ts`,
`store-issue-channel.test.ts`. One real bug caught by this: `OgTune.vue`'s
`ebpVal = computed(() => (driver() ? ebp(driver()) : null))` called `driver()` TWICE — with the
old `.value` ref this was cheap/safe by construction (same cached value both reads), but two
separate function calls have no such guarantee; fixed to `const d = driver(); return d ? ebp(d)
: null;`.

`projectToPersist()`'s return type is `ReturnType<typeof managedProject.recordToPersist>` rather
than naming `_OpenISDProjectJson` directly — that type has NO `PrivateAllow` list yet (human
decision, not made here), so importing it into `store.ts` would add a new, unauthorized
architecture-gate offense; `ReturnType<...>` gets the same type without the import.

## Verification

- `grep -rn "computed(() => managedProject\." packages/ui/src` — returns only `model` (its `||`
  fallback is real logic, already exempt per the original audit).
- `npx vue-tsc --noEmit -p packages/ui` — no new errors (same 33 pre-existing).
- `npx vitest run packages/ui/test/ui/architecture.test.ts packages/ui/test/logic` — same 5
  pre-existing failures; confirmed no new `_OpenISDProjectJson` offense was added.
- `bash scripts/test-browser.sh packages/ui/test/ui/original-skin.browser.spec.ts
  packages/ui/test/ui/sealed-fsc-winisd-golden.browser.spec.ts
  packages/ui/test/ui/original-loss-mode-selector.browser.spec.ts` — run in progress/reviewed
  before closing this file (see commit message for the actual result).
