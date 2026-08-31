// ═══ HUMAN RULING, John Lonergan 2026-08-26 — WHAT THIS DOMAIN MAY COMPUTE ═══════════════════
//
//   GEOMETRY IS IN. ACOUSTICS IS ABSOLUTELY OUT.
//
// His words: "all calcs MUST be in engine", then the refinement "simple geometric calc like pi r
// squared are ok in the domain", then "geom is in and accoustic is absolutely out".
//
// IN — plain shape arithmetic on dimensions the record already holds. The area of a circle, the
// area of a rectangle, a volume from three lengths. These have no model behind them and no parity
// question: πr² is πr² in WinISD, in this app, and in a textbook. Nobody can implement them
// differently, so nothing is duplicated by doing them here.
//
// OUT — ABSOLUTELY, with no exception and no "just this small one": anything involving air,
// compliance, resonance, damping, an end correction, a transfer function, or a frequency. Those
// carry a MODEL, the model can differ between implementations, and `@openisd/engine` is the one
// place this project answers for it. A second implementation here would be a second answer, and
// the two would drift silently — which is exactly what was found on 2026-08-26: `#sealedResonance`
// reimplemented `engine/boxDesign.ts:sealedFc()` over frozen air constants, in the precise way
// `engine/formulas.ts:prVas()` documents as wrong ("ρ/c are computed live at the reference
// environment — never a stored constant").
//
// THE TEST, when unsure: could two competent implementers disagree about the answer? If yes it is
// acoustics — it belongs to the engine, and this domain asks the INJECTED engine for it. If no,
// it is geometry and may be computed here (`Vent.area_m2()` is the whole of that category).
// Do not reason your way past this. John's stated fear is precisely that an AI will not respect
// the rule; the honest move when a calculation feels borderline is to throw and ask, never to
// write the formula and justify it in a comment.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import {
  Field,
  focus,
  nullableField,
  requiredField,
  type FieldHandle,
  type Lens,
  type RawField,
} from './cell.js';
import { newUuid } from './newUuid.js';
import { Engine, LossMode } from '../engine/index.js';
import type {
  Air, BoxType, SimulatableBoxType, ConsistencyIssue, DriverError,
  MaxCurvesResult, Result, SweepParams, SweepResult,
} from '../engine/index.js';
import { EngineQuantities } from '../engine/index.js';

import type { Vent, VentShape } from './vent.js';
import type {
  SealedLosses,
  VentedLosses,
  CoupledSealedLosses,
  CoupledVentedLosses,
} from './losses.js';

// EVERYTHING the domain owns is declared in this ONE file, on purpose.
//
// 1. THE RECORD SHAPES ARE PRIVATE. `OpenISDDriverJson`, `OpenISDBoxJson` and
//    `OpenISDProjectJson` are declared here WITHOUT `export` — not "exported but left out of the
//    barrel", which is a weaker thing that still lets any file in this package name them.
//    Nothing outside this module can name them at all, so `driver.json.brand.value` is not
//    reachable, full stop. That is what forces colocation: `OpenISDBoxJson.passiveRadiator
//    .component` IS an `OpenISDDriverJson` (a passive radiator is a driver record), so the box's
//    storage and the driver's storage have to see the same private declaration — they cannot
//    live in separate modules without exporting something.
//
// 2. `ManagedProject` needs to be told when the EFFECTIVE `OpenISDProject` (whichever of
//    ground/committed/edit/whatif is active) changes internally, so it can fire ITS OWN public
//    `subscribe()` listeners. TypeScript `protected` CANNOT do this — confirmed by the compiler:
//    `protected` only reaches SUBCLASSES, and `ManagedProject` COMPOSES four independent
//    `OpenISDProject` instances rather than extending one. The module-scoped
//    `notifyProject()`/`subscribeToProject()` WeakMap bridge below is the real mechanism, and
//    being module-scoped is exactly what keeps it out of everyone else's reach.
//
// The cost is one long file. The alternative — a shared module of record types — means exporting
// the internal shape, which is the thing this design exists to prevent.

// ---------------------------------------------------------------------------------------------
// THE STORED RECORD — private to this module.
// ---------------------------------------------------------------------------------------------

/** One data-quality mark. `kind` says who found it and how: `calc` and `range` are computed,
 *  `corroboration` is the scraper's cross-source verdict. Shape follows the corpus. */
interface DqMark {
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
interface Reading {
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
interface SpecEntry {
  readonly origin: string;
  readonly readings: Readonly<Record<string, Reading>>;
  /** The scraper's cross-source verdict: MATCH, MISMATCH, NOT_MATCHABLE, UNMATCHED. */
  readonly corroboration?: string;
  readonly definition?: string;
  readonly dq_scraper?: readonly DqMark[];
  readonly dq_calculated?: readonly DqMark[];
}

/**
 * One RECORD-LEVEL field — brand, model, driver_type and the rest.
 *
 * A different envelope from `SpecEntry`, because it answers a different question. These come
 * from ONE source and are not contested, so there is nothing to keep alternatives for and the
 * value sits directly on the field. The corpus bears that out: no metadata field anywhere
 * carries a `readings` map.
 */
interface ScrapedField<T> {
  readonly value: T;
  readonly origin?: string;
  readonly definition?: string;
  readonly dq_scraper?: readonly DqMark[];
  readonly dq_calculated?: readonly DqMark[];
}

/** `sku`'s envelope — a derived identity, with the readings it was derived FROM. A third shape
 *  because the corpus has three; mirroring means declaring what is there. */
interface DerivedField<T> {
  readonly value: T;
  readonly definition?: string;
  readonly grounds?: readonly { origin: string; reading: string; definition?: string }[];
}

/** The parameters a driver states, in one section.
 *  Not just TS parameters, but any parameter we collect off the datasheets.
 *
 *  EVERY FIELD IS OPTIONAL — a key is ABSENT when the driver does not state that parameter, not
 *  present holding a null or a zero. That is what a scraped record actually looks like: a
 *  datasheet giving four parameters produces four keys. `Cell` already reports `value: null` for
 *  a key that is not there, so a reader sees absence the same way whichever field is missing.
 *
 *  Populates as `woofer: <SpecSection>` and/or `tweeted: <SpecSection>` in OpenIsdDriver.
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
/**
 * The record's own name for a quantity — WinISD's (`Fs`, `Re`, `Cms`), which is what a stored
 * `openisd.yml` and a `.wdr` both carry. The engine's public name adds the unit (`Fs_hz`,
 * `Re_ohm`, `Cms_m_per_N`), because a caller reading a raw number is the one who can get the unit
 * wrong. This is the one crossing between the two.
 *
 * A `switch`, not a lookup table: `packages/design/AGENTS.md` permits an enumeration reached by
 * name and bans a module-level object indexed by a runtime key. It also fails LOUDLY — add a
 * quantity to `EngineQuantities` and this stops compiling, naming the case it lacks, where a
 * hand-written list of assignments would silently read `undefined` forever.
 *
 * `null` means the record has no such field, so nothing can be read for it.
 */
function recordName(q: keyof EngineQuantities): keyof SpecSection | null {
  switch (q) {
    case 'Fs_hz':            return 'Fs';
    case 'Re_ohm':           return 'Re';
    case 'Znom_ohm':         return 'Znom';
    case 'Qes':              return 'Qes';
    case 'Qms':              return 'Qms';
    case 'Qts':              return 'Qts';
    case 'Vas_m3':           return 'Vas';
    case 'Sd_m2':            return 'Sd';
    case 'Dd_m':             return 'Dd';
    case 'BL_Tm':            return 'BL';
    case 'Mms_kg':           return 'Mms';
    case 'Cms_m_per_N':      return 'Cms';
    case 'Rms_kg_per_s':     return 'Rms';
    case 'EBP_hz':           return 'EBP';
    case 'Xmax_m':           return 'Xmax';
    case 'Vd_m3':            return 'Vd';
    case 'Hc_m':             return 'Hc';
    case 'Hg_m':             return 'Hg';
    case 'Pe_W':             return 'Pe';
    case 'no':               return 'no';
    // The ONE quantity with no record name: `SPLref` is the reference sensitivity the solver
    // derives from eta-zero. No datasheet prints it and `SpecSection` has no member for it, so it
    // can only ever be CALCULATED — there is nothing for `fields()` to read.
    case 'SPLref_dB':        return null;
    case 'SPL_dB':           return 'SPL';
    case 'USPL_dB':          return 'USPL';
    case 'SPLmax_dB':        return 'SPLmax';
    case 'SPLmaxLF_dB':      return 'SPLmaxLF';
    case 'Rme_kg_per_s':     return 'Rme';
    case 'Mpow_N_per_sqrtW': return 'Mpow';
    case 'Mcost_kg_per_s':   return 'Mcost';
    case 'gamma_m_per_s2_A': return 'gamma';
    case 'Gloss':            return 'Gloss';
    case 'Vcd_m':            return 'Vcd';
    case 'Depth_m':          return 'Depth';
    case 'MagDepth_m':       return 'MagDepth';
    case 'Magnet_m':         return 'Magnet';
    case 'DVol_m3':          return 'DVol';
    case 'c_m_per_s':        return 'c';
    case 'roo_kg_per_m3':    return 'roo';
  }
  // Exhaustiveness. Without it a new quantity gives only "function lacks ending return
  // statement", which does not say WHICH; assigning to `never` makes the error name it.
  const unhandled: never = q;
  return unhandled;
}

interface SpecSection {
  // Thiele/Small.
  readonly Fs?: SpecEntry;
  readonly Re?: SpecEntry;
  readonly Le?: SpecEntry;
  readonly fLe?: SpecEntry;
  readonly KLe?: SpecEntry;
  readonly Znom?: SpecEntry;
  readonly Qts?: SpecEntry;
  readonly Qes?: SpecEntry;
  readonly Qms?: SpecEntry;
  readonly Vas?: SpecEntry;
  readonly Sd?: SpecEntry;
  readonly BL?: SpecEntry;
  readonly Mms?: SpecEntry;
  readonly Cms?: SpecEntry;
  readonly Rms?: SpecEntry;
  readonly Xmax?: SpecEntry;
  readonly Xlim?: SpecEntry;
  readonly SPL?: SpecEntry;
  readonly Pe?: SpecEntry;
  readonly Dd?: SpecEntry;
  readonly EBP?: SpecEntry;
  readonly numVC?: SpecEntry;
  readonly VCCon?: SpecEntry;
  // Ordinarily derived, but WinISD lets a human TYPE any of them, and an entered value is a fact.
  readonly Dia?: SpecEntry;
  readonly Vd?: SpecEntry;
  readonly no?: SpecEntry;
  readonly SPLmax?: SpecEntry;
  readonly SPLmaxLF?: SpecEntry;
  readonly USPL?: SpecEntry;
  readonly alfaVC?: SpecEntry;
  readonly Rt?: SpecEntry;
  readonly Ct?: SpecEntry;
  readonly gamma?: SpecEntry;
  readonly Rme?: SpecEntry;
  readonly Mpow?: SpecEntry;
  readonly Mcost?: SpecEntry;
  readonly Gloss?: SpecEntry;
  // `c` and `roo` are the air the DRIVER states — the conditions its own figures were measured
  // or computed at. `OpenISDEnvironment` on the project is what a simulation runs on; these two
  // are not that, and the record keeps them per driver because WinISD does.
  readonly c?: SpecEntry;
  readonly roo?: SpecEntry;
  // Descriptive and dimensional.
  readonly Vcd?: SpecEntry;
  readonly Hg?: SpecEntry;
  readonly Hc?: SpecEntry;
  readonly freq_low_hz?: SpecEntry;
  readonly freq_high_hz?: SpecEntry;
  readonly power_peak_W?: SpecEntry;
  readonly weight_kg?: SpecEntry;
  readonly Thick?: SpecEntry;
  readonly Depth?: SpecEntry;
  readonly MagDepth?: SpecEntry;
  readonly Magnet?: SpecEntry;
  readonly Basket?: SpecEntry;
  readonly Outer?: SpecEntry;
  readonly OuterX?: SpecEntry;
  readonly OuterY?: SpecEntry;
  readonly DVol?: SpecEntry;
}

type MetaFieldName =
  'brand' | 'model' | 'manufacturer' | 'provided_by' | 'comment' | 'added';
/** Every numeric key of `SpecSection`, derived FROM it rather than listed again — a hand-kept
 *  second list would drift, and a field added above with no accessor is caught by the compiler
 *  instead of being silently unreachable. */
/** `VCCon` as the CORPUS stores it, and back.
 *
 *  The record holds a NUMBER — `1 = parallel, 2 = series`, which is the record's own definition
 *  text and WinISD's encoding. The API holds a NAME, because a caller writing `2` cannot be
 *  checked and a caller writing `VoiceCoilWiring.Series` can. Both directions live here, next to
 *  each other, so the encoding is stated once rather than assumed at each end.
 *
 *  A number the encoding does not define reads as absence: an unknown wiring is not a wiring. */
function wiringFromRecord(value: number | null): VoiceCoilWiring | null {
  if (value === 1) return VoiceCoilWiring.Parallel;
  if (value === 2) return VoiceCoilWiring.Series;
  return null;
}

function enteredWiring(value: VoiceCoilWiring): SpecEntry {
  return {
    origin: 'entered',
    readings: { entered: { read_value: value === VoiceCoilWiring.Series ? 2 : 1 } },
  };
}

/** A hand-entered value as a `SpecEntry`.
 *
 *  ONE reading, under the `entered` role, carrying the number alone: there was no printed
 *  literal to echo and nothing stated a precision, so writing `actual_reading` or
 *  `read_precision` would fabricate provenance. One entry shape for scraped and typed values —
 *  not a second envelope for hand entry. */
function enteredEntry(value: number): SpecEntry {
  return { origin: 'entered', readings: { entered: { read_value: value } } };
}

/** The ONE legal way to read a spec entry's number: the reading `origin` names.
 *
 *  Null when the entry names an origin it has no reading for — a broken record, reported as
 *  absence rather than guessed at from some other source's reading. */
function winningValue(entry: SpecEntry | undefined): number | null {
  if (!entry) return null;
  const reading = entry.readings?.[entry.origin];
  return typeof reading?.read_value === 'number' ? reading.read_value : null;
}

type SpecFieldName = {
  [K in keyof SpecSection]-?: SpecSection[K] extends SpecEntry | undefined ? K : never;
}[keyof SpecSection];

/** The passive-radiator section — A DIFFERENT SCHEMA from a driver's, not a narrowed `SpecSection`
 *  (John 2026-08-27: "the passive rad has only a few exposed fields not same as driver as no
 *  electrical", "different schema"). A radiator has no motor and no voice coil, so `Re`, `Le`,
 *  `Znom`, `Qes`, `BL`, `numVC` and the thermal parameters describe nothing on one. Typing it as
 *  `SpecSection` would publish every one of them as a readable field. */
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

interface PassiveRadiatorSection {
  readonly Fs?: SpecEntry;
  readonly Qms?: SpecEntry;
  readonly Cms?: SpecEntry;
  readonly Mms?: SpecEntry;
  readonly Rms?: SpecEntry;
  readonly Sd?: SpecEntry;
  readonly Vas?: SpecEntry;
  readonly Vd?: SpecEntry;
  readonly Xmax?: SpecEntry;
  readonly Xlim?: SpecEntry;
  readonly Dia?: SpecEntry;
  readonly Dd?: SpecEntry;
  readonly DVol?: SpecEntry;
  // Mounting dimensions — a radiator sits on a baffle exactly as a driver does (John 2026-08-27).
  readonly Thick?: SpecEntry;
  readonly Depth?: SpecEntry;
  readonly Basket?: SpecEntry;
  readonly Outer?: SpecEntry;
  readonly OuterX?: SpecEntry;
  readonly OuterY?: SpecEntry;
  readonly weight_kg?: SpecEntry;
}

type PassiveRadiatorFieldName = keyof PassiveRadiatorSection;

/** The sections a record can carry, under `specs` (John 2026-08-30: "sections must sit under
 *  specs"). A record states the ONE its driver_type calls for; the others are absent. */
interface SpecsJson {
  readonly woofer?: SpecSection;
  readonly tweeter?: SpecSection;
  readonly 'passive-radiator'?: PassiveRadiatorSection;
}

interface OpenISDDriverJson {
  readonly brand: ScrapedField<string>;
  readonly model: ScrapedField<string>;
  readonly manufacturer: ScrapedField<string>;
  readonly provided_by: ScrapedField<string>;
  readonly comment: ScrapedField<string>;
  readonly added: ScrapedField<string>;
  readonly specs: SpecsJson;
}

/** One port's stored geometry. `diameter_m` applies to a round vent, `width_m`/`height_m` to a
 *  slotted one — which pair is meaningful follows `shape`, and the other stays null rather than
 *  carrying a stale number from a shape the user has since switched away from. */
interface VentJson {
  readonly shape: VentShape;
  readonly diameter_m: number | null;
  readonly width_m: number | null;
  readonly height_m: number | null;
  readonly length_m: number | null;
  readonly endCorrection_m: number;
}

/** Every loss factor a chamber COULD carry. Which ones are actually surfaced is decided by the
 *  `*Losses` interface the owning chamber exposes (`SealedLosses` has no `Qp`, and so on —
 *  BUG_20260824's live-confirmed per-chamber shapes), not by presence/absence here: storing a
 *  field the API never surfaces is inert, whereas an optional field would make every reader
 *  handle an absence the box type has already ruled out. */
interface LossesJson {
  readonly Ql: number;
  readonly Qa: number;
  readonly Qp: number;
  readonly Qicl: number;
}

interface ChamberJson {
  readonly volume_m3: number;
  readonly tuning_hz: number | null;
  readonly losses: LossesJson;
}

interface OpenISDBoxJson {
  readonly boxType: BoxType;
  readonly sealed: { readonly volume_m3: number; readonly losses: LossesJson };
  readonly vented: { readonly chamber: ChamberJson; readonly vent: VentJson };
  readonly bandpass4: {
    readonly rear: ChamberJson;
    readonly front: ChamberJson;
    readonly frontVent: VentJson;
  };
  readonly bandpass6: {
    readonly rear: ChamberJson;
    readonly front: ChamberJson;
    readonly rearVent: VentJson;
    readonly frontVent: VentJson;
  };
  readonly abc: {
    readonly rear: ChamberJson;
    readonly front: ChamberJson;
    readonly rearVent: VentJson;
    readonly frontVent: VentJson;
    readonly intraVent: VentJson;
  };
  readonly passiveRadiator: {
    readonly volume_m3: number;
    readonly tuning_hz: number | null;
    readonly count: number;
    readonly addedMass_kg: number | null;
    readonly losses: LossesJson;
    /** The chosen PR, stored as a full driver record (a PR IS a purchasable component, same as
     *  a driver) — null until `configurePR()` picks one. */
    readonly component: OpenISDDriverJson | null;
  };
}

/** The air the design sits in, as the USER stated it. Null where the user has stated nothing —
 *  the domain does not invent air conditions, because reference air belongs to
 *  `@openisd/engine` (`air.ts`'s `T_REF_K`/`RH_REF_PCT`/`P_REF_PA`) and a second copy here would
 *  drift from it silently. */
interface OpenISDEnvironmentJson {
  readonly temperature_K: number | null;
  readonly humidity_pct: number | null;
  readonly pressure_Pa: number | null;
}

/** What drives the system, as the USER stated it. Null where nothing is stated — 1 W is a
 *  measurement convention, not a fact about this design, so the domain does not assert it. */
interface OpenISDSignalJson {
  readonly power_W: number | null;
  readonly voltage_V: number | null;
}

interface OpenISDProjectMetaJson {
  readonly name: string;
  readonly comment: string;
}

interface OpenISDProjectJson {
  readonly driver: OpenISDDriverJson;
  readonly box: OpenISDBoxJson;
  readonly environment: OpenISDEnvironmentJson;
  readonly signal: OpenISDSignalJson;
  readonly meta: OpenISDProjectMetaJson;
}

// APPROVED GLOBALS — the only three in this package (John Lonergan, 2026-08-27; recorded in
// packages/design/AGENTS.md, and named in the allowlist of test/architecture-no-globals.test.ts).
//
// Three shared const objects, used as the starting values a brand-new box is built from.
//
// WHY THE GATE FLAGS THEM ANYWAY: `const` freezes the binding, never the contents. Nothing stops
// code writing `NO_LOSSES.Ql = 3`, and every project built afterwards would carry the change.
// `NO_CHAMBER` embeds `NO_LOSSES`, so a single mutation reaches both.
//
// WHAT KEEPS THEM SAFE: every use is a SPREAD — `{ ...NO_CHAMBER }` — so the constant supplies
// values and the record that ends up in a project is always a fresh object. A use that assigned
// one of these directly, without spreading, would put the shared object into a project's record
// and is the one thing to watch for.
const NO_LOSSES: LossesJson = { Ql: 15, Qa: 100, Qp: 100, Qicl: 100 };
const NO_VENT: VentJson = {
  shape: 'round',
  diameter_m: null,
  width_m: null,
  height_m: null,
  length_m: null,
  endCorrection_m: 0.85,
};
const NO_CHAMBER: ChamberJson = { volume_m3: 0, tuning_hz: null, losses: NO_LOSSES };

/** A box with nothing designed yet — every box type present and inert, matching the
 *  dormant-data rule (the box holds EVERY box type at once and names which is active, rather
 *  than leaving callers to honour that themselves). */
function emptyBoxJson(): OpenISDBoxJson {
  return {
    boxType: 'sealed',
    sealed: { volume_m3: 0, losses: NO_LOSSES },
    vented: { chamber: NO_CHAMBER, vent: NO_VENT },
    bandpass4: { rear: NO_CHAMBER, front: NO_CHAMBER, frontVent: NO_VENT },
    bandpass6: { rear: NO_CHAMBER, front: NO_CHAMBER, rearVent: NO_VENT, frontVent: NO_VENT },
    abc: {
      rear: NO_CHAMBER,
      front: NO_CHAMBER,
      rearVent: NO_VENT,
      frontVent: NO_VENT,
      intraVent: NO_VENT,
    },
    passiveRadiator: {
      volume_m3: 0,
      tuning_hz: null,
      count: 1,
      addedMass_kg: null,
      losses: NO_LOSSES,
      component: null,
    },
  };
}

// A package-private bridge for reading a component's record back OUT of a live wrapper, the
// same WeakMap technique `project.ts` uses for change notification. `configurePR()` has to copy
// the chosen passive radiator's record into the box's own storage, but that record is private
// to the wrapper holding it — and a public `toJson()` on the class would hand the internal
// shape to anyone, the exact leak these types exist to prevent. Registering the reader here
// keeps the capability inside the package: the wrapper registers itself on construction, and
// only code that can import this module (never a consumer, per the header) can read it back.
// ---------------------------------------------------------------------------------------------
// THE BOX — its public shape, then the window that implements it.
// ---------------------------------------------------------------------------------------------

// The box types are declared ONCE, by the engine (engine/types.ts), and imported here — this
// domain adds no second enumeration of them.
//
// 'bandpass6' and 'abc' are confirmed real, working box types in WinISD (BUG_20260824,
// 2026-08-24/25 live probe): its wizard warns that no one-click alignment SUGGESTION exists for
// either, not that the box type itself doesn't work. The engine has no circuit model for them
// yet, which simulatableBoxType() states in the one place that decides it.

// Every box type gets its OWN NAMED type. `OpenISDBox` then declares `readonly sealed:
// SealedBox` rather than `readonly sealed: Box['sealed']` — an indexed-access type, which
// couples one public declaration to another's internal structure and is the pattern already
// ruled out for `OpenISDVent['shape']`. Naming each one also lets a caller hold one box type on
// its own (`function render(b: Bandpass4Box)`), which indexing never allowed.
//
// They are named `...Box`, NOT `...Alignment`. An ALIGNMENT is the tuning/damping curve (QB3,
// Butterworth, and so on) — a concept this model does not carry at all yet. What these are is
// the enclosure TOPOLOGY, which is what WinISD itself calls Box Type. Calling them alignments
// is the naming defect recorded in BUG_20260824.

/** A chamber with both a volume and a tuning of its own — bandpass6's and ABC's. */
export interface VentedChamber {
  readonly volume_m3: FieldHandle<number>;
  readonly tuning_hz: FieldHandle<number>;
  readonly losses: CoupledVentedLosses;
}

export interface SealedBox {
  readonly volume_m3: RawField<number>;
  /** The resulting system Fc, calculated from the volume and the driver — null when either is
   *  not yet known. A CALCULATION, not a stored field, so a plain method, not a handle. */
  resonance_hz(): number | null;
  readonly losses: SealedLosses;
}

export interface VentedBox {
  readonly volume_m3: FieldHandle<number>;
  /** WinISD: Fb — the target frequency, which drives `vent`'s dimensions (or vice versa). */
  readonly tuning_hz: FieldHandle<number>;
  readonly vent: Vent;
  readonly losses: VentedLosses;
}

// Chambers and vents (ports) are two SEPARATE, sibling groupings — never one bundled into the
// other. `chambers.rear`/`chambers.front` carry ONLY volume/tuning/losses, never a vent; every
// port is a flat sibling under `vents` instead, matching the Vents tab's own three-column
// layout ("Rear chamber"/"Front chamber"/"Intrachamber").
export interface Bandpass4Box {
  readonly chambers: {
    /** rear = the chamber the driver protrudes into, SEALED — no port, so no `vents.rear`, and
     *  a read-only calculated `resonance_hz()` (WinISD's "Frc") instead of a tuning to enter. */
    readonly rear: {
      readonly volume_m3: FieldHandle<number>;
      resonance_hz(): number | null;
      readonly losses: CoupledSealedLosses;
    };
    /** front = vented; its volume (`Vf`) has exactly one home — RAW, no Entered/Calculated
     *  distinction, unlike `tuning_hz`, which is part of a solved relation. */
    readonly front: {
      readonly volume_m3: RawField<number>;
      readonly tuning_hz: FieldHandle<number>;
      readonly losses: CoupledVentedLosses;
    };
  };
  readonly vents: {
    readonly front: Vent;
  };
}

/** UNLIKE bandpass4: BOTH chambers are vented and independently tunable. */
export interface Bandpass6Box {
  readonly chambers: {
    readonly rear: VentedChamber;
    readonly front: VentedChamber;
  };
  readonly vents: {
    readonly rear: Vent;
    readonly front: Vent;
  };
}

/**
 * "Aperiodic BI-Chamber" — TWO chambers (rear, front — same shape as bandpass6's, no vent nested
 * in either), THREE ports: rear's own port to outside air, front's own port to outside air, and
 * a third port CONNECTING the two chambers directly (`vents.intra`) — a flat sibling of
 * `vents.rear`/`vents.front`, owned by neither chamber (no `chambers.intra`, no third air
 * volume).
 *
 * The connecting port has NO losses of its own here, deliberately. An earlier cut carried an
 * `intraLosses` field, inferred from the `Qiclfr`/`Qiclfc`/`Qiclcr` names in WinISD's own `.wpr`
 * format — but inference is not evidence: no WinISD screen shows losses for that port, and the
 * live probe (BUG_20260824) never captured an Advanced popup for it, if one even exists. A
 * field with no evidence behind it is a fabrication, so it is gone until a probe finds one.
 */
export interface AbcBox {
  readonly chambers: {
    readonly rear: VentedChamber;
    readonly front: VentedChamber;
  };
  readonly vents: {
    readonly rear: Vent;
    readonly front: Vent;
    readonly intra: Vent;
  };
}

/** The passive radiator the box holds, once one has been chosen. */
export interface PassiveRadiatorComponent {
  isChosen(): boolean;
  /** Adopt a chosen radiator. The box owns its radiator from here on, so later edits change the
   *  box and never the library entry the radiator was picked from. */
  update(source: OpenISDPassiveRadiatorStandalone): void;
  readonly brand: FieldHandle<string>;
  readonly model: FieldHandle<string>;
  readonly manufacturer: FieldHandle<string>;
  readonly providedBy: FieldHandle<string>;
  readonly comment: FieldHandle<string>;
  readonly added: FieldHandle<string>;
  readonly Fs_hz: FieldHandle<number>;
  readonly Qms: FieldHandle<number>;
  readonly Cms_m_per_N: FieldHandle<number>;
  readonly Mms_kg: FieldHandle<number>;
  readonly Rms_kg_per_s: FieldHandle<number>;
  readonly Sd_m2: FieldHandle<number>;
  readonly Vas_m3: FieldHandle<number>;
  readonly Vd_m3: FieldHandle<number>;
  readonly Xmax_m: FieldHandle<number>;
  readonly Xlim_m: FieldHandle<number>;
  readonly Dia_m: FieldHandle<number>;
  readonly Dd_m: FieldHandle<number>;
  readonly DVol_m3: FieldHandle<number>;
  readonly Thick_m: FieldHandle<number>;
  readonly Depth_m: FieldHandle<number>;
  readonly Basket_m: FieldHandle<number>;
  readonly Outer_m: FieldHandle<number>;
  readonly OuterX_m: FieldHandle<number>;
  readonly OuterY_m: FieldHandle<number>;
  readonly weight_kg: FieldHandle<number>;
}

export interface PassiveRadiatorBox {
  readonly volume_m3: RawField<number>;        // no solve relation
  readonly tuning_hz: FieldHandle<number>;     // WinISD: Fp
  readonly count: RawField<number>;            // no solve relation, dimensionless
  readonly addedMass_kg: FieldHandle<number>;
  readonly losses: SealedLosses;
  /** Selects or replaces the radiator this box holds — callable any time the user changes their
   *  choice, not once at setup. Takes an `OpenISDPassiveRadiator`, NOT an `OpenISDDriver`: the
   *  two are separate concepts with no shared ancestor, distinguished by which spec section
   *  their record carries, so a driver cannot be passed here and a radiator cannot be passed
   *  where a driver belongs. STANDALONE specifically — a radiator already embedded in some box
   *  is not a thing you choose from a library. Already validated, via
   *  `passiveRadiatorFromConformingRecord()` — its own seam, enforcing its own shape. */
  configurePR(radiator: OpenISDPassiveRadiatorStandalone): void;
  readonly radiator: PassiveRadiatorComponent;

  /** WinISD's "Fp" — the tuning this box and this radiator ACTUALLY produce together, which is
   *  a different thing from the `tuning_hz` field above: that is the target the user asked for,
   *  this is what the chosen radiator delivers in this volume. Null until a radiator is chosen
   *  and the volume is set. A CALCULATION, so a method, not a handle. */
  systemTuning_hz(): number | null;

  /** The tuning mass this radiator needs to hit `fp_hz` in this box — the inverse of
   *  `systemTuning_hz()`, and the number a PR design is actually dialled in with. Null on the
   *  same terms. */
  addedMassForTuning_kg(fp_hz: number): number | null;
}

/** The enclosure: which box type is active, and every box type's own fields. All six are
 *  present at once and dormant unless `boxType` names them — the dormant-data rule expressed in
 *  the type, rather than left to callers to honour. */
export interface Box {
  readonly boxType: RawField<BoxType>;
  readonly sealed: SealedBox;
  readonly vented: VentedBox;
  readonly bandpass4: Bandpass4Box;
  readonly bandpass6: Bandpass6Box;
  readonly abc: AbcBox;
  readonly passiveRadiator: PassiveRadiatorBox;
}

// ---------------------------------------------------------------------------------------------
// THE BOX WINDOW — the implementation of the shapes above, over the stored record.
// ---------------------------------------------------------------------------------------------

/** Every loss factor, over one stored `LossesJson`. The four `*Losses` interfaces are narrower
 *  VIEWS of this one implementation — a chamber exposes whichever of them its own shape allows
 *  (BUG_20260824's live-confirmed per-box-type sets), and the fields it does not expose are
 *  simply unreachable through that chamber, not absent from storage. */
class LossesWindow implements CoupledVentedLosses {
  readonly Ql: RawField<number>;
  readonly Qa: RawField<number>;
  readonly Qp: RawField<number>;
  readonly Qicl: RawField<number>;

  constructor(lens: Lens<LossesJson>) {
    // A `Lens` already IS a `RawField` — same two methods, same meaning — so each loss factor
    // is simply its own lens, with no wrapper in between.
    this.Ql = focus(lens, 'Ql');
    this.Qa = focus(lens, 'Qa');
    this.Qp = focus(lens, 'Qp');
    this.Qicl = focus(lens, 'Qicl');
  }
}

/** One port. `area_m2()` follows `shape` — a round vent's area comes from its diameter, a
 *  slotted one's from width × height — so switching shape changes the answer without any stored
 *  value having to be recomputed or migrated. */
class VentWindow implements Vent {
  readonly #lens: Lens<VentJson>;
  readonly #engine: Engine;
  readonly shape: RawField<VentShape>;
  readonly endCorrection_m: RawField<number>;

  readonly diameter_m: FieldHandle<number>;
  readonly width_m: FieldHandle<number>;
  readonly height_m: FieldHandle<number>;
  readonly length_m: FieldHandle<number>;

  constructor(lens: Lens<VentJson>, engine: Engine) {
    this.#lens = lens;
    this.#engine = engine;
    this.shape = focus(lens, 'shape');
    this.endCorrection_m = focus(lens, 'endCorrection_m');
    this.diameter_m = nullableField(lens, 'diameter_m');
    this.width_m = nullableField(lens, 'width_m');
    this.height_m = nullableField(lens, 'height_m');
    this.length_m = nullableField(lens, 'length_m');
  }

  /** Cross-sectional area of the port opening.
   *
   *  PLAIN GEOMETRY, and that is why it is allowed to live here (John 2026-08-26: "simple
   *  geometric calc like pi r squared are ok in the domain"). The line the domain must not cross
   *  is ACOUSTICS — anything involving air, compliance, resonance or an end correction. The area
   *  of a circle involves none of those and has no parity question: πr² is πr² in every model.
   *
   *  Null rather than 0 (a real, if absurd, port area) or NaN — absence is spelled ONE way in
   *  this domain, the same `null` a `Cell` carries. */
  area_m2(): number | null {
    const v = this.#lens.get();
    if (v.shape === 'round') {
      return v.diameter_m === null ? null : Math.PI * (v.diameter_m / 2) ** 2;
    }
    return v.width_m === null || v.height_m === null ? null : v.width_m * v.height_m;
  }

  /** Acoustic length — the physical length plus the end correction, which is what the sweep's
   *  port model actually resonates (`SweepParams.Leff`).
   *
   *  The end correction models how air outside the port behaves, so it is ACOUSTICS and the
   *  engine owns it. The domain supplies the port's own geometry — its length and its area, both
   *  of which it legitimately knows — and reports what comes back. */
  effectiveLength_m(): number | null {
    const length_m = this.#lens.get().length_m;
    const Sp = this.area_m2();
    if (length_m === null || Sp === null) return null;
    return this.#engine.ventEffectiveLength(length_m, Sp, this.#lens.get().endCorrection_m);
  }

  tuningIn_hz(volume_m3: number | null): number | null {
    const length_m = this.#lens.get().length_m;
    const Sp = this.area_m2();
    if (volume_m3 === null || !(volume_m3 > 0) || length_m === null || Sp === null) return null;
    return this.#engine.tuningFromLength(volume_m3, length_m, Sp, this.#lens.get().endCorrection_m);
  }

  lengthForTuning_m(volume_m3: number | null, fb_hz: number): number | null {
    const Sp = this.area_m2();
    if (volume_m3 === null || !(volume_m3 > 0) || !(fb_hz > 0) || Sp === null) return null;
    return this.#engine.ventLength(volume_m3, fb_hz, Sp, this.#lens.get().endCorrection_m);
  }
}

/** A chamber with both a volume and a tuning of its own — bandpass6's and ABC's, and the shape
 *  `VentedChamber` names in `box.ts`. */
class VentedChamberWindow {
  readonly volume_m3: FieldHandle<number>;
  readonly tuning_hz: FieldHandle<number>;
  readonly losses: CoupledVentedLosses;

  constructor(lens: Lens<ChamberJson>) {
    this.volume_m3 = requiredField(lens, 'volume_m3', 'volume_m3');
    this.tuning_hz = nullableField(lens, 'tuning_hz');
    this.losses = new LossesWindow(focus(lens, 'losses'));
  }
}

/** One field of an embedded radiator's section. The slot is NULLABLE — an embedded radiator has
 *  no record until one is chosen — so a read before then reports `not-available` and a write is
 *  refused: there is nothing to write into, and inventing a record would fabricate a radiator the
 *  user never picked. */
function prSpec(
  lens: Lens<OpenISDDriverJson | null>,
  key: PassiveRadiatorFieldName,
): Field<number> {
  return new Field<number>(
    () => {
      const spec = lens.get()?.specs['passive-radiator'];
      // A key ABSENT from the section means the radiator does not state that parameter.
      const v = winningValue(spec?.[key]);
      return v === null ? { value: null, state: 'not-available' } : { value: v, state: 'entered' };
    },
    (v) => {
      const json = lens.get();
      const spec = json?.specs['passive-radiator'];
      if (!json || !spec) {
        throw new Error(
          `passiveRadiator.radiator.${key} cannot be written: no radiator is chosen yet — ` +
          'call configurePR() first.',
        );
      }
      lens.set({
        ...json,
        specs: { ...json.specs, 'passive-radiator': { ...spec, [key]: enteredEntry(v) } },
      });
    },
    () => {
      throw new Error(
        `${key} cannot be cleared: a chosen radiator's spec section always exists — there is ` +
        'no "not entered" state for a field within it in this design.',
      );
    },
  );
}

/** A metadata field of the CHOSEN passive radiator. Until one is chosen there is nothing to
 *  read or write: reads answer `not-available` (the honest answer — no radiator, no brand),
 *  and writes are a real error rather than silently fabricating a component out of a stray
 *  keystroke. `clear()` empties the value, matching how a driver's own metadata clears. */
function prMeta(
  lens: Lens<OpenISDDriverJson | null>,
  key: MetaFieldName,
): Field<string> {
  const requireChosen = (): OpenISDDriverJson => {
    const json = lens.get();
    if (!json) {
      throw new Error(
        `passiveRadiator.component.${key} cannot be written: no radiator is chosen yet — ` +
        'call configurePR() first.',
      );
    }
    return json;
  };
  return new Field<string>(
    () => {
      const json = lens.get();
      return json === null
        ? { value: null, state: 'not-available' }
        : { value: json[key].value, state: 'entered' };
    },
    (v) => { lens.set({ ...requireChosen(), [key]: { value: v, origin: 'entered' } }); },
    () => { lens.set({ ...requireChosen(), [key]: { value: '', origin: 'entered' } }); },
  );
}

/** A T/S field of the chosen passive radiator, out of its own `passive-radiator` spec section.
 *  Same not-chosen handling as `prMeta`, plus the section invariant `OpenISDPassiveRadiator`
 *  already guarantees: a record that reached `configurePR()` came through that class, which
 *  refuses to construct without the section, so it is present whenever a component is. */

/**
 * The box, as a window onto its slice of the project record — AND holding a reference to the
 * containing `OpenISDProject` itself.
 *
 * The project reference is what lets a component answer a question that spans siblings. Fc is
 * the case in point: it depends on the box's volume AND on the driver's Fs/Sd/Cms, and the box
 * cannot see the driver on its own. An earlier version had the project inject a
 * `SealedResonanceFn` callback instead — one bespoke hole punched for one calculation, which
 * would need another hole for the next cross-component question (a vent's air mass needs the
 * environment; a PR's tuning needs the box volume it sits in). Holding the project answers all
 * of them at once.
 *
 * A box is ALWAYS part of a project, so the reference is mandatory and never null. That is not
 * true of a driver — one can be standalone (a My Drivers entry, a bundle row, a `detach()`ed
 * copy) — which is why `OpenISDDriver` does NOT take a project. Making it take one would force
 * every standalone driver to invent a project it is not part of.
 *
 * The box reaches the driver through its PUBLIC surface (`project.driver.Fs_hz.get()`), never
 * through the record — the privacy rule holds inside the module too.
 */
class OpenISDBox implements Box {
  readonly boxType: RawField<BoxType>;

  readonly sealed: SealedBox;
  readonly vented: VentedBox;
  readonly bandpass4: Bandpass4Box;
  readonly bandpass6: Bandpass6Box;
  readonly abc: AbcBox;
  readonly passiveRadiator: PassiveRadiatorBox;

  /** The driver this box loads, read through its PUBLIC field surface — never its record. A
   *  chamber's resonance depends on the driver, and this is the only thing the box needs it for. */
  readonly #driver: OpenISDDriverEmbedded;
  /** The one calculation surface. Injected, never constructed here. */
  readonly #engine: Engine;
  /** The project's own air, resolved at CALL time so a chamber follows the environment the user
   *  states rather than whichever one happened to be current at construction. */
  readonly #environment: () => OpenISDEnvironmentJson;

  private constructor(
    lens: Lens<OpenISDBoxJson>,
    driver: OpenISDDriverEmbedded,
    engine: Engine,
    environment: () => OpenISDEnvironmentJson,
  ) {
    this.#driver = driver;
    this.#engine = engine;
    this.#environment = environment;
    this.boxType = focus(lens, 'boxType');

    const sealedLens = focus(lens, 'sealed');
    const sealedVolume = focus(sealedLens, 'volume_m3');
    const sealedLosses = new LossesWindow(focus(sealedLens, 'losses')) satisfies SealedLosses;
    this.sealed = {
      volume_m3: sealedVolume,
      resonance_hz: () => this.#sealedResonance_hz(sealedVolume.get(), sealedLosses),
      losses: sealedLosses,
    };

    const ventedLens = focus(lens, 'vented');
    const ventedChamber = focus(ventedLens, 'chamber');
    this.vented = {
      volume_m3: requiredField(ventedChamber, 'volume_m3', 'vented.volume_m3'),
      tuning_hz: nullableField(ventedChamber, 'tuning_hz'),
      vent: new VentWindow(focus(ventedLens, 'vent'), engine),
      losses: new LossesWindow(focus(ventedChamber, 'losses')) satisfies VentedLosses,
    };

    const bp4 = focus(lens, 'bandpass4');
    const bp4Rear = focus(bp4, 'rear');
    const bp4RearLosses = new LossesWindow(focus(bp4Rear, 'losses')) satisfies CoupledSealedLosses;
    const bp4Front = focus(bp4, 'front');
    this.bandpass4 = {
      chambers: {
        // rear is SEALED — no port, so no `vents.rear`, and a read-only calculated
        // `resonance_hz()` (WinISD's "Frc") stands in for the tuning it cannot be given.
        rear: {
          volume_m3: requiredField(bp4Rear, 'volume_m3', 'bandpass4.rear.volume_m3'),
          resonance_hz: () => this.#sealedResonance_hz(focus(bp4Rear, 'volume_m3').get(), bp4RearLosses),
          losses: bp4RearLosses,
        },
        // front's volume is RAW — it has exactly one home and is not part of a solved
        // relation, unlike its tuning.
        front: {
          volume_m3: focus(bp4Front, 'volume_m3'),
          tuning_hz: nullableField(bp4Front, 'tuning_hz'),
          losses: new LossesWindow(focus(bp4Front, 'losses')) satisfies CoupledVentedLosses,
        },
      },
      vents: { front: new VentWindow(focus(bp4, 'frontVent'), engine) },
    };

    const bp6 = focus(lens, 'bandpass6');
    this.bandpass6 = {
      chambers: {
        rear: new VentedChamberWindow(focus(bp6, 'rear')),
        front: new VentedChamberWindow(focus(bp6, 'front')),
      },
      vents: {
        rear: new VentWindow(focus(bp6, 'rearVent'), engine),
        front: new VentWindow(focus(bp6, 'frontVent'), engine),
      },
    };

    const abc = focus(lens, 'abc');
    this.abc = {
      chambers: {
        rear: new VentedChamberWindow(focus(abc, 'rear')),
        front: new VentedChamberWindow(focus(abc, 'front')),
      },
      // Three ports, flat siblings: rear's and front's own ports to outside air, plus the
      // connecting port between the chambers — owned by neither, which is why it sits here and
      // not inside a chamber.
      vents: {
        rear: new VentWindow(focus(abc, 'rearVent'), engine),
        front: new VentWindow(focus(abc, 'frontVent'), engine),
        intra: new VentWindow(focus(abc, 'intraVent'), engine),
      },
    };

    const pr = focus(lens, 'passiveRadiator');
    const prSlot = focus(pr, 'component');
    const radiator = new OpenISDPassiveRadiatorEmbedded(prSlot, engine);
    const prVolume = focus(pr, 'volume_m3');
    const prAddedMass = nullableField(pr, 'addedMass_kg');
    this.passiveRadiator = {
      volume_m3: prVolume,
      tuning_hz: nullableField(pr, 'tuning_hz'),
      count: focus(pr, 'count'),
      addedMass_kg: prAddedMass,
      losses: new LossesWindow(focus(pr, 'losses')) satisfies SealedLosses,
      // The embedded radiator adopts the chosen one — a radiator reading another radiator's
      // record, legal because both derive from the class that declares `slot`.
      configurePR: (chosen: OpenISDPassiveRadiatorStandalone) => {
        radiator.update(chosen);
      },
      radiator,
      systemTuning_hz: () => {
        const P = this.#prParams(prVolume.get(), prAddedMass.get().value, radiator);
        return P === null ? null : engine.prTuning(P);
      },
      addedMassForTuning_kg: (fp_hz: number) => {
        const P = this.#prParams(prVolume.get(), prAddedMass.get().value, radiator);
        return P === null || !(fp_hz > 0) ? null : engine.prMassForFp(P, fp_hz);
      },
    };
  }

  /** Takes the lens onto the project's `box` slot. The project owns that slot and builds the
   *  lens, so the box needs no reference back to the project. */
  static wrap(
    slot: Lens<OpenISDBoxJson>,
    driver: OpenISDDriverEmbedded,
    engine: Engine,
    environment: () => OpenISDEnvironmentJson,
  ): OpenISDBox {
    return new OpenISDBox(slot, driver, engine, environment);
  }

  /**
   * A sealed chamber's resonance, through the INJECTED engine and in the PROJECT'S OWN air.
   *
   * Null whenever the driver has not stated what the calculation needs, or the volume is not
   * set — absence is `null` here as everywhere, never 0 and never a throw.
   *
   * The domain does none of the physics: it hands over the driver's stored values, the volume,
   * the chamber's losses and the environment, and the engine derives Vas and the resonance.
   *
   * LOSSLESS, and NOT by preference — `SpecSection` stores no `Qts`, and both lossy models need
   * it (the lossless `Fsc` is the one figure that does not). So this is the only resonance the
   * domain's own driver record can express today.
   *
   * That matters for parity: WinISD displays and saves the LOSSY figure — measured, `Fr` moves
   * 5.8 Hz for a `Ql` change at fixed volume (`winisd_research` FINDING-007). Matching it needs
   * `Qts` in the driver record, which is a decision about the record, not about this method.
   */
  /** The five numbers the engine's PR relations read, or null when any is missing.
   *
   *  Gathered ONCE for both directions: the tuning and the mass-for-a-tuning are the same
   *  relation solved each way, so they must never disagree about their inputs. `prMadd` is 0
   *  when no tuning mass has been added — that IS the stated condition, not a missing value. */
  #prParams(
    volume_m3: number,
    addedMass_kg: number | null,
    radiator: OpenISDPassiveRadiatorEmbedded,
  ): { Vb: number; prMmd: number; prMadd: number; prSd: number; prCms: number } | null {
    // Read through the radiator's OWN PUBLIC SURFACE — the box never touches a radiator's
    // record. Everything it needs, the radiator already publishes.
    const prMmd = radiator.Mms_kg.get().value;
    const prSd = radiator.Sd_m2.get().value;
    const prCms = radiator.Cms_m_per_N.get().value;
    if (prMmd === null || prSd === null || prCms === null || !(volume_m3 > 0)) return null;
    return { Vb: volume_m3, prMmd, prMadd: addedMass_kg ?? 0, prSd, prCms };
  }

  #sealedResonance_hz(volume_m3: number | null, losses: SealedLosses): number | null {
    const spec = this.#driver.spec[this.#driver.section];
    const Fs_hz = spec.Fs_hz.get().value;
    const Sd_m2 = spec.Sd_m2.get().value;
    const Cms = spec.Cms_m_per_N.get().value;
    if (volume_m3 === null || Fs_hz === null || Sd_m2 === null || Cms === null) return null;

    const env = this.#environment();
    const air = this.#engine.airFor({
      tempK: env.temperature_K ?? undefined,
      humidityPct: env.humidity_pct ?? undefined,
      pressurePa: env.pressure_Pa ?? undefined,
    });
    const Qts = spec.Qts.get().value;
    if (Qts === null) return null;
    // `LossMode.Default` IS `WinisdLossy` — John 2026-08-27: "default is winisd = Lossy". WinISD
    // displays and saves the LOSSY figure, and it MOVES with the chamber's losses: measured, `Fr`
    // shifts 5.8 Hz for a `Ql` change at fixed volume (winisd_research FINDING-007).
    return this.#engine.sealedResonanceFromCompliance(
      LossMode.Default,
      { Fs_hz, Qts, Sd_m2, Cms_m_per_N: Cms, volume_m3, Ql: losses.Ql.get(), Qa: losses.Qa.get() },
      air,
    );
  }


}

// ---------------------------------------------------------------------------------------------
// THE DRIVER, THE PROJECT, AND THE LAYERS OVER THEM.
// ---------------------------------------------------------------------------------------------

// `OpenISDDriver`, `OpenISDPassiveRadiator`, `OpenISDProject`, `ManagedProject` and
// are declared TOGETHER, in this one file — on purpose:
//
// `ManagedProject` needs to be told when the EFFECTIVE `OpenISDProject` (whichever of
// ground/committed/edit/whatif is currently active) changes internally (a field write, a solve
// pass), so it can fire ITS OWN public `subscribe()` listeners. TypeScript `protected` CANNOT
// do this — tried it, confirmed by the compiler: `protected` only reaches SUBCLASSES, and
// `ManagedProject` COMPOSES up to four independent `OpenISDProject` instances rather than
// extending one, so a `protected subscribe()` compiles but `ManagedProject` genuinely cannot
// call it. The real mechanism is the module-scoped `notifyProject()`/`subscribeToProject()`
// WeakMap bridge below — never exported, so nothing outside this file can reach it either,
// which is what actually enforces "only `ManagedProject` reaches into an `OpenISDProject`'s
// notifications," not the `protected` keyword.
//
// The RECORD shapes these classes window onto live in `storage.ts` — module-exported so the
// box's storage and the driver's can share one declaration (a PR component IS a driver
// record), but deliberately absent from `index.ts`, so no consumer can name them. See that
// file's header.

/**
 * A real, playable driver — its record has a `woofer` or `tweeter` section.
 *
 * ABSTRACT, with two concrete kinds, because "a driver in a project" and "a driver on its own"
 * are genuinely different things and the type should say so rather than one class carrying a
 * nullable project:
 *   - `OpenISDDriverEmbedded` — part of an `OpenISDProject`, holds a reference to it, and can be
 *     REPLACED wholesale via `update()`.
 *   - `OpenISDDriverStandalone` — a My Drivers entry, a bundle row, or a detached copy. No
 *     project, because it is not in one.
 * Both are WINDOWS onto a record living wherever their owner keeps it — never an internal copy.
 *
 * Neither constructs from a record with no woofer/tweeter section: a record that incomplete
 * never becomes a driver at all, it is rejected before a window is opened onto it. (Flagging
 * such a record in the driver list and refusing selection is the app's job, outside this
 * package — this refusal is the safety net that check relies on, not a duplicate of it.) So
 * every field below can assume its spec section exists for the instance's whole lifetime.
 *
 * Every `Field` is built ONCE, eagerly, in the constructor, not lazily per getter access — a
 * lazy `get Fs_hz()` allocates a new `Field` per access, so `driver.Fs_hz !== driver.Fs_hz`,
 * which breaks object-identity-based reactivity by making every read look like a change.
 * Building once makes the identity stable for the instance's lifetime, while `.get()` still
 * reads live off `read()` every call — the closures capture `this` and dereference at CALL
 * time, never a json snapshot, which is what makes eager construction safe even though
 * `write()` REASSIGNS the record.
 */
/**
 * ONE SPEC SECTION, PUBLISHED.
 *
 * The reusable component John asked for: a window onto a single `SpecSection` of a driver record,
 * with every parameter that section can carry. `OpenISDDriver` holds one of these per section it
 * has, so `driver.spec.woofer.Fs_hz` and `driver.spec.tweeter.Fs_hz` are the same class over
 * different keys — a tweeter is not a different kind of thing to read.
 *
 * THE NAMES CARRY THE UNIT and the record's keys do not (John 2026-08-27: "on design/domain the
 * private json object we follow Winisd names Fs but on the public wrapping domain object we use
 * united names Fs_hz"). No conversion happens at this boundary in either direction — the record
 * is SI already and each suffix REPORTS the unit the stored number is in. `Rms_kg_per_s`, not
 * `Rms_Ns_per_m`, because kg/s is what the record's own definition states, and the two spellings
 * of that one dimension would otherwise be a second name for the field.
 *
 * The dimensionless parameters take no suffix — `Qts`, `Qes`, `Qms`, `no`, `Gloss`, `numVC`,
 * `VCCon` (John 2026-08-27: "dimensionless measure DO NOT have a unit - by definition").
 * `Gloss` earns its place there by its own formula, `g/((2π·Fs)²·Xmax)`, which cancels to a pure
 * ratio and is displayed as a percentage.
 *
 * Every `Field` is built ONCE in the constructor, for the identity reason `OpenISDDriver`'s own
 * header gives: a lazy getter would allocate per access and make every read look like a change.
 */
export class DriverSpec {
  // Thiele/Small.
  readonly Fs_hz: Field<number>;
  readonly Re_ohm: Field<number>;
  readonly Le_H: Field<number>;
  readonly fLe_hz: Field<number>;
  /** `Le·√(2π·fLe)` — the Vanderkooy lossy-inductance coefficient (`WINISD_PARITY.md:1009`,
   *  `GHIDRA_FINDINGS.md:1039`). Henries times the square root of hertz; not dimensionless. */
  readonly KLe_H_sqrtHz: Field<number>;
  readonly Znom_ohm: Field<number>;
  readonly Qts: Field<number>;
  readonly Qes: Field<number>;
  readonly Qms: Field<number>;
  readonly Vas_m3: Field<number>;
  readonly Sd_m2: Field<number>;
  readonly BL_Tm: Field<number>;
  readonly Mms_kg: Field<number>;
  readonly Cms_m_per_N: Field<number>;
  readonly Rms_kg_per_s: Field<number>;
  readonly Xmax_m: Field<number>;
  readonly Xlim_m: Field<number>;
  readonly SPL_dB: Field<number>;
  readonly Pe_W: Field<number>;
  readonly Dd_m: Field<number>;
  readonly EBP_hz: Field<number>;
  readonly numVC: Field<number>;
  /** How the coils are wired. A NAME, not WinISD's 1/2 — see `VoiceCoilWiring`. */
  readonly VCCon: Field<VoiceCoilWiring>;
  // Ordinarily derived, but WinISD lets a human type any of them, and an entered value is a fact.
  readonly Dia_m: Field<number>;
  readonly Vd_m3: Field<number>;
  readonly no: Field<number>;
  readonly SPLmax_dB: Field<number>;
  readonly SPLmaxLF_dB: Field<number>;
  readonly USPL_dB: Field<number>;
  readonly alfaVC_per_K: Field<number>;
  readonly Rt_K_per_W: Field<number>;
  readonly Ct_J_per_K: Field<number>;
  /** `Bxl/Mms` — the acceleration factor, acceleration per ampere. NOT dimensionless: WinISD's
   *  own UI prints `N/(A*kg)`, which is the same dimension as cfuttrup's `m/(s²·A)`. */
  readonly gamma_m_per_s2_A: Field<number>;
  readonly Rme_kg_per_s: Field<number>;
  /** `Bxl/√Re` — the motor power factor, newtons per square-root watt. */
  readonly Mpow_N_per_sqrtW: Field<number>;
  /** `Rme·(1 + Xmax/min(Hc, Hg))` — the motor COST factor: how powerful the motor is, penalised
   *  by how far the coil is overhung or underhung. It IS meant as an indicator of what the driver
   *  costs to build, but the unit is not currency — the ratio is dimensionless, so the figure
   *  carries `Rme`'s kg/s. WinISD's own help: "an indicator on the price of the driver, but
   *  please forget about the unit". (Formula decompiled and reproduced exactly on 10 live WinISD
   *  runs: `winisd_research/GHIDRA_FINDINGS.md` §"Four advanced-panel formulas".) */
  readonly Mcost_kg_per_s: Field<number>;
  readonly Gloss: Field<number>;
  /** The air THIS DRIVER states — the conditions its own figures were measured or computed at.
   *  Not the environment a simulation runs on; `OpenISDEnvironment` on the project is that. */
  readonly c_m_per_s: Field<number>;
  readonly roo_kg_per_m3: Field<number>;
  // Descriptive and dimensional.
  readonly Vcd_m: Field<number>;
  readonly Hg_m: Field<number>;
  readonly Hc_m: Field<number>;
  readonly freq_low_hz: Field<number>;
  readonly freq_high_hz: Field<number>;
  readonly power_peak_W: Field<number>;
  readonly weight_kg: Field<number>;
  readonly Thick_m: Field<number>;
  readonly Depth_m: Field<number>;
  readonly MagDepth_m: Field<number>;
  readonly Magnet_m: Field<number>;
  readonly Basket_m: Field<number>;
  readonly Outer_m: Field<number>;
  readonly OuterX_m: Field<number>;
  readonly OuterY_m: Field<number>;
  readonly DVol_m3: Field<number>;

  constructor(record: Lens<OpenISDDriverJson>, section: 'woofer' | 'tweeter') {
    /** The wiring field. Its own builder because it carries a NAME, not a number, so it is not
     *  one of `SpecFieldName`'s numeric keys and cannot go through `f()`. */
    const wiring = (): Field<VoiceCoilWiring> => new Field<VoiceCoilWiring>(
      () => {
        const wiring = wiringFromRecord(winningValue(record.get().specs[section]?.VCCon));
        return wiring === null
          ? { value: null, state: 'not-available' }
          : { value: wiring, state: 'entered' };
      },
      (v) => {
        const json = record.get();
        const spec = json.specs[section] ?? {};
        record.set({
          ...json,
          specs: { ...json.specs, [section]: { ...spec, VCCon: enteredWiring(v) } },
        });
      },
      () => {
        throw new Error(
          'VCCon cannot be cleared: this section always exists once constructed — there is no ' +
          '"not entered" state for a field within it in this design.',
        );
      },
    );

    const f = (key: SpecFieldName): Field<number> => new Field<number>(
      // A key ABSENT from the section means the driver does not state that parameter — the
      // ordinary shape of a scraped record, not a fault.
      () => {
        const stated = record.get().specs[section]?.[key];
        const v = winningValue(stated);
        return v === null ? { value: null, state: 'not-available' } : { value: v, state: 'entered' };
      },
      (v) => {
        const json = record.get();
        const spec = json.specs[section] ?? {};
        record.set({
          ...json,
          specs: { ...json.specs, [section]: { ...spec, [key]: enteredEntry(v) } },
        });
      },
      () => {
        throw new Error(
          `${key} cannot be cleared: this ${section} section always exists once constructed — ` +
          'there is no "not entered" state for a field within it in this design.',
        );
      },
    );

    this.Fs_hz = f('Fs');
    this.Re_ohm = f('Re');
    this.Le_H = f('Le');
    this.fLe_hz = f('fLe');
    this.KLe_H_sqrtHz = f('KLe');
    this.Znom_ohm = f('Znom');
    this.Qts = f('Qts');
    this.Qes = f('Qes');
    this.Qms = f('Qms');
    this.Vas_m3 = f('Vas');
    this.Sd_m2 = f('Sd');
    this.BL_Tm = f('BL');
    this.Mms_kg = f('Mms');
    this.Cms_m_per_N = f('Cms');
    this.Rms_kg_per_s = f('Rms');
    this.Xmax_m = f('Xmax');
    this.Xlim_m = f('Xlim');
    this.SPL_dB = f('SPL');
    this.Pe_W = f('Pe');
    this.Dd_m = f('Dd');
    this.EBP_hz = f('EBP');
    this.numVC = f('numVC');
    this.VCCon = wiring();
    this.Dia_m = f('Dia');
    this.Vd_m3 = f('Vd');
    this.no = f('no');
    this.SPLmax_dB = f('SPLmax');
    this.SPLmaxLF_dB = f('SPLmaxLF');
    this.USPL_dB = f('USPL');
    this.alfaVC_per_K = f('alfaVC');
    this.Rt_K_per_W = f('Rt');
    this.Ct_J_per_K = f('Ct');
    this.gamma_m_per_s2_A = f('gamma');
    this.Rme_kg_per_s = f('Rme');
    this.Mpow_N_per_sqrtW = f('Mpow');
    this.Mcost_kg_per_s = f('Mcost');
    this.Gloss = f('Gloss');
    this.c_m_per_s = f('c');
    this.roo_kg_per_m3 = f('roo');
    this.Vcd_m = f('Vcd');
    this.Hg_m = f('Hg');
    this.Hc_m = f('Hc');
    this.freq_low_hz = f('freq_low_hz');
    this.freq_high_hz = f('freq_high_hz');
    this.power_peak_W = f('power_peak_W');
    this.weight_kg = f('weight_kg');
    this.Thick_m = f('Thick');
    this.Depth_m = f('Depth');
    this.MagDepth_m = f('MagDepth');
    this.Magnet_m = f('Magnet');
    this.Basket_m = f('Basket');
    this.Outer_m = f('Outer');
    this.OuterX_m = f('OuterX');
    this.OuterY_m = f('OuterY');
    this.DVol_m3 = f('DVol');
  }
}

export abstract class OpenISDDriver {
  /** Protected, not `#private`: the subclasses below are the ONLY things that need it, and
   *  `protected` is exactly the tool for that — this is a real inheritance relationship, unlike
   *  `ManagedProject`/`OpenISDProject`, which compose and therefore need the WeakMap bridge. */
  protected readonly record: Lens<OpenISDDriverJson>;
  readonly section: 'woofer' | 'tweeter';

  /** The driver's spec sections. A caller that does not care which kind of driver it holds reads
   *  `driver.spec[driver.section]`. */
  readonly spec: {
    readonly woofer: DriverSpec;
    readonly tweeter: DriverSpec;
  };

  readonly brand: Field<string>;
  readonly model: Field<string>;
  readonly manufacturer: Field<string>;
  readonly providedBy: Field<string>;
  readonly comment: Field<string>;
  readonly added: Field<string>;

  /** The one calculation surface. INJECTED, exactly as `OpenISDProject`'s is — a driver reports
   *  derived figures, and every one of them comes from here and nowhere else. */
  protected readonly engine: Engine;

  protected constructor(record: Lens<OpenISDDriverJson>, section: 'woofer' | 'tweeter', engine: Engine) {
    this.record = record;
    this.section = section;
    this.engine = engine;
    // Both are built unconditionally, and NEITHER reads the record here. A `DriverSpec` is a
    // WINDOW: it dereferences at call time, so a section the record does not carry reads
    // `not-available` on every field and starts carrying values the moment one is set. Deciding
    // in this constructor which sections "exist" would snapshot the record — and `update()`
    // REPLACES it, so a driver updated from a tweeter record would keep reporting no tweeter.
    // `section` already answers "which kind of driver is this"; presence is not a second answer.
    this.spec = {
      woofer: new DriverSpec(record, 'woofer'),
      tweeter: new DriverSpec(record, 'tweeter'),
    };
    this.brand = this.#buildMeta('brand');
    this.model = this.#buildMeta('model');
    this.manufacturer = this.#buildMeta('manufacturer');
    this.providedBy = this.#buildMeta('provided_by');
    this.comment = this.#buildMeta('comment');
    this.added = this.#buildMeta('added');
  }

  /** Which spec section a record carries, or a refusal if it carries neither. */
  protected static sectionOf(json: OpenISDDriverJson): 'woofer' | 'tweeter' {
    if (json.specs.woofer) return 'woofer';
    if (json.specs.tweeter) return 'tweeter';
    throw new Error('OpenISDDriver: record has neither a woofer nor a tweeter section');
  }

  // ── DERIVED FIGURES — every one from the injected engine, none computed here ──────────────

  /**
   * This driver's stated numbers as the engine's loose field bag.
   *
   * The engine's driver calls all take `DriverFields`, and building it is the driver's own job:
   * nothing else knows which section this driver has, and nothing else may read the record. A
   * parameter the driver does not state is ABSENT from the bag, which is exactly what the
   * consistency solver expects — it fills in what the present values imply and leaves the rest.
   *
   * Every entry is a real number because THIS FILTER MAKES IT SO, not because the record only
   * holds numbers — a distinction worth stating, because reading it the other way is what caused
   * a shipped bug. A non-numeric section field is DROPPED here, deliberately and silently, and
   * anything that then reads the key off the solved bag gets `undefined` while still compiling
   * (`DriverFields` is `Record<string, number | undefined>`). `VCCon` was exactly that casualty;
   * it is now read from its Field instead, and
   * `test/architecture-spec-section-is-numeric.test.ts` fails the moment another non-numeric
   * field is declared, so the next one cannot be lost the same way.
   *
   * The stricter `Record<string, number>` is what `checkConsistency` requires, and it still
   * satisfies `DriverFields` wherever that is asked for, so one builder serves every engine call
   * below.
   */
  fields(): EngineQuantities {
    const q = new EngineQuantities();
    const spec = this.record.get().specs[this.section];
    if (!spec) return q;
    for (const name of EngineQuantities.NAMES) {
      const key = recordName(name);
      if (key === null) continue;
      const stated = spec[key];
      if (stated === undefined) continue;
      const value = winningValue(stated);
      if (value !== null) q[name] = value;
    }
    return q;
  }

  /** Everything this driver's stated values imply, filled in. Does NOT write back — a solved
   *  value is a derivation, and the record holds only what was actually stated. */
  solveConsistencyGroup(): EngineQuantities {
    return this.engine.solveConsistencyGroup(this.fields());
  }

  /** Everything this driver's stated values disagree about — an over-specified driver whose
   *  numbers cannot all be true at once. Empty when consistent. */
  checkConsistency(): ConsistencyIssue[] {
    return this.engine.checkConsistency(this.fields());
  }

  // ── VOICE COILS — the driver states PER-COIL values; the system simulates TERMINAL ones ────
  //
  // A dual-voice-coil driver's datasheet prints ONE coil's Re and BL. What the amplifier sees
  // depends on how the coils are wired: N coils of resistance r are r/N in parallel and N·r in
  // series, with force factor bl and N·bl respectively.
  //
  // THIS DIFFERS FROM WINISD DELIBERATELY (John, 2026-08-28: "evil", "make it two"). WinISD keeps
  // ONE `Re`, rewrites it in place when the wiring combo changes — ×numVC² — and leaves the value
  // still marked ENTERED, so its file claims the user typed a number the app computed
  // (`docs/research/WINISD_PARITY.md` §11b; decompiled at `0x461242`). Here the stated value is
  // never touched and the terminal pair is DERIVED, so a typed number survives every wiring
  // change and the entered/calculated distinction stays true.
  //
  // The engine is unaffected: it receives one effective Re/BL like any other driver and knows
  // nothing about coils.

  /**
   * How the coils are wired. Absent means parallel, which is what a single coil always is.
   *
   * READ FROM THE FIELD, never from `fields()`/`solveConsistencyGroup()`. Those carry the
   * driver's NUMERIC parameters — the bag the consistency solver works on — and a wiring is a
   * name, not a quantity. Routing it through a numeric bag to get it back out again is the
   * smell, and it was also a live bug: `fields()` keeps only `typeof value === 'number'`, so once
   * `VCCon` became `'parallel' | 'series'` it was silently dropped, and the old test
   * `solveConsistencyGroup().VCCon === 2` compared `undefined` to a dead file-format encoding.
   * That made this ALWAYS false, so a series-wired driver got the parallel factors and its `Re`
   * was wrong by `numVC²` — silently, past the type checker and past eight passing tests.
   * (Found by agent `loose-end` in review, 2026-08-28.)
   */
  #wiredInSeries(): boolean {
    return this.spec[this.section].VCCon.get().value === VoiceCoilWiring.Series;
  }

  /** Voice-coil count, floored at 1: a driver has at least one coil, and a record stating 0 or
   *  nothing must not scale anything to zero or infinity. */
  #coilCount(): number {
    const n = this.spec[this.section].numVC.get().value;
    return n !== null && n >= 1 ? n : 1;
  }

  /**
   * The driver's numbers with `Re` and `BL` as the AMPLIFIER sees them, not as one coil states
   * them. Everything else passes through untouched.
   *
   * With one coil, or with the coils in parallel and `numVC` absent, this is identical to
   * `solveConsistencyGroup()` — the overwhelmingly common case costs nothing.
   */
  terminalFields(): EngineQuantities {
    const solved = this.solveConsistencyGroup();
    const n = this.#coilCount();
    if (n === 1) return solved;
    const out = Object.assign(new EngineQuantities(), solved);
    if (solved.Re_ohm !== undefined) out.Re_ohm = solved.Re_ohm * (this.#wiredInSeries() ? n : 1 / n);
    if (solved.BL_Tm !== undefined && this.#wiredInSeries()) out.BL_Tm = solved.BL_Tm * n;
    return out;
  }

  /** Voice-coil inductance, as the record states it. Not a solver quantity — nothing derives it
   *  — so it travels to `sweep` on its own, for the impedance plot alone. */
  Le_H(): number | undefined {
    return winningValue(this.record.get().specs[this.section]?.Le ?? undefined) ?? undefined;
  }

  /** Terminal resistance — what the amplifier drives. Null when the driver states no `Re`. */
  terminalRe_ohm(): number | null {
    return this.terminalFields().Re_ohm ?? null;
  }

  /** Terminal force factor. Null when the driver states no `BL`. */
  terminalBL_Tm(): number | null {
    return this.terminalFields().BL_Tm ?? null;
  }

  /** Whether `field` is one of the interdependent Q values, so that entering it constrains the
   *  others. The editor asks before deciding whether a keystroke re-solves the group. */
  isQGroupField(field: string): boolean {
    return this.engine.isQGroupField(field);
  }

  /** Whether too few of this driver's Q group are stated for the rest to follow. */
  qGroupIsIncomplete(): boolean {
    const q = this.fields();
    return this.engine.qGroupIsIncomplete((field) =>
      field === 'Qts' ? q.Qts !== undefined
      : field === 'Qes' ? q.Qes !== undefined
      : field === 'Qms' ? q.Qms !== undefined
      : false);
  }

  /** Efficiency bandwidth product, `Fs/Qes` — the rough sealed-versus-vented indicator. Null
   *  when either term is unknown, here and in every derived figure below: absence is `null`. */
  ebp_hz(): number | null {
    const { Fs_hz, Qes } = this.solveConsistencyGroup();
    return Fs_hz === undefined || Qes === undefined ? null : this.engine.ebp(Fs_hz, Qes);
  }

  /**
   * Reference efficiency η₀ in the stated air.
   *
   * Takes `Air`, not a temperature/humidity/pressure triple, for the engine's own reason: a
   * `.wdr` may state arbitrary ρ and c that no such triple reproduces. A caller holding an
   * environment calls `Engine.airFor()` first.
   */
  referenceEfficiency(air: Air): number | null {
    const { Fs_hz, Vas_m3, Qes } = this.solveConsistencyGroup();
    return Fs_hz === undefined || Vas_m3 === undefined || Qes === undefined
      ? null : this.engine.referenceEfficiency(Fs_hz, Vas_m3, Qes, air);
  }

  /** Sensitivity in dB, from this driver's efficiency in the stated air. Uses the STATED `no`
   *  when the record has one and falls back to deriving it — the same order
   *  `deriveOpenISDFields()` uses, where an entered value is never overwritten by a computed
   *  one. */
  spl_dB(air: Air): number | null {
    const stated = this.solveConsistencyGroup().no;
    const no = stated !== undefined && stated > 0 ? stated : this.referenceEfficiency(air);
    return no === null || !(no > 0) ? null : this.engine.splFromEfficiency(no, air);
  }

  /** An INDEPENDENT driver carrying this one's current values — and, with `update()`, the whole
   *  of how an editor works: take a copy, let the user edit THAT, and on OK write it back with
   *  `update()`; on Cancel simply drop it. The original never sees an intermediate value, so
   *  Cancel needs no layer, no session object and no adapter, and the same code serves an
   *  embedded driver and a standalone one alike — which is what a generic editor wants. What makes "Save to My Drivers",
   *  "edit a bundle entry" and "fork this entry" possible without any of them reaching into the
   *  storage this window points at. Always STANDALONE — a copy belongs to nothing until
   *  something adopts it (via `OpenISDDriverEmbedded.update()`, or a repo save). */
  detach(): OpenISDDriverStandalone {
    return OpenISDDriverStandalone.wrap({ ...this.record.get() }, this.engine);
  }

  /** Replace this driver's whole record with `source`'s current values. The write-back
   *  primitive: a project adopting a different driver, or an edit made on a detached copy being
   *  put back.
   *
   *  Reads `source.record` directly. Legal because `record` is PROTECTED and this method belongs
   *  to the class that declares it, so one driver may read another's — and no consumer can,
   *  because a protected member is not on the public surface. */
  update(source: OpenISDDriver): void {
    this.record.set({ ...source.record.get() });
  }

  // A field freshly read off a record is reported Entered — there is no solver in this package
  // to distinguish Entered from Calculated; that distinction is the engine's to implement
  // against this contract.
  #buildMeta(key: MetaFieldName): Field<string> {
    return new Field<string>(
      () => ({ value: this.record.get()[key].value, state: 'entered' }),
      (v) => { this.record.set({ ...this.record.get(), [key]: { value: v, origin: 'entered' } }); },
      () => { this.record.set({ ...this.record.get(), [key]: { value: '', origin: 'entered' } }); },
    );
  }

}

/** A driver that belongs to no project — a My Drivers entry, a bundle row, a detached copy.
 *  `wrap()` windows onto a record the caller owns; the record is not copied, it is referenced. */
class OpenISDDriverStandalone extends OpenISDDriver {
  static wrap(json: OpenISDDriverJson, engine: Engine): OpenISDDriverStandalone {
    let current = json;
    const record: Lens<OpenISDDriverJson> = {
      get: () => current,
      set: (j) => { current = j; },
    };
    return new OpenISDDriverStandalone(record, OpenISDDriver.sectionOf(json), engine);
  }
}

/** The driver INSIDE a project — a window onto the project's own `driver` slot. A standalone
 *  driver windows its own record instead, which is the whole difference between the two. */
class OpenISDDriverEmbedded extends OpenISDDriver {
  private constructor(record: Lens<OpenISDDriverJson>, section: 'woofer' | 'tweeter', engine: Engine) {
    super(record, section, engine);
  }

  /** Takes the lens onto the project's `driver` slot. The project owns that slot and builds the
   *  lens, so the driver needs no reference back to the project. */
  static wrap(slot: Lens<OpenISDDriverJson>, engine: Engine): OpenISDDriverEmbedded {
    return new OpenISDDriverEmbedded(slot, OpenISDDriver.sectionOf(slot.get()), engine);
  }
}

/**
 * The radiator INSIDE a box — a window onto the box's own `component` slot, which may hold
 * nothing yet. Implements `PassiveRadiatorComponent`, so it IS what `box.passiveRadiator
 * .component` hands back, rather than a hand-assembled literal of field handles.
 *
 * Has no copy/write-back pair of its own, unlike a driver. The driver editor is a GENERIC
 * component that does not know where its driver came from, so it works on a `detach()`ed copy
 * and writes back with `update()`. The radiator's dedicated tab already knows it is editing a
 * project, so writes from the radiator tab land in the project's own edited layer like any
 * other field write.
 */
/**
 * What every radiator has, wherever the radiator lives: a lens onto ITS OWN record.
 *
 * The base exists so one radiator can read another's record without any module-scoped bridge.
 * `slot` is PROTECTED, so `update()` below — a method of the class that declares it — may read
 * `source.slot`, while nothing outside the class hierarchy can.
 *
 * The lens is NULLABLE because an embedded radiator's box may hold no radiator yet. A standalone
 * radiator refuses construction without a `passive-radiator` section, so its lens never answers
 * null in practice.
 */
abstract class OpenISDPassiveRadiator {
  protected readonly slot: Lens<OpenISDDriverJson | null>;
  /** The one calculation surface, injected exactly as the driver's and the project's are. */
  protected readonly engine: Engine;

  protected constructor(slot: Lens<OpenISDDriverJson | null>, engine: Engine) {
    this.slot = slot;
    this.engine = engine;
  }

  // ── DERIVED FIGURES — every one from the engine ───────────────────────────────────────────
  //
  // A radiator's parameters are interdependent the way a driver's are: state any two of mass,
  // compliance and resonance and the third follows. WinISD lets the user enter whichever pair
  // they have, so BOTH directions of each relation exist here, and every one is the engine's.

  /** This radiator's stated `Cms`, `Mms`, `Rms`, `Sd`, as plain numbers. Null entries where the
   *  radiator does not state that parameter, or where no radiator is chosen at all. */
  #stated(): { Cms: number | null; Mms: number | null; Rms: number | null; Sd: number | null } {
    const spec = this.slot.get()?.specs['passive-radiator'];
    const read = (k: 'Cms' | 'Mms' | 'Rms' | 'Sd') => winningValue(spec?.[k]);
    return { Cms: read('Cms'), Mms: read('Mms'), Rms: read('Rms'), Sd: read('Sd') };
  }

  /** Compliance-equivalent volume, in cubic metres. Null until both compliance and cone area
   *  are stated. */
  vas_m3(): number | null {
    const { Cms, Sd } = this.#stated();
    return Cms === null || Sd === null ? null : this.engine.prVas(Cms, Sd);
  }

  /** The compliance that WOULD give a stated Vas — the inverse of `vas_m3()`, for a user who has
   *  the radiator's Vas rather than its compliance. Null until cone area is stated. */
  cmsForVas_m_per_N(vas_m3: number): number | null {
    const { Sd } = this.#stated();
    return Sd === null ? null : this.engine.prCmsFromVas(vas_m3, Sd);
  }

  /** Free-air resonance once `added_kg` of tuning mass is bolted on — the knob a PR design is
   *  actually tuned with. Null until mass and compliance are stated. */
  fsWithAddedMass_hz(added_kg: number): number | null {
    const { Mms, Cms } = this.#stated();
    return Mms === null || Cms === null ? null : this.engine.prFsWithMass(Mms, added_kg, Cms);
  }

  /** The moving mass that would put this radiator's free-air resonance at `fs_hz` — the inverse
   *  of the unloaded resonance. Null until compliance is stated. */
  mmdForFs_kg(fs_hz: number): number | null {
    const { Cms } = this.#stated();
    return Cms === null ? null : this.engine.prMmdFromFs(fs_hz, Cms);
  }

  /** Mechanical Q. Null until mass, compliance and resistance are all stated. */
  qms(): number | null {
    const { Mms, Cms, Rms } = this.#stated();
    return Mms === null || Cms === null || Rms === null
      ? null : this.engine.prQms(Mms, Cms, Rms);
  }

  /** The mechanical resistance that would give a stated `Qms` — the inverse of `qms()`. */
  rmsForQms_kg_per_s(qms: number): number | null {
    const { Mms, Cms } = this.#stated();
    return Mms === null || Cms === null ? null : this.engine.prRmsFromQms(qms, Mms, Cms);
  }

  /**
   * Replace this radiator's record with `source`'s current values.
   *
   * PROTECTED: adopting another radiator is meaningless on a standalone, which belongs to no
   * box, so only the embedded subclass republishes this as public. Declared HERE because `slot`
   * is declared here, which is what makes reading `source.slot` legal.
   */
  protected update(source: OpenISDPassiveRadiator): void {
    const record = source.slot.get();
    this.slot.set(record === null ? null : { ...record });
  }
}

class OpenISDPassiveRadiatorEmbedded extends OpenISDPassiveRadiator implements PassiveRadiatorComponent {
  readonly brand: Field<string>;
  readonly model: Field<string>;
  readonly manufacturer: Field<string>;
  readonly providedBy: Field<string>;
  readonly comment: Field<string>;
  readonly added: Field<string>;
  readonly Fs_hz: Field<number>;
  readonly Qms: Field<number>;
  readonly Cms_m_per_N: Field<number>;
  readonly Mms_kg: Field<number>;
  readonly Rms_kg_per_s: Field<number>;
  readonly Sd_m2: Field<number>;
  readonly Vas_m3: Field<number>;
  readonly Vd_m3: Field<number>;
  readonly Xmax_m: Field<number>;
  readonly Xlim_m: Field<number>;
  readonly Dia_m: Field<number>;
  readonly Dd_m: Field<number>;
  readonly DVol_m3: Field<number>;
  readonly Thick_m: Field<number>;
  readonly Depth_m: Field<number>;
  readonly Basket_m: Field<number>;
  readonly Outer_m: Field<number>;
  readonly OuterX_m: Field<number>;
  readonly OuterY_m: Field<number>;
  readonly weight_kg: Field<number>;

  constructor(slot: Lens<OpenISDDriverJson | null>, engine: Engine) {
    super(slot, engine);
    this.brand = prMeta(slot, 'brand');
    this.model = prMeta(slot, 'model');
    this.manufacturer = prMeta(slot, 'manufacturer');
    this.providedBy = prMeta(slot, 'provided_by');
    this.comment = prMeta(slot, 'comment');
    this.added = prMeta(slot, 'added');
    this.Fs_hz = prSpec(slot, 'Fs');
    this.Qms = prSpec(slot, 'Qms');
    this.Cms_m_per_N = prSpec(slot, 'Cms');
    this.Mms_kg = prSpec(slot, 'Mms');
    this.Rms_kg_per_s = prSpec(slot, 'Rms');
    this.Sd_m2 = prSpec(slot, 'Sd');
    this.Vas_m3 = prSpec(slot, 'Vas');
    this.Vd_m3 = prSpec(slot, 'Vd');
    this.Xmax_m = prSpec(slot, 'Xmax');
    this.Xlim_m = prSpec(slot, 'Xlim');
    this.Dia_m = prSpec(slot, 'Dia');
    this.Dd_m = prSpec(slot, 'Dd');
    this.DVol_m3 = prSpec(slot, 'DVol');
    this.Thick_m = prSpec(slot, 'Thick');
    this.Depth_m = prSpec(slot, 'Depth');
    this.Basket_m = prSpec(slot, 'Basket');
    this.Outer_m = prSpec(slot, 'Outer');
    this.OuterX_m = prSpec(slot, 'OuterX');
    this.OuterY_m = prSpec(slot, 'OuterY');
    this.weight_kg = prSpec(slot, 'weight_kg');
  }

  isChosen(): boolean { return this.slot.get() !== null; }

  /** Adopt the chosen radiator into this box. The box owns its radiator from here on, so later
   *  edits change the box and never the library entry the radiator was picked from. */
  override update(source: OpenISDPassiveRadiatorStandalone): void {
    super.update(source);
  }
}

/** A radiator that belongs to no box — straight out of the bundle, or served from My PRs. The
 *  ONLY radiator type the selector popup and the PR editor ever see, and what `configurePR()`
 *  accepts. Its record has a `passive-radiator` section. Its
 *  own concept, not "a driver that happens to be a PR": no shared ancestor with `OpenISDDriver`.
 *  Same window-not-copy shape, same construction-time refusal, same eager-built fields. */
class OpenISDPassiveRadiatorStandalone extends OpenISDPassiveRadiator {
  readonly section = 'passive-radiator' as const;

  readonly brand: Field<string>;
  readonly model: Field<string>;
  readonly Fs_hz: Field<number>;
  readonly Qms: Field<number>;
  readonly Cms_m_per_N: Field<number>;
  readonly Mms_kg: Field<number>;
  readonly Rms_kg_per_s: Field<number>;
  readonly Sd_m2: Field<number>;
  readonly Vas_m3: Field<number>;
  readonly Vd_m3: Field<number>;
  readonly Xmax_m: Field<number>;
  readonly Xlim_m: Field<number>;
  readonly Dia_m: Field<number>;
  readonly Dd_m: Field<number>;
  readonly DVol_m3: Field<number>;
  readonly Thick_m: Field<number>;
  readonly Depth_m: Field<number>;
  readonly Basket_m: Field<number>;
  readonly Outer_m: Field<number>;
  readonly OuterX_m: Field<number>;
  readonly OuterY_m: Field<number>;
  readonly weight_kg: Field<number>;

  private constructor(
    get: () => OpenISDDriverJson,
    set: (json: OpenISDDriverJson) => void,
    engine: Engine,
  ) {
    super({ get, set: (json) => set(json!) }, engine);
    // The refusal in `prSpec` can never fire here: `window()` rejects a record with no
    // `passive-radiator` section, so a standalone always has one.
    this.brand = prMeta(this.slot, 'brand');
    this.model = prMeta(this.slot, 'model');
    this.Fs_hz = prSpec(this.slot, 'Fs');
    this.Qms = prSpec(this.slot, 'Qms');
    this.Cms_m_per_N = prSpec(this.slot, 'Cms');
    this.Mms_kg = prSpec(this.slot, 'Mms');
    this.Rms_kg_per_s = prSpec(this.slot, 'Rms');
    this.Sd_m2 = prSpec(this.slot, 'Sd');
    this.Vas_m3 = prSpec(this.slot, 'Vas');
    this.Vd_m3 = prSpec(this.slot, 'Vd');
    this.Xmax_m = prSpec(this.slot, 'Xmax');
    this.Xlim_m = prSpec(this.slot, 'Xlim');
    this.Dia_m = prSpec(this.slot, 'Dia');
    this.Dd_m = prSpec(this.slot, 'Dd');
    this.DVol_m3 = prSpec(this.slot, 'DVol');
    this.Thick_m = prSpec(this.slot, 'Thick');
    this.Depth_m = prSpec(this.slot, 'Depth');
    this.Basket_m = prSpec(this.slot, 'Basket');
    this.Outer_m = prSpec(this.slot, 'Outer');
    this.OuterX_m = prSpec(this.slot, 'OuterX');
    this.OuterY_m = prSpec(this.slot, 'OuterY');
    this.weight_kg = prSpec(this.slot, 'weight_kg');
  }

  static window(
    get: () => OpenISDDriverJson,
    set: (json: OpenISDDriverJson) => void,
    engine: Engine,
  ): OpenISDPassiveRadiatorStandalone {
    if (!get().specs['passive-radiator']) {
      throw new Error('OpenISDPassiveRadiatorStandalone.window: record has no passive-radiator section');
    }
    return new OpenISDPassiveRadiatorStandalone(get, set, engine);
  }

  static wrap(json: OpenISDDriverJson, engine: Engine): OpenISDPassiveRadiatorStandalone {
    let current = json;
    return OpenISDPassiveRadiatorStandalone.window(() => current, (j) => { current = j; }, engine);
  }

}

// The real "only ManagedProject reaches this" mechanism (see the file header) — module-scoped,
// never exported. `OpenISDProject` calls `notifyProject(this)` on every write instead of holding
// its own listener set, and `ManagedProject` calls `subscribeToProject(project, fn)` instead of a
// method on `project`. Nothing outside this file can reach either, which is the enforcement.

/**
 * An untrusted record from a repository → a live driver, OR the list of everything wrong with
 * it. THE one seam a driver record enters this package through: the bundle, My Drivers, a file
 * and a project's own driver slot all arrive here, so no entry point can enforce a shape another
 * does not.
 *
 * Returns problems rather than throwing, and returns them ALL rather than the first: a driver
 * picker has to SHOW why a row is unselectable, which one exception cannot express. The union
 * also means a caller cannot forget to check — reaching the driver requires narrowing past the
 * `string[]`.
 *
 * Only this function casts to the record type; no caller with an untrusted value casts itself.
 */
export function driverFromConformingRecord(record: unknown, engine: Engine): OpenISDDriver | string[] {
  if (typeof record !== 'object' || record === null) return ['not an object'];
  const r = record as Record<string, unknown>;

  const problems = metadataProblems(r);
  const specs = r.specs;
  const sections = typeof specs === 'object' && specs !== null ? specs as Record<string, unknown> : {};
  if (!sections.woofer && !sections.tweeter) {
    problems.push('neither a woofer nor a tweeter section — nothing to simulate');
  }
  return problems.length > 0 ? problems : OpenISDDriverStandalone.wrap(record as OpenISDDriverJson, engine);
}

/**
 * The same seam for a PASSIVE RADIATOR — its own function because a radiator is its own concept,
 * not a kind of driver. What differs is the section its record must carry: a radiator needs
 * `passive-radiator`, and a driver needs `woofer` or `tweeter`. Sharing one validator would mean
 * one of the two accepting a record the other's type could never model.
 *
 * Same contract as the driver seam: every problem at once, never an exception, so a radiator
 * picker can show why a row is unselectable.
 */
export function passiveRadiatorFromConformingRecord(
  record: unknown,
  engine: Engine,
): OpenISDPassiveRadiatorStandalone | string[] {
  if (typeof record !== 'object' || record === null) return ['not an object'];
  const r = record as Record<string, unknown>;

  const problems = metadataProblems(r);
  const prSpecs = r.specs;
  const prSections = typeof prSpecs === 'object' && prSpecs !== null
    ? prSpecs as Record<string, unknown> : {};
  if (!prSections['passive-radiator']) {
    problems.push('no passive-radiator section — this record is not a radiator');
  }
  return problems.length > 0
    ? problems
    : OpenISDPassiveRadiatorStandalone.wrap(record as OpenISDDriverJson, engine);
}

/** The metadata every purchasable component carries, driver or radiator alike — the one part of
 *  the two seams that IS genuinely shared, so it is written once. */
function metadataProblems(r: Record<string, unknown>): string[] {
  const problems: string[] = [];
  for (const key of ['brand', 'model', 'manufacturer', 'provided_by', 'comment', 'added']) {
    const field = r[key];
    if (typeof field !== 'object' || field === null
        || typeof (field as { value?: unknown }).value !== 'string') {
      problems.push(`'${key}' is missing or is not a stated value`);
    }
  }
  return problems;
}

// FRIEND ACCESS. Every project's record lives here rather than in a `#json` field, because the
// components a project contains — its embedded driver, its box — legitimately need to reach it,
// and TypeScript has no `friend`.
//
// The alternatives do not hold. `#json` is too private: unreachable even by a class declared
// beside it. A `json()` method — or a method returning an unexported `HasJson` interface — is
// too public: NOT exporting a type only makes it unnameable, never unreachable, so a consumer
// still writes `project.internals().json().driver.brand.value` and TypeScript resolves the whole
// chain structurally without needing a single one of those names. A module-private `unique
// symbol` key would work, but stays discoverable at runtime via `Object.getOwnPropertySymbols`.
//
// A module-scoped WeakMap is the one that actually holds: every class in THIS file can reach any
// project's record, and nothing outside can, because nothing outside can reach the map.



/**
 * THE PROJECT — the one type the app holds.
 *
 * Wraps an `OpenISDProjectJson` directly and holds TWO records: `#saved` is the project as of the
 * last save, `#edited` is the project including every change since. `#edited` is null until the
 * first write, so an untouched project costs one record, not two.
 *
 * There is no separate what-if. A what-if and an unsaved edit were the same mechanism differing
 * only in the user's intention (John 2026-08-27), so a what-if is now: edit, look at the curves,
 * press Cancel.
 *
 * `driver` and `box` are live WINDOWS over slices of whichever record is current — reads and
 * writes go straight through, never to a disconnected copy.
 */
export class OpenISDProject {
  readonly driver: OpenISDDriverEmbedded;
  readonly box: Box;
  /** What the user calls this project. A LABEL, not an identity — two projects may share one,
   *  which is exactly why `uuid()` exists. */
  readonly name: RawField<string>;

  /** The user's own note about this project. Stored, never interpreted. */
  readonly comment: RawField<string>;

  /** THE project's identity, and IN-MEMORY ONLY — deliberately a class field rather than a
   *  member of `OpenISDProjectJson`, which is what makes "internal only" structural instead of
   *  a rule someone has to remember: the record is the only thing that is ever serialised, so
   *  an id that is not in it CANNOT reach a file or a link (John 2026-08-26, QO92).
   *
   *  It exists so the running app can tell two open projects apart when their names collide,
   *  and so a store — or a focus pointer — can key on something stable. */
  readonly #uuid: string;

  /** The project as of the last save. Never mutated: every write builds a new record. */
  #saved: OpenISDProjectJson;

  /** The project including every change since the last save, or null when no change has been
   *  made. Always a COMPLETE record, never a partial one. */
  #edited: OpenISDProjectJson | null = null;

  readonly #listeners = new Set<() => void>();

  /** The one calculation surface this project uses. INJECTED — never constructed here, never
   *  reached through a module-scoped instance. Every acoustic figure the project reports comes
   *  from this reference and from nowhere else. */
  readonly #engine: Engine;

  private constructor(saved: OpenISDProjectJson, uuid: string, engine: Engine) {
    this.#saved = saved;
    this.#uuid = uuid;
    this.#engine = engine;
    this.driver = OpenISDDriverEmbedded.wrap(this.#slot('driver'), engine);
    // The box is handed the DRIVER and the ENGINE: a chamber's resonance depends on the driver
    // it loads, and the box reads the driver through its PUBLIC field surface, never its record.
    this.box = OpenISDBox.wrap(this.#slot('box'), this.driver, engine, () => this.#current().environment);
    const meta = this.#slot('meta');
    this.name = focus(meta, 'name');
    this.comment = focus(meta, 'comment');
  }

  /** A record ENTERS the process here. A record carries no identity, so one is minted — two
   *  wraps of one record are two independently editable projects, which is what opening a FILE
   *  twice should give. */
  static wrap(json: OpenISDProjectJson, engine: Engine): OpenISDProject {
    return this.wrapWithIdentity(json, newUuid(), engine);
  }

  /**
   * Wrap a record under an identity the caller already holds. FOR A STORE READ, AND NOTHING
   * ELSE: a store key was minted in this process, so adopting it back is restoring an identity,
   * not importing a foreign one. Without this, a project loaded from the store gets a new
   * identity and its next save writes to a NEW key, orphaning the entry it came from
   * (`bugs/BUG_20260826_reopening_a_stored_project_duplicates_its_store_entry.md`).
   *
   * NOT for a file: a file's id was minted by another process and is provenance, never a key
   * (the driver precedent, QO81).
   */
  static wrapWithIdentity(json: OpenISDProjectJson, uuid: string, engine: Engine): OpenISDProject {
    return new OpenISDProject(json, uuid, engine);
  }

  /** This project's in-memory identity. */
  uuid(): string { return this.#uuid; }

  /** The record every read goes to. */
  #current(): OpenISDProjectJson {
    return this.#edited ?? this.#saved;
  }

  /** Enter the edited state if not already in it, and answer the record a write must build on.
   *  The first call copies `#saved`; later calls answer the existing `#edited`. */
  #ensureEditing(): OpenISDProjectJson {
    if (!this.#edited) this.#edited = { ...this.#saved };
    return this.#edited;
  }

  /** A get/set pair addressing ONE top-level field of the record. Reads whichever record is
   *  current; every write lands in `#edited`.
   *
   *  The write REPLACES the record rather than mutating one, so a caller holding an earlier
   *  record sees no change through it — copy-on-write, with the copy being the spread that a
   *  write performs anyway. */
  #slot<K extends keyof OpenISDProjectJson>(key: K): Lens<OpenISDProjectJson[K]> {
    return {
      get: () => this.#current()[key],
      set: (value) => {
        const base = this.#ensureEditing();
        this.#edited = { ...base, [key]: value };
        this.#notify();
      },
    };
  }

  /** @internal The record a save writes. */
  recordToPersist(): OpenISDProjectJson { return this.#current(); }

  /** Whether unsaved changes exist. Answered by the presence of `#edited`: the first write
   *  creates it, and only `save()` or `cancel()` removes it. */
  isModified(): boolean { return this.#edited !== null; }

  // ── THE SIGNAL ────────────────────────────────────────────────────────────────────────────

  /**
   * The voltage that delivers this project's stated drive power into its driver — `√(Pin·Re)`,
   * WinISD's reference-power convention, and the `eg` every sweep is run at.
   *
   * Null when no power is stated or the driver has no usable `Re`. Never a substituted default:
   * a project that has not been told its drive level does not have one.
   */
  driveVoltage_V(): number | null {
    const power_W = this.#current().signal.power_W;
    const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
    return power_W === null || Re_ohm === undefined ? null : this.#engine.driveVoltage(power_W, Re_ohm);
  }

  /**
   * Qts as the amplifier's source impedance actually loads it.
   *
   * `Rs` is a PARAMETER rather than a record field because the record has no home for it — the
   * same decision `packages/model`'s `sealedResonance()` made and for the same reason. When the
   * amplifier's output impedance gets a home, this reads it instead.
   *
   * Null when the driver's Q group is too incomplete to resolve.
   */
  sourceLoadedQts(Rs: number): number | null {
    const { Qms, Qes, Re_ohm, Qts } = this.driver.solveConsistencyGroup();
    if (Qms === undefined || Qes === undefined || Re_ohm === undefined || Qts === undefined) return null;
    return this.#engine.sourceLoadedQts(Qms, Qes, Re_ohm, Rs, Qts);
  }

  // ── SIMULATION — the engine's sweep, run on THIS project's driver and box ──────────────────
  //
  // The project supplies what only it knows — the driver and which enclosure topology is active
  // — and the caller supplies the sweep's own parameters. It does NOT assemble `SweepParams`
  // from the record: that assembly is a policy decision (which losses, which grid, how many
  // drivers) that belongs to whoever is asking for the sweep, not to the project.

  /**
   * Which of the engine's simulable topologies this project is, or null.
   *
   * There is ONE box-type vocabulary now, so this translates nothing — it asks the engine which
   * of its own types it can model. Null for `bandpass6` and `abc`, which it has no circuit for,
   * and that null is the reason every simulation method below can return null: not a failure, a
   * topology the engine does not yet cover.
   */
  #engineBoxType(): SimulatableBoxType | null {
    return this.#engine.simulatableBoxType(this.box.boxType.get());
  }

  /** The frequency response, impedance and excursion this design produces — or the issues that
   *  stopped it, each NAMING the quantity the driver does not state. A bare null would say only
   *  "cannot simulate", which is what a caller cannot act on. `value` is null with an empty
   *  `errors` when the active topology is one the engine has no model for. */
  sweep(P: SweepParams): Result<SweepResult> {
    const box = this.#engineBoxType();
    if (!box) return { value: null, errors: [] };
    return this.#engine.sweep(this.driver.terminalFields(), this.driver.Le_H(), box, P);
  }

  /** The excursion- and power-limited maximum SPL curves. Reports on the same terms as `sweep`. */
  maxCurves(P: SweepParams): Result<MaxCurvesResult> {
    const box = this.#engineBoxType();
    if (!box) return { value: null, errors: [] };
    return this.#engine.maxCurves(this.driver.terminalFields(), this.driver.Le_H(), box, P);
  }

  /** What is wrong with these sweep parameters for this project's topology — checked BEFORE a
   *  sweep, so a caller can refuse rather than plot nonsense. Empty when nothing is wrong. */
  validateParams(P: SweepParams): DriverError[] {
    const box = this.#engineBoxType();
    return box ? this.#engine.validateParams(box, P) : [];
  }

  /** The passband level a response is measured against — the reference every dB figure below is
   *  relative to. */
  passbandRef(spl: number[]): number { return this.#engine.passbandRef(spl); }

  /** The frequency where the response has fallen `dropDb` below its passband — F3 at 3 dB, F6 at
   *  6, and so on. Null when the response never falls that far inside the swept range. */
  rolloffFreq(sw: SweepResult, dropDb: number): number | null {
    return this.#engine.rolloffFreq(sw, dropDb);
  }

  /** A non-finite value anywhere in the response, or null. A sweep that produced NaN is a fault
   *  to report, never a curve to draw. */
  classifyFinite(sw: SweepResult): DriverError | null { return this.#engine.classifyFinite(sw); }

  /** A response clamped flat against a limit, or null — a shape that looks like a valid answer
   *  and is not. */
  classifyFlatClamp(sw: SweepResult): DriverError | null {
    return this.#engine.classifyFlatClamp(sw);
  }

  /** The same finiteness check for the max-SPL curves. */
  classifyMaxFinite(mx: MaxCurvesResult): DriverError | null {
    return this.#engine.classifyMaxFinite(mx);
  }

  /**
   * The impedance peak of a swept response — the resonance the design ACTUALLY exhibits, read
   * off the curve rather than predicted from a formula.
   *
   * Reads `Re` off this project's own driver, which is why it lives here and not on the caller.
   * Null when the driver has no usable `Re`, or the curve has no peak.
   */
  impedancePeak(sw: SweepResult | null): { Fsc: number; Qtc: number } | null {
    const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
    return Re_ohm === undefined ? null : this.#engine.findImpedancePeak(sw, Re_ohm);
  }

  /** Promote the edited record. A no-op when nothing has been edited. */
  save(): void {
    if (!this.#edited) return;
    this.#saved = this.#edited;
    this.#edited = null;
    this.#notify();
  }

  /**
   * Discard every change since the last save, after `confirm` agrees.
   *
   * The challenge is a PARAMETER because the caller — the Cancel button on the project bar —
   * already owns the warning dialog and holds the answer at the moment of the call. Threading a
   * callback through every construction path would deliver a value that one caller already has.
   *
   * Answers whether anything was discarded: false when nothing was edited, and false when the
   * user declined.
   */
  async cancel(confirm: DiscardChallenge): Promise<boolean> {
    if (!this.#edited) return false;
    if (!await confirm()) return false;
    this.#edited = null;
    this.#notify();
    return true;
  }

  /** Register a listener, fired on every change to the current record and on entering or
   *  leaving the edited state. Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void {
    this.#listeners.add(fn);
    return () => { this.#listeners.delete(fn); };
  }

  #notify(): void {
    this.#listeners.forEach((fn) => fn());
  }
}

/**
 * The app's warning before unsaved changes are destroyed, as `cancel()` sees it: answers whether
 * to go ahead. Async because a dialog is — the domain waits for a person.
 */
export type DiscardChallenge = () => Promise<boolean>;

/**
 * A project with nothing designed yet.
 *
 * The driver slot holds an EMPTY WOOFER SECTION — a section present, nothing stated. That is
 * enough for `OpenISDDriver.sectionOf()` to succeed, which is what lets a project be constructed
 * before its driver has been written in; the real driver arrives immediately afterwards through
 * `project.driver.update()`. No zeros are invented, because every spec field is optional.
 */
function emptyProjectJson(): OpenISDProjectJson {
  const unstated = { value: '', origin: 'unstated' };
  return {
    driver: {
      brand: unstated, model: unstated, manufacturer: unstated,
      provided_by: unstated, comment: unstated, added: unstated,
      specs: { woofer: {} },
    },
    box: emptyBoxJson(),
    environment: { temperature_K: null, humidity_pct: null, pressure_Pa: null },
    signal: { power_W: null, voltage_V: null },
    meta: { name: '', comment: '' },
  };
}

// ---------------------------------------------------------------------------------------------
// BUILDING A PROJECT — the wizard's path in, and the only way to make an `OpenISDProject`.
// ---------------------------------------------------------------------------------------------

/**
 * A project is not valid until it has a driver AND a box type, and each box type needs different
 * things — so choosing the box type hands back a builder SPECIALISED to it. A sealed builder has
 * no tuning to set; a passive-radiator builder demands a radiator; a bandpass builder asks about
 * two chambers. None of them can be reached without a driver, because that is where the chain
 * starts.
 *
 * What is required to BUILD is only what defines the enclosure — volumes, tunings, and the PR's
 * own radiator. Vents, losses and the rest have real defaults and are what the user fills in
 * afterwards, through the normal `box` surface. `build()` names anything still missing rather
 * than quietly producing a half-formed project.
 */
export function newProject(driver: OpenISDDriver, engine: Engine): ProjectBuilder {
  return new ProjectBuilder(driver, engine);
}

class ProjectBuilder {
  readonly #driver: OpenISDDriver;
  readonly #engine: Engine;

  constructor(driver: OpenISDDriver, engine: Engine) {
    this.#driver = driver;
    this.#engine = engine;
  }

  sealed(): SealedProjectBuilder { return new SealedProjectBuilder(this.#driver, this.#engine); }
  vented(): VentedProjectBuilder { return new VentedProjectBuilder(this.#driver, this.#engine); }
  bandpass4(): Bandpass4ProjectBuilder { return new Bandpass4ProjectBuilder(this.#driver, this.#engine); }
  bandpass6(): TwoChamberProjectBuilder { return new TwoChamberProjectBuilder(this.#driver, this.#engine, 'bandpass6'); }
  abc(): TwoChamberProjectBuilder { return new TwoChamberProjectBuilder(this.#driver, this.#engine, 'abc'); }
  passiveRadiator(): PassiveRadiatorProjectBuilder {
    return new PassiveRadiatorProjectBuilder(this.#driver, this.#engine);
  }
}

/** Shared assembly. Each specialised builder decides the box record; this turns it into a
 *  managed project, so there is ONE place a project comes into existence. */
abstract class BoxProjectBuilder {
  /** The driver OBJECT, not its record. A record could not be read out of it anyway — only
   *  `OpenISDDriver` and its subclasses can reach a driver's storage — and it does not need to
   *  be: `build()` hands the object to the project's own embedded driver, which copies it in. */
  protected readonly driver: OpenISDDriver;
  /** The one calculation surface, on its way to the project this builder will assemble. */
  protected readonly engine: Engine;
  protected constructor(driver: OpenISDDriver, engine: Engine) {
    this.driver = driver;
    this.engine = engine;
  }

  /** The chosen radiator, for the builders that take one. */
  protected radiatorChoice: OpenISDPassiveRadiatorStandalone | null = null;

  protected abstract boxRecord(): OpenISDBoxJson;

  protected static required(value: number | null, what: string): number {
    if (value === null) throw new Error(`build(): ${what} is required`);
    return value;
  }

  /**
   * Assemble the project — the LAST thing, once every part has been collected.
   *
   * The project is constructed with an empty driver section, then each component copies ITSELF
   * in: `project.driver.update()` is one driver reading another, inside the class that declares
   * the record, and the radiator does the same. So no record crosses a boundary and the project
   * never handles driver state.
   */
  build(): OpenISDProject {
    const project = OpenISDProject.wrap({ ...emptyProjectJson(), box: this.boxRecord() }, this.engine);
    project.driver.update(this.driver);
    if (this.radiatorChoice) project.box.passiveRadiator.radiator.update(this.radiatorChoice);
    // Those writes land in `#edited`, because every write does. A project the user has just
    // created has no UNSAVED changes, though — so the assembled state IS its saved baseline.
    // Without this a new project is born modified, and Cancel would discard its own driver.
    project.save();
    return project;
  }
}

class SealedProjectBuilder extends BoxProjectBuilder {
  #volume: number | null = null;
  constructor(driver: OpenISDDriver, engine: Engine) { super(driver, engine); }
  volume_m3(v: number): this { this.#volume = v; return this; }
  protected boxRecord(): OpenISDBoxJson {
    const box = emptyBoxJson();
    return {
      ...box,
      boxType: 'sealed',
      sealed: { ...box.sealed, volume_m3: BoxProjectBuilder.required(this.#volume, 'sealed volume_m3') },
    };
  }
}

class VentedProjectBuilder extends BoxProjectBuilder {
  #volume: number | null = null;
  #tuning: number | null = null;
  constructor(driver: OpenISDDriver, engine: Engine) { super(driver, engine); }
  volume_m3(v: number): this { this.#volume = v; return this; }
  tuning_hz(v: number): this { this.#tuning = v; return this; }
  protected boxRecord(): OpenISDBoxJson {
    const box = emptyBoxJson();
    return {
      ...box,
      boxType: 'vented',
      vented: {
        ...box.vented,
        chamber: {
          ...box.vented.chamber,
          volume_m3: BoxProjectBuilder.required(this.#volume, 'vented volume_m3'),
          tuning_hz: BoxProjectBuilder.required(this.#tuning, 'vented tuning_hz'),
        },
      },
    };
  }
}

/** Bandpass 4th order: a SEALED rear chamber (no tuning of its own — its resonance is
 *  calculated) and a vented front one. */
class Bandpass4ProjectBuilder extends BoxProjectBuilder {
  #rearVolume: number | null = null;
  #frontVolume: number | null = null;
  #frontTuning: number | null = null;
  constructor(driver: OpenISDDriver, engine: Engine) { super(driver, engine); }
  rearVolume_m3(v: number): this { this.#rearVolume = v; return this; }
  frontVolume_m3(v: number): this { this.#frontVolume = v; return this; }
  frontTuning_hz(v: number): this { this.#frontTuning = v; return this; }
  protected boxRecord(): OpenISDBoxJson {
    const box = emptyBoxJson();
    const R = BoxProjectBuilder.required;
    return {
      ...box,
      boxType: 'bandpass4',
      bandpass4: {
        ...box.bandpass4,
        rear: { ...box.bandpass4.rear, volume_m3: R(this.#rearVolume, 'bandpass4 rearVolume_m3') },
        front: {
          ...box.bandpass4.front,
          volume_m3: R(this.#frontVolume, 'bandpass4 frontVolume_m3'),
          tuning_hz: R(this.#frontTuning, 'bandpass4 frontTuning_hz'),
        },
      },
    };
  }
}

/** Bandpass 6th order and ABC: two INDEPENDENTLY tunable chambers. Identical to build — they
 *  differ in their ports (ABC adds a third, connecting one), which is set afterwards through
 *  the box surface, not here. */
class TwoChamberProjectBuilder extends BoxProjectBuilder {
  readonly #kind: 'bandpass6' | 'abc';
  #rearVolume: number | null = null;
  #rearTuning: number | null = null;
  #frontVolume: number | null = null;
  #frontTuning: number | null = null;

  constructor(driver: OpenISDDriver, engine: Engine, kind: 'bandpass6' | 'abc') {
    super(driver, engine);
    this.#kind = kind;
  }

  rearVolume_m3(v: number): this { this.#rearVolume = v; return this; }
  rearTuning_hz(v: number): this { this.#rearTuning = v; return this; }
  frontVolume_m3(v: number): this { this.#frontVolume = v; return this; }
  frontTuning_hz(v: number): this { this.#frontTuning = v; return this; }

  protected boxRecord(): OpenISDBoxJson {
    const box = emptyBoxJson();
    const R = BoxProjectBuilder.required;
    const k = this.#kind;
    const chambers = {
      rear: {
        ...box[k].rear,
        volume_m3: R(this.#rearVolume, `${k} rearVolume_m3`),
        tuning_hz: R(this.#rearTuning, `${k} rearTuning_hz`),
      },
      front: {
        ...box[k].front,
        volume_m3: R(this.#frontVolume, `${k} frontVolume_m3`),
        tuning_hz: R(this.#frontTuning, `${k} frontTuning_hz`),
      },
    };
    return { ...box, boxType: k, [k]: { ...box[k], ...chambers } };
  }
}

/** A passive-radiator box cannot be valid without a RADIATOR — the one box type whose builder
 *  demands a second component, which is exactly why it has a builder of its own. */
class PassiveRadiatorProjectBuilder extends BoxProjectBuilder {
  #volume: number | null = null;
  #tuning: number | null = null;
  #count = 1;

  constructor(driver: OpenISDDriver, engine: Engine) { super(driver, engine); }

  volume_m3(v: number): this { this.#volume = v; return this; }
  tuning_hz(v: number): this { this.#tuning = v; return this; }
  count(v: number): this { this.#count = v; return this; }
  /** Takes an ALREADY-VALIDATED radiator, from `passiveRadiatorFromConformingRecord()`. Kept as
   *  the OBJECT; `build()` has the box's own radiator copy it in. */
  radiator(radiator: OpenISDPassiveRadiatorStandalone): this {
    this.radiatorChoice = radiator;
    return this;
  }

  protected boxRecord(): OpenISDBoxJson {
    const box = emptyBoxJson();
    const R = BoxProjectBuilder.required;
    if (!this.radiatorChoice) throw new Error('build(): a passive-radiator box requires a radiator');
    // `component` stays null HERE and is filled by `build()`, which has the box's own radiator
    // adopt the chosen one — the record is private to the radiator, so the builder cannot copy
    // it across itself.
    return {
      ...box,
      boxType: 'box-passive-radiator',
      passiveRadiator: {
        ...box.passiveRadiator,
        volume_m3: R(this.#volume, 'passive-radiator volume_m3'),
        tuning_hz: R(this.#tuning, 'passive-radiator tuning_hz'),
        count: this.#count,
      },
    };
  }
}

// ── PERSISTENCE ────────────────────────────────────────────────────────────────────────────
//
//     app / UI
//        │   domain objects only — `OpenISDProject`
//     ProjectRepo     ── peer of the DOMAIN OBJECT, lives HERE
//        │   `OpenISDProjectJson`, which never appears in any signature below
//     RecordStore<R>  ── peer of the RECORD, injected, implemented elsewhere
//        │
//     IndexedDB (packages/design/browser) / a file / a server
//
// The repo is the only code that converts between the two vocabularies, so it is the only code
// that needs both. It lives in THIS module because converting requires the record type and the
// module-private `projectRecords` registry, neither of which leaves this file.
//
// The store does NOT live here, and does not need to: it is injected as a GENERIC factory
// (`projectRepo()` takes the factory), so the implementation is parametric in the record type and can neither
// name nor inspect it. That is what keeps browser code out of a package that otherwise depends
// on nothing, while `OpenISDProjectJson` stays unexported and unnameable everywhere.

/**
 * What a stored project is called, for a picker.
 *
 * PUBLIC on purpose, unlike the record: it is the label a user reads, so hiding it would only
 * force the store to invent a shape it cannot see. Carried ALONGSIDE the record rather than read
 * out of it, because the store is not allowed to look inside.
 */
/**
 * Somewhere to keep records, keyed by a string the caller supplies.
 *
 * PARAMETRIC IN `R` AND DELIBERATELY IGNORANT OF IT. An implementation stores and returns values
 * of `R` without ever inspecting them, so it cannot depend on what `R` turns out to be — which
 * is exactly what lets the record type stay private to this module while the implementation
 * lives in another package entirely.
 *
 * Ignorance costs nothing in practice: IndexedDB declares its indexes with runtime keyPath
 * strings (`'meta.name'`), so a store can index a value it has no compile-time knowledge of. The
 * bytes on disk are a real, self-describing JSON document; only the TYPE is opaque.
 *
 * ASSUMES the record is kept as a STRUCTURED VALUE, not a serialised string — a string cannot be
 * indexed, and every listing would then have to deserialise every entry.
 */
export interface RecordStore<R> {
  /**
   * Keep `record` under `id`, replacing whatever was there, and stamp it as modified now.
   *
   * TAKES `meta` SEPARATELY because it may not read the record. Stamping is the STORE's job, not
   * the caller's: "when this was last written" is a fact about the act of writing, and the store
   * is the only participant present at the moment it happens.
   *
   * WHY IT EXISTS: `ProjectRepo.save()` needs somewhere to put what it extracted, and must not
   * care whether that is IndexedDB, a file or a server.
   */
  put(id: string, record: R): void;

  /**
   * The record under `id`, or null when there is none.
   *
   * Null means ABSENT, never "unreadable" — a stored value that cannot be understood is a fault
   * to report, and collapsing the two is how a corrupt entry becomes a silently missing project.
   *
   * WHY IT EXISTS: `ProjectRepo.load()` needs the raw record before it can rebuild a project.
   */
  get(id: string): R | null;

  /**
   * Every entry's key, label and modification time — enough to draw a picker, nothing more.
   *
   * DEPENDS ON an index over the stored records. Reading whole records and discarding them would
   * work and is wrong: it makes showing a picker cost the size of every stored project rather
   * than the number of them.
   *
   * WHY IT EXISTS: it is the only way `ProjectRepo.list()` can be cheap.
   */
  list(): { id: string; label: string; modified: string }[];

  /**
   * Delete the record under `id`. Deleting an absent id is NOT an error — the postcondition
   * ("nothing is stored under `id`") already holds, which is what makes deletion safe to retry
   * after a failure with no caller checking first.
   *
   * WHY IT EXISTS: `ProjectRepo.remove()` needs it.
   */
  remove(id: string): void;
}

/**
 * A store implementation, before it knows what it will hold.
 *
 * GENERIC, and that is the whole mechanism. If the registry took a `RecordStore<OpenISDProjectJson>`
 * directly, an outsider could still satisfy that parameter by inference even without being able to
 * NAME the type — the standing hole with unexported types. A factory that must work for ANY `R`
 * cannot depend on which one it gets, so parametricity enforces the boundary instead of a naming
 * convention, and no cast is needed anywhere.
 */
export type RecordStoreFactory = <R>(labelPath: string) => RecordStore<R>;


/**
 * The app's delete dialog, as the repo sees it: shown the entry that is really about to be
 * destroyed, answering whether to proceed.
 *
 * Async because a dialog is — the repo waits for a person. `false` is a full stop, not a retry:
 * the entry is left exactly as it was.
 */
export type DeleteChallenge = (entry: ProjectListing) => Promise<boolean>;

/**
 * How a delete ended. Three outcomes rather than a boolean, because "nothing was deleted" has two
 * very different causes and a caller reporting to the user must tell them apart: the user
 * declined, versus the entry was not there at all (already deleted, or a stale row).
 */
export type DeleteOutcome = 'deleted' | 'declined' | 'absent';

/**
 * One row of `ProjectRepo.list()` — plain data for a picker.
 *
 * Deliberately NOT a snapshot of the project: a listing exists so the user can CHOOSE, so it
 * carries only what a chooser needs. Anything more would be a second route to project state that
 * bypasses `load()`.
 */
export interface ProjectListing {
  /** The STORE KEY — pass it back to `load()` or `remove()`.
   *
   *  It IS the project's uuid: `save()` keys on `OpenISDProject.uuid()`, and `load()` adopts the
   *  key back, so an entry and the project opened from it share one identity. That is what lets a
   *  workspace tell whether a row in the picker is already open, and what stops a reopened design
   *  autosaving into a second entry. */
  readonly id: string;
  /** The project's name. A LABEL, never an identity: two entries may share one. */
  readonly name: string;
  /** When the entry was last written, for ordering the picker most-recent-first. */
  readonly modified: string;
}

/**
 * The app's door to stored projects, in DOMAIN vocabulary.
 *
 * Every method takes or returns an `OpenISDProject` or plain data — never a record — so no caller
 * can see the stored shape, and a change to that shape cannot reach the app.
 *
 * DEPENDS ON the `RecordStore` handed to `projectRepo()`, and on this module's privileged
 * access to a project's own record. Both are why it lives here rather than in an app package.
 *
 * ASSUMES identity comes from the project itself (`OpenISDProject.uuid()`) and is in-memory only,
 * never carried in the record — so the repo supplies the key on every call, and a record on its
 * own names nothing.
 */
export interface ProjectRepo {
  /**
   * Write `project`'s current design to the store under its own uuid, replacing any entry there.
   *
   * PERSISTS the edit layer if one is open, else committed — never an open what-if, which is
   * exploratory and must not survive the session. There is no layer parameter, so no call site
   * can persist the wrong thing.
   *
   * WHY IT EXISTS — AUTOSAVE: the user types a box volume, is called away, and the browser
   * discards the tab. On return the design is still there. Today the app has no answer to that:
   * work between explicit File → Save actions is simply lost.
   *
   * Autosave is this method plus a TRIGGER — the project's own change notification calling it.
   * The trigger is still undecided (QO92: every change, debounced, or on blur), and the same
   * method serves an explicit toolbar Save. WHAT is written is settled here; WHEN is not.
   */
  save(project: OpenISDProject): void;

  /**
   * Rebuild the project stored under `id` as a fresh `OpenISDProject`, with nothing edited.
   *
   * RETURNS the problems rather than throwing, so a caller listing projects can show WHY a row
   * cannot be opened instead of failing on click.
   *
   * ADOPTS `id` AS THE PROJECT'S IDENTITY. A store key was minted in this process, so restoring
   * it is not importing a foreign id — and it is what makes reopening idempotent: the project's
   * next save writes back to the entry it came from. Opening one entry twice therefore yields two
   * handles on the SAME identity, which a workspace should collapse by focusing what is already
   * open rather than loading a second copy. (A FILE import still mints: a file's id is provenance,
   * never a key — the driver precedent, QO81.)
   *
   * WHY IT EXISTS: the user picks "Ported 8in v3" from the list and expects the design back as
   * they left it, editable. It is also the reload path.
   */
  load(id: string): OpenISDProject | string[];

  /**
   * Everything the store holds, most-recently-modified first.
   *
   * WHY IT EXISTS: the picker opens with forty designs stored and must render immediately.
   * Without a listing the only way to show it is to load all forty — the whole cost of opening
   * every design, paid to render forty lines of text.
   */
  list(): ProjectListing[];

  /**
   * Delete the stored entry for `id`, but ONLY after `confirm` agrees.
   *
   * Deletion is final: no archive, no undo, and once the user has no file there is no copy left
   * anywhere. So the challenge is a PARAMETER, not a convention — there is no overload without
   * it and no call site can forget it (John 2026-08-26). What the UI must put in that dialog:
   *
   *   1. OFFER EXPORT FIRST, as the default action — deletion is only safe once the design exists
   *      somewhere else, and the moment to say so is before it is gone.
   *   2. DEMAND A TYPED 3-DIGIT NUMBER, generated per dialog. A button can be clicked reflexively
   *      and a checkbox ticked without reading; typing digits cannot be done by muscle memory,
   *      which forces the user to look at WHICH project the dialog names. Generated rather than
   *      fixed, or regular users learn it and it decays back into a button.
   *
   * `confirm` RECEIVES THE STORED ENTRY, so the dialog names what is really about to be destroyed
   * rather than what the caller believed it was pointing at. It is called ONLY when the entry is
   * found: a dialog about a project that is already gone teaches users to dismiss dialogs unread.
   *
   * Deliberately harsher than the CLOSE challenge, which offers three named outcomes and no
   * typing. Closing loses work since the last file save; this destroys the stored copy too.
   *
   * WHY IT EXISTS: a store that only ever grows eventually hits its quota, and the first symptom
   * is saves silently failing. The user needs to throw away the experiments they no longer want.
   */
  remove(id: string, confirm: DeleteChallenge): Promise<DeleteOutcome>;
}

/**
 * Build a repo over the store `make` produces.
 *
 * THE FACTORY IS INSTANTIATED HERE, at the private record type. So the caller supplies a store
 * without ever learning what it will hold, and this module fixes the type without the caller
 * being able to name it — the boundary is enforced by parametricity, not by a naming rule, and
 * no cast appears anywhere.
 *
 * The store is held by the returned repo, NOT in module scope. A module-scoped store would have
 * to be installed exactly once, which makes a second repo impossible to create and the package
 * impossible to test — a test would need a reset backdoor that ships in production code. Passing
 * it in costs one argument at the composition root and removes the global entirely.
 *
 * ASSUMES the composition root builds ONE repo and shares it. Two repos over two factories are
 * two stores; over IndexedDB they would address the same database, but nothing here enforces
 * that, and nothing needs to — deciding what exists once is what a composition root is for.
 */
export function projectRepo(make: RecordStoreFactory, engine: Engine): ProjectRepo {
  const store = make<OpenISDProjectJson>('meta.name');
  return {
    save(project: OpenISDProject): void {
      const json = project.recordToPersist();
      store.put(project.uuid(), json);
    },

    load(id: string): OpenISDProject | string[] {
      const json = store.get(id);
      if (!json) return [`no stored project with id ${id}`];
      // ADOPTS `id` as the project's identity, so its next save writes back to the entry it came
      // from rather than minting a second one. See `wrapWithIdentity()`.
      return OpenISDProject.wrapWithIdentity(json, id, engine);
    },

    list(): ProjectListing[] {
      return store.list()
        .map(e => ({ id: e.id, name: e.label, modified: e.modified }))
        .sort((a, b) => (a.modified < b.modified ? 1 : a.modified > b.modified ? -1 : 0));
    },

    async remove(id: string, confirm: DeleteChallenge): Promise<DeleteOutcome> {
      // FOUND FIRST, then challenge: there is nothing to name and nothing to lose when `id`
      // matches nothing, and the listing is what gives the dialog the real entry to show.
      const entry = this.list().find(e => e.id === id);
      if (!entry) return 'absent';
      if (!await confirm(entry)) return 'declined';
      store.remove(id);
      return 'deleted';
    },
  };
}
