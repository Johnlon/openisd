# Local `computed`/`const` aliases wrap a single domain-object read with a second name, across the UI layer

# Status
PARTIALLY FIXED 2026-08-18 — all single-use-site instances fixed (`ventArea`, `boxResonance`'s
`prFh` leg, `brand`, `portPipeResonance`, `prVas`, `prFs`, `prFsMass`, `prQms` in
`OriginalShell.vue`; `fixes`, `faults` in `DiagnosticsModal.vue`). The 3 `store.ts` multi-use
aliases (`driver`, `driverErrors`, `driverConsistencyIssues`) and `projectToPersist` are
DELIBERATELY NOT fixed — see "Why the store.ts aliases stay" below.

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
| 400-403 | `export const driver = computed<Driver \| null>(() => { void _version.value; return managedProject.toDriver(); });` | `managedProject.toDriver()` | many: `App.vue`, `OgTune.vue`, `OriginalShell.vue`, `useDesignIO.ts`, `GraphPanel.vue`, `driverFigures.ts`, others |
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

## Why the store.ts aliases stay (`driver`, `driverErrors`, `driverConsistencyIssues`,
`projectToPersist`)

`managedProject` IS already exported from `store.ts` (line 99), so the "does store.ts re-export
it" question above is answered: yes. But inlining these 4 is NOT the same shape as the
single-use-site fixes above, for a reason the earlier draft of this bug missed: `driver` /
`driverErrors` / `driverConsistencyIssues` each carry a `void _version.value;` line before their
return — the ONLY reactive dependency in their body, since `managedProject.toDriver()` /
`.errors()` / `.consistencyIssues()` touch no Vue `ref`/`reactive` internally (they read private
class fields). That line is what makes Vue re-run the computed when `managedProject.subscribe()`
fires (a what-if scrub, a driver load, etc.) — without it, a `computed()` wrapping one of these
calls would compute ONCE and cache forever, going stale on every subsequent project change.

Inlining a *single-use-site* alias into a template expression is safe regardless (a template
re-evaluates on every re-render triggered by anything else reactive on the page — proven
harmless here by `sealed-fsc-winisd-golden.browser.spec.ts`/`original-loss-mode-selector.browser
.spec.ts` staying green after doing exactly that for `ventArea`/`boxResonance`/`prVas` etc.,
which have the same "no tracked ref" shape). But `driverWarnings` (`store.ts`) and several
importing files build their OWN further `computed()` on top of `driverErrors`/`driver` — moving
the raw call into THOSE computeds without also copying the `_version` bridge into each one would
silently reintroduce staleness in files that never knew they depended on it. That is a real
correctness risk, not a style preference, and needs its own pass (verify every consuming
computed either doesn't need live updates or gets its own `_version` read) rather than a blind
grep-and-inline. Left open.

## Verification

- `grep -rn "computed(() => managedProject\." packages/ui/src` — now returns only the 4 `store.ts`
  rows left open above (confirmed: `driver`, `projectToPersist`, `driverErrors`,
  `driverConsistencyIssues`).
- `npx vue-tsc --noEmit -p packages/ui` — no new errors (same 33 pre-existing).
- `npx vitest run packages/ui/test/ui/architecture.test.ts packages/ui/test/logic` — same 5
  pre-existing failures.
- `bash scripts/test-browser.sh packages/ui/test/ui/sealed-fsc-winisd-golden.browser.spec.ts
  packages/ui/test/ui/original-loss-mode-selector.browser.spec.ts` — both green (see run output;
  these exercise `rearResonance`/`rearQtc`/`boxResonance` and the loss-mode selector directly).
