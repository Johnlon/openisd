# `_Specs`' passive-radiator key was spelled with an underscore while the driver_type vocabulary and the real data corpus use a hyphen

Status: FIXED — John changed `_Specs`' key from `passive_radiator` to `'passive-radiator'` at
`packages/model/src/openisdDriver.ts:237`. `npm run typecheck:model` now exits 0.

## Symptom (as found)

    $ npm run typecheck:model
    packages/model/src/openisdDriver.ts(535,62): error TS2322: Type '"woofer" | "tweeter" | "passive-radiator"' is not assignable to type '"woofer" | "tweeter" | "passive_radiator"'.
      Type '"passive-radiator"' is not assignable to type '"woofer" | "tweeter" | "passive_radiator"'. Did you mean '"passive_radiator"'?
    packages/model/src/openisdDriver.ts(539,34): error TS2551: Property 'passive-radiator' does not exist on type '_Specs'. Did you mean 'passive_radiator'?
    packages/model/src/openisdDriver.ts(540,24): error TS2551: Property 'passive-radiator' does not exist on type '_Specs'. Did you mean 'passive_radiator'?

## Evidence

`_Specs` declared its passive-radiator key with an UNDERSCORE — `packages/model/src/openisdDriver.ts:237` (before the fix):

    export interface _Specs {
      woofer?: _SpecSection;
      tweeter?: _SpecSection;
      passive_radiator?: _SpecSection;      // underscore — the outlier
    }

`sectionFor` (`openisdDriver.ts:277-280`, before the fix) used a HYPHEN, and its return value
was stored as `#section` and used to index `_Specs` directly:

    function sectionFor(record: _OpenISDDriverJson): 'woofer' | 'tweeter' | 'passive-radiator' {
      const t = record.driver_type?.value;
      if (t === 'amt') return 'tweeter';
      return t === 'tweeter' || t === 'passive-radiator' ? t : 'woofer';
    }
    ...
    const s = this.#record.specs[this.#section] ?? {};   // openisdDriver.ts:539

The real data corpus settles which spelling is correct. `packages/ui/src/drivers-bundle.json`
(built from actual `openisd.yml` records) carries, for every record that has one:

    "driver_type":{"value":"passive-radiator", ...}
    "specs":{"passive-radiator": ...}

— hyphen, in both the driver_type value AND the specs key, for every record in the corpus.
The underscore in `_Specs`' declaration was the wrong spelling; it never matched the data
`sectionFor` was built against, which is why the compiler had nothing to say about it until
this file's four call sites were all forced to agree.

## Cause

The union `'woofer' | 'tweeter' | 'passive-radiator'` (or `passive_radiator`) is written
inline at four separate sites in this file — `_Specs` (:233), `sectionFor`'s return (:277),
`#section`'s declared type (:287), and the `section` getter (:535) — instead of being declared
once and reused. Each inline copy independently agreed with the corpus except `_Specs`, whose
underscore was simply a typo against real data that nothing caught until the other three sites
were compared against it by the type checker.

## Fix applied

`_Specs`' key changed from `passive_radiator` to `'passive-radiator'`
(`packages/model/src/openisdDriver.ts:237`), matching the corpus and the other three sites.
`npm run typecheck:model` now exits 0 (verified).

## Residual — not fixed, and not planned

The four sites are still four independent inline unions, not one named, reused type. Nothing
stops the next edit from reintroducing a mismatch the same way this one happened — the
compiler will only catch it again if the divergent copy also causes a real type error, which
is exactly what didn't happen here for two of the three members (`woofer`/`tweeter` never
diverged, only the passive-radiator spelling did). John declined the dedup (2026-08-23) —
leaving the four inline copies as they are.

## Verification

- `npm run typecheck:model` exits 0 — confirmed after the fix.
- No `passive_radiator` (underscore) spelling of the field/type remains anywhere in
  `packages/` — the only underscore hits left in the tree are a manufacturer image-hosting
  URL path and unrelated filename citations (`view_3_passive_radiator.png`,
  `BUG_20260817_wpr_passive_radiator_vas...`), confirmed by grep across the repo.
