/**
 * `_OpenISDProjectJson` — one speaker design, whole.
 *
 * This is the thing a user opens, edits, explores with a what-if, saves and shares. It is what
 * `ManagedProject` holds three of (ground / committed / overlay), and it is PRIVATE to that
 * class: nothing outside reaches this type or any of its members.
 *
 * ── It is a SUPERSET of a `.wpr` ──
 * At minimum it carries everything needed to drive a WinISD project file; on top of that it
 * carries everything OpenISD needs that WinISD has no concept of. The `.wpr` writer trims down
 * to what WinISD understands. The project never trims itself to suit a foreign format.
 *
 * ── Switching box type DELETES NOTHING ──
 * `OpenISDBox` holds every alignment at once and names which is ACTIVE. Flip a ported box to
 * sealed and its port data stays, dormant; flip back and it is intact. Only the `.wpr` writer
 * drops dormant data, because the file format cannot express it — and dropping on the way OUT
 * is not the same as discarding from the model. Anything that clears a field on a box-type
 * change is a defect: the user asked to look at a different alignment, not to lose their work.
 *
 * ── COMPONENT vs CONFIGURATION ──
 * `OpenISDDriver` and `OpenISDPassiveRadiator` are COMPONENTS: real, purchasable parts with
 * datasheets and catalogue entries, so each carries a full record with per-field provenance.
 * Everything else here is a CONFIGURATION — chosen or sized by the designer, never bought — so
 * it is modelled plainly, without catalogue machinery.
 *
 * Plain data throughout: no methods, no class identity, `structuredClone`-able, because
 * `ManagedProject` clones a whole project to open an overlay.
 */
import { OpenISDDriver } from './openisdDriver.js';
import type { Filter } from '@openisd/engine';
import { prCmsFromVas, prMmdFromFs, prRmsFromQms, prVas, prQms, prFsWithMass,
         sealedFc, tuningFromLength, prTuning, findImpedancePeak } from "@openisd/engine";
import { WinISDProject } from "@openisd/winisd";
import type { Result, EngineDriver, SweepResult } from "@openisd/engine";

/** Which alignment is ACTIVE. The others stay populated and dormant. */
export type AlignmentKind = 'sealed' | 'vented' | 'bandpass4' | 'passive-radiator';

/** WinISD's own `[Box].BType` numeric code — a raw file-format discriminator, never a bare
 *  int at a call site that interprets it. `alignmentKindOfBType`/`bTypeOfAlignmentKind` below
 *  are the ONE place this vocabulary meets `AlignmentKind` — every reader/writer of a `.wpr`
 *  box type goes through them rather than keeping its own switch. */
export enum WinIsdBType {
  Sealed = 0,
  Vented = 1,
  Bandpass4 = 2,
  PassiveRadiator = 4,
}

/** WinISD's raw BType code → this app's AlignmentKind. `undefined` when `code` is nullish (a
 *  `.wpr` that never states BType) or not one of WinISD's four modelled box types — the
 *  caller decides how to report that, since those are different errors this pure mapping does
 *  not itself choose between. */
export function alignmentKindOfBType(code: number | undefined): AlignmentKind | undefined {
  switch (code) {
    case WinIsdBType.Sealed: return 'sealed';
    case WinIsdBType.Vented: return 'vented';
    case WinIsdBType.Bandpass4: return 'bandpass4';
    case WinIsdBType.PassiveRadiator: return 'passive-radiator';
    default: return undefined;
  }
}

/** This app's AlignmentKind → WinISD's raw BType code — the reverse of `alignmentKindOfBType`. */
export function bTypeOfAlignmentKind(kind: AlignmentKind): WinIsdBType {
  switch (kind) {
    case 'sealed': return WinIsdBType.Sealed;
    case 'vented': return WinIsdBType.Vented;
    case 'bandpass4': return WinIsdBType.Bandpass4;
    case 'passive-radiator': return WinIsdBType.PassiveRadiator;
  }
}

/** A vent, as cut. Not a component: nobody buys a hole, so it has no catalogue record. */
export interface OpenISDVent {
  shape: 'round' | 'slotted';
  /** Round: the diameter. 0 ⇒ not chosen. */
  diameter_m: number;
  /** Slotted: the two cross-section sides. 0 ⇒ not chosen. */
  width_m: number;
  height_m: number;
  /** Physical length. DERIVED in WinISD from volume + tuning + diameter + end correction, so it
   *  is read-only there. 0 ⇒ not chosen. */
  length_m: number;
  /** × diameter: 0.613 two-free, 0.732 one-flanged, 0.849 two-flanged. 0 ⇒ not chosen. */
  endCorrection: number;
}

/** A sealed box: no vent, no radiator. */
export interface OpenISDSealedAlignment {
  volume_m3: number;
}

/** A vented box OWNS its vent — a sealed box has no vent to configure, and the model says so
 *  rather than leaving an ignored field lying about. */
export interface OpenISDVentedAlignment {
  volume_m3: number;
  /** System tuning. */
  Fb_hz: number;
  /** The alignment's ports, arity fixed by the alignment: vented has exactly one. An array
   *  from day one so a multi-port alignment (ABC needs three, QO85) adds no new shape. */
  vents: OpenISDVent[];
}

/** 4th-order bandpass: a sealed rear chamber and a vented front one. */
export interface OpenISDBandpass4Alignment {
  rearVolume_m3: number;
  frontVolume_m3: number;
  /** Front-chamber tuning. */
  Ff_hz: number;
  /** The front chamber's ports — bandpass4 has exactly one. Same arity-by-alignment array as
   *  `OpenISDVentedAlignment.vents` (QO85). */
  vents: OpenISDVent[];
}

/** A passive-radiator box OWNS its radiator, for the same reason a vented box owns its vent. */
export interface OpenISDPassiveRadiatorAlignment {
  volume_m3: number;
  /** System tuning (WinISD: Fp). Tied to the radiator's added mass by one relation. */
  Fp_hz: number;
  /** How many radiators. */
  count: number;
  /** Mass added to the radiator's own Mmd to move the tuning. */
  addedMass_kg: number;
  /** The radiator itself — a COMPONENT, so it carries its own record. Absent until one is
   *  chosen; the alignment can be configured before a part is picked. */
  radiator?: OpenISDPassiveRadiatorRef;
}

/** Placeholder for the passive-radiator component (Plan 1 step 5 replaces this with the real
 *  `OpenISDPassiveRadiator`). Named rather than inlined so the swap is one edit, and so the
 *  alignment above already expresses that a radiator is a COMPONENT and not loose fields. */
export interface OpenISDPassiveRadiatorRef {
  Sd_m2: number;
  Mmd_kg: number;
  Cms_m_per_N: number;
  Rms_Ns_per_m: number;
  Xmax_m: number;
  name: string;
}

/**
 * The enclosure. Holds EVERY alignment at once and names which is active — that is the
 * dormant-data rule expressed in the type, rather than left to callers to honour.
 *
 * 6th-order bandpass and ABC are not here: neither exists in the codebase, and ABC has no field
 * specification anywhere (ledger QO44). Adding an empty member would claim otherwise.
 */
export interface OpenISDBox {
  active: AlignmentKind;
  sealed: OpenISDSealedAlignment;
  vented: OpenISDVentedAlignment;
  bandpass4: OpenISDBandpass4Alignment;
  passiveRadiator: OpenISDPassiveRadiatorAlignment;
  /** Enclosure losses: leakage, absorption, port. Shared by every alignment. */
  Ql: number;
  Qa: number;
  Qp: number;
}

/**
 * What the solver aims AT, and which member of each solved pair the user pinned.
 *
 * Presence ⇒ ENTERED: held, never recomputed. Absence ⇒ CALCULATED, re-solved whenever an
 * entered member changes. WinISD's own direction — volume, diameter and tuning entered, vent
 * LENGTH returned — is the default; the reverse falls out of the same model rather than being
 * a second mechanism.
 */
export interface OpenISDTarget {
  entered: Record<string, true>;
}

/** Ambient air. ρ and c are DERIVED from these three, never stored beside them. */
export interface OpenISDEnvironment {
  tempK: number;
  /** PERCENT here. The `.wpr`'s `phi` is a fraction — converted in that writer alone. */
  humidityPct: number;
  pressurePa: number;
  /** Opt in to WinISD's behaviour of storing humidity and pressure and never reading them. */
  ignoreHumidityAndPressure: boolean;
}

/** What drives the system. */
export interface OpenISDSignal {
  /** System input power, W. */
  inputPower_W: number;
  /** Amplifier series resistance, Ω. */
  seriesResistance_ohm: number;
  driverCount: number;
  wiring: 'series' | 'parallel';
  /** Rg sits in series with each driver rather than at the amplifier. */
  rgAtDriverSide: boolean;
}

/** Where the listener is. Not yet modelled by the engine — carried so a project can state it
 *  and a file can round-trip it, rather than being silently dropped. */
export interface OpenISDListening {
  distance_m: number;
  angle_rad: number;
}

/** WinISD's Advanced pane. Each is a MODELLING choice, not a measured value. */
export interface OpenISDSimOptions {
  /** Voice-coil inductance in the acoustic circuit: WinISD's own switch, under our name. */
  circuitModel: 'winisd' | 'gyrator';
  /** Model the vent as an acoustic transmission line instead of a lumped mass. */
  tlPortModel: boolean;
  /** Auto-EQ flat, charging the boost to excursion / velocity / max SPL. */
  forceFlatResponse: boolean;
  /** Plot SPL backed off to Xmax instead of raw SPL. */
  splXmaxLimited: boolean;
  /** Voice-coil temperature rise, K, and its resistance coefficient, /K. 0 ⇒ no-op. */
  vcTempRise: number;
  alfaVC: number;
  /** Mass added to the DRIVER's cone, kg. 0 ⇒ no-op. */
  driverAddedMass: number;
}

/** The frequency band a sweep is computed over. */
export interface OpenISDSweepRange {
  fmin_hz: number;
  fmax_hz: number;
  points: number;
}

/** Who made this project, and when. `name` is a LABEL: two open projects may share one, so it
 *  is never an identity — the workspace entry's own id is. */
export interface OpenISDProjectMeta {
  name: string;
  creator: string;
  created: string;
  modified: string;
  description: string;
}

/**
 * THE project. Every member is data; none is a live object with its own lifecycle, because
 * `ManagedProject` clones the whole thing to open an edit or a what-if.
 */
export interface _OpenISDProjectJson {
  /** The driver as ITS OWN serialisation (`OpenISDDriver.toOwdrText()`), never the record
   *  shape. THE OWNER OF THE STATE SERIALIZES IT (QO83): the driver's record is private to
   *  `OpenISDDriver`, so the project — a legitimate HOLDER of a driver, not its owner —
   *  carries the text and materialises a live driver from it when one is asked for.
   *  `undefined` before a driver is chosen; `structuredClone` copies text exactly.
   *
   *  A REQUIRED key holding `| undefined`, not an optional (`driver?:`) property: `OpenISDProject`
   *  exposes every other field of this interface under a same-named public getter, which makes
   *  the class structurally satisfy this interface UNLESS at least one field the class does NOT
   *  expose is also non-optional — an optional field's mere absence from the class's public
   *  shape is not a structural mismatch. */
  driver: string | undefined;
  box: OpenISDBox;
  target: OpenISDTarget;
  filters: Filter[];
  environment: OpenISDEnvironment;
  signal: OpenISDSignal;
  listening: OpenISDListening;
  simOptions: OpenISDSimOptions;
  sweep: OpenISDSweepRange;
  meta: OpenISDProjectMeta;
}

// ── Construction and the one legal way to switch alignment ────────────────────────────────

/**
 * A vent with NOTHING chosen. Every dimension is 0 — this codebase's unset marker — until the
 * New Project wizard sets it from the driver, the box type and the selected alignment. See
 * bugs/BUG_20260821_new_project_invents_box_and_vent_values_instead_of_asking_the_user.md
 */
function prototypeVent(): OpenISDVent {
  return {
    shape: 'round',
    // TODO(box-wizard): WinISD initialises 0.102 m (4 in). Unset until the wizard sets it.
    diameter_m: 0,
    // TODO(box-wizard): slot width, unset until the wizard sets it.
    width_m: 0,
    // TODO(box-wizard): slot height, unset until the wizard sets it.
    height_m: 0,
    // TODO(box-wizard): DERIVED in WinISD from volume + tuning + diameter + end correction.
    //   Unset until that derivation exists.
    length_m: 0,
    // TODO(box-wizard): WinISD initialises 0.732 (one-flanged). Unset until the wizard sets it.
    endCorrection: 0,
  };
}

/**
 * A box with EVERY alignment present from the start, and NOTHING sized.
 *
 * None is created lazily on first switch: a lazily-created alignment gets DEFAULTS, and a
 * default written over a value restored from a file is the silent-data-loss this whole design
 * exists to prevent. They all exist, one is active, and none carries a number nobody chose.
 *
 * WinISD CALCULATES volume and tuning from driver + box type + alignment in its New Project
 * wizard. OpenISD has no such wizard yet, so every such value is 0 (unset) rather than an
 * invented plausible number — see
 * bugs/BUG_20260821_new_project_invents_box_and_vent_values_instead_of_asking_the_user.md
 */
export function prototypeBox(): OpenISDBox {
  return {
    active: 'vented',
    // TODO(box-wizard): sealed Vb, calculated from driver + alignment. Unset until then.
    sealed: { volume_m3: 0 },
    // TODO(box-wizard): vented Vb and Fb, calculated from driver + alignment. Unset until then.
    vented: { volume_m3: 0, Fb_hz: 0, vents: [prototypeVent()] },
    // TODO(box-wizard): bandpass chamber volumes and front tuning, calculated from driver +
    //   alignment. Unset until then.
    bandpass4: {
      rearVolume_m3: 0, frontVolume_m3: 0, Ff_hz: 0, vents: [prototypeVent()],
    },
    // TODO(box-wizard): PR volume, tuning, count and added mass, calculated from driver + PR +
    //   alignment. Unset until then.
    passiveRadiator: { volume_m3: 0, Fp_hz: 0, count: 0, addedMass_kg: 0 },
    // Enclosure losses: leakage, absorption, port. They describe the BOX, not one alignment,
    // so they sit here and survive every switch. These three are NOT invented: WinISD itself
    // writes Ql=10, Qa=100, Qp=100 — see test/fixtures/winisd-parity/goldens/bandpass4.wpr:69.
    Ql: 10, Qa: 100, Qp: 100,
  };
}

/**
 * Make one alignment active. **This writes exactly one field and nothing else.**
 *
 * It is a function rather than a bare assignment so that the rule has somewhere to be
 * enforced and tested: every dormant alignment keeps its values, so flipping a ported box to
 * sealed and back returns it intact. If this ever needs to do more than one write, that is the
 * moment to ask what is being cleared and why.
 */
export function setActiveAlignment(box: OpenISDBox, kind: AlignmentKind): void {
  box.active = kind;
}

// ── Flat field accessors — ledger QO54 ────────────────────────────────────────────────────
//
// `ManagedProject`/`store.ts` expose box, vent and PR data through a small set of legacy-shaped
// flat fields (`Vb`, `ventD`, `Fb`, `prSd`, …) so `useVentGroup.ts`/`usePrGroup.ts` and every UI
// call site keep working unchanged while the ACTUAL storage moves onto `OpenISDBox`. These
// functions are what those flat fields are defined in terms of.
//
// The rule, uniform across all of them: a field addresses bandpass4's OWN storage only while
// bandpass4 is active; every other active alignment (sealed, vented, passive-radiator) still
// addresses the VENTED alignment's storage, dormant or not — a vent or tuning typed in before
// switching away from vented must stay reachable through the same flat field, matching
// "switching box type deletes nothing." PR fields never depend on `active` at all.

/** The vent object `ventShape`/`ventD`/`ventW`/`ventH`/`ventL`/`endCorrection` address. A LIVE
 *  reference — writing through it mutates the box directly. */
export function activeVent(box: OpenISDBox): OpenISDVent {
  return (box.active === 'bandpass4' ? box.bandpass4.vents : box.vented.vents)[0]!;
}

/** Vent cross-sectional area, round or slotted. The single source of this formula — it was
 *  independently reimplemented as inline `Math.PI * (ventD / 2) ** 2` arithmetic in four
 *  separate files, one of them inside a module whose own header comment claimed "no physics
 *  is re-derived here" (bugs/BUG_20260818_vent_area_formula_duplicated_four_times_no_engine_
 *  source_of_truth.md). Slotted uses width × height directly; round vents are the only shape
 *  the pre-existing call sites actually computed, so that is the formula being consolidated. */
export function ventArea_m2(vent: OpenISDVent): number {
  return vent.shape === 'slotted'
    ? vent.width_m * vent.height_m
    : Math.PI * (vent.diameter_m / 2) ** 2;
}

/** `Vb` — the rear/primary chamber volume, per active alignment. Bandpass4's FRONT chamber is
 *  the separate `Vf` field (`bandpass4.frontVolume_m3`), untouched by this. */
export function boxVolume_m3(box: OpenISDBox): number {
  switch (box.active) {
    case 'sealed': return box.sealed.volume_m3;
    case 'vented': return box.vented.volume_m3;
    case 'bandpass4': return box.bandpass4.rearVolume_m3;
    case 'passive-radiator': return box.passiveRadiator.volume_m3;
  }
}
export function setBoxVolume_m3(box: OpenISDBox, value: number): void {
  switch (box.active) {
    case 'sealed': box.sealed.volume_m3 = value; break;
    case 'vented': box.vented.volume_m3 = value; break;
    case 'bandpass4': box.bandpass4.rearVolume_m3 = value; break;
    case 'passive-radiator': box.passiveRadiator.volume_m3 = value; break;
  }
}

/** `Fb` — system tuning. Bandpass4's `Ff_hz` (front-chamber tuning) IS `Fb` while bandpass4 is
 *  active; every other alignment reads/writes the vented alignment's `Fb_hz`, dormant or not. */
export function boxTuning_Fb_hz(box: OpenISDBox): number {
  return box.active === 'bandpass4' ? box.bandpass4.Ff_hz : box.vented.Fb_hz;
}
export function setBoxTuning_Fb_hz(box: OpenISDBox, value: number): void {
  if (box.active === 'bandpass4') box.bandpass4.Ff_hz = value;
  else box.vented.Fb_hz = value;
}

/** A stand-in with every field zeroed, for a read where no radiator has been chosen yet. Frozen
 *  and shared: a read must never allocate, since a reactive UI calls this on every render. */
const NO_RADIATOR: Readonly<OpenISDPassiveRadiatorRef> =
  Object.freeze({ Sd_m2: 0, Mmd_kg: 0, Cms_m_per_N: 0, Rms_Ns_per_m: 0, Xmax_m: 0, name: '' });

/** The radiator's own fields (Sd/Mmd/Cms/Rms/Xmax/name) for READING — zeros when none is
 *  chosen yet. Never creates one; see `ensurePassiveRadiator` for writing. */
export function passiveRadiatorOrDefault(
  alignment: OpenISDPassiveRadiatorAlignment,
): Readonly<OpenISDPassiveRadiatorRef> {
  return alignment.radiator ?? NO_RADIATOR;
}

/** The radiator's own fields for WRITING — creates one on first write if none exists yet, and
 *  returns the SAME object on every later call so a second field written right after the first
 *  lands on it rather than silently starting over. */
export function ensurePassiveRadiator(
  alignment: OpenISDPassiveRadiatorAlignment,
): OpenISDPassiveRadiatorRef {
  return alignment.radiator ??= { Sd_m2: 0, Mmd_kg: 0, Cms_m_per_N: 0, Rms_Ns_per_m: 0, Xmax_m: 0, name: '' };
}

// ── OpenISDProject — the class facade over `_OpenISDProjectJson` ──────────────────────────
//
// Mirrors `OpenISDDriver`'s own pattern (openisdDriver.ts): private constructor, static
// factories, accessors, `copy()`. `ManagedOpenISDProject` holds three of these (ground /
// committed / what-if) and never touches `_OpenISDProjectJson` directly — every read and
// write goes through this class's own API instead.

/** A project with nothing chosen — what the app holds before a driver is picked, and the seed
 *  `OpenISDProject.empty()` builds. Every value is a real default a user could have set; none
 *  is a fake driver standing in for a real one. */
function prototypeProject(): _OpenISDProjectJson {
  return {
    driver: undefined,
    box: prototypeBox(),
    // WinISD's direction: volume, diameter and tuning are typed; vent length is returned.
    // `Frc` has no OpenISDBox home yet (no 6th-order alignment exists — QO44) and is carried
    // here as a bare flag with no corresponding value; `prMadd` is the PR's own entered
    // member — added mass is typed, its tuning solved. `ventW`/`ventH` mark round-vent
    // dimensions entered even though only a slotted vent solves against them, matching what
    // ships: `ventFieldState` reads this set for EVERY vent field's E/C/N badge, not only the
    // ones the Helmholtz solver consumes.
    target: { entered: {
      Vb: true, ventD: true, ventW: true, ventH: true, Fb: true, Frc: true, prMadd: true,
    } },
    filters: [],
    environment: {
      tempK: 293.15, humidityPct: 30, pressurePa: 101325, ignoreHumidityAndPressure: false,
    },
    signal: {
      inputPower_W: 1, seriesResistance_ohm: 0.1, driverCount: 1,
      wiring: 'parallel', rgAtDriverSide: false,
    },
    listening: { distance_m: 1, angle_rad: 0 },
    simOptions: {
      circuitModel: 'winisd', tlPortModel: false, forceFlatResponse: false,
      splXmaxLimited: false, vcTempRise: 0, alfaVC: 0.0039, driverAddedMass: 0,
    },
    sweep: { fmin_hz: 1, fmax_hz: 20000, points: 400 },
    meta: { name: '', creator: '', created: '', modified: '', description: '' },
  };
}

/**
 * WinISD-vocabulary PR conversions — the ONE place `@openisd/engine`'s PR inverse formulas
 * (`prCmsFromVas`/`prMmdFromFs`/`prRmsFromQms`) are called from outside this project's own
 * `fromWinISDProject` construction, per the ruling that a PR T/S inverse is reachable ONLY via
 * the domain layer, never as a free engine call at a UI call site
 * (bugs/BUG_20260818_pr_formulas_and_air_constants_duplicated_outside_engine.md).
 * `packages/ui/src/logic/prWinIsdFields.ts` calls these three instead of hand-deriving.
 */
export function prCmsFromWinIsdVas(vasL: number, sdM2: number): number {
  return prCmsFromVas(vasL, sdM2);
}
export function prMmdFromWinIsdFs(fsHz: number, cmsSI: number): number {
  return prMmdFromFs(fsHz, cmsSI);
}
export function prRmsFromWinIsdQms(qms: number, mmdSI: number, cmsSI: number): number {
  return prRmsFromQms(qms, mmdSI, cmsSI);
}

export class OpenISDProject {
  readonly #record: _OpenISDProjectJson;

  private constructor(record: _OpenISDProjectJson) {
    this.#record = record;
  }

  /** Adopt an existing record — a load from disk, a share link, a restore. */
  static fromJsonRecord(record: _OpenISDProjectJson): OpenISDProject {
    return new OpenISDProject(record);
  }

  /**
   * THIS design as a WinISD `.wpr` project — the write-side twin of `fromWinISDProject`, and
   * the one place box/vent tuning is derived for export (the owner of the state calculates).
   *
   * `driverSection` is the driver's own `.wdr` text (the DRIVER serialises itself — this
   * project only holds it). `driver` is the engine projection for the sealed-resonance
   * refinement, `curve` the current swept impedance when one exists, and `now` is passed in,
   * never read from the clock, so the same design is byte-reproducible.
   */
  toWinISDProject(driverSection: string, driver: EngineDriver | null, now: Date,
                  curve: SweepResult | null): WinISDProject {
    const record = this.#record;
    const kind = record.box.active;
    const pad2 = (x: number) => String(x).padStart(2, '0');

    const Vb = kind === 'sealed' ? record.box.sealed.volume_m3
      : kind === 'vented' ? record.box.vented.volume_m3
      : kind === 'bandpass4' ? record.box.bandpass4.rearVolume_m3
      : record.box.passiveRadiator.volume_m3;
    const vent = (kind === 'bandpass4' ? record.box.bandpass4.vents : record.box.vented.vents)[0]!;
    const Sp = ventArea_m2(vent);

    const peak = (driver && curve) ? findImpedancePeak(curve, driver.Re) : null;
    const sealedFr = peak ? peak.Fsc : ((driver && sealedFc(driver, Vb)) ?? 0);

    const box: Record<string, string | number> = {
      BType: bTypeOfAlignmentKind(kind),
      Vr: Vb, Fr: 0,
      // ONE loss triple describes the enclosure; the file wants one per chamber, so both
      // chambers are written from it rather than one discarding the user's losses.
      Qlf: record.box.Ql, Qaf: record.box.Qa, Qpf: record.box.Qp,
      Qlr: record.box.Ql, Qar: record.box.Qa, Qpr: record.box.Qp,
      // Ambient — the design's own. The file's `phi` is a FRACTION; the record carries percent.
      T: record.environment.tempK, p: record.environment.pressurePa,
      phi: record.environment.humidityPct / 100,
      Nd: record.signal.driverCount,
      alfaVC: record.simOptions.alfaVC, dTVC: record.simOptions.vcTempRise,
    };
    const sections: Record<string, Record<string, string | number>> = {
      ProjectInfo: {
        Description: record.meta.description || '',
        Creator: record.meta.creator || '',
        CreateDate: (record.meta.created || '').replace(/-/g, ''), // '' if truly unknown
        ModifyDate: `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`,
      },
      Box: box,
      SignalSource: { Rg: record.signal.seriesResistance_ohm, P: record.signal.inputPower_W },
      SimulatorOptions: {
        VCInd: record.simOptions.circuitModel === 'gyrator' ? 1 : 0,
        FlatResponse: record.simOptions.forceFlatResponse ? 1 : 0,
        TLPorts: record.simOptions.tlPortModel ? 1 : 0,
      },
    };

    // `crosscalc` is the AREA's provenance — 0 when the area was entered, 1 when derived from
    // the diameter. Held as the entered-set flag pending the WinISD probe's ground truth
    // (bugs/BUG_20260823_wpr_import_discards_vent_cross_section_provenance.md); it is NOT the
    // port's shape.
    const ventKv = (Fb: number, ventVb: number): Record<string, string | number> => ({
      Num: 1, Shape: 1,
      // [Vent*].Fb/Vb are WinISD's copy of the owning chamber's own [Box] tuning/volume
      // (confirmed across the parity corpus), so they repeat the SAME numbers written above.
      Fb, Vb: ventVb,
      dia1: vent.diameter_m, dia2: vent.diameter_m, carea: Sp, len: vent.length_m,
      endcorrection: vent.endCorrection,
      crosscalc: record.target.entered['ventCrossArea'] ? 0 : 1,
    });

    if (kind === 'sealed') {
      box.Fr = sealedFr;
    } else if (kind === 'vented') {
      // The record's solved tuning, not a recompute from the length: if BOTH Fb and length are
      // entered (allowed), recomputing here would export a tuning contradicting the one on
      // screen. The file is plain geometry either way; it should be the geometry the user sees.
      box.Fr = record.box.vented.Fb_hz;
      box.Sdrport = Sp;
      sections.VentRear = ventKv(record.box.vented.Fb_hz, Vb);
    } else if (kind === 'bandpass4') {
      box.Fr = sealedFr; // rear: sealed, the driver's own chamber
      const Vf = record.box.bandpass4.frontVolume_m3;
      const Ff = tuningFromLength(Vf, vent.length_m, Sp, vent.endCorrection); // front: vented
      box.Vf = Vf; box.Ff = Ff; box.Sdfport = Sp;
      sections.VentFront = ventKv(Ff, Vf);
    } else {
      const pr = record.box.passiveRadiator;
      const r = pr.radiator;
      if (r) {
        box.Fr = prTuning({ Vb, prMmd: r.Mmd_kg, prMadd: pr.addedMass_kg,
                            prSd: r.Sd_m2, prCms: r.Cms_m_per_N });
        box.Npr = pr.count;
        sections.PassiveRadiator = {
          // prVas() returns LITRES (its own contract); the file's Vas is SI m³ like every
          // other key in the section, so the ÷1000 is load-bearing
          // (BUG_20260817_wpr_passive_radiator_vas_written_in_litres...).
          Vas: prVas(r.Cms_m_per_N, r.Sd_m2) / 1000,
          Qms: prQms(r.Mmd_kg, r.Cms_m_per_N, r.Rms_Ns_per_m),
          Fs: prFsWithMass(r.Mmd_kg, pr.addedMass_kg, r.Cms_m_per_N),
          Sd: r.Sd_m2, Xmax: r.Xmax_m, Me: pr.addedMass_kg,
        };
      }
    }

    return WinISDProject.build(driverSection, sections);
  }

  /** A project with nothing chosen. */
  static empty(): OpenISDProject {
    return new OpenISDProject(prototypeProject());
  }

  /** An independent copy — how `ManagedOpenISDProject` obtains its ground/committed/what-if
   *  layers without ever touching the JSON itself (`ManagedX` clones `X` by asking `X` for a
   *  copy of itself — never by touching its JSON, ledger QO60/61). */
  copy(): OpenISDProject {
    return new OpenISDProject(structuredClone(this.#record));
  }

  // ---- driver ------------------------------------------------------------------------------

  /** The driver's own serialised TEXT — for `ManagedOpenISDProject` to materialise its OWN
   *  live `OpenISDDriver` from. Opaque: no private shape crosses, so this needs no underscore
   *  and no allow-list entry. `undefined` before a driver is chosen. */
  driverText(): string | undefined { return this.#record.driver; }

  /** Adopt a driver into this project — the ONE adoption channel, taking the public domain
   *  object rather than the private record (QO73/human ruling 2026-08-22: no UI code may name
   *  or infer the driver's record shape). Stores the driver's OWN serialisation, so the
   *  caller's live driver and this project's copy can never be the same object.
   *  `undefined` clears the project's driver. */
  setDriver(driver: OpenISDDriver | undefined): void {
    this.#record.driver = driver?.toOwdrText();
  }

  /**
   * A PROJECT FILE's text → an `OpenISDProject`, driver included.
   *
   * THE OWNER OF THE STATE PARSES IT (human ruling 2026-08-22, QO83). A `.wpr` is WinISD's own
   * project format: the raw section/key/value read belongs to `@openisd/winisd`, the box-type
   * mapping and PR conversion belong to this class (`fromWinISDProject` below), and the
   * embedded `[Driver]` block is the DRIVER's own serialisation, so it is handed to
   * `OpenISDDriver`. Every one of those steps is a question about state this package owns —
   * which is why the whole chain lives here rather than in a caller that would need the
   * record shape to stitch it together.
   *
   * Errors are returned, never thrown; `value` is null when the file cannot be read.
   */
  static fromWprText(text: string): Result<OpenISDProject> {
    const fail = (message: string): Result<OpenISDProject> =>
      ({ value: null, errors: [{ level: 'error', field: 'wpr', message }] });

    const wpr = WinISDProject.fromWprIni(text);
    let project: OpenISDProject;
    try { project = OpenISDProject.fromWinISDProject(wpr); }
    catch (err) { return fail((err as Error).message); }

    if (wpr.driverWdrText().trim().length > 0) {
      try { project.setDriver(OpenISDDriver.fromWdrText(wpr.driverWdrText())); }
      catch (err) { return fail(`the .wpr's [Driver] block could not be read: ${(err as Error).message}`); }
    }
    return { value: project, errors: [] };
  }

  /**
   * The ONE place a raw `.wpr` parse (`@openisd/winisd`'s `parseWprRaw`) becomes a real
   * project — box-type→box-kind mapping and the PR WinISD-vocabulary→canonical conversion both
   * happen here, never at the caller (PLAN_QO60_LAYERING_REMEDIATION.md objective 2b). Builds
   * on `prototypeProject()`'s defaults; a raw field present overwrites its default, absent
   * leaves the default untouched — a value the file does not state is never fabricated, and a
   * default the file does not override is never cleared. Carries no driver: the caller sets one
   * separately via `setDriver()`, since `raw.driverWdrText` needs `OpenISDDriver.fromWdrText()`,
   * which this file does not call (it is not one of the licensed construction sites).
   */
  static fromWinISDProject(wpr: WinISDProject): OpenISDProject {
    const n = (sec: string, key: string) => wpr.number(sec, key);
    const t = (sec: string, key: string) => wpr.value(sec, key);

    const kind = alignmentKindOfBType(n('Box', 'BType'));
    if (kind == null) {
      const bType = n('Box', 'BType');
      throw new Error(bType == null
        ? '.wpr has no [Box] BType — the box type is not stated, and this reader will not assume one'
        : `.wpr states BType=${bType}, which is not a box type OpenISD models (0/1/2/4)`);
    }

    const record = prototypeProject();
    setActiveAlignment(record.box, kind);

    const Vr = n('Box', 'Vr');
    if (Vr != null) {
      switch (kind) {
        case 'sealed': record.box.sealed.volume_m3 = Vr; break;
        case 'vented': record.box.vented.volume_m3 = Vr; break;
        case 'bandpass4': record.box.bandpass4.rearVolume_m3 = Vr; break;
        case 'passive-radiator': record.box.passiveRadiator.volume_m3 = Vr; break;
      }
    }
    const Vf = n('Box', 'Vf');
    if (Vf != null) record.box.bandpass4.frontVolume_m3 = Vf;
    const fb = kind === 'bandpass4' ? n('Box', 'Ff') : n('Box', 'Fr');
    if (fb != null) {
      if (kind === 'bandpass4') record.box.bandpass4.Ff_hz = fb;
      else record.box.vented.Fb_hz = fb;
    }
    // The file stores a loss triple PER CHAMBER (Qlf/Qlr, …); the rear chamber is the primary
    // one for every box type OpenISD models, so the record's single triple reads from it.
    const Ql = n('Box', 'Qlr'), Qa = n('Box', 'Qar'), Qp = n('Box', 'Qpr');
    if (Ql != null) record.box.Ql = Ql;
    if (Qa != null) record.box.Qa = Qa;
    if (Qp != null) record.box.Qp = Qp;

    const P = n('SignalSource', 'P'), Rg = n('SignalSource', 'Rg');
    if (P != null) record.signal.inputPower_W = P;
    if (Rg != null) record.signal.seriesResistance_ohm = Rg;
    const Nd = n('Box', 'Nd');
    if (Nd != null) record.signal.driverCount = Nd;

    const ventSec = kind === 'bandpass4' ? 'VentFront' : 'VentRear';
    const vent = (kind === 'bandpass4' ? record.box.bandpass4.vents : record.box.vented.vents)[0]!;
    const dia = n(ventSec, 'dia1');
    if (dia != null) vent.diameter_m = dia;
    const len = n(ventSec, 'len');
    if (len != null) vent.length_m = len;
    const endCorrection = n(ventSec, 'endcorrection');
    if (endCorrection != null) vent.endCorrection = endCorrection;
    // `crosscalc=0` states the cross-section AREA was entered rather than derived from the
    // diameter. It says nothing about port SHAPE: the file carries no width/height keys, and
    // its separate `Shape=` key is unread pending ground truth from the WinISD probe
    // (bugs/BUG_20260823_wpr_import_discards_vent_cross_section_provenance.md). Shape comes
    // from OBSERVED GEOMETRY — a stated dia1 is a round port — so no import can build a vent
    // whose area computes to zero while the file states a nonzero diameter.
    if (n(ventSec, 'crosscalc') === 0) record.target.entered['ventCrossArea'] = true;

    if (kind === 'passive-radiator') {
      const Sd = n('PassiveRadiator', 'Sd'), Vas = n('PassiveRadiator', 'Vas');
      const Fs = n('PassiveRadiator', 'Fs'), Qms = n('PassiveRadiator', 'Qms');
      const hasPr = Sd != null && Sd > 0 && Vas != null && Fs != null && Fs > 0 && Qms != null && Qms > 0;
      if (!hasPr) {
        throw new Error('.wpr states BType=4 (passive radiator) but [PassiveRadiator] does not '
          + 'carry Sd, Vas, Fs and Qms — the radiator cannot be reconstructed and will not be invented');
      }
      // `.wpr`'s [PassiveRadiator].Vas is SI m³ (BUG_20260817); the engine's Vas-vocabulary
      // functions take litres, so the ×1000 happens here, at this one boundary.
      const cms = prCmsFromVas(Vas * 1000, Sd);
      const mmd = prMmdFromFs(Fs, cms);
      const rms = prRmsFromQms(Qms, mmd, cms);
      const radiator = ensurePassiveRadiator(record.box.passiveRadiator);
      radiator.Sd_m2 = Sd;
      radiator.Cms_m_per_N = cms;
      radiator.Mmd_kg = mmd;
      radiator.Rms_Ns_per_m = rms;
      radiator.Xmax_m = n('PassiveRadiator', 'Xmax') ?? 0;
      const Me = n('PassiveRadiator', 'Me');
      if (Me != null) record.box.passiveRadiator.addedMass_kg = Me;
      const Npr = n('Box', 'Npr');
      if (Npr != null) record.box.passiveRadiator.count = Npr;
    }

    const tempK = n('Box', 'T'), pressurePa = n('Box', 'p'), phi = n('Box', 'phi');
    if (tempK != null) record.environment.tempK = tempK;
    if (pressurePa != null) record.environment.pressurePa = pressurePa;
    if (phi != null) record.environment.humidityPct = phi * 100; // file: fraction; record: percent

    const vcInd = t('SimulatorOptions', 'VCInd');
    if (vcInd != null) record.simOptions.circuitModel = vcInd === '1' ? 'gyrator' : 'winisd';
    const tlPorts = t('SimulatorOptions', 'TLPorts');
    if (tlPorts != null) record.simOptions.tlPortModel = tlPorts === '1';
    const flat = t('SimulatorOptions', 'FlatResponse');
    if (flat != null) record.simOptions.forceFlatResponse = flat === '1';

    const description = t('ProjectInfo', 'Description');
    record.meta = {
      name: description || 'Imported Design',
      description: description || '',
      creator: t('ProjectInfo', 'Creator') || '',
      created: t('ProjectInfo', 'CreateDate') || '',
      modified: '',
    };

    return new OpenISDProject(record);
  }

  // ---- sub-object accessors — live references, named exactly like `_OpenISDProjectJson`'s
  // own fields so a caller reads and writes them precisely as it would the raw record, without
  // ever naming `_OpenISDProjectJson` itself. "The box IS the storage" (managedProject.ts):
  // these are public, non-private types — `OpenISDBox` and its siblings, not `_XJson` — so
  // handing out a live reference is not handing out the private shape. --------------------

  get box(): OpenISDBox { return this.#record.box; }

  /** How many ports the ACTIVE alignment has (sealed and PR: 0). */
  ventCount(): number {
    const box = this.#record.box;
    return box.active === 'vented' ? box.vented.vents.length
      : box.active === 'bandpass4' ? box.bandpass4.vents.length
      : 0;
  }

  /** One port of the active alignment, as an independent copy — mutating it changes nothing.
   *  Index-based from day one so a multi-port alignment (QO85) adds no new accessor shape. */
  vent(i: number): OpenISDVent | undefined {
    const box = this.#record.box;
    const vents = box.active === 'vented' ? box.vented.vents
      : box.active === 'bandpass4' ? box.bandpass4.vents
      : [];
    const v = vents[i];
    return v ? { ...v } : undefined;
  }
  get target(): OpenISDTarget { return this.#record.target; }
  get environment(): OpenISDEnvironment { return this.#record.environment; }
  get signal(): OpenISDSignal { return this.#record.signal; }
  get listening(): OpenISDListening { return this.#record.listening; }
  get simOptions(): OpenISDSimOptions { return this.#record.simOptions; }
  get sweep(): OpenISDSweepRange { return this.#record.sweep; }
  get meta(): OpenISDProjectMeta { return this.#record.meta; }
  get filters(): Filter[] { return this.#record.filters; }
  set filters(value: Filter[]) { this.#record.filters = value; }
}
