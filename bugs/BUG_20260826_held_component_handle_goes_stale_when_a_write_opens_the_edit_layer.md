# A held component handle goes stale the moment a write opens the edit layer

**Where:** `packages/design/domain/project.ts` — `ManagedProject.driver` (getter, ~line 1220),
`writeProjectRecord()` / `editLayerFor()` (~lines 1066–1089).

**Status:** FIXED 2026-08-26. Found by `packages/design/test/domain.test.ts` → "the driver — a
window, not a copy > reads and writes through to the record it was given" (1 failing, 22 passing);
now 24/24 with a second test covering the what-if transition.

## Symptom

A write through a driver handle does not read back through that same handle.

```
const driver = newProject(...).sealed().volume_m3(0.03).build().driver;
driver.Fs_hz.get().value   // 30
driver.Fs_hz.set(35);
driver.Fs_hz.get().value   // 30  — expected 35
```

Failure output: `AssertionError: expected 30 to be 35`.

## Cause — the mechanism, not a guess

`ManagedProject.driver` is a GETTER: `get driver() { return this.#effective().driver; }`. It
returns the `OpenISDDriverEmbedded` belonging to whichever layer is effective AT THE MOMENT OF
THE CALL. Each layer is a separate `OpenISDProject` instance with its own record entry in the
`projectRecords` WeakMap, so each layer's driver is a distinct object bound to that layer.

At the moment the test reads `.driver`, no overlay is open, so the effective layer is
`#committed` and the handle is committed's driver.

`Fs_hz.set(35)` then reaches `writeProjectRecord()`, which calls `editLayerFor()`. That sees a
write aimed at the committed layer of a managed project with no transient layer open, so it
opens an edit layer and lands the write THERE — `projectRecords.set(redirect, json)`. This
redirect is deliberate and is the feature that makes editing a field in a tab start an edit
session with no component having to call `beginEdit()`.

The consequence is that after the write the effective layer is `#edit`, a DIFFERENT
`OpenISDProject` with a DIFFERENT driver object. The handle the caller is still holding belongs
to `#committed`, whose record was never touched — so it correctly reports the old value.

The test is right and the code is wrong: a handle obtained from the public API must not be
invalidated by a write made through that same handle.

## Why this matters beyond the test

This is the normal shape of UI code, not an artificial case. A component that does
`const d = project.driver` once — in `setup()`, in a `computed`, as a prop — and then binds
fields off `d` will show stale values from the first edit onwards, because that first edit is
exactly what opens the edit layer. The write appears to be lost.

## Fix — applied

Components no longer bind a project instance; they resolve one on every access. A new
`ProjectRef = () => OpenISDProject` is what `projectSlot()`, `OpenISDBox.wrap()` and
`OpenISDDriverEmbedded.wrap()` now take.

- `OpenISDProject` passes `() => this` — a plain project is one layer, so it never varies. The
  indirection exists for its caller.
- `ManagedProject` builds ONE driver and ONE box in its constructor over
  `() => this.#effective()`, held in `#driver`/`#box`, and its `driver`/`box` getters return
  those rather than the effective layer's own components.
- `OpenISDDriverEmbedded.project` became a getter returning `this.#project()`, so a component
  reaching a sibling gets the layer that is effective NOW.

The rejected alternative was re-pointing each layer's components when a layer opens: it makes
every handle mutable and still leaves a window between the write and the re-point.

The fix is what the design's own doctrine already required — the app holds `ManagedProject`,
never a layer, so nothing it hands out should be a layer's object. Stable component identity is
separately what lets a UI framework memoize on object identity, the same reasoning that made
every `Field` eagerly constructed rather than rebuilt per getter call.

## Verification

`packages/design/test/domain.test.ts` passes 24/24. The originally failing test is unchanged —
it already encoded the correct contract. Added: "the handle a caller holds survives every layer
transition", which binds the handle once and then reads it across a write-opened edit layer, a
`commit()`, a `beginWhatif()` write, and a `cancelTransient()`.
