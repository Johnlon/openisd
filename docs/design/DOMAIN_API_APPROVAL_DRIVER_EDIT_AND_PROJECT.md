# Approval sheet — the three undecided groups, one row per symbol

For John's ruling. Every row carries the real signature, the measured caller count, and the
specific risk — a name alone is not enough to approve. Companion to
`DOMAIN_API_APPROVAL_LIST.md` (the reading group is already approved there).

---

## GROUP 1 — `OpenISDDriver`, editing

These are how the editor changes a driver. All take a FIELD NAME and a plain value; none takes
or returns a record.

| symbol | signature | prod. callers | what it does | risk |
|---|---|---|---|---|
| `enter` | `enter(field: SpecField, value: number): void` | 4 | writes a hand-entered number, marking it `E` | none — field name + number in, nothing out |
| `clear` | `clear(field: SpecField): void` | 4 | removes a hand-entered value | none |
| `enterMeta` | `enterMeta(field: MetaField, value: string): void` | 5 | writes brand/model/manufacturer/comment etc. | none — `MetaField` is a closed 6-name union |
| `clearMeta` | `clearMeta(field: MetaField): void` | 1 | clears one metadata field | none |
| `get/set autoCalculate` | `boolean` | — | whether derivable fields solve to `C` or stay `N` | none — a boolean switch |
| `static empty` | `static empty(): OpenISDDriver` | — | a new blank driver | none — returns a domain object |

**Recommendation: APPROVE all six.** This is the domain API the editor is supposed to work
against — the alternative to the editor touching the record. Refusing these would leave no
sanctioned way to edit a driver at all.

---

## GROUP 2 — `OpenISDDriver`, the three I propose to make PRIVATE

| symbol | signature | prod. callers | why private |
|---|---|---|---|
| `toWinISDDriver` | `(): Result<WinISDDriver>` | **0** | hands out the WinISD projection OBJECT. Zero production callers — the text route `toWdrText` was the public path and is now `#` anyway. Nothing needs it. |
| `static fromWinISDDriver` | `(wdr: WinISDDriver): OpenISDDriver` | **0** | same, inbound. Zero production callers. |
| `get section` | `(): 'woofer' \| 'tweeter' \| 'passive-radiator'` | 2 | returns which spec SECTION this driver is — a fact about the record's internal layout. Callers wanting the driver TYPE should ask for the driver type. |

**Recommendation: PRIVATE all three.** The first two are free — nothing calls them. `get section`
has 2 callers to migrate.

**`toDriver` — SEPARATE, and I recommend PUBLIC:** `toDriver(): EngineDriver | null`, 3 callers.
It hands the ENGINE its input structure. `EngineDriver` is `@openisd/engine`'s public type, not
a piece of our record, so this exposes nothing internal — it is the model talking to the physics
engine in the engine's own vocabulary. Making it private would leave no way to simulate.

---

## GROUP 3 — `OpenISDProject`'s nine getters — ⚠ THE SERIOUS ONE

`get box(): OpenISDBox { return this.#record.box; }` — and the same shape for `target`,
`environment`, `signal`, `listening`, `simOptions`, `sweep`, `meta`, `filters`.

**They return `#record`'s interior BY REFERENCE.** Not a copy, not a read-only view. Any holder
can write straight into the project's private state with no method call, no validation and no
change notification.

**This is not theoretical — it is how the code already works.** Measured:
- `managedProject.ts` performs **31** mutations through these getters, e.g.
  `this.mutate(p => { p.box.Ql = value; })`, `p.box.passiveRadiator.count = value`.
- `wprMapping.ts:78-112` writes `input.box.Fr`, `input.box.SdRear`, `input.box.Vf`,
  `input.box.npr` and more.

So the `#` on `#record` currently guarantees nothing for the project: nine public doors hand out
writable handles to its interior. This is the same defect as `_driverJsonRecord`/
`_projectJsonRecord` being "private" by underscore only — a privacy that the language does not
enforce and the code routinely walks around.

**Three ways to rule it, with honest costs:**

1. **Keep as-is.** Zero work. But `#record` stays decorative for this class, and the
   deny-by-default rule would be granting exactly what it exists to prevent.
2. **Return deep-frozen or cloned values.** Reads stay public and become safe; all 31+ mutation
   sites break and must move to named methods (`setBoxQl` already exists — most of the managed
   layer's mutators are these one-liners, so many sites become one call). Cost: real, mostly
   mechanical, spread across `managedProject.ts` and `wprMapping.ts`.
3. **Private + named accessors per fact.** The strictest: no sub-structure ever leaves. Largest
   change; also the only one where the `#` means what it says.

**My recommendation: (2).** It closes the hole with a mechanical migration and keeps the read
ergonomics the UI relies on. (3) is the pure answer but is a much larger redesign, and (1) is
not compatible with the rule you have just set.

**The remaining project members** — `setDriver`, `set filters`, `static empty`, `copy`,
`static fromWprText`, `static fromWinISDProject` — are proposed PUBLIC. `fromWprText` and
`fromWinISDProject` fall under the file seam once that lands, so they may become private then.
