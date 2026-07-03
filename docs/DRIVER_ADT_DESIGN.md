# Driver model as an ADT — E/C/N provenance & lossless WDR round-trip

## Why this exists

A WinISD `.wdr` marks every field as **E**ntered (human typed it), **C**alculated
(the app derived it), or **N**ot-available (absent) — that's what the `ParState`
string encodes, and WinISD's own editor shows it as green/blue/black.

Today OpenISD gets this wrong in two ways:

1. **The exporter fabricates provenance.** `toWdr` cannot know which fields the
   human entered, so it guesses (originally a single hardcoded ParState string;
   now a raw-vs-derived heuristic). Both are guesses — neither can see an
   _override_ (typing over a derived field), and both read a loaded file's fields
   as if freshly entered.
2. **`parseWdr` is lossy.** It reads ~11 fields (Fs, the Q-trio, Vas, Sd, Re, Le,
   Xmax, Pe, Znom, Brand, Model) and drops the rest — dimensions, Hc/Hg/fLe/KLe,
   thermal fields, c/roo, **and ParState itself**. So import → export is not
   faithful, and the real provenance is thrown away on load.

The root cause is that `driverRaw` is an **anemic reactive bag** (`state.driverRaw.Fs = …`,
the editor's `entered[key] = val`) poked directly from the store, editor, and
persistence. Provenance (`activeEntered`) lives only inside the editor modal and is
**discarded on apply**.

## The one fact you must store

E/C/N is not three independent flags — two are derivable:

- **N** = the field has no value (visible from the value)
- **C** = the field has a value and was **not** entered (derivable, given the E-set)
- **E** = the human entered it ← **the only fact not recoverable from the values**

`enter('Fs', 37)` and `compute Fs = 37` produce the identical `37`; only a recorded
mark distinguishes them later. So the model **stores the entered-marks** (the one
non-derivable fact) and **derives** C and N from `(values, marks)`. Storing explicit
per-field flags instead would be redundant state that can contradict the values.

## The design: `Driver` is an ADT that owns the invariant

Make `Driver` a proper object whose **only** mutation path is `enter`/`clear`. Then
E/C/N cannot drift out of sync with the values — you physically cannot set a value
without its mark updating, and there is no way to set a mark directly. Drift would
require breaking encapsulation, which callers don't get to do.

```ts
class Driver {
  // ── mutate (the only way to change the model) ──────────────────────────────
  enter(field: string, value: number | string): void; // human supplied → state = E
  clear(field: string): void; // remove human value → C (if derivable) or N

  // ── read ───────────────────────────────────────────────────────────────────
  get(field: string): number | string | undefined; // resolved: E value, else computed C value
  state(field: string): "E" | "C" | "N"; // derived; never settable from outside
  errors(): DriverError[]; // deriveDriver's {value,errors} contract

  // ── round-trip (INI ↔ model) ────────────────────────────────────────────────
  static fromWdr(text: string): Driver; // parse ALL keys incl. ParState → replay marks
  toWdr(): string; // write ALL carried fields + ParState from marks
}
```

- **Stored:** the entered-marks + the carried field values (including pass-through
  fields OpenISD does not simulate, so they survive a round-trip).
- **Derived:** every computed (C) value, and the whole E/C/N view.
- `state(field)` is the single implementation that both the editor (was `stateOf`)
  and the exporter (was `parstate`) call. `ParState` becomes purely the on-disk
  serialization of `state()`.

### `enter` / `clear` semantics

- `enter(field, value)` — store the value, mark the field **E**. Editing a derived
  field (e.g. `Cms`) is an override: it becomes E and the dependent derivations
  either stop recomputing it or reconcile — define per field.
- `clear(field)` — drop the human value and the E mark. The field reverts to **C**
  if the app can still derive it from the remaining E inputs, else **N**. (This is
  exactly WinISD's "clear to revert to calculated".)

## Round-trip rules (the symmetry)

**`Driver.fromWdr(ini)`** — read the **entire** `[Driver]` section, keep every key:

```
for each [Driver] key with a value:
  ParState says E → enter(field, value)      // authoritative input; carried & re-emitted
  ParState says C → skip; let the app compute it (Cms, Bl, η₀, …)
  ParState says N → skip
```

Fields the app cannot recompute (dimensions, Hc/Hg, thermal) are carried as-is —
in practice marked **E** so they persist, since the app has no derivation for them.

**`driver.toWdr()`** — the exact inverse: write every carried field (`get(field)`),
and build `ParState` from `state(field)` at each probe-confirmed position (see
`scraper_lib._parstate` for the position map — positions like Qts=14, c=47, roo=48).

Import → export is lossless by construction, and provenance survives: ParState in
via `enter`, ParState out via `state()`.

## Migration from the reactive bag

This replaces `DriverRaw`-as-plain-object with a `Driver` object. The work is at the
call sites, not the concept:

- **Store:** hold a `Driver` instance; every `state.driverRaw.X = v` becomes
  `driver.enter('X', v)`; clearing a field becomes `driver.clear('X')`.
- **Editor (`DriverDefineModal`):** `activeEntered`/`stateOf`/`entered[key]=val` all
  collapse into `driver.enter/clear` + `driver.state()`. The modal stops owning
  provenance — it just drives the Driver.
- **Engine:** `deriveDriver` becomes the Driver's internal derivation; `parstate`
  becomes `state()`; `parseWdr`/`toWdr` become `fromWdr`/`toWdr`.
- **Persistence / URL / project JSON:** serialize the entered-marks alongside the
  values (or reconstruct them from the embedded ParState) so provenance round-trips
  through localStorage, the share link, and saved projects too — not just WDR files.

### Two things to decide before building

1. **Vue reactivity over a class.** Vue 3 reactivity works with class instances, but
   it's a different pattern than the current `reactive({...})` plain object. Decide:
   a reactive class instance, or keep a reactive plain-data core (values + marks)
   with the `enter/clear/state` API as free functions over it. The latter is closer
   to today's code and lower-risk; the former is cleaner encapsulation.
2. **Override reconciliation.** When a user overrides a normally-derived field (Cms,
   Bl, SPL, c, roo), specify per field whether dependent values recompute around the
   override or the override is treated as a fixed input. WinISD treats an override as
   E and leaves it; match that unless there's a reason not to.

## What this kills

- The hardcoded ParState string, the presence-based guess, and the raw-vs-derived
  interim heuristic — all obsolete.
- `stateOf` (editor) and `parstate` (engine) as separate implementations — one
  `state()`.
- The lossy `parseWdr` — replaced by a full-fidelity `fromWdr`.
- The class of "provenance is wrong after edit/reload/export" bugs — structurally
  impossible once E/C/N is only ever a consequence of `enter`/`clear`.
