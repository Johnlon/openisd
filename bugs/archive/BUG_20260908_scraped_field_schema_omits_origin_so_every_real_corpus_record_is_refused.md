# The scraped-field schema omits `origin`, so every real corpus record is refused

Status: RESOLVED

## Symptom

`OpenISDDriver.fromConformingRecord()` refuses every real `openisd.yml` in the corpus, naming
each metadata field:

```
'manufacturer': Unrecognized key: "origin"; 'brand': Unrecognized key: "origin";
'model': Unrecognized key: "origin"; 'driver_type': Unrecognized key: "origin";
'series': Unrecognized key: "origin"; 'product_image': Unrecognized key: "origin";
'description': Unrecognized key: "origin"; 'provided_by': Unrecognized key: "origin";
'comment': Unrecognized key: "origin"; 'added': Unrecognized key: "origin"
```

Because `scripts/bundleProjection.mjs` decides bundling by asking exactly this seam, EVERY corpus
record is judged unbundlable. The driver bundle the app ships would be empty — a direct violation
of the QO79/QO81 ruling that every structurally readable record bundles.

## Evidence

The corpus record `winisd_drivers/db/datasheets/accuton/bd90-6-727/openisd.yml`:

```yaml
manufacturer:
  value: Accuton
  origin: manufacturer_product_page
```

`packages/design/domain/openisdSchema.ts:327` — the schema for that shape declares no `origin`:

```ts
/** READ off a source. `readings` keeps what each one said. (`ScrapedField`, model_driver.py:155.) */
const scrapedFieldOf = <T extends z.ZodType>(value: T) => z.strictObject({
    value,
    readings: z.record(z.string(), value).optional(),
    dq_scraper: dqMarks(),
    note: z.unknown().optional(),
});
```

The writer of these records, `winisd_tools/scrapers/scrapers/lib/model_driver.py:155`, declares it
REQUIRED:

```python
class ScrapedField(FieldEnvelope, Generic[T]):
    value: T
    origin: SourceRole
    readings: Optional[dict[SourceRole, T]] = None
```

Failing tests: `packages/ui/test/persistence/round-trip-gate.test.ts` (4 of 6) and
`packages/ui/test/persistence/bundle-drivers-disposition.test.ts` (3 of 5).

## Cause

`scrapedFieldOf` was written from `ScrapedField`'s field list with `origin` dropped. The
neighbouring `derivedFieldOf` carries `grounds`, whose entries each hold an `origin`, and the
comment block above both explains that `definition` is deliberately excluded as driver.yml's
alone — so the omission reads as if it had been considered, but `origin` is the one thing that
names WHICH source a scraped value came from, and the schema's own doc comment for the function
says the field is "READ off a source".

`z.strictObject` then refuses the key rather than ignoring it, which is the schema behaving as
designed (`openisdSchema.ts:20` states strictness is deliberate) — the defect is the missing
declaration, not the strictness.

Nothing caught it because the only tests that feed a REAL corpus record through this seam are the
two above, and both were already failing to compile or to import for unrelated migration reasons.

## Fix

`scrapedFieldOf` declares `origin: z.string()`, matching `ScrapedField.origin: SourceRole`. A
plain string rather than an enum of roles: the scraper owns that role list and the schema does not
mirror it anywhere else, so pinning a copy here would be a second source of truth that drifts.

## Verification

`npx vitest run packages/ui/test/persistence/round-trip-gate.test.ts
packages/ui/test/persistence/bundle-drivers-disposition.test.ts` — watched failing with the
`Unrecognized key: "origin"` errors above, then passing.
