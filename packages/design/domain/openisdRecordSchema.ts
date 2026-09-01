/**
 * THE openisd RECORD, DECLARED ONCE, AS A SCHEMA — the ONLY description of what an openisd record
 * is, and the only thing that decides whether an untrusted value is one.
 *
 * ITS OWN FILE because it is a different kind of thing from the domain objects in `project.ts`:
 * those are behaviour over a record that has already been checked, this is the check itself, and
 * the boundary between "untrusted value" and "record" is exactly the line the two sit either side
 * of. It also keeps the record's SHAPE readable in one screenful, which it was not when buried in
 * the middle of 2900 lines of domain code.
 *
 * PRIVATE TO THE DOMAIN. `domain/index.ts` does not re-export it: a caller that wants to know
 * whether a value is a record asks `driverFromConformingRecord` or `driverYmlToOpenIsdRecord`,
 * which answer in the caller's own vocabulary. Publishing the schema would publish the record
 * shape, which is the thing this package exists to keep private.
 *
 * STRICT THROUGHOUT (`z.strictObject`). An undeclared key is REFUSED at its own path rather than
 * quietly dropped, so a record that gains a field the app does not model is a loud failure instead
 * of a silent loss.
 */
import { z } from 'zod';

/** DQ marks. A function, not a shared object: a module-scoped literal would be state, and each
 *  schema gets its own. */
const dqMarks = () => z.strictObject({
    kind: z.string(), severity: z.string(), rule: z.string(), detail: z.string(),
    params: z.record(z.string(), z.unknown()),
}).array().optional();

/** One source's reading of one parameter. `read_value` is the number; the rest annotate it. */
const readingJsonSchema = z.strictObject({
    // `_KEY_PRIORITY_LIST` (`model_driver.py:1509`) is the canonical key order — the emitter's
    // own, applied by `canonical_yaml`. Not the pydantic class's field order, which differs.
    // What the source PRINTED comes first, then any repair of it, then the numbers parsed out,
    // then whether the read was refused, then the measurement condition.
    actual_reading: z.string().optional(),
    // A printed literal the scraper had to REPAIR to parse, and the rule that repaired it —
    // `conformed_reading: 3.5 Ω` beside `conformed_by: unit-glyph-unreadable`. Placed here, next
    // to the literal they qualify, so "this is not what the page printed" is read in one glance.
    conformed_reading: z.string().optional(),
    conformed_by: z.string().optional(),
    read_value: z.number(),
    read_precision: z.number().optional(),
    // Why this source's reading was thrown out, e.g. `ohm-glyph-merged-as-digit` — immediately
    // after the numbers it disqualifies, so a refused read cannot be skim-read as a usable one.
    rejected: z.string().optional(),
    // THE MEASUREMENT CONDITION, on a closed vocabulary (`record_registries.MeasurementNote`).
    // It qualifies THAT source's number: a sensitivity taken at 2.83 V/1 m is 3 dB louder than
    // the same driver at 1 W/1 m on 4 ohms (`model_driver.py`).
    note: z.string().optional(),
});
/** A spec field: which source won, and every source's reading. It states no value of its own.
 *  `readings` carries AT LEAST ONE — `SpecEntry.readings` is `Field(min_length=1)`, because an
 *  entry naming a winning origin with nothing under it is a field with no value.
 *  `dq_scraper` and `dq_calculated` are split BY PRODUCER: a scraper finds structural, parse and
 *  source problems; only the calculation finds T/S parameters that disagree with each other. */
const specEntryJsonSchema = z.strictObject({
    // `_KEY_PRIORITY_LIST` order (`model_driver.py:1509`) — see the note on the record schema below.
    origin: z.string(),
    readings: z.record(z.string(), readingJsonSchema).refine(
        r => Object.keys(r).length > 0, 'expected at least one reading'),
    corroboration: z.string().optional(),
    dq_scraper: dqMarks(),
    dq_calculated: dqMarks(),
});

// ── THE THREE FIELD ENVELOPES ─────────────────────────────────────────────────────────────────
//
// A record never stores a bare value: it stores the value with the provenance that answers where
// it came from. THREE different answers, so three envelopes (`model_driver.py`, `FieldEnvelope`
// and its subclasses).
//
// `definition` — what a field MEANS — is on all three in the scraper and appears on NONE of them
// here. It is driver.yml's, and never reaches an openisd.yml or a .wdr (John, 2026-09-01). A
// consumer of this record already knows what `Fs` is.

/** READ off a source. `origin` names which source won; `readings` keeps what each one said.
 *  (`ScrapedField`, model_driver.py:155.) */
const scrapedFieldOf = <T extends z.ZodTypeAny>(value: T) => z.strictObject({
    value,
    origin: z.string(),
    readings: z.record(z.string(), value).optional(),
    dq_scraper: dqMarks(),
    note: z.unknown().optional(),
});

/** COMPUTED from other fields. No origin — nothing was read — but `grounds` carries the evidence,
 *  and there is always at least one. (`DerivedField`, model_driver.py:193.) */
const derivedFieldOf = <T extends z.ZodTypeAny>(value: T) => z.strictObject({
    value,
    grounds: z.strictObject({
        origin: z.string(), reading: z.string(),
    }).array().min(1),
});

/** A fact about the RECORD, not about the driver — a uuid, where its sources were. Nothing was
 *  read and nothing was derived, so neither origin nor grounds. (`BookkeepingField`,
 *  model_driver.py:202.) */
const bookkeepingFieldOf = <T extends z.ZodTypeAny>(value: T) => z.strictObject({
    value,
});

const textField = scrapedFieldOf(z.string());


// ── THE SPEC SECTIONS, BY NAME ────────────────────────────────────────────────────────────────
//
// Named sections and named fields, not `record(string, record(string, …))`. `SpecSection` in the
// scraper forbids extra keys and its field set is asserted against the registry, so a section
// carrying a field nobody declared is a record the pipeline could not have written. A loose
// record accepts it and the app then reads a field no code knows about.
//
// A FUNCTION, not a shared object: a module-scoped literal would be state, and each schema gets
// its own (`test/architecture-no-globals.test.ts`).
const driverSpecsSectionJsonSchema = (e: typeof specEntryJsonSchema) => z.strictObject({
    Fs: e, Re: e, Le: e, fLe: e, KLe: e, Znom: e,
    Qts: e, Qes: e, Qms: e, Vas: e, Sd: e, BL: e,
    Mms: e, Cms: e, Rms: e, Xmax: e, Xlim: e, SPL: e,
    Pe: e, Dd: e, EBP: e, numVC: e, VCCon: e, Dia: e,
    Vd: e, no: e, SPLmax: e, SPLmaxLF: e, USPL: e, alfaVC: e,
    Rt: e, Ct: e, gamma: e, Rme: e, Mpow: e, Mcost: e,
    Gloss: e, c: e, roo: e, Vcd: e, Hg: e, Hc: e,
    freq_low_hz: e, freq_high_hz: e, power_peak_W: e, weight_kg: e, Thick: e, Depth: e,
    MagDepth: e, Magnet: e, Basket: e, Outer: e, OuterX: e, OuterY: e,
    DVol: e,
}).partial();

/** A radiator has no motor and no voice coil, so `Re`, `Le`, `Znom`, `Qes`, `BL`, `numVC` and the
 *  thermal parameters describe nothing on one — a DIFFERENT schema, not a narrowed driver's. */
const passiveRadiatorSpecsSectionJsonSchema = (e: typeof specEntryJsonSchema) => z.strictObject({
    Fs: e, Qms: e, Cms: e, Mms: e, Rms: e, Sd: e,
    Vas: e, Vd: e, Xmax: e, Xlim: e, Dia: e, Dd: e,
    DVol: e, Thick: e, Depth: e, Basket: e, Outer: e, OuterX: e,
    OuterY: e, weight_kg: e,
}).partial();

const specsJsonSchema = z.strictObject({
    woofer: driverSpecsSectionJsonSchema(specEntryJsonSchema).optional(),
    tweeter: driverSpecsSectionJsonSchema(specEntryJsonSchema).optional(),
    'passive-radiator': passiveRadiatorSpecsSectionJsonSchema(specEntryJsonSchema).optional(),
});

export const openISDDeviceJsonSchema = z.strictObject({
    // THE ORDER IS THE RECORD'S OWN, and changing it changes every file we write. These members
    // are declared in
    // `_KEY_PRIORITY_LIST` order (`model_driver.py:1509`), which is the order `canonical_yaml` writes
    // and therefore the order every driver.yml on disk states its keys in (John, 2026-09-01: "I
    // asked for the order to be the constant order that driver.yml emits").
    //
    // It matters because `safeParse` returns an object built key by key IN DECLARATION ORDER, and
    // that object is what the domain then holds and re-serialises. Declared in any other order,
    // every record would come back reordered and every regenerated openisd.yml would diff against
    // its predecessor for no reason at all.
    //
    // Which ENVELOPE each field gets is not a style choice either — it is what `OpenIsdYmlFile`
    // declares, and it says how the value came to be there: read from a document (scraped),
    // computed from other fields (derived), or a fact about the record itself (bookkeeping).
    uuid: bookkeepingFieldOf(z.string()),
    quality: z.strictObject({
        issue: z.string().optional(),
        confirmed_fields: z.string().array(),
        fields_with_issues: z.string().array(),
        missing: z.string().array(),
        invalid: z.string().array(),
        parse_errors: z.string().array(),
        cross_source_only: z.unknown().array(),
    }),
    manufacturer: textField,
    brand: textField,
    model: textField,
    sku: derivedFieldOf(z.string()),
    driver_type: textField,
    series: textField.optional(),
    nominal_size_cm: scrapedFieldOf(z.number()).optional(),
    data_sources: bookkeepingFieldOf(z.strictObject({
        manufacturer_datasheet: z.string().optional(),
        manufacturer_product_page: z.string().optional(),
        manufacturer_listing_page: z.string().optional(),
    })),
    authoritative: bookkeepingFieldOf(z.string()),
    product_image: textField.optional(),
    description: textField.optional(),
    surround_material: textField.optional(),
    provided_by: textField.optional(),
    comment: textField.optional(),
    added: textField.optional(),
    specs: specsJsonSchema,
    // A curve is a `CurveEntry` — value and origin — and its payload names where the
    // data is. `local_path` is absent when the datasheet only PLOTS the curve and nothing
    // extracted the numbers (`CurvePayload`, model_driver.py:1079).
    curves: z.record(z.string(), z.strictObject({
        value: z.strictObject({
            type: z.string(),
            data_format: z.string().optional(),
            local_path: z.string().optional(),
            extracted_data_path: z.string().optional(),
        }),
        origin: z.string(),
    })).optional(),
});

/**
 * THE openisd.yml RECORD, declared as a type — every key one carries, and no key it does not.
 *
 * Required versus optional follows the model that WRITES the file — `OpenIsdYmlFile` in
 * winisd_tools `scrapers/scrapers/lib/model_openisd.py:55-73`, which is `extra="forbid"`. A field
 * declared there without a `= None` default is required here. Counting the corpus agrees on
 * these ten but cannot tell "the schema requires it" from "every record we hold happens to have
 * it", so the schema is the authority.
 * `test/architecture-record-matches-openisd-yml.test.ts` holds the two in agreement, because a
 * type that models a SUBSET of the file is silent — it does not fail, it just cannot carry what
 * it left out.
 */
export type OpenISDDeviceJson = z.infer<typeof openISDDeviceJsonSchema>;
