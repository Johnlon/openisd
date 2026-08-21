Status: OPEN

# A metadata override becomes permanently unclearable after any unrelated box/vent/PR edit

## Symptom

Override a driver metadata field (`enterMeta`, e.g. `manufacturer`), then make ANY unrelated
box/vent/PR edit (e.g. scrub `Vb`), then try to clear the override (`clearMeta`) — it silently
no-ops. The overridden value is stuck; nothing in the UI can remove it short of reloading the
project.

## Evidence

Probe against `ManagedOpenISDProject` directly (a project with a driver whose `manufacturer` is
`'Acme'`, `manufacturer_datasheet` origin):

```ts
const mp = ManagedOpenISDProject.fromProject(p);
mp.enterMeta('manufacturer', 'Overridden Co');
console.log(mp.metaCell('manufacturer').value);   // 'Overridden Co' — correct
mp.setBoxVolume_m3(0.05);                          // unrelated box edit
mp.clearMeta('manufacturer');
console.log(mp.metaCell('manufacturer').value);   // still 'Overridden Co' — should be 'Acme'
```

Output, run in `packages/ui`'s vitest `node` environment:

```
after enterMeta, manufacturer= Overridden Co
after clearMeta (post-rematerialise), manufacturer= Overridden Co
```

## Cause

`packages/model/src/openisdDriver.ts:293`: `#displacedMeta` — the map `clearMeta()` reads to
know what value/origin to restore — is declared `readonly` and populated per-INSTANCE:

```ts
readonly #displacedMeta = new Map<MetaField, { value: string; origin: SourceRole }>();
```

`enterMeta()` (openisdDriver.ts:705-717) records the pre-override `{value, origin}` into this
map on the CURRENT `OpenISDDriver` instance. `clearMeta()` (:721-730) reads it back, and returns
early — doing nothing, notifying nothing — if the map has no entry for the field.

`packages/ui/src/logic/managedProject.ts`'s `mutate()` (:359-366), invoked by every box/vent/PR
setter, unconditionally replaces `layer.openIsdDriver` with a FRESH `OpenISDDriver.fromJsonRecord(...)`
instance on every call — even when the edit has nothing to do with the driver. The fresh
instance's `#displacedMeta` starts empty; the override survives (it was written into the record
itself, `f.origin = 'manual'`), but the fact that it WAS an override — and what to restore — is
gone. `clearMeta()` on the new instance finds nothing displaced and no-ops forever, for that
field, until the project reloads.

This is the same re-materialisation mechanism as
`BUG_20260821_whatif_bridge_detaches_when_mutate_rematerialises_the_driver.md`, hitting a second
piece of per-instance `OpenISDDriver` state.

## Note on the notify guard

With `enter`/`clear`/`enterMeta`/`clearMeta` notifying unconditionally (this session's ruled fix
for `BUG_20260821_managedproject_enter_clear_never_reach_notify.md`), a no-op `clearMeta()` call
STILL notifies — a spurious re-render with no actual state change, on top of the value staying
stuck. Both effects trace to the same root cause below.

## Fix

RECORD ONLY. Not fixed as part of task A2 — explicitly out of scope per the ruling that produced
this record. A fix needs the displaced-meta map (or the `manual`-override fact it encodes) to
survive `mutate()`'s driver re-materialisation, which likely means `mutate()` should only
re-materialise the driver when `project.driver` actually changed (identity or content), rather
than unconditionally on every call — a call this session did not make.

## Verification

Reproduced via the probe above. No regression test added — recorded only, per instruction.
