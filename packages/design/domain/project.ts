import {
  Field,
  focus,
  nullableField,
  requiredField,
  type FieldHandle,
  type Lens,
  type RawField,
} from './cell.js';
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

  /** Cross-sectional area, or null when the dimensions this vent's own shape needs are not set.
   *  Null rather than 0 (a real, if absurd, port area) or NaN — absence is spelled ONE way in
   *  this domain, the same `null` a `Cell` carries, so a caller checks for it the same way
   *  everywhere and the compiler makes them. */
  area_m2(): number | null {
    const v = this.#lens.get();
    if (v.shape === 'round') {
      return v.diameter_m === null ? null : Math.PI * (v.diameter_m / 2) ** 2;
    }
    return v.width_m === null || v.height_m === null ? null : v.width_m * v.height_m;
  }

  /** Acoustic length — the physical length plus the end correction, applied over the port's
   *  equivalent radius so a slotted vent and a round vent of equal area correct alike.
   *  NOT yet verified against WinISD's own convention: the end-correction FACTOR is stored
   *  (0.85 default, the common one-flanged-end value), but which radius it multiplies is a
   *  parity question this package has not probed. Flagged rather than asserted. */
  effectiveLength_m(): number | null {
    const v = this.#lens.get();
    const area = this.area_m2();
    if (v.length_m === null || area === null) return null;
    return v.length_m + v.endCorrection_m * Math.sqrt(area / Math.PI);
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

// Reference air conditions, used only to turn a driver's stored compliance into the equivalent
// volume Fc needs. The environment record carries the REAL temperature/humidity/pressure, and
// deriving c and rho from those is the engine's CIPM-2007 model — not reproduced here. A box
// resonance computed from reference air is therefore approximate; the engine owns the exact one.
const RHO_REF = 1.2041;
const C_REF = 343.684120962152;

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
  readonly #project: OpenISDProject;
  readonly boxType: RawField<BoxType>;

  readonly sealed: SealedBox;
  readonly vented: VentedBox;
  readonly bandpass4: Bandpass4Box;
  readonly bandpass6: Bandpass6Box;
  readonly abc: AbcBox;
  readonly passiveRadiator: PassiveRadiatorBox;

  private constructor(lens: Lens<OpenISDBoxJson>, project: OpenISDProject) {
    this.#project = project;
    this.boxType = focus(lens, 'boxType');

    const sealedLens = focus(lens, 'sealed');
    this.sealed = {
      volume_m3: focus(sealedLens, 'volume_m3'),
      resonance_hz: () => this.#sealedResonance(sealedLens.get().volume_m3),
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
          resonance_hz: () => this.#sealedResonance(bp4Rear.get().volume_m3),
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

  /** Takes the PROJECT, not a lens — same reasoning as `OpenISDDriverEmbedded.wrap()`: the
   *  project owns the slot and supplies it, via the module-private registry. */
  static wrap(project: OpenISDProject): OpenISDBox {
    return new OpenISDBox(projectSlot(project, 'box'), project);
  }

  /** Sealed-system resonance, Fc = Fs · √(1 + Vas/Vb), with Vas derived from the driver's own
   *  stored compliance and cone area (Vas = ρc²·Sd²·Cms). Null when the volume is not set or
   *  the driver has not stated what this needs — absence is one thing in this domain, spelled
   *  null wherever it appears. Reads the driver through the project reference, using the
   *  driver's public field surface. */
  #sealedResonance(volume_m3: number): number | null {
    if (!(volume_m3 > 0)) return null;
    const driver = this.#project.driver;
    const fs = driver.Fs_hz.get().value;
    const sd = driver.Sd_m2.get().value;
    const cms = driver.Cms_m_per_N.get().value;
    if (fs === null || sd === null || cms === null) return null;
    const vas_m3 = RHO_REF * C_REF ** 2 * sd ** 2 * cms;
    return fs * Math.sqrt(1 + vas_m3 / volume_m3);
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
  readonly project: OpenISDProject;

  private constructor(
    record: Lens<OpenISDDriverJson>,
    section: 'woofer' | 'tweeter',
    project: OpenISDProject,
  ) {
    super(record, section);
    this.project = project;
  }

  /** Takes the PROJECT, not a lens — the project owns the slot, so it is the project's business
   *  to say where the record lives, not the caller's to hand it over. The lens comes from the
   *  module-private registry the project fills in on construction. */
  static wrap(project: OpenISDProject): OpenISDDriverEmbedded {
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
}

// The real "only ManagedProject reaches this" mechanism (see the file header) — module-scoped,
// never exported. `OpenISDProject` calls `notifyProject(this)` on every write instead of holding
// its own listener set, and `ManagedProject` calls `subscribeToProject(project, fn)` instead of a
// method on `project`. Nothing outside this file can reach either, which is the enforcement.
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
const projectRecords = new WeakMap<OpenISDProject, OpenISDProjectJson>();

// Which `ManagedProject` owns a layer. A write has to know whether it is landing on managed
// committed state — and if so, be redirected into an edit layer — so the layer must be able to
// find its manager. Module-scoped, like every other friend-access bridge here.
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

/** A lens onto one top-level slot of a project's record — how a contained component reads and
 *  writes its own slice without ever holding the whole record. */
function projectSlot<K extends keyof OpenISDProjectJson>(
  project: OpenISDProject,
  key: K,
): Lens<OpenISDProjectJson[K]> {
  return {
    get: () => projectRecord(project)[key],
    set: (v) => writeProjectRecord(project, { ...projectRecord(project), [key]: v }),
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

  private constructor(json: OpenISDProjectJson) {
    // The record goes into the module-private map BEFORE the components are built — each of
    // them reads its own slot straight out of it. See the FRIEND ACCESS note above.
    projectRecords.set(this, json);
    this.driver = OpenISDDriverEmbedded.wrap(this);
    this.box = OpenISDBox.wrap(this);
  }

  static wrap(json: OpenISDProjectJson): OpenISDProject {
    return new OpenISDProject(json);
  }

  /** An independent copy — how `ManagedProject` obtains each layer's own instance. A SHALLOW
   *  copy of the record suffices: every write in this design is copy-on-write (a new wrapper
   *  object each time, never in-place mutation of a nested one), so this copy and the original
   *  can briefly share nested references without risk — the first write through EITHER instance
   *  replaces its own record wholesale, never reaching into the other's. What `copy()` actually
   *  provides is a SEPARATE IDENTITY: the record is keyed by instance, so two references to the
   *  SAME `OpenISDProject` share one entry and a write through either is visible through both —
   *  exactly what the ground/committed/edit/whatif layers must never do to each other. */
  copy(): OpenISDProject {
    return new OpenISDProject({ ...projectRecord(this) });
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

  private constructor(ground: OpenISDProject, committed: OpenISDProject) {
    this.#ground = ground;
    this.#committed = committed;
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

  get driver(): OpenISDDriverEmbedded { return this.#effective().driver; }
  get box(): Box { return this.#effective().box; }

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
