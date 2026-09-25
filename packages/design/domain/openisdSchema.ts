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
import {WinISDDriver} from '../winisd/index.js';
import {newUuid} from './newUuid.js';
import type {OpenISDDriver} from './openisdDomain.js';
import type {BoxType, DriverError, Filter, FilterType} from '../engine/index.js';
import type {VentShape} from './vent.js';

/** DQ marks. A function, not a shared object: a module-scoped literal would be state, and each
 *  schema gets its own. Exported so `driverYmlToOpenisdAndWdr.ts`'s `scraperEntrySchema` (D9/D11)
 *  can validate `dq_scraper` against the SAME shape this record stores, rather than a
 *  hand-duplicated copy free to drift. */
export const dqMarks = () => z.strictObject({
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

/** WinISD's own default when a vented box states no port count (`[VentRear] Num`) — one port.
 *  Read-time fallback in the same style as `calcNumVC()`: a record without a count, or with one
 *  that is not a whole number of at least one, READS as this calculated value. */
export function calcVentCount(): number {
    return 1;
}

/** The record's number for a wiring — the other direction of `wiringFromRecord`, stated once so
 *  the entered and calculated entry builders below cannot drift apart. */
export function wiringToRecord(value: VoiceCoilWiring): number {
    return value === VoiceCoilWiring.Series ? 2 : 1;
}

export function enteredWiring(value: VoiceCoilWiring): SpecEntryJson {
    return {state: 'E', value: wiringToRecord(value)};
}

/** The wiring a resolve derived — `calcVCCon()`'s default, stored as a real 'C' entry rather
 *  than conjured at read time (John, 2026-09-24: "simply no reason for these exceptions to the
 *  rule"). Wiring's counterpart to `calculatedEntry`. */
export function calculatedWiring(value: VoiceCoilWiring): SpecEntryJson {
    return {state: 'C', value: wiringToRecord(value)};
}

/** A hand-entered value as a `SpecEntryJson` (T11 — no provenance for a value nothing was read
 *  from: no `origin`, no `readings`, just the number and the 'E' flag). */
export function enteredEntry(value: number): SpecEntryJson {
    return {state: 'E', value};
}

/** A solver-derived value as a `SpecEntryJson` (T11 — the 'C' flag; no `origin`/`readings`,
 *  nothing was read). */
export function calculatedEntry(value: number): SpecEntryJson {
    return {state: 'C', value};
}

/** The ONE legal way to read a spec entry's number: `.value` (T11 — one value, one flag; there
 *  is no second channel to fall back to). Null when the entry itself is absent ('N'). */
export function winningValue(entry: SpecEntryJson | undefined): number | null {
    return entry?.value ?? null;
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
 *  Exported so `driverYmlToOpenisdAndWdr.ts` can validate a scraper's driver.yml readings against
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
    // `_KEY_PRIORITY_LIST` order (`model_driver.py:1509`) — see the note on the record schema below.
    origin: z.string().optional(),
    readings: z.record(z.string(), readingJsonSchema).refine(
        r => Object.keys(r).length > 0, 'expected at least one reading').optional(),
    corroboration: corroborationJsonSchema.optional(),
    dq_scraper: dqMarks(),
    dq_calculated: dqMarks(),
});

/** A calculated spec entry: a `value` plus `state:'C'` and nothing else but its own dq — nothing
 *  was read, so no `origin`/`readings`/`dq_scraper` (only a scraper produces those). */
const calculatedEntrySchema = z.strictObject({
    state: z.literal('C'),
    value: z.number(),
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
 * from the scraper side — is no longer accepted here. `driverYmlToOpenisdAndWdr.ts` builds the
 * `{state:'E', value, origin, corroboration, readings, dq_scraper}` entry itself, choosing the
 * origin and computing corroboration on this side (`sourceRank.ts`, `corroboration.ts`), before
 * this schema ever parses it — so a bare scraper shape reaching this union IS a parse error, not
 * a shape to be silently upgraded.
 */
export const specEntryJsonSchema = z.discriminatedUnion('state', [enteredEntrySchema, calculatedEntrySchema]);
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
 *  (`domain.test.ts` "names EVERY bad reading"). The key that is present says which member the
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
const openISDEnvironmentJsonSchema = z.strictObject({
    temperature_K: specEntryJsonSchema.optional(),
    humidity_pct: specEntryJsonSchema.optional(),
    pressure_Pa: specEntryJsonSchema.optional(),
    // Null reads as true (QO95): a new project matches WinISD's own air model out of the box.
    useWinisdAirModel: z.boolean().nullable(),
});
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
    // Sealed-box resonance loss model (S10/QO130): which physics model box.sealed's Fsc/Qtc
    // readout uses. PROJECT-scoped, not a UI singleton (QO130) — two open projects must not
    // share one loss mode. Wire values mirror `LossMode.ALL`; `OpenISDProject.lossMode`
    // translates via `LossMode.parse`/`.value` at this boundary. Optional: absent parses to
    // `LossMode.Default` (winisd-lossy), matching every project saved before S10.
    lossMode: z.enum(['lossless', 'conventional-lossy', 'winisd-lossy']).optional(),
});
export type OpenISDAdvancedJson = z.infer<typeof openISDAdvancedJsonSchema>;


/** The chart panels' own project-scoped view state: which charts are open. `N` (sweep point
 *  count) absent means the engine's own default (`sweep.ts`: 400 points). `graphs` (which
 *  charts are open) is PROJECT-scoped per S10/QO130 (reverses QO90 for this); optional, absent
 *  meaning a project saved before S10. The cursor/selection (crosshair, pinned frequency,
 *  drag-band) is ALSO project-scoped per QO130, but John 2026-09-20/21 ruled those four
 *  fast-changing values (they write on every mousemove) out of the saved record entirely —
 *  `OpenISDProject` holds them as plain in-memory instance state, never in this schema; see
 *  `OpenISDProject.cursorF` etc. */
const openISDChartsJsonSchema = z.strictObject({
    N: z.number().optional(),
    graphs: z.array(z.string()).optional(),
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
 * states a wiring — 520 of the 524 corpus files (`drivers/mysamples/PARSTATE-FINDINGS.md`). Reading
 * this row on its mark, as every other row is read, loses every series wiring in the corpus.
 *
 * `1` and `2` are the whole encoding. Anything else is read as `1`, parallel, with the number the
 * file carried kept as `actual_reading`. A warning is pushed — NOT a `dq_calculated` mark on the
 * record; coercion is a parse event and the record stays clean.
 */
function wdrVCConEntry(
    cell: { value: string },
    warnings: DriverError[],
): SpecEntryJson | undefined {
    const raw = cell.value.trim();
    if (raw.length === 0) return undefined;
    const stated = Number(raw);
    if (!isFinite(stated)) return undefined;

    if (stated === 1 || stated === 2) {
        return {
            state: 'E', value: stated,
            origin: 'manual',
            readings: {manual: {actual_reading: raw, read_value: stated}},
        };
    }
    // Out of range for the two-position dropdown WinISD's own UI offers (1 parallel, 2 series)
    // — not a value a human could have entered, so it is omitted rather than coerced into an
    // entered fact. The slot then reads as absence, which the driver's own `resolve()` fills
    // with `calcVCCon()`'s default as a 'C' entry, the same way an absent key is filled (John,
    // 2026-09-05: "when reading back a zero or absent then it should recorded as C in openisd
    // and the default calculated 1 comes thru").
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
): SpecEntryJson {
    const stated = Number(cell.value);
    if (Number.isInteger(stated) && stated >= 1 && stated <= 4) {
        return {
            state: 'E', value: stated,
            origin: 'manual',
            readings: {manual: {actual_reading: cell.value, read_value: stated}},
        };
    }
    warnings.push({
        level: 'warn', field: 'numVC',
        message: `numVC=${stated} is not a coil count between 1 and 4 — read as 1`,
    });
    return {
        state: 'E', value: 1,
        origin: 'manual',
        readings: {manual: {actual_reading: cell.value, read_value: 1}},
    };
}

/** Read the `.wdr` row `wdrKey` into the record's spec entries, under `schemaKey`. C (derived) is
 *  always skipped; N (blank) is skipped unless it carries a non-zero value (3rd-party writers
 *  have broken parstate); VCCon reads strictly on presence. */
function readSpecEntryInto(
    entries: Record<string, SpecEntryJson>,
    wdr: WinISDDriver,
    schemaKey: keyof DriverSpecsSection,
    wdrKey: string,
    warnings: DriverError[],
): void {
    const cell = wdr.cell(wdrKey);
    const numValue = Number(cell.value);
    const shouldImport =
        cell.state === 'entered'
        || (cell.state === 'not-available' && isFinite(numValue) && numValue !== 0)
        || wdrKey === 'VCCon';
    if (!shouldImport) return;
    if (wdrKey === 'VCCon') {
        const entry = wdrVCConEntry(cell, warnings);
        if (entry) entries[schemaKey] = entry;
    } else if (wdrKey === 'numVC') {
        entries[schemaKey] = wdrNumVCEntry(cell, warnings);
    } else {
        entries[schemaKey] = {
            state: 'E', value: numValue,
            origin: 'manual',
            readings: {manual: {actual_reading: cell.value, read_value: numValue}},
        };
    }
}

export function winISDDriverToOpenISDDeviceJson(wdr: WinISDDriver):
    { record: OpenISDDeviceJson; warnings: DriverError[] } {

    const warnings: DriverError[] = [];
    const named = (text: string | undefined) => text && text.length > 0 ? text : 'n/a';
    const brand = named(wdr.headerField('brand'));
    const model = named(wdr.headerField('model'));
    const manufacturer = named(wdr.headerField('manufacturer'));

    const specEntries: Record<string, z.infer<typeof specEntryJsonSchema>> = {};
    // THE FIXED 48-ROW STRUCTURE, each row read explicitly into its schema key — no row list, no
    // key map: the calls below ARE the rows, and each names the schema entry it is stored under
    // and the `.wdr` row it is read from.
    readSpecEntryInto(specEntries, wdr, 'Qts', 'Qts', warnings);
    readSpecEntryInto(specEntries, wdr, 'Znom_ohm', 'Znom', warnings);
    readSpecEntryInto(specEntries, wdr, 'Fs_hz', 'Fs', warnings);
    readSpecEntryInto(specEntries, wdr, 'Pe_W', 'Pe', warnings);
    readSpecEntryInto(specEntries, wdr, 'SPL_dB', 'SPL', warnings);
    readSpecEntryInto(specEntries, wdr, 'Re_ohm', 'Re', warnings);
    readSpecEntryInto(specEntries, wdr, 'Le_H', 'Le', warnings);
    readSpecEntryInto(specEntries, wdr, 'fLe_hz', 'fLe', warnings);
    readSpecEntryInto(specEntries, wdr, 'KLe_H_sqrtHz', 'KLe', warnings);
    readSpecEntryInto(specEntries, wdr, 'BL_Tm', 'BL', warnings);
    readSpecEntryInto(specEntries, wdr, 'Xmax_m', 'Xmax', warnings);
    readSpecEntryInto(specEntries, wdr, 'Cms_m_per_N', 'Cms', warnings);
    readSpecEntryInto(specEntries, wdr, 'Qms', 'Qms', warnings);
    readSpecEntryInto(specEntries, wdr, 'Qes', 'Qes', warnings);
    readSpecEntryInto(specEntries, wdr, 'Rms_kg_per_s', 'Rms', warnings);
    readSpecEntryInto(specEntries, wdr, 'Mms_kg', 'Mms', warnings);
    readSpecEntryInto(specEntries, wdr, 'Sd_m2', 'Sd', warnings);
    readSpecEntryInto(specEntries, wdr, 'Vas_m3', 'Vas', warnings);
    readSpecEntryInto(specEntries, wdr, 'Dia_m', 'Dia', warnings);
    readSpecEntryInto(specEntries, wdr, 'Vd_m3', 'Vd', warnings);
    readSpecEntryInto(specEntries, wdr, 'no', 'no', warnings);
    readSpecEntryInto(specEntries, wdr, 'Dd_m', 'Dd', warnings);
    readSpecEntryInto(specEntries, wdr, 'EBP_hz', 'EBP', warnings);
    readSpecEntryInto(specEntries, wdr, 'numVC', 'numVC', warnings);
    readSpecEntryInto(specEntries, wdr, 'Hc_m', 'Hc', warnings);
    readSpecEntryInto(specEntries, wdr, 'Hg_m', 'Hg', warnings);
    readSpecEntryInto(specEntries, wdr, 'SPLmax_dB', 'SPLmax', warnings);
    readSpecEntryInto(specEntries, wdr, 'SPLmaxLF_dB', 'SPLmaxLF', warnings);
    readSpecEntryInto(specEntries, wdr, 'USPL_dB', 'USPL', warnings);
    readSpecEntryInto(specEntries, wdr, 'alfaVC_per_K', 'alfaVC', warnings);
    readSpecEntryInto(specEntries, wdr, 'Rt_K_per_W', 'Rt', warnings);
    readSpecEntryInto(specEntries, wdr, 'Ct_J_per_K', 'Ct', warnings);
    readSpecEntryInto(specEntries, wdr, 'gamma_m_per_s2_A', 'gamma', warnings);
    readSpecEntryInto(specEntries, wdr, 'Rme_kg_per_s', 'Rme', warnings);
    readSpecEntryInto(specEntries, wdr, 'Mpow_N_per_sqrtW', 'Mpow', warnings);
    readSpecEntryInto(specEntries, wdr, 'Mcost_kg_per_s', 'Mcost', warnings);
    readSpecEntryInto(specEntries, wdr, 'Gloss', 'Gloss', warnings);
    readSpecEntryInto(specEntries, wdr, 'VCCon', 'VCCon', warnings);
    readSpecEntryInto(specEntries, wdr, 'c_m_per_s', 'c', warnings);
    readSpecEntryInto(specEntries, wdr, 'roo_kg_per_m3', 'roo', warnings);
    readSpecEntryInto(specEntries, wdr, 'Thick_m', 'Thick', warnings);
    readSpecEntryInto(specEntries, wdr, 'Depth_m', 'Depth', warnings);
    readSpecEntryInto(specEntries, wdr, 'MagDepth_m', 'MagDepth', warnings);
    readSpecEntryInto(specEntries, wdr, 'Magnet_m', 'Magnet', warnings);
    readSpecEntryInto(specEntries, wdr, 'Basket_m', 'Basket', warnings);
    readSpecEntryInto(specEntries, wdr, 'Outer_m', 'Outer', warnings);
    readSpecEntryInto(specEntries, wdr, 'Vcd_m', 'Vcd', warnings);
    readSpecEntryInto(specEntries, wdr, 'DVol_m3', 'DVol', warnings);

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
        driver_type: {value: 'woofer'},
        data_sources: {value: {}},
        authoritative: {value: 'openisd'},
        ...(providedBy ? {provided_by: providedBy} : {}),
        ...(comment ? {comment} : {}),
        ...(added ? {added} : {}),
        specs: {woofer: specEntries},
    };
    return {record, warnings};
}


/**
 * The spec section of a driver, named through `OpenISDDriver`'s own PUBLIC `spec` property rather
 * than by importing the class behind it — that class is deliberately unexported, and this needs a
 * name for a parameter, not access to anything design keeps private.
 */
export type DriverSpec = OpenISDDriver['specs'];


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
    width_m: null,
    // Absent, not null (S7-a): a `SpecEntryJson` slot's "not-available" is the key missing.
    // WinISD's default port end correction: TWO FREE ENDS (0.613). The earlier 0.6 matched none
    // of the UI's END_CORRECTION_OPTIONS, so the select rendered blank (BUG_20260912 #10).
    endCorrection_m: 0.613,
});
const NO_VENTED_CHAMBER: ChamberJson =
    Object.freeze({volume_m3: 0, losses: NO_VENTED_LOSSES});
const NO_COUPLED_SEALED_CHAMBER =
    Object.freeze({volume_m3: 0, losses: NO_COUPLED_SEALED_LOSSES});
const NO_COUPLED_VENTED_CHAMBER =
    Object.freeze({volume_m3: 0, losses: NO_COUPLED_VENTED_LOSSES});

/** A box with nothing designed yet — every box type present and inert, matching the
 *  dormant-data rule (the box holds EVERY box type at once and names which is active, rather
 *  than leaving callers to honour that themselves). */
export function emptyBoxJson(radiator: RadiatorDeviceJson): OpenISDBoxJson {
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
            // tuning_goal_hz/addedMass_kg absent, not null (S7-a): a `SpecEntryJson` slot's
            // "not-available" is the key missing.
            count: 1,
            losses: NO_SEALED_LOSSES,
            component: radiator,
        },
    };
}


/** The keys `driver.yml` carries that an openisd record does not. `definition` sits at EVERY
 *  depth — on each metadata envelope, each `sku.grounds` entry and each spec entry — so removing
 *  them is a walk, not a top-level filter. */
const DRIVER_YML_ONLY_KEYS: readonly string[] = Object.freeze(['definition', 'scraper', 'scraper_meta']);

/**
 * The same value with every `driver.yml`-only key removed, at any depth.
 *
 *  `unknown` IN AND OUT IS APPROVED HERE, AND ONLY BECAUSE THIS FUNCTION IS PRIVATE (John,
 *  2026-09-09). It runs between the YAML parse and the strict schema, where the value genuinely
 *  has no type yet: the strip must happen first, because `z.strictObject` REFUSES an undeclared
 *  key rather than dropping it, and zod 4's loose mode passes unknown keys through instead of
 *  removing them. Because the function is not exported and `fromDriverYmlRecord` is the only way
 *  to reach it, no caller ever holds the untyped value — they get a validated
 *  `OpenISDDeviceJson`. Export this and the approval no longer holds.
 *
 *  Rebuilt rather than deleted from: the parsed object is the caller's own reference and must not
 *  be mutated by the thing reading it. A clone of the structure with only `DRIVER_YML_ONLY_KEYS`
 *  pruned — `specs` keys pass through untouched, because `driver.yml` already spells them the
 *  openisd way (`Fs_hz`, `Vas_m3`, …), so no canonicalisation belongs here.
 */
function stripDriverYmlOnlyFields(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripDriverYmlOnlyFields);
    if (typeof value !== 'object' || value === null) return value;

    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
        if (DRIVER_YML_ONLY_KEYS.includes(key)) continue;
        out[key] = stripDriverYmlOnlyFields(v);
    }
    return out;
}

function freshDriverRecord(value: unknown): unknown {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
    return { ...value, uuid: { value: newUuid() } };
}

export function sortKeysDeep(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeysDeep);
    if (typeof value !== 'object' || value === null) return value;

    // Two ascending arms only: `Object.entries` never yields two entries sharing one key within
    // the same object, so `a === b` cannot occur here — there is no third, equal, outcome to
    // return 0 for.
    return Object.fromEntries(
        Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([k, v]) => [k, sortKeysDeep(v)]),
    );
}

export const OpenISDDeviceJson = Object.freeze({
    fromOpenisdDriverJson(jsonText: string): { json: OpenISDDeviceJson } | { problems: string[] } {
        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonText);
        } catch (e) {
            return {problems: [`not valid JSON: ${String(e)}`]};
        }
        return OpenISDDeviceJson.fromDriverYmlRecord(parsed);
    },

    toOpenisdDriverJson(json: OpenISDDeviceJson): string {
        const { uuid, ...withoutUuid } = json;
        void uuid;
        return JSON.stringify(sortKeysDeep(withoutUuid), null, 2);
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

    /** A `driver.yml` record as an openisd one: drop the keys `driver.yml` carries and an openisd
     *  record does not, then validate what is left against the strict schema.
     *
     *  STRIP FIRST, THEN STRICT. The two cannot be one step: `z.strictObject` REFUSES an
     *  undeclared key rather than dropping it, so `scraper_meta`/`scraper`/`definition` have to be
     *  gone before the schema sees the record. Loosening the schema to strip them instead is not
     *  the alternative it looks like — zod 4's loose mode PASSES unknown keys through rather than
     *  removing them. */
    fromDriverYmlRecord(value: unknown): { json: OpenISDDeviceJson } | { problems: string[] } {
        return OpenISDDeviceJson.fromConformingRecord(freshDriverRecord(stripDriverYmlOnlyFields(value)));
    }
});
