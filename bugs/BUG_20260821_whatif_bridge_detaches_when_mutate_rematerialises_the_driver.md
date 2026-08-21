Status: RESOLVED

# A what-if's driver-notify bridge detaches after any box/vent/PR edit — driver scrubs go silent

## Symptom

Inside a live what-if, a driver-field edit (`enter`/`clear`/`enterMeta`/`clearMeta`) notifies
subscribers only until the FIRST box/vent/PR field is scrubbed (`mutate()`). After that, every
further driver-field edit in the same what-if produces ZERO notifications — the chart stops
updating for driver scrubs, though it keeps updating for box/vent/PR scrubs.

## Evidence

Probe against `ManagedOpenISDProject` directly (a project with a driver, `Qts`/`Fs` stated):

```ts
const mp = ManagedOpenISDProject.fromProject(p);
mp.beginWhatIf();
let n = 0;
mp.subscribe(() => { n++; });
mp.enter('Qts', 0.36);      // driver scrub
console.log(n);             // 1 — correct
mp.setBoxVolume_m3(0.05);   // box scrub
console.log(n);             // 2 — correct
mp.enter('Fs', 41);         // driver scrub, AFTER a box scrub
console.log(n);             // 2 — LOST. Expected 3.
```

Output, run in `packages/ui`'s vitest `node` environment:

```
after enter#1, n= 1
after setBoxVolume, n= 2
after enter#2 (post-rematerialise), n= 2
```

## Cause

`packages/ui/src/logic/managedProject.ts`:

- `#openWhatIfOver()` (:411-417) subscribes to the overlay layer's `OpenISDDriver` INSTANCE at
  the moment the what-if opens: `layer.openIsdDriver?.subscribe(() => this.#notify())`. That
  subscription is stored in a JS closure over that one object; nothing re-subscribes it later.
- `mutate()` (:359-366) — called by every box/vent/PR setter — REPLACES
  `layer.openIsdDriver` with a brand-new `OpenISDDriver` instance every time it runs, regardless
  of whether the driver record actually changed: `layer.openIsdDriver = layer.project.driver ?
  OpenISDDriver.fromJsonRecord(layer.project.driver) : null;` (:364). This re-materialisation
  runs even for a pure box/vent/PR edit that never touches `project.driver`.
- After that reassignment, `#effective().openIsdDriver` (what `enter`/`clear`/`enterMeta`/
  `clearMeta` call into) is the NEW instance. The bridge's subscription is still attached to the
  OLD, now-orphaned instance. The new instance has no subscriber at all, so its own internal
  `#notify()` (openisdDriver.ts) reaches nobody, and the explicit `if (this.#overlay?.kind !==
  'whatif') this.#notify();` guard in `enter`/`clear`/`enterMeta`/`clearMeta`
  (`BUG_20260821_managedproject_enter_clear_never_reach_notify.md`'s fix) deliberately skips
  during a what-if, relying on exactly this now-broken bridge.

## User-visible effect

In the Tune panel's what-if mode: scrub a box/vent/PR field once, then scrub any driver field
(Fs, Qts, Vas, ...) — the chart does not update for that scrub or any subsequent driver scrub in
the same what-if session. Cancelling and re-beginning the what-if restores live updates until the
next box/vent/PR scrub repeats the detach.

## Fix

Human ruling (`docs/design/REACTIVITY.md:104-107`): every public mutator notifies
UNCONDITIONALLY. `packages/ui/src/logic/managedProject.ts`:

- `mutate()` now calls `this.#notify()` on every call, no mode guard.
- `enter`/`clear`/`enterMeta`/`clearMeta` now call `this.#notify()` on every call, no mode guard.
- The driver-notify bridge is DELETED: `#openWhatIfOver()` no longer subscribes to the overlay's
  `OpenISDDriver` at all — `Overlay` no longer carries an `unsubscribe` field, and
  `#endWhatIfIfActive()`/`load()` no longer call one. Nothing outside this class ever holds the
  managed `OpenISDDriver` instance (`packages/ui/src` grepped for `openIsdDriver`/`OpenISDDriver`
  usage outside `managedProject.ts`: every other site constructs its OWN separate instance), so
  removing the bridge does not strand an external subscriber.

With the bridge gone, `enter()`'s own unconditional `this.#notify()` is the sole notification
source for a driver-field edit in every mode — it cannot go stale when `mutate()` re-materialises
`openIsdDriver`, because nothing is subscribed to that instance to begin with.

`loadDriverRecord()` lost its own explicit `if (this.#overlay?.kind !== 'whatif') this.#notify();`
— with `mutate()` now unconditional, that second call would have double-fired on committed state.

## Verification

`packages/ui/test/logic/managedProject.test.ts` — `'a driver scrub after a box scrub in the SAME
what-if still notifies'` — begins a what-if, scrubs a driver field (n=1), scrubs `Vb` via
`setBoxVolume_m3` which re-materialises `openIsdDriver` (n=2), then scrubs a driver field again
and asserts n=3. Green. Also covered: `'setBoxVolume_m3 ... notifies exactly once on COMMITTED
state'`, `'setBoxVolume_m3 notifies exactly once during a live what-if'`, and the pre-existing
`'a what-if with N scrubs produces N+2'` — all green, `npx vue-tsc -p packages/ui --noEmit`
clean.
