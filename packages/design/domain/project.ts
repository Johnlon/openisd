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
// reimplemented `engine/alignments.ts:sealedFc()` over frozen air constants, in the precise way
// `engine/formulas.ts:prVas()` documents as wrong ("ρ/c are computed live at the reference
// environment — never a stored constant").
//
// THE TEST, when unsure: could two competent implementers disagree about the answer? If yes it is
// acoustics — it belongs to the engine, and here it calls `noEngine()`. If no, it is geometry.
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

/**
 * Refuse a calculation that belongs to `@openisd/engine`. See the ruling at the top of this file.
 *
 * THROWS rather than returning null, deliberately. Null is this domain's word for "the value is
 * not stated", which a caller is entitled to render as a blank — so answering null here would
 * report a missing INPUT when the truth is a missing IMPLEMENTATION, and the gap would stay
 * invisible until someone wondered why a figure never appears. A throw is found by whoever calls
 * it, immediately, and names itself in the message.
 *
 * Returns `never`, so a call site satisfies any return type without a cast.
 */
function noEngine(what: string): never {
  throw new Error(
    `${what}: acoustic calculations belong to @openisd/engine, and this domain is not wired to it yet`);
}
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

interface ScrapedField<T> {
  readonly value: T;
  readonly origin: string;
}

interface SpecSection {
  readonly Fs_hz: ScrapedField<number>;
  readonly Sd_m2: ScrapedField<number>;
  readonly Cms_m_per_N: ScrapedField<number>;
  readonly Mmd_kg: ScrapedField<number>;
  readonly Rms_Ns_per_m: ScrapedField<number>;
  readonly Xmax_m: ScrapedField<number>;
  // ...one ScrapedField per T/S parameter in that section.
}

type MetaFieldName =
  'brand' | 'model' | 'manufacturer' | 'provided_by' | 'comment' | 'added';
type SpecFieldName =
  'Fs_hz' | 'Sd_m2' | 'Cms_m_per_N' | 'Mmd_kg' | 'Rms_Ns_per_m' | 'Xmax_m';

interface OpenISDDriverJson {
  readonly brand: ScrapedField<string>;
  readonly model: ScrapedField<string>;
  readonly manufacturer: ScrapedField<string>;
  readonly provided_by: ScrapedField<string>;
  readonly comment: ScrapedField<string>;
  readonly added: ScrapedField<string>;
  readonly woofer?: SpecSection;
  readonly tweeter?: SpecSection;
  readonly 'passive-radiator'?: SpecSection;
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

interface OpenISDEnvironmentJson {
  readonly temperature_K: number;
  readonly humidity_pct: number;
  readonly pressure_Pa: number;
}

interface OpenISDSignalJson {
  readonly power_W: number;
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
// FRIEND SIDE-TABLE 1 of 4 — the one exception to AGENTS.md §"GLOBAL VARIABLES ARE FORBIDDEN",
// which requires each use to name what it holds and every referee.
//
// HOLDS: for one component wrapper (a standalone driver or passive radiator), a closure that
//   returns THAT wrapper's own `OpenISDDriverJson`. One entry per wrapper; nothing shared.
// EXPOSES: `OpenISDDriverStandalone`'s / `OpenISDPassiveRadiatorStandalone`'s private record.
// TO: whichever sibling needs to COPY that record into its own storage.
//
// REFEREES — every one, and there are no others:
//   writers, via `registerJsonReader()`:
//     `OpenISDDriverStandalone.wrap()`          — registers itself on construction
//     `OpenISDPassiveRadiatorStandalone.wrap()` — likewise
//   readers, via `readWrappedJson()`:
//     `OpenISDBox.configurePR()`  — copies a chosen radiator INTO the box's own storage
//     `…Standalone.update()`      — adopts an edited copy back over the original
//     `newProject()`              — seeds the builder from the chosen driver
//     `PassiveRadiatorProjectBuilder.radiator()` — seeds the box's PR slot
//
// WHY NOT A PUBLIC METHOD: a `toJson()` on the class would hand the private record shape to any
// consumer — the exact leak these types exist to prevent. Registering here keeps the capability
// inside the module: only code that can import this file can read it back.
const jsonReaders = new WeakMap<object, () => OpenISDDriverJson>();

function registerJsonReader(wrapper: object, read: () => OpenISDDriverJson): void {
  jsonReaders.set(wrapper, read);
}

function readWrappedJson(wrapper: object): OpenISDDriverJson {
  const read = jsonReaders.get(wrapper);
  if (!read) throw new Error('readWrappedJson: wrapper did not register a reader');
  return read();
}

// ---------------------------------------------------------------------------------------------
// THE BOX — its public shape, then the window that implements it.
// ---------------------------------------------------------------------------------------------

// 'bandpass6' and 'abc' confirmed real, working box types in WinISD (BUG_20260824,
// 2026-08-24/25 live probe) — its wizard warns no one-click alignment SUGGESTION exists for
// either, not that the box type itself doesn't work.
export type BoxType = 'sealed' | 'vented' | 'bandpass4' | 'bandpass6' | 'passive-radiator' | 'abc';

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
  readonly brand: FieldHandle<string>;
  readonly model: FieldHandle<string>;
  readonly manufacturer: FieldHandle<string>;
  readonly providedBy: FieldHandle<string>;
  readonly comment: FieldHandle<string>;
  readonly added: FieldHandle<string>;
  readonly Sd_m2: FieldHandle<number>;
  readonly Mmd_kg: FieldHandle<number>;
  readonly Cms_m_per_N: FieldHandle<number>;
  readonly Rms_Ns_per_m: FieldHandle<number>;
  readonly Xmax_m: FieldHandle<number>;
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
  readonly component: PassiveRadiatorComponent;
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
  readonly shape: RawField<VentShape>;
  readonly endCorrection_m: RawField<number>;

  readonly diameter_m: FieldHandle<number>;
  readonly width_m: FieldHandle<number>;
  readonly height_m: FieldHandle<number>;
  readonly length_m: FieldHandle<number>;

  constructor(lens: Lens<VentJson>) {
    this.#lens = lens;
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

  /** Acoustic length — physical length plus the end correction. ACOUSTICS, not geometry, so it
   *  belongs to `@openisd/engine` and throws here.
   *
   *  The end correction models how air outside the port behaves, which is exactly the kind of
   *  thing the domain must not decide. Its parity question travels with it and is the engine's to
   *  settle: the FACTOR is stored (0.85, the common one-flanged-end value), but which radius it
   *  multiplies has never been probed against real WinISD. */
  effectiveLength_m(): number | null {
    return noEngine('effectiveLength_m');
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
function prSpec(
  lens: Lens<OpenISDDriverJson | null>,
  key: SpecFieldName,
): Field<number> {
  return new Field<number>(
    () => {
      const spec = lens.get()?.['passive-radiator'];
      return spec ? { value: spec[key].value, state: 'entered' } : { value: null, state: 'not-available' };
    },
    (v) => {
      const json = lens.get();
      const spec = json?.['passive-radiator'];
      if (!json || !spec) {
        throw new Error(
          `passiveRadiator.component.${key} cannot be written: no radiator is chosen yet — ` +
          'call configurePR() first.',
        );
      }
      lens.set({ ...json, 'passive-radiator': { ...spec, [key]: { value: v, origin: 'entered' } } });
    },
    () => {
      throw new Error(
        `${key} cannot be cleared: a chosen radiator's spec section always exists — there is ` +
        'no "not entered" state for a field within it in this design.',
      );
    },
  );
}

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
  readonly #project: ProjectRef;
  readonly boxType: RawField<BoxType>;

  readonly sealed: SealedBox;
  readonly vented: VentedBox;
  readonly bandpass4: Bandpass4Box;
  readonly bandpass6: Bandpass6Box;
  readonly abc: AbcBox;
  readonly passiveRadiator: PassiveRadiatorBox;

  private constructor(lens: Lens<OpenISDBoxJson>, project: ProjectRef) {
    this.#project = project;
    this.boxType = focus(lens, 'boxType');

    const sealedLens = focus(lens, 'sealed');
    this.sealed = {
      volume_m3: focus(sealedLens, 'volume_m3'),
      resonance_hz: () => noEngine('sealed.resonance_hz'),
      losses: new LossesWindow(focus(sealedLens, 'losses')) satisfies SealedLosses,
    };

    const ventedLens = focus(lens, 'vented');
    const ventedChamber = focus(ventedLens, 'chamber');
    this.vented = {
      volume_m3: requiredField(ventedChamber, 'volume_m3', 'vented.volume_m3'),
      tuning_hz: nullableField(ventedChamber, 'tuning_hz'),
      vent: new VentWindow(focus(ventedLens, 'vent')),
      losses: new LossesWindow(focus(ventedChamber, 'losses')) satisfies VentedLosses,
    };

    const bp4 = focus(lens, 'bandpass4');
    const bp4Rear = focus(bp4, 'rear');
    const bp4Front = focus(bp4, 'front');
    this.bandpass4 = {
      chambers: {
        // rear is SEALED — no port, so no `vents.rear`, and a read-only calculated
        // `resonance_hz()` (WinISD's "Frc") stands in for the tuning it cannot be given.
        rear: {
          volume_m3: requiredField(bp4Rear, 'volume_m3', 'bandpass4.rear.volume_m3'),
          resonance_hz: () => noEngine('sealed.resonance_hz'),
          losses: new LossesWindow(focus(bp4Rear, 'losses')) satisfies CoupledSealedLosses,
        },
        // front's volume is RAW — it has exactly one home and is not part of a solved
        // relation, unlike its tuning.
        front: {
          volume_m3: focus(bp4Front, 'volume_m3'),
          tuning_hz: nullableField(bp4Front, 'tuning_hz'),
          losses: new LossesWindow(focus(bp4Front, 'losses')) satisfies CoupledVentedLosses,
        },
      },
      vents: { front: new VentWindow(focus(bp4, 'frontVent')) },
    };

    const bp6 = focus(lens, 'bandpass6');
    this.bandpass6 = {
      chambers: {
        rear: new VentedChamberWindow(focus(bp6, 'rear')),
        front: new VentedChamberWindow(focus(bp6, 'front')),
      },
      vents: {
        rear: new VentWindow(focus(bp6, 'rearVent')),
        front: new VentWindow(focus(bp6, 'frontVent')),
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
        rear: new VentWindow(focus(abc, 'rearVent')),
        front: new VentWindow(focus(abc, 'frontVent')),
        intra: new VentWindow(focus(abc, 'intraVent')),
      },
    };

    const pr = focus(lens, 'passiveRadiator');
    const prComponent = focus(pr, 'component');
    this.passiveRadiator = {
      volume_m3: focus(pr, 'volume_m3'),
      tuning_hz: nullableField(pr, 'tuning_hz'),
      count: focus(pr, 'count'),
      addedMass_kg: nullableField(pr, 'addedMass_kg'),
      losses: new LossesWindow(focus(pr, 'losses')) satisfies SealedLosses,
      // Copies the chosen radiator's record INTO the box's own storage — the box owns its PR
      // from here on, so later edits through `component` below change the box, never the
      // library entry the radiator was picked from.
      configurePR: (radiator: OpenISDPassiveRadiatorStandalone) => {
        prComponent.set({ ...readWrappedJson(radiator) });
      },
      component: new OpenISDPassiveRadiatorEmbedded(prComponent),
    };
  }

  /** Takes a PROJECT REFERENCE, not a lens — same reasoning as `OpenISDDriverEmbedded.wrap()`:
   *  the project owns the slot and supplies it, via the module-private registry. A reference
   *  rather than an instance so one box can serve every layer — see `ProjectRef`. */
  static wrap(project: ProjectRef): OpenISDBox {
    return new OpenISDBox(projectSlot(project, 'box'), project);
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
export abstract class OpenISDDriver {
  /** Protected, not `#private`: the subclasses below are the ONLY things that need it, and
   *  `protected` is exactly the tool for that — this is a real inheritance relationship, unlike
   *  `ManagedProject`/`OpenISDProject`, which compose and therefore need the WeakMap bridge. */
  protected readonly record: Lens<OpenISDDriverJson>;
  readonly section: 'woofer' | 'tweeter';

  readonly Fs_hz: Field<number>;
  readonly Sd_m2: Field<number>;
  readonly Cms_m_per_N: Field<number>;
  readonly Mmd_kg: Field<number>;
  readonly Rms_Ns_per_m: Field<number>;
  readonly Xmax_m: Field<number>;
  readonly brand: Field<string>;
  readonly model: Field<string>;
  readonly manufacturer: Field<string>;
  readonly providedBy: Field<string>;
  readonly comment: Field<string>;
  readonly added: Field<string>;

  protected constructor(record: Lens<OpenISDDriverJson>, section: 'woofer' | 'tweeter') {
    this.record = record;
    this.section = section;
    this.Fs_hz = this.#buildSpecField('Fs_hz');
    this.Sd_m2 = this.#buildSpecField('Sd_m2');
    this.Cms_m_per_N = this.#buildSpecField('Cms_m_per_N');
    this.Mmd_kg = this.#buildSpecField('Mmd_kg');
    this.Rms_Ns_per_m = this.#buildSpecField('Rms_Ns_per_m');
    this.Xmax_m = this.#buildSpecField('Xmax_m');
    this.brand = this.#buildMeta('brand');
    this.model = this.#buildMeta('model');
    this.manufacturer = this.#buildMeta('manufacturer');
    this.providedBy = this.#buildMeta('provided_by');
    this.comment = this.#buildMeta('comment');
    this.added = this.#buildMeta('added');
    registerJsonReader(this, record.get);
  }

  /** Which spec section a record carries, or a refusal if it carries neither. */
  protected static sectionOf(json: OpenISDDriverJson): 'woofer' | 'tweeter' {
    if (json.woofer) return 'woofer';
    if (json.tweeter) return 'tweeter';
    throw new Error('OpenISDDriver: record has neither a woofer nor a tweeter section');
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
    return OpenISDDriverStandalone.wrap({ ...this.record.get() });
  }

  /** Replace this driver's whole record with `source`'s current values. The write-back
   *  primitive: a project adopting a different driver, or an edit made on a detached copy being
   *  put back. Reads `source` through the module-private reader bridge, never a public accessor,
   *  so the record shape stays unexposed. */
  update(source: OpenISDDriver): void {
    this.record.set({ ...readWrappedJson(source) });
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

  #buildSpecField(field: SpecFieldName): Field<number> {
    return new Field<number>(
      () => ({ value: this.record.get()[this.section]![field].value, state: 'entered' }),
      (v) => {
        const json = this.record.get();
        const spec = json[this.section]!;
        this.record.set({ ...json, [this.section]: { ...spec, [field]: { value: v, origin: 'entered' } } });
      },
      () => {
        throw new Error(
          `${field} cannot be cleared: this driver's ${this.section} section always exists once ` +
          'constructed — there is no "not entered" state for a field within it in this design.',
        );
      },
    );
  }
}

/** A driver that belongs to no project — a My Drivers entry, a bundle row, a detached copy.
 *  `wrap()` windows onto a record the caller owns; the record is not copied, it is referenced. */
class OpenISDDriverStandalone extends OpenISDDriver {
  static wrap(json: OpenISDDriverJson): OpenISDDriverStandalone {
    let current = json;
    const record: Lens<OpenISDDriverJson> = {
      get: () => current,
      set: (j) => { current = j; },
    };
    return new OpenISDDriverStandalone(record, OpenISDDriver.sectionOf(json));
  }
}

/** The driver INSIDE a project — the project's own `driver` slot, plus a reference to the
 *  project containing it. That reference is how a component answers a question spanning
 *  siblings; `OpenISDBox` uses the same idea to reach this driver for Fc. A standalone driver
 *  has no such reference because it is in no project — which is exactly why these are two
 *  types rather than one with a nullable field. */
class OpenISDDriverEmbedded extends OpenISDDriver {
  readonly #project: ProjectRef;

  private constructor(
    record: Lens<OpenISDDriverJson>,
    section: 'woofer' | 'tweeter',
    project: ProjectRef,
  ) {
    super(record, section);
    this.#project = project;
  }

  /** The project containing this driver — resolved on each access, so it is the layer that is
   *  effective NOW rather than whichever one happened to be effective at construction. */
  get project(): OpenISDProject { return this.#project(); }

  /** Takes a PROJECT REFERENCE, not a lens — the project owns the slot, so it is the project's
   *  business to say where the record lives, not the caller's to hand it over. The lens comes
   *  from the module-private registry the project fills in on construction. A reference rather
   *  than an instance so one driver can serve every layer — see `ProjectRef`. */
  static wrap(project: ProjectRef): OpenISDDriverEmbedded {
    const lens = projectSlot(project, 'driver');
    return new OpenISDDriverEmbedded(lens, OpenISDDriver.sectionOf(lens.get()), project);
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
 * project, so it drives `beginEdit()`/`commit()`/`cancelTransient()` on the `ManagedProject` it
 * holds instead — the project's own edit layer is what makes its Cancel work.
 */
class OpenISDPassiveRadiatorEmbedded implements PassiveRadiatorComponent {
  readonly #slot: Lens<OpenISDDriverJson | null>;

  readonly brand: Field<string>;
  readonly model: Field<string>;
  readonly manufacturer: Field<string>;
  readonly providedBy: Field<string>;
  readonly comment: Field<string>;
  readonly added: Field<string>;
  readonly Sd_m2: Field<number>;
  readonly Mmd_kg: Field<number>;
  readonly Cms_m_per_N: Field<number>;
  readonly Rms_Ns_per_m: Field<number>;
  readonly Xmax_m: Field<number>;

  constructor(slot: Lens<OpenISDDriverJson | null>) {
    this.#slot = slot;
    this.brand = prMeta(slot, 'brand');
    this.model = prMeta(slot, 'model');
    this.manufacturer = prMeta(slot, 'manufacturer');
    this.providedBy = prMeta(slot, 'provided_by');
    this.comment = prMeta(slot, 'comment');
    this.added = prMeta(slot, 'added');
    this.Sd_m2 = prSpec(slot, 'Sd_m2');
    this.Mmd_kg = prSpec(slot, 'Mmd_kg');
    this.Cms_m_per_N = prSpec(slot, 'Cms_m_per_N');
    this.Rms_Ns_per_m = prSpec(slot, 'Rms_Ns_per_m');
    this.Xmax_m = prSpec(slot, 'Xmax_m');
  }

  isChosen(): boolean { return this.#slot.get() !== null; }
}

/** A radiator that belongs to no box — straight out of the bundle, or served from My PRs. The
 *  ONLY radiator type the selector popup and the PR editor ever see, and what `configurePR()`
 *  accepts. Its record has a `passive-radiator` section. Its
 *  own concept, not "a driver that happens to be a PR": no shared ancestor with `OpenISDDriver`.
 *  Same window-not-copy shape, same construction-time refusal, same eager-built fields. */
class OpenISDPassiveRadiatorStandalone {
  readonly #get: () => OpenISDDriverJson;
  readonly #set: (json: OpenISDDriverJson) => void;
  readonly section = 'passive-radiator' as const;

  readonly Sd_m2: Field<number>;
  readonly Cms_m_per_N: Field<number>;
  readonly Mmd_kg: Field<number>;
  readonly Rms_Ns_per_m: Field<number>;
  readonly Xmax_m: Field<number>;

  private constructor(get: () => OpenISDDriverJson, set: (json: OpenISDDriverJson) => void) {
    this.#get = get;
    this.#set = set;
    this.Sd_m2 = this.#buildSpecField('Sd_m2');
    this.Cms_m_per_N = this.#buildSpecField('Cms_m_per_N');
    this.Mmd_kg = this.#buildSpecField('Mmd_kg');
    this.Rms_Ns_per_m = this.#buildSpecField('Rms_Ns_per_m');
    this.Xmax_m = this.#buildSpecField('Xmax_m');
    registerJsonReader(this, get);
  }

  static window(
    get: () => OpenISDDriverJson,
    set: (json: OpenISDDriverJson) => void,
  ): OpenISDPassiveRadiatorStandalone {
    if (!get()['passive-radiator']) {
      throw new Error('OpenISDPassiveRadiatorStandalone.window: record has no passive-radiator section');
    }
    return new OpenISDPassiveRadiatorStandalone(get, set);
  }

  static wrap(json: OpenISDDriverJson): OpenISDPassiveRadiatorStandalone {
    let current = json;
    return OpenISDPassiveRadiatorStandalone.window(() => current, (j) => { current = j; });
  }

  #buildSpecField(field: SpecFieldName): Field<number> {
    return new Field<number>(
      () => ({ value: this.#get()['passive-radiator']![field].value, state: 'entered' }),
      (v) => {
        const json = this.#get();
        const spec = json['passive-radiator']!;
        this.#set({ ...json, 'passive-radiator': { ...spec, [field]: { value: v, origin: 'entered' } } });
      },
      () => {
        throw new Error(
          `${field} cannot be cleared: this passive radiator's section always exists once ` +
          'constructed — there is no "not entered" state for a field within it in this design.',
        );
      },
    );
  }
}

/**
 * The field-accessor surface `OpenISDProject` and `ManagedProject` both provably carry — not two
 * independently-written lookalike shapes, one named interface both reference.
 */
interface ProjectFields {
  readonly driver: OpenISDDriverEmbedded;
  readonly box: Box;
  /** What the user calls this project. A LABEL, not an identity — two projects may share one,
   *  which is exactly why `uuid()` exists. A `RawField`, like every other stored value with no
   *  solve relation behind it, so it is read and written with the same two verbs as the rest. */
  readonly name: RawField<string>;
  /** The user's own note about this project. Stored, never interpreted. */
  readonly comment: RawField<string>;
}

// The real "only ManagedProject reaches this" mechanism (see the file header) — module-scoped,
// never exported. `OpenISDProject` calls `notifyProject(this)` on every write instead of holding
// its own listener set, and `ManagedProject` calls `subscribeToProject(project, fn)` instead of a
// method on `project`. Nothing outside this file can reach either, which is the enforcement.
// FRIEND SIDE-TABLE 2 of 4 — see AGENTS.md §"GLOBAL VARIABLES ARE FORBIDDEN".
//
// HOLDS: for one `OpenISDProject`, the set of callbacks watching THAT project. One entry per
//   project; no callback is shared between projects.
// EXPOSES: `OpenISDProject`'s change notification.
// TO: `ManagedProject`, which must re-subscribe whenever the effective layer changes.
//
// REFEREES — every one:
//   notify, via `notifyProject()`:
//     `writeProjectRecord()` — twice: after a redirected write, and after a direct one
//   subscribe, via `subscribeToProject()`:
//     `ManagedProject` ctor — watches committed, to set `#modified`
//     `ManagedProject`'s effective-layer rewatch — watches whichever layer is effective now
//
// WHY NOT A LISTENER SET ON THE CLASS: a public `subscribe()` on `OpenISDProject` would let a
// consumer watch a LAYER directly, and the app must only ever hold `ManagedProject`.
const projectListeners = new WeakMap<OpenISDProject, Set<() => void>>();

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
export function driverFromConformingRecord(record: unknown): OpenISDDriver | string[] {
  if (typeof record !== 'object' || record === null) return ['not an object'];
  const r = record as Record<string, unknown>;

  const problems = metadataProblems(r);
  if (!r.woofer && !r.tweeter) {
    problems.push('neither a woofer nor a tweeter section — nothing to simulate');
  }
  return problems.length > 0 ? problems : OpenISDDriverStandalone.wrap(record as OpenISDDriverJson);
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
): OpenISDPassiveRadiatorStandalone | string[] {
  if (typeof record !== 'object' || record === null) return ['not an object'];
  const r = record as Record<string, unknown>;

  const problems = metadataProblems(r);
  if (!r['passive-radiator']) {
    problems.push('no passive-radiator section — this record is not a radiator');
  }
  return problems.length > 0
    ? problems
    : OpenISDPassiveRadiatorStandalone.wrap(record as OpenISDDriverJson);
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
// FRIEND SIDE-TABLE 3 of 4 — see AGENTS.md §"GLOBAL VARIABLES ARE FORBIDDEN". THE CENTRAL ONE:
// it is what makes `OpenISDProjectJson` genuinely private.
//
// HOLDS: for one `OpenISDProject`, THAT project's whole record. One entry per project — the
//   layers of a `ManagedProject` are separate projects with separate entries, which is exactly
//   what keeps ground/committed/edit/whatif from writing through each other.
// EXPOSES: `OpenISDProject`'s record.
// TO: the sibling classes that are WINDOWS onto slices of it, and to the repo that serialises it.
//
// REFEREES — every one:
//   writers:
//     `OpenISDProject` ctor  — seeds the entry before the components are built
//     `writeProjectRecord()` — twice: a redirected write, and one landing where it was aimed
//   readers, via `projectRecord()`:
//     `projectSlot()`            — the lens every component reads and writes through
//     `OpenISDProject.copy()`    — clones the record for a new layer
//     `projectRepo().save()`     — the only place a record leaves for a store
//   and `projectSlot()` itself is used by:
//     `OpenISDBox.wrap()` | `OpenISDDriverEmbedded.wrap()`
//     `OpenISDProject` ctor (meta) | `ManagedProject` ctor (meta, over the effective layer)
//
// WHY NOT A `#private` FIELD: `OpenISDBox` and `OpenISDDriverEmbedded` are SEPARATE CLASSES that
// window slices of the project's record, and TypeScript has no `friend` — `#private` is
// unreachable by a sibling, an unexported type is unnameable but still reachable by inference,
// and a `unique symbol` key is discoverable via `Object.getOwnPropertySymbols`.
const projectRecords = new WeakMap<OpenISDProject, OpenISDProjectJson>();

// Which `ManagedProject` owns a layer. A write has to know whether it is landing on managed
// committed state — and if so, be redirected into an edit layer — so the layer must be able to
// find its manager. Module-scoped, like every other friend-access bridge here.
// FRIEND SIDE-TABLE 4 of 4 — see AGENTS.md §"GLOBAL VARIABLES ARE FORBIDDEN".
//
// HOLDS: for one `OpenISDProject` layer, the `ManagedProject` that owns it. One entry per layer.
// EXPOSES: the layer→owner link.
// TO: `writeProjectRecord()`, which must know whether a write is landing on MANAGED committed
//   state — if so it opens an edit layer and lands there instead, so editing a field in a tab
//   starts an edit session with no component having to call `beginEdit()`.
//
// REFEREES — every one:
//   writers, all in `ManagedProject`, as each layer comes into existence:
//     ctor (ground + committed) | `load()` | `save()` | `commit()` | `beginEdit()` | `beginWhatif()`
//   reader:
//     `editLayerFor()` — the only one, called from `writeProjectRecord()`
//
// WHY NOT A FIELD ON THE LAYER: `OpenISDProject` must not know about `ManagedProject` — a plain
// project has no layers and no owner, and giving it one would put layering into the class the
// layering exists to wrap.
const owningManaged = new WeakMap<OpenISDProject, ManagedProject>();

function projectRecord(project: OpenISDProject): OpenISDProjectJson {
  const json = projectRecords.get(project);
  if (!json) throw new Error('projectRecord: not an initialised OpenISDProject');
  return json;
}

/** Replace a project's record and tell its listeners. The one write path — every component's
 *  own `set` ends up here, so notification cannot be forgotten at a call site. */
function writeProjectRecord(project: OpenISDProject, json: OpenISDProjectJson): void {
  // A write aimed at COMMITTED state opens an edit layer first and lands there instead —
  // editing a field in a tab starts an edit session by itself, with no component having to
  // remember to call `beginEdit()`. Redirecting is sound because the edit layer is copied from
  // committed BEFORE this write is applied, so `json` (committed plus this one change) is
  // exactly what the new layer should hold.
  const redirect = editLayerFor(project);
  if (redirect) {
    projectRecords.set(redirect, json);
    notifyProject(redirect);
    return;
  }
  projectRecords.set(project, json);
  notifyProject(project);
}

/** The layer a write should really go to, or null when it can go where it was aimed. Only a
 *  write at the COMMITTED layer of a managed project is redirected: ground is never written
 *  through, and an open edit/what-if is already the right target. */
function editLayerFor(project: OpenISDProject): OpenISDProject | null {
  const managed = owningManaged.get(project);
  if (!managed || !managed.committedIs(project) || managed.hasTransientLayer()) return null;
  return managed.openEditLayer();
}

/**
 * WHICH project a component is looking at, resolved on EVERY access rather than fixed when the
 * component was built.
 *
 * A `ManagedProject` has several layers, each its own `OpenISDProject`, and a write can move
 * which one is effective — writing to committed opens an edit layer and lands there. A component
 * bound to one layer therefore stops matching the project the instant that happens, and a caller
 * holding it reads stale values from its own write onwards
 * (`bugs/BUG_20260826_held_component_handle_goes_stale_when_a_write_opens_the_edit_layer.md`).
 *
 * Resolving late fixes that at the root: `ManagedProject` builds ONE driver and ONE box over
 * `() => this.#effective()`, so the objects it hands out survive every layer transition and stay
 * correct. A plain `OpenISDProject` passes `() => this`, which never varies.
 *
 * Stable component objects are also what let a UI framework memoize on object identity — the
 * same reasoning that made every `Field` eagerly constructed rather than built per getter call.
 */
type ProjectRef = () => OpenISDProject;

/** A lens onto one top-level slot of a project's record — how a contained component reads and
 *  writes its own slice without ever holding the whole record. */
function projectSlot<K extends keyof OpenISDProjectJson>(
  ref: ProjectRef,
  key: K,
): Lens<OpenISDProjectJson[K]> {
  return {
    get: () => projectRecord(ref())[key],
    set: (v) => writeProjectRecord(ref(), { ...projectRecord(ref()), [key]: v }),
  };
}

function subscribeToProject(project: OpenISDProject, fn: () => void): () => void {
  let set = projectListeners.get(project);
  if (!set) {
    set = new Set();
    projectListeners.set(project, set);
  }
  set.add(fn);
  return () => { set.delete(fn); };
}

function notifyProject(project: OpenISDProject): void {
  projectListeners.get(project)?.forEach((fn) => fn());
}

/**
 * The plain domain object — no layer management, no subscription to arbitrary listeners. Holds
 * its own `OpenISDProjectJson`; `driver` and `box` are live WINDOWS over slices of it, so reads
 * and writes go straight through to the SAME record this class holds, never a disconnected copy.
 */
class OpenISDProject implements ProjectFields {
  readonly driver: OpenISDDriverEmbedded;
  readonly box: Box;
  readonly name: RawField<string>;
  readonly comment: RawField<string>;

  /** THE project's identity, and IN-MEMORY ONLY — deliberately a class field rather than a
   *  member of `OpenISDProjectJson`, which is what makes "internal only" structural instead of
   *  a rule someone has to remember: the record is the only thing that is ever serialised, so
   *  an id that is not in it CANNOT reach a file or a link (John 2026-08-26, QO92: "lets make
   *  the UUID an internal only feature ... when loading an owdr we assign a new uuid").
   *
   *  It exists so the running app can tell two open projects apart when their names collide,
   *  and so a store — or a focus pointer — can key on something stable. Persisting it would buy
   *  a problem rather than solve one: a file carrying an id makes re-importing it a collision
   *  the user must be asked about, over an identity they never knew they had. Unpersisted, a
   *  load is simply a new project, which is what it looks like to the user anyway. */
  readonly #uuid: string;

  private constructor(json: OpenISDProjectJson, uuid: string) {
    this.#uuid = uuid;
    // The record goes into the module-private map BEFORE the components are built — each of
    // them reads its own slot straight out of it. See the FRIEND ACCESS note above.
    projectRecords.set(this, json);
    // `() => this` never varies — a plain project is one layer. The indirection exists for
    // `ManagedProject`, which passes a ref that follows the effective layer.
    this.driver = OpenISDDriverEmbedded.wrap(() => this);
    this.box = OpenISDBox.wrap(() => this);
    const meta = projectSlot(() => this, 'meta');
    this.name = focus(meta, 'name');
    this.comment = focus(meta, 'comment');
  }

  /** Wrapping a record is how a project ENTERS the process. A record carries no identity, so
   *  one is minted — two wraps of one record are two independently editable projects, which is
   *  what opening a FILE twice should give.
   *
   *  `wrapWithIdentity()` is the exception, and the ONLY caller that may use it is a store
   *  reader: see its own note. */
  static wrap(json: OpenISDProjectJson): OpenISDProject {
    return new OpenISDProject(json, newUuid());
  }

  /**
   * Wrap a record under an identity the caller already holds.
   *
   * FOR A STORE READ, AND NOTHING ELSE. A store key was minted in this process, by this app —
   * it IS an in-memory identity, so adopting it back is restoring one, not importing a foreign
   * one. Without this, a project loaded from the store gets a new identity, its next autosave
   * writes to a NEW key, and the entry it came from is orphaned: reopening a design silently
   * duplicates it (`bugs/BUG_20260826_reopening_a_stored_project_duplicates_its_store_entry.md`).
   *
   * NOT for a file. A file's id — if it even had one — was minted by some other process and is
   * provenance, never a key, so a file import mints (the driver precedent, QO81). The split is
   * on WHERE the record came from, not on whether an id was available.
   *
   * Not exported: reachable only inside this module, where the repo lives.
   */
  static wrapWithIdentity(json: OpenISDProjectJson, uuid: string): OpenISDProject {
    return new OpenISDProject(json, uuid);
  }

  /** This project's in-memory identity. See `#uuid`. */
  uuid(): string { return this.#uuid; }

  /** An independent copy — how `ManagedProject` obtains each layer's own instance. A SHALLOW
   *  copy of the record suffices: every write in this design is copy-on-write (a new wrapper
   *  object each time, never in-place mutation of a nested one), so this copy and the original
   *  can briefly share nested references without risk — the first write through EITHER instance
   *  replaces its own record wholesale, never reaching into the other's. What `copy()` actually
   *  provides is a SEPARATE IDENTITY: the record is keyed by instance, so two references to the
   *  SAME `OpenISDProject` share one entry and a write through either is visible through both —
   *  exactly what the ground/committed/edit/whatif layers must never do to each other. */
  copy(): OpenISDProject {
    // The id CARRIES ACROSS: a copy is another layer of the same project, not another project.
    // `ManagedProject` would otherwise hold several identities for one thing it wraps.
    return new OpenISDProject({ ...projectRecord(this) }, this.#uuid);
  }
}

/**
 * The layer-management wrapper — the one type the app actually holds. Four layers: `#ground`
 * (the design as loaded/saved), `#committed` (the current confirmed design), and at most one of
 * `#edit` (an in-progress edit, promotable via `commit()`) or `#whatif` (an exploratory session
 * that can NEVER be promoted — there is no `commitWhatif()`, ever: a what-if explores values the
 * app cannot verify against physical reality). `driver`/`box` delegate to whichever is effective
 * — `#whatif` if open, else `#edit` if open, else `#committed`. `subscribe()` re-fires whenever
 * the currently-effective project notifies, and re-subscribes on every layer transition.
 */
export class ManagedProject implements ProjectFields {
  // Advanced by `save()`, and read by `isModified()` to answer "are there unsaved changes".
  #ground: OpenISDProject;
  #committed: OpenISDProject;
  #edit: OpenISDProject | null = null;
  #whatif: OpenISDProject | null = null;
  readonly #listeners = new Set<() => void>();
  #unwatchEffective: (() => void) | null = null;
  #unwatchCommitted: (() => void) | null = null;
  #modified = false;

  /** THE identity of the project this wraps — the wrapper is id'd by the same id (John
   *  2026-08-26). Every layer is a `copy()` of one project and so carries it, which is why
   *  ground's answer serves for all of them. In-memory only: see `OpenISDProject`'s `#uuid`.
   *
   *  This is what a store, or a focus pointer, keys on. A name cannot serve — two open
   *  projects may share one, and that is precisely what identity exists to make harmless. */
  uuid(): string { return this.#ground.uuid(); }

  readonly #driver: OpenISDDriverEmbedded;
  readonly #box: Box;
  readonly name: RawField<string>;
  readonly comment: RawField<string>;

  private constructor(ground: OpenISDProject, committed: OpenISDProject) {
    this.#ground = ground;
    this.#committed = committed;
    this.#driver = OpenISDDriverEmbedded.wrap(() => this.#effective());
    this.#box = OpenISDBox.wrap(() => this.#effective());
    // Over the EFFECTIVE layer, like `driver`/`box` — one stable handle for the wrapper's life.
    const meta = projectSlot(() => this.#effective(), 'meta');
    this.name = focus(meta, 'name');
    this.comment = focus(meta, 'comment');
    owningManaged.set(ground, this);
    owningManaged.set(committed, this);
    this.#watchEffective();
    this.#watchCommitted();
  }

  /** Adopt `project` as the WHOLE design. Ground and committed each become their OWN independent
   *  copy — never the same instance, so editing one can never be visible through the other. */
  static load(project: OpenISDProject): ManagedProject {
    return new ManagedProject(project.copy(), project.copy());
  }

  #effective(): OpenISDProject {
    return this.#whatif ?? this.#edit ?? this.#committed;
  }

  /** ONE driver and ONE box for this managed project's whole life, each resolving the effective
   *  layer on every read and write (`ProjectRef`).
   *
   *  They are NOT the effective layer's own components. Returning those would hand out an object
   *  bound to one layer, which a write can then move away from — writing to committed opens an
   *  edit layer, so a caller that did `const d = project.driver` before its first edit would read
   *  stale values from that edit onwards, and the write would look lost
   *  (`bugs/BUG_20260826_held_component_handle_goes_stale_when_a_write_opens_the_edit_layer.md`).
   *  That is the ordinary shape of UI code — bind once in `setup()`, read many times — so the
   *  handle has to outlive the layer. */
  get driver(): OpenISDDriverEmbedded { return this.#driver; }
  get box(): Box { return this.#box; }

  /** @internal The layer persistence must write: the open edit layer if there is one, else
   *  committed. NEVER a what-if — an exploratory session must not survive the session. Reached
   *  by `persistableLayerOf()` in this module only; the app has no route to a layer. */
  layerToPersist(): OpenISDProject { return this.#edit ?? this.#committed; }

  /** @internal Is `project` the layer a write would land on when nothing transient is open? */
  committedIs(project: OpenISDProject): boolean { return this.#committed === project; }

  /** @internal Is an edit or what-if already open, making a redirect unnecessary? */
  hasTransientLayer(): boolean { return this.#edit !== null || this.#whatif !== null; }

  /** @internal Open the edit layer for a write that has just been aimed at committed state.
   *  Notifies, because the project has just become editable and a Save/Revert bar keys off it. */
  openEditLayer(): OpenISDProject {
    this.beginEdit();
    return this.#edit!;
  }

  isWhatif(): boolean { return this.#whatif !== null; }
  isEditing(): boolean { return this.#edit !== null; }

  /** Whether committed state has moved on since the last save — the "unsaved changes" question.
   *
   *  Tracked as a FLAG, not by comparing `#ground` and `#committed`. Identity cannot answer it:
   *  both `load()` and `save()` deliberately build fresh copies, so the two are never the same
   *  instance and an identity test reads "modified" permanently (caught by the smoke test that
   *  first exercised this). Value comparison would work but needs a deep walk of the record on
   *  every ask. The flag is set by any change reaching committed — a direct write when no
   *  transient layer is open, or a `commit()` — and cleared only by `save()`.
   *
   *  A transient edit/what-if does NOT set it: nothing has been promoted into the design yet. */
  isModified(): boolean { return this.#modified; }

  /** Discard every committed change since the last save, restoring the design as saved. The one
   *  thing `#ground` is FOR — without it, `save()` would be nothing but a flag reset. Ends any
   *  open transient layer, which would otherwise be left sitting over state that no longer
   *  exists. */
  revertToSaved(): void {
    this.#committed = this.#ground.copy();
    owningManaged.set(this.#committed, this);
    this.#modified = false;
    this.#watchCommitted();
    this.cancelTransient();
  }

  /** Promote committed state into ground — a genuine save. Ends any open edit/what-if first:
   *  neither should survive a save silently attached to the new ground. */
  save(): void {
    this.#ground = this.#committed.copy();
    owningManaged.set(this.#ground, this);
    this.#modified = false;
    this.cancelTransient();
  }

  /** Promote an in-progress edit into committed. A no-op if no edit is open — and correctly
   *  notifies nothing in that case, because nothing changed. */
  commit(): void {
    if (!this.#edit) return;
    this.#committed = this.#edit.copy();
    owningManaged.set(this.#committed, this);
    this.#modified = true;
    this.#watchCommitted();
    this.cancelTransient();
  }

  /** Open an editable working copy of committed state — an in-progress edit, distinct from a
   *  what-if: THIS one can be promoted, via `commit()`. Mutually exclusive with `beginWhatif()`;
   *  only one transient layer at a time. */
  beginEdit(): void {
    this.cancelTransient();
    this.#edit = this.#committed.copy();
    owningManaged.set(this.#edit, this);
    this.#watchEffective();
    this.#notify();
  }

  /** Open a what-if over committed state — a working copy that can NEVER be promoted. Also IS
   *  the Reset operation: reseeding a what-if reseeds from COMMITTED, not ground (corrected
   *  2026-08-25) — calling this again while one is open discards it and opens a fresh one, which
   *  is exactly what Reset needs, so there is no separate `resetOverlayToGround()`. */
  beginWhatif(): void {
    this.cancelTransient();
    this.#whatif = this.#committed.copy();
    owningManaged.set(this.#whatif, this);
    this.#watchEffective();
    this.#notify();
  }

  /** Discard whichever transient layer is open. The only way either session ends without
   *  promotion. Safe to call with neither open. */
  cancelTransient(): void {
    this.#edit = null;
    this.#whatif = null;
    this.#watchEffective();
    this.#notify();
  }

  // Committed is watched SEPARATELY from the effective layer: a direct write while no transient
  // layer is open lands on committed and must set the unsaved-changes flag, and committed is
  // replaced wholesale by `commit()`/`revertToSaved()`, so the subscription has to follow it.
  #watchCommitted(): void {
    this.#unwatchCommitted?.();
    this.#unwatchCommitted = subscribeToProject(this.#committed, () => { this.#modified = true; });
  }

  #watchEffective(): void {
    this.#unwatchEffective?.();
    this.#unwatchEffective = subscribeToProject(this.#effective(), () => this.#notify());
  }

  #notify(): void {
    for (const fn of this.#listeners) fn();
  }

  /** Register a listener, fired on any change to the effective layer's state, AND on every
   *  layer transition (the effective layer itself changing is a change). Returns an unsubscribe
   *  function. THIS is the public subscribe — `OpenISDProject` has none. */
  subscribe(fn: () => void): () => void {
    this.#listeners.add(fn);
    return () => { this.#listeners.delete(fn); };
  }
}

/** A project with nothing designed yet — an empty box of every box type, and the driver record
 *  the caller supplies (a project cannot exist without a driver). */
function emptyProjectJson(driver: OpenISDDriverJson): OpenISDProjectJson {
  return {
    driver,
    box: emptyBoxJson(),
    environment: { temperature_K: 293.15, humidity_pct: 30, pressure_Pa: 101325 },
    signal: { power_W: 1, voltage_V: null },
    meta: { name: '', comment: '' },
  };
}

// ---------------------------------------------------------------------------------------------
// BUILDING A PROJECT — the wizard's path in, and the only way to make a `ManagedProject`.
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
export function newProject(driver: OpenISDDriver): ProjectBuilder {
  return new ProjectBuilder({ ...readWrappedJson(driver) });
}

class ProjectBuilder {
  readonly #driver: OpenISDDriverJson;

  constructor(driver: OpenISDDriverJson) {
    this.#driver = driver;
  }

  sealed(): SealedProjectBuilder { return new SealedProjectBuilder(this.#driver); }
  vented(): VentedProjectBuilder { return new VentedProjectBuilder(this.#driver); }
  bandpass4(): Bandpass4ProjectBuilder { return new Bandpass4ProjectBuilder(this.#driver); }
  bandpass6(): TwoChamberProjectBuilder { return new TwoChamberProjectBuilder(this.#driver, 'bandpass6'); }
  abc(): TwoChamberProjectBuilder { return new TwoChamberProjectBuilder(this.#driver, 'abc'); }
  passiveRadiator(): PassiveRadiatorProjectBuilder {
    return new PassiveRadiatorProjectBuilder(this.#driver);
  }
}

/** Shared assembly. Each specialised builder decides the box record; this turns it into a
 *  managed project, so there is ONE place a project comes into existence. */
abstract class BoxProjectBuilder {
  protected readonly driver: OpenISDDriverJson;
  protected constructor(driver: OpenISDDriverJson) { this.driver = driver; }

  protected abstract boxRecord(): OpenISDBoxJson;

  protected static required(value: number | null, what: string): number {
    if (value === null) throw new Error(`build(): ${what} is required`);
    return value;
  }

  build(): ManagedProject {
    const json: OpenISDProjectJson = {
      ...emptyProjectJson(this.driver),
      box: this.boxRecord(),
    };
    return ManagedProject.load(OpenISDProject.wrap(json));
  }
}

class SealedProjectBuilder extends BoxProjectBuilder {
  #volume: number | null = null;
  constructor(driver: OpenISDDriverJson) { super(driver); }
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
  constructor(driver: OpenISDDriverJson) { super(driver); }
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
  constructor(driver: OpenISDDriverJson) { super(driver); }
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

  constructor(driver: OpenISDDriverJson, kind: 'bandpass6' | 'abc') {
    super(driver);
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
  #radiator: OpenISDDriverJson | null = null;

  constructor(driver: OpenISDDriverJson) { super(driver); }

  volume_m3(v: number): this { this.#volume = v; return this; }
  tuning_hz(v: number): this { this.#tuning = v; return this; }
  count(v: number): this { this.#count = v; return this; }
  /** Takes an ALREADY-VALIDATED radiator, from `passiveRadiatorFromConformingRecord()`. */
  radiator(radiator: OpenISDPassiveRadiatorStandalone): this {
    this.#radiator = { ...readWrappedJson(radiator) };
    return this;
  }

  protected boxRecord(): OpenISDBoxJson {
    const box = emptyBoxJson();
    const R = BoxProjectBuilder.required;
    if (!this.#radiator) throw new Error('build(): a passive-radiator box requires a radiator');
    return {
      ...box,
      boxType: 'passive-radiator',
      passiveRadiator: {
        ...box.passiveRadiator,
        volume_m3: R(this.#volume, 'passive-radiator volume_m3'),
        tuning_hz: R(this.#tuning, 'passive-radiator tuning_hz'),
        count: this.#count,
        component: this.#radiator,
      },
    };
  }
}

// ── PERSISTENCE ────────────────────────────────────────────────────────────────────────────
//
//     app / UI
//        │   domain objects only — `ManagedProject`
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
export interface ProjectMeta {
  /** The project's name. A LABEL, never an identity — two stored projects may share one. */
  readonly name: string;
}

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
  put(id: string, record: R, meta: ProjectMeta): void;

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
  list(): { id: string; meta: ProjectMeta; modified: string }[];

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
export type RecordStoreFactory = <R>() => RecordStore<R>;


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
   *  It IS the project's uuid: `save()` keys on `ManagedProject.uuid()`, and `load()` adopts the
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
 * Every method takes or returns a `ManagedProject` or plain data — never a record — so no caller
 * can see the stored shape, and a change to that shape cannot reach the app.
 *
 * DEPENDS ON the `RecordStore` handed to `projectRepo()`, and on this module's privileged
 * access to a project's own record. Both are why it lives here rather than in an app package.
 *
 * ASSUMES identity comes from the project itself (`ManagedProject.uuid()`) and is in-memory only,
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
   * Autosave is this method plus a TRIGGER — `ManagedProject`'s change notification calling it.
   * The trigger is still undecided (QO92: every change, debounced, or on blur), and the same
   * method serves an explicit toolbar Save. WHAT is written is settled here; WHEN is not.
   */
  save(project: ManagedProject): void;

  /**
   * Rebuild the project stored under `id` as a fresh `ManagedProject` — ground and committed both
   * set to what was stored, no overlay open.
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
  load(id: string): ManagedProject | string[];

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

/** The layer a save must write. A free function so the rule lives beside the repo that applies
 *  it, rather than being restated at each call site. */
function persistableLayerOf(project: ManagedProject): OpenISDProject {
  return project.layerToPersist();
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
export function projectRepo(make: RecordStoreFactory): ProjectRepo {
  const store = make<OpenISDProjectJson>();
  return {
    save(project: ManagedProject): void {
      const layer = persistableLayerOf(project);
      const json = projectRecord(layer);
      store.put(project.uuid(), json, { name: json.meta.name });
    },

    load(id: string): ManagedProject | string[] {
      const json = store.get(id);
      if (!json) return [`no stored project with id ${id}`];
      // ADOPTS `id` as the project's identity, so its next save writes back to the entry it came
      // from rather than minting a second one. See `wrapWithIdentity()`.
      return ManagedProject.load(OpenISDProject.wrapWithIdentity(json, id));
    },

    list(): ProjectListing[] {
      return store.list()
        .map(e => ({ id: e.id, name: e.meta.name, modified: e.modified }))
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
