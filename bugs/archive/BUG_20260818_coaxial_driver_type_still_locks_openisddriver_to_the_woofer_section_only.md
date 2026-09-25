# A coaxial driver's tweeter T/S section is permanently unreachable through `OpenISDDriver`

# Status
WONTFIX — human ruling 2026-08-21 (ledger QO65, verbatim): "we dont have a intention atm ot
modelling the tweeter - miggh change in future but that is a proper backlog item"; the
accessors not reaching the tweeter is acked as fine. Future tweeter support (e.g. showing
tweeter specs in the driver-info popup) is a backlog item, not a defect. The REAL defect found
in the same code — the PR discriminator's two spellings — is
bugs/BUG_20260821_passive_radiator_discriminator_has_two_spellings_across_the_stack.md.

## Symptom

`driverType.ts` declares a real `coaxial` `DriverType` (woofer + tweeter sharing one axis), and
the record's own spec container (`_Specs`, `openisdRecord.ts`) already supports a driver holding
BOTH a `woofer` section and a `tweeter` section at once. But `OpenISDDriver` picks exactly ONE
section at construction, fixed for the object's lifetime, and every field read/write goes through
that single section. For a `driver_type: 'coaxial'` record, the section resolver has no
`'coaxial'` case, so it silently falls through to `'woofer'` — the tweeter section of a coax
driver's own record is never read, never written, and never visible through `cell()`/`enter()`/
`clear()`, even though the data slot for it exists right next to the woofer one.

## Evidence

`packages/model/src/openisdDriver.ts:136-141`:
```ts
function sectionFor(record: _OpenISDDriverJson): 'woofer' | 'tweeter' | 'passive-radiator' {
  const t = record.driver_type?.value;
  if (t === 'tweeter') return 'tweeter';
  if (t === 'passive-radiator' || t === 'passive-radiator') return 'passive-radiator';
  return 'woofer';   // <- 'coaxial' (and anything else unrecognised) lands here
}
```
`packages/model/src/openisdDriver.ts:181,198`: `#section` is set once in the constructor from
`sectionFor(record)` and never revisited.

`packages/model/src/openisdDriver.ts:250-251`, the ONE place every field access goes through:
```ts
const s = this.#record.specs[this.#section] ?? {};
this.#record.specs[this.#section] = s;
```

`packages/model/src/openisdRecord.ts` — `_Specs` (the record's own container) already has room
for both sections simultaneously:
```ts
export interface _Specs {
  woofer?: SpecSection;
  tweeter?: SpecSection;
  passive_radiator?: SpecSection;
}
```

`packages/ui/src/driverType.ts:78` — `coaxial` is a real, distinct `DriverType`, not a synonym
for `woofer`:
```ts
static readonly Coaxial = new DriverType('coaxial', 'Coaxial', [Chip.Coax, Chip.Woofer, Chip.Bass, Chip.Mid, Chip.Tweet]);
```

## Cause

`sectionFor()` was written enumerating the sections `OpenISDDriver` was built to expose
one-at-a-time (`'woofer' | 'tweeter' | 'passive-radiator'`), matching a driver that has exactly
one spec section. `coaxial` was added to `DriverType`'s vocabulary (UI-facing enum) without a
corresponding case in the model's section resolver, so it was never given a legal outcome —
it silently defaults to the same branch as every other unrecognised `driver_type` value.

## Fix (not applied — reported per bug-first rule, not yet decided)

Not fixed here. `OpenISDDriver`'s single-`#section` design is a structural mismatch for a
driver_type that legitimately has two live sections — this is not a one-line branch add (adding
`if (t === 'coaxial') return 'woofer'` explicitly would silence the symptom without giving the
tweeter section a way to be read/written; the class's whole field-access surface — `cell()`,
`enter()`, `clear()`, `metaCell()`, `specs()` — assumes one section). Needs a design decision on
whether `OpenISDDriver` gains a second, explicit tweeter-section accessor path for coax, or
whether coax is out of scope for `OpenISDDriver` entirely until a real design is made.

## Human ruling (2026-08-21)

"Coax out of scope atm but add this as an open item in openisd and mark it as human deferred
until big refactoring complete." Recorded as QO62 in questions.yml. Revisit after the
WinISDDriver-construction/QO55/QO60-SERVICE-layer refactoring work lands, not before.

## Verification

Not yet — no fix applied.

## Ruling (human, 2026-08-21, QO65 — reconfirmed under the new id)

Not actually a bug: "we dont have a intention atm ot modelling the tweeter - miggh change in
future but that is a proper backlog item." OpenISD is primarily a sub-box tool; the tweeter
info would be potentially useful in the driver info popup but is not critical. The human acks
that the accessor methods do not provide access to the tweeter — "that sok". Future tweeter
support is a backlog item, not a defect. (A prior defer note here cited QO62, an id since
reassigned to the encoding ruling — QO65 is the governing entry.)
