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
 * `emptyBoxJson()` and the `NO_*` frozen defaults live here too: they build an `OpenISDBoxJson`
 * from nothing but JSON, no class involved, so the record's blank shape sits with the record's
 * schema. `openisdTransforms.ts`'s builders spread them into a new project.
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
import {WinISDDriver, INI_ROWS} from '../winisd/index.js';
import {newUuid} from './newUuid.js';
import type {FieldHandle} from './cell.js';
import type {OpenISDDriver} from './openisdDomain.js';
import type {DriverError, BoxType, Filter, FilterType} from '../engine/index.js';
import type {VentShape} from './vent.js';

/** DQ marks. A function, not a shared object: a module-scoped literal would be state, and each
 *  schema gets its own. */
const dqMarks = () => z.strictObject({
    kind: z.string(), severity: z.string(), rule: z.string(), detail: z.string(),
    params: z.record(z.string(), z.unknown()),
}).array().optional();

/** One data-quality mark. `kind` says who found it and how: `calc` and `range` are computed,
 *  `corroboration` is the scraper's cross-source verdict. Shape follows the corpus. */
export interface DqMark {
    readonly kind: string;
    readonly severity: string;
    readonly rule: string;
    readonly params: Readonly<Record<string, unknown>>;
    readonly detail: string;
}

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

/**
 * One SPEC field — a T/S parameter, and every source's reading of it.
 *
 * IT STATES NO VALUE OF ITS OWN. The number is `readings[origin].read_value`, and `origin` names
 * which source won. That decision is made upstream by `crosscheck.py` — impossible readings
 * excluded, then majority, then document precedence — and nothing downstream re-takes it. A
 * top-level `value` here would store one fact twice and need a validator to keep the copies in
 * step (Q31).
 *
 * TWO DQ FIELDS, SPLIT BY PRODUCER (John 2026-08-29). `dq_scraper` holds what only a scraper can
 * find — structural, parse and source problems. `dq_calculated` holds what only the calculation
 * can find, and is written by the bridge, never trusted from a file it did not produce. One
 * field would make "who says so" unanswerable, and the two age differently: a calculated mark is
 * only as current as the engine that produced it.
 */
export interface SpecEntryJson {
    readonly origin: string;
    readonly readings: Readonly<Record<string, Reading>>;
    /** The scraper's cross-source verdict: MATCH, MISMATCH, NOT_MATCHABLE, UNMATCHED. */
    readonly corroboration?: string;
    readonly dq_scraper?: readonly DqMark[];
    readonly dq_calculated?: readonly DqMark[];
}

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
 *  KEYS HERE ARE THE RECORD'S OWN, UNSUFFIXED — `openisd.yml` states `Fs`, `Sd`, `Cms`, `Xmax`,
 *  so this type states them too. Spelling the stored keys differently would make the reader hold
 *  a translation table to check a record against the type that declares it.
 *
 *  THE UNIT LIVES ON THE PUBLIC API, NOT HERE (John 2026-08-27: "please put the unit back on
 *  api"). `OpenISDDriver.spec.woofer` publishes `Fs_hz`, `Sd_m2`, `Cms_m_per_N` — a caller
 *  reading a number is the one who can get the unit wrong, and the name is where they will look.
 *  The record is already SI throughout (`Sd: {actual_reading: '1217 cm2', read_value: 0.1217}`),
 *  so the suffix reports what the value IS; it never converts. */
export interface DriverSpecsSection {
    // Thiele/Small.
    readonly Fs?: SpecEntryJson;
    readonly Re?: SpecEntryJson;
    readonly Le?: SpecEntryJson;
    readonly fLe?: SpecEntryJson;
    readonly KLe?: SpecEntryJson;
    readonly Znom?: SpecEntryJson;
    readonly Qts?: SpecEntryJson;
    readonly Qes?: SpecEntryJson;
    readonly Qms?: SpecEntryJson;
    readonly Vas?: SpecEntryJson;
    readonly Sd?: SpecEntryJson;
    readonly BL?: SpecEntryJson;
    readonly Mms?: SpecEntryJson;
    readonly Cms?: SpecEntryJson;
    readonly Rms?: SpecEntryJson;
    readonly Xmax?: SpecEntryJson;
    readonly Xlim?: SpecEntryJson;
    readonly SPL?: SpecEntryJson;
    readonly Pe?: SpecEntryJson;
    readonly Dd?: SpecEntryJson;
    readonly EBP?: SpecEntryJson;
    readonly numVC?: SpecEntryJson;
    readonly VCCon?: SpecEntryJson;
    // Ordinarily derived, but WinISD lets a human TYPE any of them, and an entered value is a fact.
    readonly Dia?: SpecEntryJson;
    readonly Vd?: SpecEntryJson;
    readonly no?: SpecEntryJson;
    readonly SPLmax?: SpecEntryJson;
    readonly SPLmaxLF?: SpecEntryJson;
    readonly USPL?: SpecEntryJson;
    readonly alfaVC?: SpecEntryJson;
    readonly Rt?: SpecEntryJson;
    readonly Ct?: SpecEntryJson;
    readonly gamma?: SpecEntryJson;
    readonly Rme?: SpecEntryJson;
    readonly Mpow?: SpecEntryJson;
    readonly Mcost?: SpecEntryJson;
    readonly Gloss?: SpecEntryJson;
    // `c` and `roo` are the air the DRIVER states — the conditions its own figures were measured
    // or computed at. `OpenISDEnvironment` on the project is what a simulation runs on; these two
    // are not that, and the record keeps them per driver because WinISD does.
    readonly c?: SpecEntryJson;
    readonly roo?: SpecEntryJson;
    // Descriptive and dimensional.
    readonly Vcd?: SpecEntryJson;
    readonly Hg?: SpecEntryJson;
    readonly Hc?: SpecEntryJson;
    readonly freq_low_hz?: SpecEntryJson;
    readonly freq_high_hz?: SpecEntryJson;
    readonly power_peak_W?: SpecEntryJson;
    readonly weight_kg?: SpecEntryJson;
    readonly Thick?: SpecEntryJson;
    readonly Depth?: SpecEntryJson;
    readonly MagDepth?: SpecEntryJson;
    readonly Magnet?: SpecEntryJson;
    readonly Basket?: SpecEntryJson;
    readonly Outer?: SpecEntryJson;
    readonly OuterX?: SpecEntryJson;
    readonly OuterY?: SpecEntryJson;
    readonly DVol?: SpecEntryJson;
}

/** `VCCon` as the CORPUS stores it, and back.
 *
 *  The record holds a NUMBER — `1 = parallel, 2 = series`, which is the record's own definition
 *  text and WinISD's encoding. The API holds a NAME, because a caller writing `2` cannot be
 *  checked and a caller writing `VoiceCoilWiring.Series` can. Both directions live here, next to
 *  each other, so the encoding is stated once rather than assumed at each end.
 *
 *  A number the encoding does not define reads as absence: an unknown wiring is not a wiring. */
export function wiringFromRecord(value: number | null): VoiceCoilWiring | null {
    if (value === 1) return VoiceCoilWiring.Parallel;
    if (value === 2) return VoiceCoilWiring.Series;
    return null;
}

/** WinISD's own default when a driver states no wiring — `docs/spec/SPEC_ENGINE.md:424`,
 *  "Defaults are 0, except numVC=1, VCCon=1". Not a computation: a documented constant, the
 *  same fact `calcNumVC()` states for coil count. The ONE place either is written down, so
 *  `DriverSpecsSection`'s getter and the `.wdr` exporter (which reads the getter, not this
 *  function, directly) agree instead of each stating '1' on its own. */
export function calcVCCon(): VoiceCoilWiring {
    return VoiceCoilWiring.Parallel;
}

/** WinISD's own default when a driver states no coil count — same source as `calcVCCon()`. */
export function calcNumVC(): number {
    return 1;
}

export function enteredWiring(value: VoiceCoilWiring): SpecEntryJson {
    return {
        origin: 'entered',
        readings: {entered: {read_value: value === VoiceCoilWiring.Series ? 2 : 1}},
    };
}

/** A hand-entered value as a `SpecEntryJson`.
 *
 *  ONE reading, under the `entered` role, carrying the number alone: there was no printed
 *  literal to echo and nothing stated a precision, so writing `actual_reading` or
 *  `read_precision` would fabricate provenance. One entry shape for scraped and typed values —
 *  not a second envelope for hand entry. */
export function enteredEntry(value: number): SpecEntryJson {
    return {origin: 'entered', readings: {entered: {read_value: value}}};
}

/** The ONE legal way to read a spec entry's number: the reading `origin` names.
 *
 *  Null when the entry names an origin it has no reading for — a broken record, reported as
 *  absence rather than guessed at from some other source's reading. */
export function winningValue(entry: SpecEntryJson | undefined): number | null {
    if (!entry) return null;
    const reading = entry.readings?.[entry.origin];
    return typeof reading?.read_value === 'number' ? reading.read_value : null;
}

/**
 * How a multi-coil driver's voice coils are wired.
 *
 * NAMED, never WinISD's `1`/`2` (John, 2026-08-28: "encoding in openisd is 'series' not '2' —
 * convert to '2' on serialisation to wpr/wdr", and "same principle applies to other numeric
 * enums"). A magic number in the record forces every reader to hold a translation table, and a
 * mis-set 1 reads as valid data rather than as the mistake it is. The numeric encoding is a
 * property of WinISD's file format and belongs in the `.wdr`/`.wpr` adapter alone.
 *
 * The domain already works this way for the enums it inherited — `BoxType` and `VentShape` are
 * names here and numbers only in the file.
 */
export const VoiceCoilWiring = {
    Parallel: 'parallel',
    Series: 'series',
} as const;

/** The wiring values, as a type. Declared from the object above rather than as a second literal
 *  union, so there is exactly ONE place the members are written and a new member cannot be added
 *  to one and forgotten in the other. */
export type VoiceCoilWiring = typeof VoiceCoilWiring[keyof typeof VoiceCoilWiring];

/** The passive-radiator section — A DIFFERENT SCHEMA from a driver's, not a narrowed `DriverSpecsSection`
 *  (John 2026-08-27: "the passive rad has only a few exposed fields not same as driver as no
 *  electrical", "different schema"). A radiator has no motor and no voice coil, so `Re`, `Le`,
 *  `Znom`, `Qes`, `BL`, `numVC` and the thermal parameters describe nothing on one. Typing it as
 *  `DriverSpecsSection` would publish every one of them as a readable field. */
export interface PassiveRadiatorSpecsSection {
    readonly Fs?: SpecEntryJson;
    readonly Qms?: SpecEntryJson;
    readonly Cms?: SpecEntryJson;
    readonly Mms?: SpecEntryJson;
    readonly Rms?: SpecEntryJson;
    readonly Sd?: SpecEntryJson;
    readonly Vas?: SpecEntryJson;
    readonly Vd?: SpecEntryJson;
    readonly Xmax?: SpecEntryJson;
    readonly Xlim?: SpecEntryJson;
    readonly Dia?: SpecEntryJson;
    readonly Dd?: SpecEntryJson;
    readonly DVol?: SpecEntryJson;
    // Mounting dimensions — a radiator sits on a baffle exactly as a driver does (John 2026-08-27).
    readonly Thick?: SpecEntryJson;
    readonly Depth?: SpecEntryJson;
    readonly Basket?: SpecEntryJson;
    readonly Outer?: SpecEntryJson;
    readonly OuterX?: SpecEntryJson;
    readonly OuterY?: SpecEntryJson;
    readonly weight_kg?: SpecEntryJson;
}


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

/** READ off a source. `readings` keeps what each one said. (`ScrapedField`, model_driver.py:155.) */
const scrapedFieldOf = <T extends z.ZodType>(value: T) => z.strictObject({
    value,
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
    // DO NOT REORDER. Field order matches `_KEY_PRIORITY_LIST` (`model_driver.py:1509`) and `driver.yml`.
    // Zod's `safeParse` preserves this declaration order; reordering here causes diff noise on save.
    // Envelope types (scraped/derived/bookkeeping) exactly match `OpenIsdYmlFile` definitions.
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


/** One port's stored geometry. `diameter_m` applies to a round vent, `width_m`/`height_m` to a
 *  slotted one — which pair is meaningful follows `shape`, and the other stays null rather than
 *  carrying a stale number from a shape the user has since switched away from. */
const ventJsonSchema = z.strictObject({
    shape: z.enum(['round', 'slotted'] satisfies readonly VentShape[]),
    diameter_m: z.number().nullable(),
    width_m: z.number().nullable(),
    height_m: z.number().nullable(),
    length_m: z.number().nullable(),
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
    tuning_hz: z.number().nullable(),
    losses,
});
const ventedChamberJsonSchema = chamberJsonSchemaOf(ventedLossesJsonSchema);
export type ChamberJson = z.infer<typeof ventedChamberJsonSchema>;
const coupledSealedChamberJsonSchema = chamberJsonSchemaOf(coupledSealedLossesJsonSchema);
const coupledVentedChamberJsonSchema = chamberJsonSchemaOf(coupledVentedLossesJsonSchema);

/** The project schema, nested throughout (QO116, John: "box and environment as nested
 *  strictObjects... Validate the whole project in a single .parse() at the load boundary. Not
 *  three standalone schemas."). `openISDBoxJsonSchema`, `openISDEnvironmentJsonSchema` and the
 *  rest below exist only to be composed into `openISDProjectJsonSchema` — none is a second
 *  standalone entry point. */
const openISDBoxJsonSchema = z.strictObject({
    boxType: z.enum([
        'sealed', 'vented', 'bandpass4', 'bandpass6', 'box-passive-radiator', 'abc',
    ] satisfies readonly BoxType[]),
    sealed: z.strictObject({ volume_m3: z.number(), losses: sealedLossesJsonSchema }),
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
    passiveRadiator: z.strictObject({
        volume_m3: z.number(),
        tuning_hz: z.number().nullable(),
        count: z.number(),
        addedMass_kg: z.number().nullable(),
        losses: sealedLossesJsonSchema,
        // The chosen PR, stored as a full driver record (a PR IS a purchasable component, same as
        // a driver) — null until `configurePR()` picks one. Reuses `openISDDeviceJsonSchema`
        // rather than a second driver schema, per QO116.
        component: openISDDeviceJsonSchema.nullable(),
    }),
});
export type OpenISDBoxJson = z.infer<typeof openISDBoxJsonSchema>;

/** The air the design sits in, as the USER stated it. Null where the user has stated nothing —
 *  the domain does not invent air conditions, because reference air belongs to
 *  `@openisd/engine` (`air.ts`'s `T_REF_K`/`RH_REF_PCT`/`P_REF_PA`) and a second copy here would
 *  drift from it silently. */
const openISDEnvironmentJsonSchema = z.strictObject({
    temperature_K: z.number().nullable(),
    humidity_pct: z.number().nullable(),
    pressure_Pa: z.number().nullable(),
    // Null reads as true (QO95): a new project matches WinISD's own air model out of the box.
    useWinisdAirModel: z.boolean().nullable(),
});
export type OpenISDEnvironmentJson = z.infer<typeof openISDEnvironmentJsonSchema>;

/** What drives the system, as the USER stated it. Null where nothing is stated — 1 W is a
 *  measurement convention, not a fact about this design, so the domain does not assert it. */
const openISDSignalJsonSchema = z.strictObject({
    power_W: z.number().nullable(),
    voltage_V: z.number().nullable(),
});
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

/** One signal-chain filter. `id` and the per-type fields are all optional on the engine's own
 *  `Filter` type, so the schema follows suit rather than asserting a shape the engine does not
 *  require. */
const filterJsonSchema = z.strictObject({
    id: z.string().optional(),
    type: z.enum([
        'highpass', 'lowpass', 'linkwitz', 'peaking', 'lowshelf', 'highshelf',
    ] satisfies readonly FilterType[]),
    enabled: z.boolean(),
    fc: z.number().optional(),
    Q: z.number().optional(),
    f0: z.number().optional(),
    Q0: z.number().optional(),
    fp: z.number().optional(),
    Qp: z.number().optional(),
    gain: z.number().optional(),
}) satisfies z.ZodType<Filter>;

/** The signal-chain filter list. */
const filtersJsonSchema = z.strictObject({
    filters: filterJsonSchema.array(),
});
export type FiltersJson = z.infer<typeof filtersJsonSchema>;

/** WinISD's top-level Advanced pane settings that are not project-array facts about the driver:
 *  force-flat auto-EQ, and the port simulation model. */
const openISDAdvancedJsonSchema = z.strictObject({
    // WinISD Advanced tab: "Force flat response".
    forceFlatResponse: z.boolean(),
    // WinISD Advanced tab: "Use transmission line-model for port simulation".
    useTransmissionLinePortModel: z.boolean(),
    // WinISD Advanced tab: "Rg is at driver side" — whether the amplifier's source resistance
    // (`OpenISDDriverEmbeddingJson.Rs_ohm`) is applied per driver or once across the whole array.
    rgAtDriverSide: z.boolean(),
    // WinISD Advanced tab: "Simulate voice coil inductance" — includes Le in the acoustic circuit
    // model (gyrator) rather than just the impedance plot (winisd).
    circuitModel: z.enum(['winisd', 'gyrator']),
    // WinISD Advanced tab: "SPL graph is Xmax limited" — whether the SPL chart shows the drive
    // backed off wherever peak excursion exceeds Xmax (`splXlimCurve`) instead of the unclamped
    // `spl` curve. Display only: the unclamped curve still feeds the transfer-function chart, the
    // F3/F6/F10 read-outs and every compare trace regardless.
    splGraphIsXmaxLimited: z.boolean(),
});
export type OpenISDAdvancedJson = z.infer<typeof openISDAdvancedJsonSchema>;

/** A saved Y-axis zoom override for one chart tab — absent means auto-scale to fit the data. */
const chartYRangeJsonSchema = z.strictObject({
    ymin: z.number(),
    ymax: z.number(),
});
export type ChartYRangeJson = z.infer<typeof chartYRangeJsonSchema>;

/** The chart panels' own view state: the frequency range every chart sweeps and is plotted
 *  over (shared — one X axis across all panels, John 2026-09-07), and each panel's own Y-axis
 *  zoom (`perTab`, keyed by the UI's `ChartTabId` as a plain string — that type is
 *  `packages/ui`'s, so this schema cannot reference it directly). Per-project: two projects
 *  legitimately want different ranges. `fmin_hz`/`fmax_hz`/`N` absent means the engine's own
 *  sweep defaults (`sweep.ts`: 10 Hz, 1000 Hz, 400 points). */
const openISDChartsJsonSchema = z.strictObject({
    fmin_hz: z.number().optional(),
    fmax_hz: z.number().optional(),
    N: z.number().optional(),
    perTab: z.record(z.string(), chartYRangeJsonSchema),
});
export type OpenISDChartsJson = z.infer<typeof openISDChartsJsonSchema>;

/** The embedded driver, plus the settings that describe how it sits in THIS project's array —
 *  how many units, how they're wired together, the amplifier's source resistance loading them,
 *  the coil's thermal rise under drive, and the added mass on the driver from this array's own
 *  hardware. These are project-array facts, not facts about the driver itself, so they live
 *  beside `device` rather than inside `OpenISDDeviceJson` (John 2026-09-06). */
const openISDDriverEmbeddingJsonSchema = z.strictObject({
    device: openISDDeviceJsonSchema,
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
 * `.wdr` (read by `WinISDDriver.fromWdrIni`) -> an `OpenISDDeviceJson` record.
 * Decision table (ParState mark × value in file):
 *
 *   E + 0        → entered, value 0  (warn on export — may be a failed scrape)
 *   E + nonzero  → entered, value
 *   C + any      → nothing  (derived, never stored; re-derived from entered fields)
 *   N + 0        → nothing
 *   N + nonzero  → entered, value
 *   key absent   → nothing
 *
 * `Xlim` is excluded even when marked entered: its cell always carries an empty value
 * (`WinISDDriver`'s own doc — `.wdr` has no key for it), so there is no real number to store.
 *
 * There is no source document, so every field this record can source is marked `manual`
 * (`SourceRole.MANUAL` — "a hand-entered value", `record_registries.py`).
 *
 * `authoritative` is required by the schema below but has no honest value for a `.wdr` import:
 * there is no document to name, and `manual` is barred from `data_sources` in the format this
 * field describes (winisd_tools `model_driver.py`). `openisd` is the pipeline's own role,
 * declared for exactly this case (`record_registries.py`: "a record's own provenance"). This is
 * a placeholder, not a considered choice — `authoritative`'s future is unsettled (John,
 * 2026-09-01: "it's total crap").
 */
/**
 * /**
 * `VCCon` as a record entry, read on PRESENCE rather than on its ParState mark.
 *
 * WinISD writes no instruction to slot 46, so it leaves `N` there while the `VCCon=` row still
 * states a wiring — 520 of the 524 corpus files (`drivers/sample/PARSTATE-FINDINGS.md`). Reading
 * this row on its mark, as every other row is read, loses every series wiring in the corpus.
 *
 * `1` and `2` are the whole encoding. Anything else is read as `1`, parallel, with the number the
 * file carried kept as `actual_reading`. A warning is pushed — NOT a `dq_calculated` mark on the
 * record; coercion is a parse event and the record stays clean.
 */
function wdrVCConEntry(
    cell: { value: string },
    warnings: DriverError[],
): z.infer<typeof specEntryJsonSchema> | undefined {
    const raw = cell.value.trim();
    if (raw.length === 0) return undefined;
    const stated = Number(raw);
    if (!isFinite(stated)) return undefined;

    if (stated === 1 || stated === 2) {
        return {
            origin: 'manual',
            readings: {manual: {actual_reading: raw, read_value: stated}},
        };
    }
    // Out of range for the two-position dropdown WinISD's own UI offers (1 parallel, 2 series)
    // — not a value a human could have entered, so it is omitted rather than coerced into an
    // entered fact. The driver's own VCCon getter then reports the calculated default
    // (`calcVCCon()`, parallel) the same way an absent key does (John, 2026-09-05: "when reading
    // back a zero or absent then it should recorded as C in openisd and the default calculated 1
    // comes thru").
    warnings.push({
        level: 'warn', field: 'VCCon',
        message: `VCCon=${stated} is not 1 (parallel) or 2 (series) — omitted, reads as the calculated default`,
    });
    return undefined;
}

/**
 * `numVC` coil count must be integer 1..4. Outside that, read as 1. 
 * Coercion is a parse event — warning emitted, no dq_calculated on the record.
 */
function wdrNumVCEntry(
    cell: { value: string },
    warnings: DriverError[],
): z.infer<typeof specEntryJsonSchema> {
    const stated = Number(cell.value);
    if (Number.isInteger(stated) && stated >= 1 && stated <= 4) {
        return {
            origin: 'manual',
            readings: {manual: {actual_reading: cell.value, read_value: stated}},
        };
    }
    warnings.push({
        level: 'warn', field: 'numVC',
        message: `numVC=${stated} is not a coil count between 1 and 4 — read as 1`,
    });
    return {
        origin: 'manual',
        readings: {manual: {actual_reading: cell.value, read_value: 1}},
    };
}

export function winISDDriverToOpenISDDeviceJson(wdr: WinISDDriver):
    { record: OpenISDDeviceJson; warnings: DriverError[] } {

    const warnings: DriverError[] = [];
    const named = (text: string | undefined) => text && text.length > 0 ? text : 'n/a';
    const brand = named(wdr.headerField('brand'));
    const model = named(wdr.headerField('model'));
    const manufacturer = named(wdr.headerField('manufacturer'));

    const specEntries: Record<string, z.infer<typeof specEntryJsonSchema>> = {};
    for (const key of INI_ROWS) {
        let entry: z.infer<typeof specEntryJsonSchema> | undefined;
        const cell = wdr.cell(key);
        const numValue = Number(cell.value);

        // C (derived) is always skipped.
        // N (blank) is skipped unless it carries a non-zero value (3rd-party writers have broken parstate).
        // VCCon reads strictly on presence.
        const shouldImport =
            cell.state === 'entered'
            || (cell.state === 'not-available' && isFinite(numValue) && numValue !== 0)
            || key === 'VCCon';

        if (shouldImport) {
            if (key === 'VCCon') {
                entry = wdrVCConEntry(cell, warnings);
            } else if (key === 'numVC') {
                entry = wdrNumVCEntry(cell, warnings);
            } else {
                entry = {
                    origin: 'manual',
                    readings: {manual: {actual_reading: cell.value, read_value: numValue}},
                };
            }
        }

        if (entry !== undefined) {
            specEntries[key] = entry;
        }
    }

    // Optional: present only when the header line is non-blank, so a `.wdr` that never states
    // one produces no field — not an empty string standing in for "unstated"
    // (bugs/BUG_20260903_wdr_reader_drops_providedby_comment_dateadded_on_every_round_trip.md).
    const stated = (text: string | undefined) =>
        text && text.length > 0 ? {value: text} : undefined;
    const providedBy = stated(wdr.headerField('providedBy'));
    const comment = stated(wdr.headerField('comment'));
    const added = stated(wdr.headerField('dateAdded'));

    // A driver-only `.wdr` has no field for OID's `driver_type` — WinISD's format never had one
    // to lose. `[DRIVERTYPE ...]` in `Comment=` is OpenISD's own tag for it (same mechanism as
    // `[DQ]`/`[ENV]`; see
    // bugs/BUG_20260907_driver_type_has_no_wdr_slot_so_every_loaded_driver_becomes_a_woofer.md).
    // A file with no tag — every real WinISD file — falls back to `woofer`, today's behaviour.
    const taggedType = wdr.driverType();
    const driverType: 'woofer' | 'tweeter' = taggedType === 'tweeter' ? 'tweeter' : 'woofer';

    const record: OpenISDDeviceJson = {
        uuid: {value: newUuid()},
        quality: {
            confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
            parse_errors: [], cross_source_only: [],
        },
        manufacturer: {value: manufacturer},
        brand: {value: brand},
        model: {value: model},
        sku: {value: model, grounds: [{origin: 'manual', reading: model}]},
        driver_type: {value: driverType},
        data_sources: {value: {}},
        authoritative: {value: 'openisd'},
        ...(providedBy ? {provided_by: providedBy} : {}),
        ...(comment ? {comment} : {}),
        ...(added ? {added} : {}),
        specs: {[driverType]: specEntries},
    };
    return {record, warnings};
}


/**
 * The spec section of a driver, named through `OpenISDDriver`'s own PUBLIC `spec` property rather
 * than by importing the class behind it — that class is deliberately unexported, and this needs a
 * name for a parameter, not access to anything design keeps private.
 */
export type DriverSpec = OpenISDDriver['spec']['woofer'];

/**
 * Each `.wdr` key paired with the `DriverSpec` field that answers it — `Fs` → `Fs_hz`,
 * `Cms` → `Cms_m_per_N`.
 *
 * WRITTEN OUT, not derived by matching member names at runtime. The name-matching version of this
 * needed `spec` cast to a string-indexed record, which erases the type: a `DriverSpec` member
 * renamed or removed then becomes a field SILENTLY missing from every generated `.wdr`, found only
 * by someone diffing the corpus. Naming both halves makes the compiler check the pairing, so the
 * same rename is a build error here instead.
 *
 * `VCCon` is not here because it is not numeric — it is `Field<VoiceCoilWiring>`, a wiring NAME.
 * `wdrVCCon()` below projects it, and it is MANDATORY in the file (John, 2026-08-31).
 */
export function wdrFields(spec: DriverSpec): ReadonlyArray<readonly [string, FieldHandle<number>]> {
    return [
        ['Qts', spec.Qts], ['Znom', spec.Znom_ohm], ['Fs', spec.Fs_hz], ['Pe', spec.Pe_W],
        ['SPL', spec.SPL_dB], ['Re', spec.Re_ohm], ['Le', spec.Le_H], ['fLe', spec.fLe_hz],
        ['KLe', spec.KLe_H_sqrtHz], ['BL', spec.BL_Tm], ['Xmax', spec.Xmax_m],
        ['Cms', spec.Cms_m_per_N], ['Qms', spec.Qms], ['Qes', spec.Qes], ['Rms', spec.Rms_kg_per_s],
        ['Mms', spec.Mms_kg], ['Sd', spec.Sd_m2], ['Vas', spec.Vas_m3], ['Dia', spec.Dia_m],
        ['Vd', spec.Vd_m3], ['no', spec.no], ['Dd', spec.Dd_m], ['EBP', spec.EBP_hz],
        ['numVC', spec.numVC], ['Hc', spec.Hc_m], ['Hg', spec.Hg_m], ['SPLmax', spec.SPLmax_dB],
        ['SPLmaxLF', spec.SPLmaxLF_dB], ['USPL', spec.USPL_dB], ['alfaVC', spec.alfaVC_per_K],
        ['Rt', spec.Rt_K_per_W], ['Ct', spec.Ct_J_per_K], ['gamma', spec.gamma_m_per_s2_A],
        ['Rme', spec.Rme_kg_per_s], ['Mpow', spec.Mpow_N_per_sqrtW], ['Mcost', spec.Mcost_kg_per_s],
        ['Gloss', spec.Gloss], ['c', spec.c_m_per_s],
        ['roo', spec.roo_kg_per_m3], ['Thick', spec.Thick_m], ['Depth', spec.Depth_m],
        ['MagDepth', spec.MagDepth_m], ['Magnet', spec.Magnet_m], ['Basket', spec.Basket_m],
        ['Outer', spec.Outer_m], ['Vcd', spec.Vcd_m], ['DVol', spec.DVol_m3],
    ];
}

// Shared const objects, the starting values a brand-new box is built from. Values are WinISD's
// own defaults for a freshly-created box (packages/design/winisd/winisdProject.ts TEMPLATE:
// Ql=10, Qa=100, Qp=100, Qiclfr=100, endcorrection=0.6) — not invented numbers.
//
// Each is `Object.freeze`d so no assignment or mutating call on it can compile or run — see
// packages/design/AGENTS.md "Keep module-scoped state immutable". Every use still SPREADS the
// value (`{ ...NO_VENTED_CHAMBER }`) so the object reaching a project record is always a fresh
// copy, never the shared one.
const NO_SEALED_LOSSES: SealedLossesJson = Object.freeze({Ql: 10, Qa: 100});
const NO_VENTED_LOSSES: VentedLossesJson = Object.freeze({Ql: 10, Qa: 100, Qp: 100});
const NO_COUPLED_SEALED_LOSSES: CoupledSealedLossesJson =
    Object.freeze({Ql: 10, Qa: 100, Qicl: 100});
const NO_COUPLED_VENTED_LOSSES: CoupledVentedLossesJson =
    Object.freeze({Ql: 10, Qa: 100, Qp: 100, Qicl: 100});
const NO_VENT: VentJson = Object.freeze({
    shape: 'round',
    diameter_m: null,
    width_m: null,
    height_m: null,
    length_m: null,
    endCorrection_m: 0.6,
});
const NO_VENTED_CHAMBER: ChamberJson =
    Object.freeze({volume_m3: 0, tuning_hz: null, losses: NO_VENTED_LOSSES});
const NO_COUPLED_SEALED_CHAMBER =
    Object.freeze({volume_m3: 0, tuning_hz: null, losses: NO_COUPLED_SEALED_LOSSES});
const NO_COUPLED_VENTED_CHAMBER =
    Object.freeze({volume_m3: 0, tuning_hz: null, losses: NO_COUPLED_VENTED_LOSSES});

/** A box with nothing designed yet — every box type present and inert, matching the
 *  dormant-data rule (the box holds EVERY box type at once and names which is active, rather
 *  than leaving callers to honour that themselves). */
export function emptyBoxJson(): OpenISDBoxJson {
    return {
        boxType: 'sealed',
        sealed: {volume_m3: 0, losses: NO_SEALED_LOSSES},
        vented: {chamber: NO_VENTED_CHAMBER, vent: NO_VENT},
        bandpass4: {rear: NO_COUPLED_SEALED_CHAMBER, front: NO_COUPLED_VENTED_CHAMBER, frontVent: NO_VENT},
        bandpass6: {
            rear: NO_COUPLED_VENTED_CHAMBER,
            front: NO_COUPLED_VENTED_CHAMBER,
            rearVent: NO_VENT,
            frontVent: NO_VENT,
        },
        abc: {
            rear: NO_COUPLED_VENTED_CHAMBER,
            front: NO_COUPLED_VENTED_CHAMBER,
            rearVent: NO_VENT,
            frontVent: NO_VENT,
            intraVent: NO_VENT,
        },
        passiveRadiator: {
            volume_m3: 0,
            tuning_hz: null,
            count: 1,
            addedMass_kg: null,
            losses: NO_SEALED_LOSSES,
            component: null,
        },
    };
}


import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { driverSectionProblems, radiatorSectionProblems } from './openisdTransforms.js';

export const OpenISDDeviceJson = Object.freeze({
    fromOpenisdDriverYml(ymlText: string): { json: OpenISDDeviceJson } | { problems: string[] } {
        let parsed: unknown;
        try {
            parsed = parseYaml(ymlText);
        } catch (e) {
            return {problems: [`not valid YAML: ${e instanceof Error ? e.message : String(e)}`]};
        }
        return OpenISDDeviceJson.fromConformingRecord(OpenISDDeviceJson.stripDriverYmlOnlyFields(parsed));
    },

    toOpenisdDriverYml(json: OpenISDDeviceJson): string {
        return stringifyYaml(json);
    },

    fromConformingRecord(record: unknown): { json: OpenISDDeviceJson } | { problems: string[] } {
        const result = openISDDeviceJsonSchema.safeParse(record);
        if (result.success) return {json: result.data};
        return {
            problems: result.error.issues.map(issue => issue.path.length === 0
                ? issue.message
                : `'${issue.path.join('.')}': ${issue.message}`),
        };
    },

    stripDriverYmlOnlyFields(value: unknown): unknown {
        if (Array.isArray(value)) return value.map(OpenISDDeviceJson.stripDriverYmlOnlyFields);
        if (typeof value !== 'object' || value === null) return value;

        const out: Record<string, unknown> = {};
        for (const [key, v] of Object.entries(value)) {
            if (key === 'definition' || key === 'scraper' || key === 'scraper_meta') continue;
            out[key] = OpenISDDeviceJson.stripDriverYmlOnlyFields(v);
        }
        return out;
    }
});
