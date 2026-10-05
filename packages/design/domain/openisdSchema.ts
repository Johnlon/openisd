/**
 * THE openisd RECORD, DECLARED ONCE, AS A SCHEMA — the ONLY description of what an openisd record
 * is, and the only thing that decides whether an untrusted value is one.
 *
 * ITS OWN FILE because it is a different kind of thing from the domain objects in
 * `openisdDomain.ts`: those are behaviour over a record that has already been checked, this is
 * the check itself, and the boundary between "untrusted value" and "record" is exactly the line
 * the two sit either side of. It also keeps the record's SHAPE readable on its own, apart from
 * the domain code.
 *
 * DATA SHAPES ONLY: the zod schemas, their inferred types, and the small hand-written interfaces
 * (`Reading`, `DriverSpecsSection`, `PassiveRadiatorSpecsSection`) that describe the same shapes
 * the schemas validate. The logic that reads or builds these shapes — voice-coil wiring
 * (`voiceCoilWiring.ts`), spec-entry helpers (`specEntry.ts`), `.wdr` import
 * (`winIsdDriverImport.ts`), a brand-new box's defaults (`boxDefaults.ts`) and
 * `OpenISDDeviceJson`'s own parse/serialise boundary (`openIsdDeviceJsonIo.ts`) — lives in its own
 * module, named for what it does, and imports the type it needs from here.
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
import {z} from 'zod';
import type {OpenISDDriver} from './driver/openISDDriver.js';
import type {BoxType, Filter, PassFamily} from '../engine/index.js';
import type {VentShape} from './vent.js';
import {dqMarks} from './specEntry.js';

/**
 * One SOURCE'S READING of one field, as the scraper recorded it. Names are the corpus's own.
 *
 * `actual_reading` is the literal the document printed; `read_value` is its SI parse. Neither is
 * derived from the other — both come from one parse of the literal, so a record shows what was
 * printed AND what it meant.
 */
export interface Reading {
    readonly actual_reading?: string;
    readonly read_value: number;
    readonly read_precision?: number;
}

// `SpecEntryJson` — one SPEC field, ONE VALUE, ONE FLAG (T11) — is declared further down as
// `z.infer<typeof specEntryJsonSchema>` (see that schema's own doc comment), not here: the type
// alias forward-references the schema (legal — TS resolves type-level bindings for the whole
// module in one pass, unlike a `const`), so every field below sees the real shape and the two
// can never drift apart the way a hand-duplicated interface could.

/** The parameters a driver states, in one section.
 *  Not just TS parameters, but any parameter we collect off the datasheets.
 *
 *  EVERY FIELD IS OPTIONAL — a key is ABSENT when the driver does not state that parameter, not
 *  present holding a null or a zero. That is what a scraped record actually looks like: a
 *  datasheet giving four parameters produces four keys. `Cell` already reports `value: null` for
 *  a key that is not there, so a reader sees absence the same way whichever field is missing.
 *
 *  Populates as `woofer: <DriverSpecsSection>` and/or `tweeted: <DriverSpecsSection>` in OpenIsdDriver.
 *  It also means an EMPTY driver is `{ woofer: {} }` — a section present and nothing in it. No
 *  invented zeros, and `OpenISDDriver.sectionOf()` is satisfied, which is what lets a project be
 *  constructed before its driver is written in.
 *
 *  Keys are the canonical application names, including their SI units. The same name is used by
 *  storage, domain, engine and UI. WinISD's unsuffixed keys are translated only while parsing or
 *  serialising its external file formats. */
export interface DriverSpecsSection {
    // Thiele/Small.
    readonly Fs_hz?: SpecEntryJson;
    readonly Re_ohm?: SpecEntryJson;
    readonly Le_H?: SpecEntryJson;
    readonly fLe_hz?: SpecEntryJson;
    readonly KLe_H_sqrtHz?: SpecEntryJson;
    readonly Znom_ohm?: SpecEntryJson;
    readonly Qts?: SpecEntryJson;
    readonly Qes?: SpecEntryJson;
    readonly Qms?: SpecEntryJson;
    readonly Vas_m3?: SpecEntryJson;
    readonly Sd_m2?: SpecEntryJson;
    readonly BL_Tm?: SpecEntryJson;
    readonly Mms_kg?: SpecEntryJson;
    readonly Cms_m_per_N?: SpecEntryJson;
    readonly Rms_kg_per_s?: SpecEntryJson;
    readonly Xmax_m?: SpecEntryJson;
    readonly Xlim_m?: SpecEntryJson;
    readonly SPL_dB?: SpecEntryJson;
    readonly Pe_W?: SpecEntryJson;
    readonly Dd_m?: SpecEntryJson;
    readonly EBP_hz?: SpecEntryJson;
    readonly numVC?: SpecEntryJson;
    readonly VCCon?: SpecEntryJson;
    // Ordinarily derived, but WinISD lets a human TYPE any of them, and an entered value is a fact.
    readonly Dia_m?: SpecEntryJson;
    readonly Vd_m3?: SpecEntryJson;
    readonly no?: SpecEntryJson;
    readonly SPLmax_dB?: SpecEntryJson;
    readonly SPLmaxLF_dB?: SpecEntryJson;
    readonly USPL_dB?: SpecEntryJson;
    readonly alfaVC_per_K?: SpecEntryJson;
    readonly Rt_K_per_W?: SpecEntryJson;
    readonly Ct_J_per_K?: SpecEntryJson;
    readonly gamma_m_per_s2_A?: SpecEntryJson;
    readonly Rme_kg_per_s?: SpecEntryJson;
    readonly Mpow_N_per_sqrtW?: SpecEntryJson;
    readonly Mcost_kg_per_s?: SpecEntryJson;
    readonly Gloss?: SpecEntryJson;
    // `c` and `roo` are the air the DRIVER states — the conditions its own figures were measured
    // or computed at. `OpenISDEnvironment` on the project is what a simulation runs on; these two
    // are not that, and the record keeps them per driver because WinISD does.
    readonly c_m_per_s?: SpecEntryJson;
    readonly roo_kg_per_m3?: SpecEntryJson;
    // Descriptive and dimensional.
    readonly Vcd_m?: SpecEntryJson;
    readonly Hg_m?: SpecEntryJson;
    readonly Hc_m?: SpecEntryJson;
    readonly freq_low_hz?: SpecEntryJson;
    readonly freq_high_hz?: SpecEntryJson;
    readonly power_peak_W?: SpecEntryJson;
    readonly weight_kg?: SpecEntryJson;
    readonly Thick_m?: SpecEntryJson;
    readonly Depth_m?: SpecEntryJson;
    readonly MagDepth_m?: SpecEntryJson;
    readonly Magnet_m?: SpecEntryJson;
    readonly Basket_m?: SpecEntryJson;
    readonly Outer_m?: SpecEntryJson;
    readonly OuterX_m?: SpecEntryJson;
    readonly OuterY_m?: SpecEntryJson;
    readonly DVol_m3?: SpecEntryJson;
}

/** The passive-radiator section — A DIFFERENT SCHEMA from a driver's, not a narrowed `DriverSpecsSection`
 *  (John 2026-08-27: "the passive rad has only a few exposed fields not same as driver as no
 *  electrical", "different schema"). A radiator has no motor and no voice coil, so `Re`, `Le`,
 *  `Znom`, `Qes`, `BL`, `numVC` and the thermal parameters describe nothing on one. Typing it as
 *  `DriverSpecsSection` would publish every one of them as a readable field. */
export interface PassiveRadiatorSpecsSection {
    readonly Fs_hz?: SpecEntryJson;
    readonly Qms?: SpecEntryJson;
    readonly Cms_m_per_N?: SpecEntryJson;
    readonly Mms_kg?: SpecEntryJson;
    readonly Rms_kg_per_s?: SpecEntryJson;
    readonly Sd_m2?: SpecEntryJson;
    readonly Vas_m3?: SpecEntryJson;
    readonly Vd_m3?: SpecEntryJson;
    readonly Xmax_m?: SpecEntryJson;
    readonly Xlim_m?: SpecEntryJson;
    readonly Dia_m?: SpecEntryJson;
    readonly Dd_m?: SpecEntryJson;
    readonly DVol_m3?: SpecEntryJson;
    // Mounting dimensions — a radiator sits on a baffle exactly as a driver does (John 2026-08-27).
    readonly Thick_m?: SpecEntryJson;
    readonly Depth_m?: SpecEntryJson;
    readonly Basket_m?: SpecEntryJson;
    readonly Outer_m?: SpecEntryJson;
    readonly OuterX_m?: SpecEntryJson;
    readonly OuterY_m?: SpecEntryJson;
    readonly weight_kg?: SpecEntryJson;
}


/** One source's reading of one parameter. `read_value` is the number; the rest annotate it.
 *  Exported so `winIsdDriverConverter.ts` can validate a scraper's driver.yml readings against
 *  the SAME shape this record stores, rather than a hand-duplicated copy free to drift. */
export const readingJsonSchema = z.strictObject({
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
/** The corroboration verdict a scraped entry's readings settled on (D11) — `Corroboration.ALL`'s
 *  wire values. Absent on a hand-typed entry and on any entry with fewer than two usable readings
 *  (`UNMATCHED` is itself a verdict and is always written, so absence here means "no readings to
 *  corroborate at all", i.e. a single-source entry that predates this scheme). */
const corroborationJsonSchema = z.enum(['MATCH', 'MISMATCH', 'NOT_MATCHABLE', 'UNMATCHED']);

/** An entered spec entry: a `value` plus `state:'E'`, with `origin`/`readings` riding beside it
 *  as information only — which source won, and every source's reading. `readings` carries AT
 *  LEAST ONE when present — `SpecEntry.readings` is `Field(min_length=1)` upstream, because an
 *  entry naming a winning origin with nothing under it is a field with no value — but a
 *  hand-typed value (`enteredEntry`) has neither `origin` nor `readings` at all. */
const enteredEntrySchema = z.strictObject({
    state: z.literal('E'),
    value: z.number(),
    /** Half-width of what this value STATES, in SI — written by whatever entered it, because the
     *  stored number cannot be read back for it: a field showing 2 decimals of grams states
     *  30 g to ±0.005 g, and `0.03` kg no longer says so. Absent on a value that arrived as a
     *  plain number, where its own decimals are the statement (`0.5` kg is 1 dp of a kilogram).
     *  Never the precision the FIELD supports — that is a display question. */
    precision: z.number().positive().optional(),
    // `_KEY_PRIORITY_LIST` order (`model_driver.py:1509`) — see the note on the record schema below.
    origin: z.string().optional(),
    readings: z.record(z.string(), readingJsonSchema).refine(
        r => Object.keys(r).length > 0, 'expected at least one reading').optional(),
    corroboration: corroborationJsonSchema.optional(),
    dq_scraper: dqMarks(),
    dq_calculated: dqMarks(),
});

/** A calculated spec entry: a `value` plus `state:'C'`, the precision it inherits, and its own dq
 *  — nothing was read, so no `origin`/`readings`/`dq_scraper` (only a scraper produces those). */
const calculatedEntrySchema = z.strictObject({
    state: z.literal('C'),
    value: z.number(),
    /** Half-width the value inherits from its most precise entered input, in SI — stored as an
     *  entered value's `precision` is. Absent when no entered width reaches it. */
    precision: z.number().positive().optional(),
    dq_calculated: dqMarks(),
});

/**
 * A spec field: `value` + `state` (T11), `origin`/`readings` riding beside an entered value as
 * provenance only. `dq_scraper` and `dq_calculated` are split BY PRODUCER: a scraper finds
 * structural, parse and source problems (entered values only); only the calculation finds T/S
 * parameters that disagree with each other (either state).
 *
 * ONE VALUE, ONE FLAG (T11, John: "it gets written into the Json simple as that… do not muddle
 * semantics"): `value` is the number, `state` says whether it was TYPED ('E') or DERIVED ('C') —
 * absence of the whole entry means 'N', not-available. There is no separate value channel for a
 * calculated figure: a `'C'` entry writes the SAME `value` field an `'E'` entry does, so a reader
 * never juggles two numbers wondering which one is live.
 *
 * `origin`/`readings` ride BESIDE an `'E'` entry as INFORMATION ONLY — which source's reading
 * won, and what every source said. A hand-typed value has neither: there was no source to name.
 * A `'C'` entry has no `origin`/`readings` at all — nothing was read, `crosscheck.py` never ran.
 *
 * NO LEGACY PREPROCESS (D15): a bare `{origin, readings}` shape with no `state` key — the old
 * `driver.yml` shape, before the scraper's own origin pick and corroboration verdict were retired
 * from the scraper side — is no longer accepted here. `winIsdDriverConverter.ts` builds the
 * `{state:'E', value, origin, corroboration, readings, dq_scraper}` entry itself, choosing the
 * origin and computing corroboration on this side (`sourceRank.ts`, `corroboration.ts`), before
 * this schema ever parses it — so a bare scraper shape reaching this union IS a parse error, not
 * a shape to be silently upgraded.
 */
export const specEntryJsonSchema =
    z.discriminatedUnion('state', [enteredEntrySchema, calculatedEntrySchema]);

export type SpecEntryJson = z.infer<typeof specEntryJsonSchema>;

// ── THE THREE FIELD ENVELOPES ─────────────────────────────────────────────────────────────────
//
// A record never stores a bare value: it stores the value with the provenance that answers where
// it came from. THREE different answers, so three envelopes (`model_driver.py`, `FieldEnvelope`
// and its subclasses).
//
// `definition` — what a field MEANS — is on all three in the scraper and appears on NONE of them
// here. It is driver.yml's, and never reaches an openisd.yml or a .wdr (John, 2026-09-01). A
// consumer of this record already knows what `Fs` is.

/** READ off a source. `origin` names the source the value came from and `readings` keeps what each
 *  one said. (`ScrapedField`, model_driver.py:155.)
 *
 *  `origin` is a plain string, not an enum of source roles: the scraper owns that list
 *  (`SourceRole`, model_driver.py) and nothing else here mirrors it, so a copy would be a second
 *  source of truth free to drift from the one that writes these records.
 *
 *  Optional, where the scraper has it required, because this schema also reads records the APP
 *  wrote: a driver the user typed was read off no source and has no role to name. */
const scrapedFieldOf = <T extends z.ZodType>(value: T) => z.strictObject({
    value,
    origin: z.string().optional(),
    readings: z.record(z.string(), value).optional(),
    dq_scraper: dqMarks(),
    note: z.unknown().optional(),
});

/** COMPUTED from other fields. No origin — nothing was read — but `grounds` carries the evidence,
 *  and there is always at least one. (`DerivedField`, model_driver.py:193.) */
const derivedFieldOf = <T extends z.ZodType>(value: T) => z.strictObject({
    value,
    grounds: z.strictObject({
        origin: z.string(), reading: z.string(),
    }).array().min(1),
});

/** A fact about the RECORD, not about the driver — a uuid, where its sources were. Nothing was
 *  read and nothing was derived, so neither origin nor grounds. (`BookkeepingField`,
 *  model_driver.py:202.) */
const bookkeepingFieldOf = <T extends z.ZodType>(value: T) => z.strictObject({
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
    Fs_hz: e, Re_ohm: e, Le_H: e, fLe_hz: e, KLe_H_sqrtHz: e, Znom_ohm: e,
    Qts: e, Qes: e, Qms: e, Vas_m3: e, Sd_m2: e, BL_Tm: e,
    Mms_kg: e, Cms_m_per_N: e, Rms_kg_per_s: e, Xmax_m: e, Xlim_m: e, SPL_dB: e,
    Pe_W: e, Dd_m: e, EBP_hz: e, numVC: e, VCCon: e, Dia_m: e,
    Vd_m3: e, no: e, SPLmax_dB: e, SPLmaxLF_dB: e, USPL_dB: e, alfaVC_per_K: e,
    Rt_K_per_W: e, Ct_J_per_K: e, gamma_m_per_s2_A: e, Rme_kg_per_s: e, Mpow_N_per_sqrtW: e, Mcost_kg_per_s: e,
    Gloss: e, c_m_per_s: e, roo_kg_per_m3: e, Vcd_m: e, Hg_m: e, Hc_m: e,
    freq_low_hz: e, freq_high_hz: e, power_peak_W: e, weight_kg: e, Thick_m: e, Depth_m: e,
    MagDepth_m: e, Magnet_m: e, Basket_m: e, Outer_m: e, OuterX_m: e, OuterY_m: e,
    DVol_m3: e,
}).partial();

/** A radiator has no motor and no voice coil, so `Re`, `Le`, `Znom`, `Qes`, `BL`, `numVC` and the
 *  thermal parameters describe nothing on one — a DIFFERENT schema, not a narrowed driver's. */
const passiveRadiatorSpecsSectionJsonSchema = (e: typeof specEntryJsonSchema) => z.strictObject({
    Fs_hz: e, Qms: e, Cms_m_per_N: e, Mms_kg: e, Rms_kg_per_s: e, Sd_m2: e,
    Vas_m3: e, Vd_m3: e, Xmax_m: e, Xlim_m: e, Dia_m: e, Dd_m: e,
    DVol_m3: e, Thick_m: e, Depth_m: e, Basket_m: e, Outer_m: e, OuterX_m: e,
    OuterY_m: e, weight_kg: e,
}).partial();

/** A DRIVER's spec sections: the woofer section the app simulates — always — and, on a coaxial
 *  only, a tweeter section beside it. */
const driverSpecsJsonSchema = z.strictObject({
    woofer: driverSpecsSectionJsonSchema(specEntryJsonSchema),
    tweeter: driverSpecsSectionJsonSchema(specEntryJsonSchema).optional(),
});

/** A PASSIVE RADIATOR's spec sections: exactly one, its own. */
const radiatorSpecsJsonSchema = z.strictObject({
    'passive-radiator': passiveRadiatorSpecsSectionJsonSchema(specEntryJsonSchema),
});

/** `specs` is a SUM TYPE — a device is a driver OR a radiator. Three optional sections would
 *  have admitted `{}` and `{woofer, 'passive-radiator'}` as well-typed records and left every
 *  reader to re-discover the contradiction; here both are refused AT THE PARSE.
 *
 *  Dispatched by hand rather than through `z.union`: a union that fails reports ONE issue on
 *  `specs` and swallows the member's own findings, so a driver record with two bad readings
 *  inside `Fs_hz` would have come back as "specs: invalid" instead of naming each reading
 *  (`domain/driver-record.test.ts` "names EVERY bad reading"). The key that is present says which member the
 *  value claims to be; that member then parses it and its issues pass through, paths intact. */
const SPECS_SHAPE = "a driver (a 'woofer' section, optionally with a 'tweeter' section) or a "
    + "passive radiator (a 'passive-radiator' section) — not both, not neither";
const specsJsonSchema = z.unknown().transform((value, ctx): DriverSpecsJson | RadiatorSpecsJson => {
    const keyed = typeof value === 'object' && value !== null && !Array.isArray(value);
    const claimsDriver = keyed && 'woofer' in value;
    const claimsRadiator = keyed && 'passive-radiator' in value;
    if (claimsDriver === claimsRadiator) {
        ctx.issues.push({code: 'custom', message: SPECS_SHAPE, input: value});
        return z.NEVER;
    }
    const member = claimsDriver ? driverSpecsJsonSchema.safeParse(value) : radiatorSpecsJsonSchema.safeParse(value);
    if (!member.success) {
        // Re-raised at the member's own path, so `specs.woofer.Fs_hz.…` survives the dispatch.
        for (const issue of member.error.issues) {
            ctx.issues.push({code: 'custom', message: issue.message, path: [...issue.path], input: value});
        }
        return z.NEVER;
    }
    return member.data;
});

/** The `specs` a DRIVER record carries. */
export type DriverSpecsJson = z.infer<typeof driverSpecsJsonSchema>;
/** The `specs` a PASSIVE RADIATOR record carries. */
export type RadiatorSpecsJson = z.infer<typeof radiatorSpecsJsonSchema>;

/** Narrow a record's `specs` to the driver member of the sum, or null when the record is a
 *  radiator. A reader that needs the woofer section asks this ONCE and then reads typed fields;
 *  the `in` check is the discriminator, since a strict driver object never carries the
 *  radiator's key. */
export function driverSpecsOf(json: OpenISDDeviceJson): DriverSpecsJson | null {
    return 'woofer' in json.specs ? json.specs : null;
}

/** The radiator counterpart of `driverSpecsOf()`. */
export function radiatorSpecsOf(json: OpenISDDeviceJson): RadiatorSpecsJson | null {
    return 'passive-radiator' in json.specs ? json.specs : null;
}

export const openISDDeviceJsonSchema = z.strictObject({
    // DO NOT REORDER. Field order matches `_KEY_PRIORITY_LIST` (`model_driver.py:1509`) and `driver.yml`.
    // Zod's `safeParse` preserves this declaration order; reordering here causes diff noise on save.
    // Envelope types (scraped/derived/bookkeeping) exactly match `OpenIsdYmlFile` definitions.
    uuid: bookkeepingFieldOf(z.string()),
    quality: z.strictObject({
        issue: z.string().optional(),
        // Optional (D3/D17): derived from corroboration, not stored by a post-D9/D11 driver.yml —
        // but the existing corpus is NOT regenerated by this work, so an old record still carrying
        // them must keep parsing beside a new one that has neither.
        confirmed_fields: z.string().array().optional(),
        fields_with_issues: z.string().array().optional(),
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
    // Retired (John, 2026-10-04): the app picks a reading's origin itself (selectOrigin.ts). Older
    // records still carry it, so it parses; nothing reads it and OpenISD never writes it.
    authoritative: bookkeepingFieldOf(z.string()).optional(),
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

/** A device record whose `specs` is a driver's. */
export type DriverDeviceJson = Omit<OpenISDDeviceJson, 'specs'> & {specs: DriverSpecsJson};
/** A device record whose `specs` is a passive radiator's. */
export type RadiatorDeviceJson = Omit<OpenISDDeviceJson, 'specs'> & {specs: RadiatorSpecsJson};

/** `json` as a driver record, or null when it is a radiator's. */
export function asDriverDevice(json: OpenISDDeviceJson): DriverDeviceJson | null {
    const specs = driverSpecsOf(json);
    return specs === null ? null : {...json, specs};
}

/** `json` as a radiator record, or null when it is a driver's. */
export function asRadiatorDevice(json: OpenISDDeviceJson): RadiatorDeviceJson | null {
    const specs = radiatorSpecsOf(json);
    return specs === null ? null : {...json, specs};
}

/** A project's driver slot: a device record that must be a driver. */
export const driverDeviceJsonSchema = openISDDeviceJsonSchema.transform((json, ctx): DriverDeviceJson => {
    const driver = asDriverDevice(json);
    if (driver === null) ctx.issues.push({code: 'custom', message: 'the driver slot holds a passive-radiator record', input: json});
    return driver ?? z.NEVER;
});

/** A box's radiator slot: a device record that must be a passive radiator. */
export const radiatorDeviceJsonSchema = openISDDeviceJsonSchema.transform((json, ctx): RadiatorDeviceJson => {
    const radiator = asRadiatorDevice(json);
    if (radiator === null) ctx.issues.push({code: 'custom', message: 'the radiator slot holds a driver record', input: json});
    return radiator ?? z.NEVER;
});


/** One port's stored geometry. `diameter_m` applies to a round vent, `height_m` (against the
 *  live `width_m`) to a slotted one — which pair is meaningful follows `shape`, and the other
 *  stays absent rather than carrying a stale number from a shape the user has since switched
 *  away from. `area_m2` is a solved pair with whichever of those two is active (S7-e); `width_m`
 *  itself is never solved, so it keeps the plain nullable shape. */
const ventJsonSchema = z.strictObject({
    shape: z.enum(['round', 'slotted'] satisfies readonly VentShape[]),
    // A solver-set slot (S7-a/S7-e): absent = not-available, `state:'E'` = entered, `state:'C'`
    // = derived — not a plain nullable number.
    diameter_m: specEntryJsonSchema.optional(),
    width_m: z.number().nullable(),
    height_m: specEntryJsonSchema.optional(),
    length_m: specEntryJsonSchema.optional(),
    // How many identical ports share the chamber. Same slot shape as `numVC`: absent =
    // not-available, and the domain reads that (or a value that is not a whole number ≥ 1) as
    // the calculated `calcVentCount()` — never refused at parse time.
    count: specEntryJsonSchema.optional(),
    area_m2: specEntryJsonSchema.optional(),
    endCorrection_m: z.number(),
});
export type VentJson = z.infer<typeof ventJsonSchema>;

/** The four loss shapes a chamber can actually have, matching `losses.ts`'s four `*Losses` read
 *  interfaces field-for-field (BUG_20260824's live-confirmed per-box-type/chamber-role shapes):
 *  no port on the chamber means no `Qp`; no coupling to another chamber means no `Qicl`. Each box
 *  type's chamber in `openISDBoxJsonSchema` below stores exactly the shape it has — there is no
 *  shared superset schema, because the superset was never real: WinISD itself never shows `Qp`
 *  or `Qicl` controls for a sealed box. */
const sealedLossesJsonSchema = z.strictObject({
    Ql: z.number(),
    Qa: z.number(),
});
export type SealedLossesJson = z.infer<typeof sealedLossesJsonSchema>;

const ventedLossesJsonSchema = z.strictObject({
    Ql: z.number(),
    Qa: z.number(),
    Qp: z.number(),
});
export type VentedLossesJson = z.infer<typeof ventedLossesJsonSchema>;

const coupledSealedLossesJsonSchema = z.strictObject({
    Ql: z.number(),
    Qa: z.number(),
    Qicl: z.number(),
});
export type CoupledSealedLossesJson = z.infer<typeof coupledSealedLossesJsonSchema>;

const coupledVentedLossesJsonSchema = z.strictObject({
    Ql: z.number(),
    Qa: z.number(),
    Qp: z.number(),
    Qicl: z.number(),
});
export type CoupledVentedLossesJson = z.infer<typeof coupledVentedLossesJsonSchema>;

/** A chamber with its own volume and tuning, parameterised by which loss shape it has — bandpass4's
 *  rear (sealed, coupled) and front (vented, coupled) need different shapes from the same box. */
const chamberJsonSchemaOf = <L extends z.ZodType>(losses: L) => z.strictObject({
    volume_m3: z.number(),
    // A solver-set slot (S7-a) — see `ventJsonSchema.length_m`'s note.
    tuning_goal_hz: specEntryJsonSchema.optional(),
    losses,
});
const ventedChamberJsonSchema = chamberJsonSchemaOf(ventedLossesJsonSchema);
export type ChamberJson = z.infer<typeof ventedChamberJsonSchema>;
const coupledSealedChamberJsonSchema = chamberJsonSchemaOf(coupledSealedLossesJsonSchema);
const coupledVentedChamberJsonSchema = chamberJsonSchemaOf(coupledVentedLossesJsonSchema);
export type CoupledVentedChamberJson = z.infer<typeof coupledVentedChamberJsonSchema>;

/** The passive-radiator box's own record — its own schema (a PR is a different device), so no
 *  `wdr` and not a driver spec field. */
const passiveRadiatorJsonSchema = z.strictObject({
    volume_m3: z.number(),
    // A solver-set slot (S7-a) — see `ventJsonSchema.length_m`'s note.
    tuning_goal_hz: specEntryJsonSchema.optional(),
    count: z.number(),
    addedMass_kg: specEntryJsonSchema.optional(),
    // The two PR OUTPUTS (S2-7d2): always calculated, never entered — but still a solver-set
    // slot, not a readout computed fresh at every read, so the project
    // cascade has somewhere to write them and a reader never re-solves on read.
    resonanceWithAddedMass_hz: specEntryJsonSchema.optional(),
    systemTuning_hz: specEntryJsonSchema.optional(),
    losses: sealedLossesJsonSchema,
    // The box's PR, stored as a full driver record (a PR IS a purchasable component, same as
    // a driver) — blank until `configurePR()` picks one. Reuses `openISDDeviceJsonSchema`
    // rather than a second driver schema, per QO116.
    component: radiatorDeviceJsonSchema,
});

/** The project schema, nested throughout (QO116, John: "box and environment as nested
 *  strictObjects... Validate the whole project in a single .parse() at the load boundary. Not
 *  three standalone schemas."). `openISDBoxJsonSchema`, `openISDEnvironmentJsonSchema` and the
 *  rest below exist only to be composed into `openISDProjectJsonSchema` — none is a second
 *  standalone entry point. */
const openISDBoxJsonSchema = z.strictObject({
    boxType: z.enum([
        'sealed', 'vented', 'bandpass4', 'bandpass6', 'box-passive-radiator', 'abc',
    ] satisfies readonly BoxType[]),
    // The port air velocity every port-velocity chart draws as its limit line, m/s. Per project
    // (John, 2026-10-01). Optional: absent reads as 17 m/s, matching every project saved before it.
    portVelocityLimit_m_per_s: z.number().optional(),
    sealed: z.strictObject({
        volume_m3: z.number(), losses: sealedLossesJsonSchema,
        // A solver-set slot (S7-a) — see `ventJsonSchema.length_m`'s note; a slot for the
        // sealed-alignment solve to write, wired up in S2-7d.
        Qtc: specEntryJsonSchema.optional(),
    }),
    vented: z.strictObject({ chamber: ventedChamberJsonSchema, vent: ventJsonSchema }),
    bandpass4: z.strictObject({
        // rear is sealed but coupled to front through the shared wall — Qicl, no Qp.
        rear: coupledSealedChamberJsonSchema,
        // front is vented and coupled — both Qp and Qicl.
        front: coupledVentedChamberJsonSchema,
        frontVent: ventJsonSchema,
    }),
    bandpass6: z.strictObject({
        rear: coupledVentedChamberJsonSchema,
        front: coupledVentedChamberJsonSchema,
        rearVent: ventJsonSchema,
        frontVent: ventJsonSchema,
    }),
    abc: z.strictObject({
        rear: coupledVentedChamberJsonSchema,
        front: coupledVentedChamberJsonSchema,
        rearVent: ventJsonSchema,
        frontVent: ventJsonSchema,
        // The connecting port between rear and front. No live WinISD evidence was ever captured
        // for its own loss controls (BUG_20260824) — it stores no losses of its own here, and
        // none should be invented without that evidence.
        intraVent: ventJsonSchema,
    }),
    passiveRadiator: passiveRadiatorJsonSchema,
});
export type OpenISDBoxJson = z.infer<typeof openISDBoxJsonSchema>;

/**
 * The air the design sits in. Entry-shaped like every spec quantity: 'E' where the user stated
 * the condition, 'C' where the project's resolve stored the app's Options → Environment value,
 * absent only in a record no resolve has reached. The reference constants themselves stay in
 * `@openisd/engine` (`air.ts`'s `T_REF_K`/`RH_REF_PCT`/`P_REF_PA`) — a second copy here would
 * drift from them silently.
 */
/** Projects saved before 2026-10-05 carry `useWinisdAirModel`, the switch for the removed
 *  CIPM-2007 air model. WinISD's air model is now the only one, so the value is dropped. */
function dropLegacyUseWinisdAirModel(value: unknown): unknown {
    if (typeof value !== 'object' || value === null || !('useWinisdAirModel' in value)) return value;
    const {useWinisdAirModel: _dropped, ...rest} = value;
    return rest;
}
const openISDEnvironmentJsonSchema = z.preprocess(dropLegacyUseWinisdAirModel, z.strictObject({
    temperature_K: specEntryJsonSchema.optional(),
    humidity_pct: specEntryJsonSchema.optional(),
    pressure_Pa: specEntryJsonSchema.optional(),
}));
export type OpenISDEnvironmentJson = z.infer<typeof openISDEnvironmentJsonSchema>;

/** The three air conditions a project states, each an entry like any spec quantity. */
export type EnvironmentCondition = 'temperature_K' | 'humidity_pct' | 'pressure_Pa';

/** What drives the system: drive power `power_W` and drive voltage `voltage_V`, each an entry.
 *  An absent `voltage_V` reads as the 1 V default; an absent `power_W` reads as not-available. */
const openISDSignalJsonSchema = z.strictObject({power_W: specEntryJsonSchema.optional(), voltage_V: specEntryJsonSchema.optional()});
export type OpenISDSignalJson = z.infer<typeof openISDSignalJsonSchema>;

/** WinISD Project tab: Creator/Created/Modified/Description, plus the project's own name. */
const openISDProjectMetaJsonSchema = z.strictObject({
    name: z.string(),
    creator: z.string(),
    created: z.string(),
    modified: z.string(),
    description: z.string(),
});
export type OpenISDProjectMetaJson = z.infer<typeof openISDProjectMetaJsonSchema>;

/** WinISD's low/high-pass "Subtype" choices, plus the pass filters' Q/order — see the engine's
 *  `PassFamily`. */
const passFamilyJsonSchema = z.enum([
    'butterworth', 'linkwitzRiley', 'bessel', 'sos',
] satisfies readonly PassFamily[]);

/** One signal-chain filter — one of WinISD's 8 Filter Editor types, plus the two OpenISD-only
 *  shelves, each its own strict shape (engine's `FilterSpec`, a discriminated union, not a bag
 *  of optional fields). `id` is optional (the UI's list key); `enabled` is required on every
 *  variant. QO169: an old `{type:'lowpass', fc, Q}`-shaped saved filter has no `family`/`order`
 *  and simply fails this schema — no migration. */
const filterJsonSchema = z.discriminatedUnion('type', [
    z.strictObject({id: z.string().optional(), type: z.literal('lowpass'), enabled: z.boolean(),
        family: passFamilyJsonSchema, order: z.number(), fc: z.number(), Q: z.number()}),
    z.strictObject({id: z.string().optional(), type: z.literal('highpass'), enabled: z.boolean(),
        family: passFamilyJsonSchema, order: z.number(), fc: z.number(), Q: z.number()}),
    z.strictObject({id: z.string().optional(), type: z.literal('allpass'), enabled: z.boolean(),
        order: z.number(), t: z.number(), Q: z.number()}),
    z.strictObject({id: z.string().optional(), type: z.literal('linkwitz'), enabled: z.boolean(),
        f0: z.number(), Q0: z.number(), fp: z.number(), Qp: z.number()}),
    z.strictObject({id: z.string().optional(), type: z.literal('peaking'), enabled: z.boolean(),
        fc: z.number(), Q: z.number(), gain: z.number()}),
    z.strictObject({id: z.string().optional(), type: z.literal('peakHighpass'), enabled: z.boolean(),
        fpk: z.number(), gainPk: z.number()}),
    z.strictObject({id: z.string().optional(), type: z.literal('staticGain'), enabled: z.boolean(),
        gain: z.number()}),
    z.strictObject({id: z.string().optional(), type: z.literal('raisedCosine'), enabled: z.boolean(),
        fc: z.number(), bwOct: z.number(), gain: z.number()}),
    z.strictObject({id: z.string().optional(), type: z.literal('lowshelf'), enabled: z.boolean(),
        fc: z.number(), Q: z.number(), gain: z.number()}),
    z.strictObject({id: z.string().optional(), type: z.literal('highshelf'), enabled: z.boolean(),
        fc: z.number(), Q: z.number(), gain: z.number()}),
]) satisfies z.ZodType<Filter>;

/** The signal-chain filter list. */
const filtersJsonSchema = z.strictObject({
    filters: filterJsonSchema.array(),
});
export type FiltersJson = z.infer<typeof filtersJsonSchema>;

/** Projects saved on 2026-09-26 before the rename carry `useWinisdDriverModel`; read it as
 *  `winisdDriverModel`. Every save writes the new name. */
function renameLegacyWinisdDriverModel(value: unknown): unknown {
    if (typeof value !== 'object' || value === null || !('useWinisdDriverModel' in value)) return value;
    const {useWinisdDriverModel, ...rest} = value;
    return {...rest, winisdDriverModel: useWinisdDriverModel};
}

/** WinISD's top-level Advanced pane settings that are not project-array facts about the driver:
 *  force-flat auto-EQ, and the port simulation model. */
const openISDAdvancedJsonSchema = z.preprocess(renameLegacyWinisdDriverModel, z.strictObject({
    // WinISD Advanced tab: "Force flat response".
    forceFlatResponse: z.boolean(),
    // WinISD Advanced tab: "Use transmission line-model for port simulation".
    useTransmissionLinePortModel: z.boolean(),
    // WinISD Advanced tab: "Rg is at driver side" — whether the amplifier's source resistance
    // (`OpenISDDriverEmbeddingJson.Rs_ohm`) is applied per driver or once across the whole array.
    rgAtDriverSide: z.boolean(),
    // WinISD Advanced tab: "Simulate voice coil inductance" — includes Le in the acoustic circuit
    // model (gyrator) rather than just the impedance plot (winisd). 'winisdGyrator' is the
    // inductance-on model WinISD itself uses (BUG_20260926).
    circuitModel: z.enum(['winisd', 'gyrator', 'winisdGyrator']),
    // WinISD Advanced tab: "SPL graph is Xmax limited" — whether the SPL chart shows the drive
    // backed off wherever peak excursion exceeds Xmax (`splXlimCurve`) instead of the unclamped
    // `spl` curve. Display only: the unclamped curve still feeds the transfer-function chart, the
    // F3/F6/F10 read-outs and every compare trace regardless.
    splGraphIsXmaxLimited: z.boolean(),
    // Retired (John, 2026-10-05): the sealed-box loss-model choice is gone; the only model is
    // WinISD's lossy one and Ql/Qa control the losses. Older files still carry the key, so it
    // parses; the loader (`retireLossMode`) turns it into Ql/Qa and drops it, and OpenISD never
    // writes it.
    lossMode: z.enum(['lossless', 'conventional-lossy', 'winisd-lossy']).optional(),
    // The WinISD bug and option switches below are optional: absent parses to
    // `CompatSwitch.winisdValue`, so an absent bug switch is OFF (bug fixed) and an absent option
    // is ON (WinISD's way).
    // Bug switch "Enable WinISD two-BL driver bug": the simulation mixes the entered BL with the BL implied
    // by Fs, Qes and Vas, as WinISD does. Absent parses to OFF.
    winisdDriverModel: z.boolean().optional(),
    // Bug switch "Enable WinISD VA model bug": the amplifier apparent load power chart as WinISD computes
    // it, P·Re·|Hf|²/|Z + Rg|. Absent parses to OFF.
    winisdVaModel: z.boolean().optional(),
    // Option "Enable WinISD style simplified ABC intra-port velocity": the ABC intra-port velocity chart as WinISD
    // draws it, the leak term left out. Absent parses to ON, WinISD's convention.
    winisdAbcIntraPortVelocity: z.boolean().optional(),
    // Bug switch "Enable WinISD PR Npr resonance bug": the passive-radiator box's fixed-loss frequency as WinISD
    // computes it, Npr times below the tuning. Absent parses to OFF.
    winisdPrNprResonance: z.boolean().optional(),
    // Bug switch "Enable WinISD Bessel high-pass bug": Bessel high-pass filters as WinISD computes them,
    // not the mirror of the low-pass. Absent parses to OFF.
    winisdBesselHighpass: z.boolean().optional(),
    // "Enable WinISD style phase wrapping": wraps phase curves to [-180°, +180°]. Optional: absent parses to ON.
    winisdWrapPhase: z.boolean().optional(),
    // "Enable WinISD style per-driver boxes": N drivers as WinISD simulates them, each in Vb/N fed P/N; off, the N
    // coils wired into one terminal impedance. Optional: absent parses to ON.
    winisdDriverCountModel: z.boolean().optional(),
    // "Enable WinISD style uncapped flat response": force flat as WinISD does it, every point to the TF 0 dB, uncapped;
    // off, boost only to the passband reference, capped. Optional: absent parses to ON.
    winisdFlatModel: z.boolean().optional(),
}));
export type OpenISDAdvancedJson = z.infer<typeof openISDAdvancedJsonSchema>;


/** The chart panels' own project-scoped view state: which charts are open. `N` (sweep point
 *  count) absent means the engine's own default (`SimulationEngine.sweep`: 400 points). `graphs` (which
 *  charts are open) is PROJECT-scoped per S10/QO130 (reverses QO90 for this); optional, absent
 *  meaning a project saved before S10. The cursor/selection (crosshair, pinned frequency,
 *  drag-band) is ALSO project-scoped per QO130, but John 2026-09-20/21 ruled those four
 *  fast-changing values (they write on every mousemove) out of the saved record entirely —
 *  `OpenISDProject` holds them as plain in-memory instance state, never in this schema; see
 *  `OpenISDProject.cursorF` etc. */
const openISDChartsJsonSchema = z.strictObject({
    N: z.number().optional(),
    graphs: z.array(z.string()).optional(),
    /** The project's trace/legend colour, a CSS colour; absent until the project is first opened. */
    traceColor: z.string().optional(),
});
export type OpenISDChartsJson = z.infer<typeof openISDChartsJsonSchema>;

/** The embedded driver, plus the settings that describe how it sits in THIS project's array —
 *  how many units, how they're wired together, the amplifier's source resistance loading them,
 *  the coil's thermal rise under drive, and the added mass on the driver from this array's own
 *  hardware. These are project-array facts, not facts about the driver itself, so they live
 *  beside `device` rather than inside `OpenISDDeviceJson` (John 2026-09-06). */
const openISDDriverEmbeddingJsonSchema = z.strictObject({
    device: driverDeviceJsonSchema,
    // WinISD Driver tab: "Num. of drivers".
    nDrivers: z.number(),
    // WinISD Driver tab: "Voice coil connection".
    wiring: z.enum(['series', 'parallel']),
    // WinISD Driver tab: "Voice coil temp rise".
    vcTempRise_K: z.number(),
    Rs_ohm: z.number(),
    // WinISD Driver tab: "Added mass to cone".
    driverAddedMass_kg: z.number(),
    // WinISD Driver tab: "Standard" / "Iso-Barik" radio.
    loading: z.enum(['standard', 'isobaric']),
    // WinISD Driver tab: "Voice coil resistance TC" — a project-level value independent of the
    // driver's own datasheet `alfaVC_per_K` (WinISD stores these as two separate fields,
    // `[Box] alfaVC` vs `[Driver] alfaVC`, that can and do diverge).
    alfaVC_per_K: z.number(),
});
export type OpenISDDriverEmbeddingJson = z.infer<typeof openISDDriverEmbeddingJsonSchema>;

/** THE project record, as ONE schema (QO116) — every nested section above exists only to build
 *  this. `openISDProjectJsonSchema.parse()`/`.safeParse()` is the one validator for the whole
 *  project at the load boundary; nothing downstream re-checks a section on its own. */
export const openISDProjectJsonSchema = z.strictObject({
    driverEmbedding: openISDDriverEmbeddingJsonSchema,
    box: openISDBoxJsonSchema,
    environment: openISDEnvironmentJsonSchema,
    signal: openISDSignalJsonSchema,
    meta: openISDProjectMetaJsonSchema,
    filters: filtersJsonSchema,
    advanced: openISDAdvancedJsonSchema,
    charts: openISDChartsJsonSchema,
});
export type OpenISDProjectJson = z.infer<typeof openISDProjectJsonSchema>;

export const openISDProjectSessionJsonSchema = z.strictObject({
    label: z.string(),
    saved: openISDProjectJsonSchema,
    edited: openISDProjectJsonSchema.nullable(),
});
export type OpenISDProjectSessionJson = z.infer<typeof openISDProjectSessionJsonSchema>;


/**
 * The spec section of a driver, named through `OpenISDDriver`'s own PUBLIC `spec` property rather
 * than by importing the class behind it — that class is deliberately unexported, and this needs a
 * name for a parameter, not access to anything design keeps private.
 */
export type DriverSpec = OpenISDDriver['specs'];

