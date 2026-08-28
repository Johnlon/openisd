/**
 * `OpenISDProjectJson` — one speaker design, whole.
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
 * `OpenISDBox` holds every box type at once and names which is ACTIVE. Flip a ported box to
 * sealed and its port data stays, dormant; flip back and it is intact. Only the `.wpr` writer
 * drops dormant data, because the file format cannot express it — and dropping on the way OUT
 * is not the same as discarding from the model. Anything that clears a field on a box-type
 * change is a defect: the user asked to look at a different box type, not to lose their work.
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
import { OpenISDDriver, Provenance } from './openisdDriver.js';
import { driverFromConformingRecord } from './driverConformance.js';
// `OpenISDDriverJson` is `openisdDriver.ts`'s own wire shape — named openly here (not
// laundered through an alias or `unknown`) because `OpenISDProjectJson.driver` below HOLDS one
// as opaque data: this file never reads a field off it, only passes it whole to
// `OpenISDDriver.fromJsonRecord()`/`.toJsonRecord()`.
import type { OpenISDDriverJson } from './openisdDriver.js';
import type { Filter } from '@openisd/design/engine';
import { Engine } from '@openisd/design/engine';
import { WinISDProject } from "@openisd/winisd";
import type { Result, EngineDriver, SweepResult, LossMode, BoxType } from "@openisd/design/engine";

/** The project fields `cell()`/`enter()`/`clear()` speak — the vent group, the PR group, and
 *  the derived port area. */
export type ProjectFieldId =
  | 'Vb' | 'ventD' | 'Fb' | 'ventL' | 'ventW' | 'ventH' | 'Sp' | 'prFp' | 'prMadd'
  // Relation-less registered fields — one name each, the registry's own symbol. All are
  // Entered by the prototype-stater rule (QO36-B4): the prototype or the user stated them,
  // nothing ever solves them.
  | 'Vf' | 'Ql' | 'Qa' | 'Qp' | 'frcHz' | 'endCorrection'
  | 'advTemp' | 'advHumidity' | 'advPressure'
  | 'Pin' | 'Rs' | 'nDrivers' | 'vcTempRise' | 'driverAddedMass'
  // The radiator's own facts (SI), and its datasheet vocabulary — Vas/Fs/Qms are DERIVED
  // views of the canonical Sd/Cms/Mmd/Rms; entering one re-solves the canonical set with
  // the ruled holds. All values SI (prVas in m³ — display units are the registry's job).
  | 'prSd' | 'prXmax' | 'prNum' | 'prVas' | 'prFs' | 'prQms' | 'prFsMass';

/** How many ports each box type HAS — the enforced fact behind `vents[]`, not a comment.
 *
 *  TOTAL over the one `BoxType`, so a new box type is a compile error here rather than a silent
 *  hole. `bandpass6` and `abc` are declared because the type declares them; neither is
 *  constructible through the UI yet and the engine has no circuit for either.
 *
 *  `abc: 3` is John's own figure (QO85, 2026-08-23: "ABC needs 3 ports, not 1").
 *  `bandpass6: 2` is the standard two-ported-chamber topology and is NOT confirmed against real
 *  WinISD — raised as a ledger question rather than left as a silent assumption. */
export const VENT_ARITY: Readonly<Record<BoxType, number>> = {
  sealed: 0, vented: 1, bandpass4: 1, 'box-passive-radiator': 0, bandpass6: 2, abc: 3,
};

/** Throws when a record's vents arrays do not match their box types' declared arity — a
 *  wrong-arity record must refuse loudly, never have vents silently ignored by `[0]` reads
 *  (the silent-drop class QO85's shape decision exists to prevent). */
function assertVentArity(box: OpenISDBox): void {
  const check = (kind: 'vented' | 'bandpass4', vents: readonly OpenISDVent[]) => {
    if (vents.length !== VENT_ARITY[kind]) {
      throw new Error(`${kind} declares ${VENT_ARITY[kind]} port(s) but the record carries `
        + `${vents.length} — arity is fixed per box type (QO85) and a mismatch is refused, `
        + 'never truncated');
    }
  };
  check('vented', box.vented.vents);
  check('bandpass4', box.bandpass4.vents);
}

const RELATIONLESS: ReadonlySet<string> = new Set(['Vf','Ql','Qa','Qp','endCorrection','frcHz','advTemp','advHumidity','advPressure','Pin','Rs','nDrivers','vcTempRise','driverAddedMass']);

// `BoxType` is declared ONCE, by `@openisd/design/engine`, and imported at the top of this file.
// This model adds no second enumeration of it.

/** WinISD's own `[Box].BType` numeric code — a raw file-format discriminator, never a bare
 *  int at a call site that interprets it. `boxTypeOfBType`/`bTypeOfBoxType` below
 *  are the ONE place this vocabulary meets `BoxType` — every reader/writer of a `.wpr`
 *  box type goes through them rather than keeping its own switch. */
export enum WinIsdBType {
  Sealed = 0,
  Vented = 1,
  Bandpass4 = 2,
  PassiveRadiator = 4,
}

/** WinISD's raw BType code → this app's BoxType. `undefined` when `code` is nullish (a
 *  `.wpr` that never states BType) or not one of WinISD's four modelled box types — the
 *  caller decides how to report that, since those are different errors this pure mapping does
 *  not itself choose between. */
function boxTypeOfBType(code: number | undefined): BoxType | undefined {
  switch (code) {
    case WinIsdBType.Sealed: return 'sealed';
    case WinIsdBType.Vented: return 'vented';
    case WinIsdBType.Bandpass4: return 'bandpass4';
    case WinIsdBType.PassiveRadiator: return 'box-passive-radiator';
    default: return undefined;
  }
}

/** This app's BoxType → WinISD's raw BType code — the reverse of `boxTypeOfBType`.
 *
 *  `bandpass6` and `abc` REFUSE rather than return a code. WinISD does support both box types
 *  (BUG_20260824, live probe), but which `BType` integer it writes for them has never been
 *  measured — the four codes above are the measured ones. Guessing here would write a `.wpr`
 *  that names the wrong enclosure, which is worse than declining to write one. */
function bTypeOfBoxType(kind: BoxType): WinIsdBType {
  switch (kind) {
    case 'sealed': return WinIsdBType.Sealed;
    case 'vented': return WinIsdBType.Vented;
    case 'bandpass4': return WinIsdBType.Bandpass4;
    case 'box-passive-radiator': return WinIsdBType.PassiveRadiator;
    case 'bandpass6':
    case 'abc':
      throw new Error(
        `Cannot write a WinISD project for a ${kind} enclosure: WinISD's own BType code for it `
        + 'has not been measured, and writing a guessed code would name a different box type.',
      );
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
export interface OpenISDSealedBox {
  volume_m3: number;
}

/** A vented box OWNS its vent — a sealed box has no vent to configure, and the model says so
 *  rather than leaving an ignored field lying about. */
export interface OpenISDVentedBox {
  volume_m3: number;
  /** System tuning. */
  Fb_hz: number;
  /** The box type's ports, arity fixed by the box type: vented has exactly one. An array
   *  from day one so a multi-port box type (ABC needs three, QO85) adds no new shape.
   *  READONLY: growing or shrinking it is refused at compile time; arity changes only with a
   *  new box-type definition. */
  vents: readonly OpenISDVent[];
}

/** 4th-order bandpass: a sealed rear chamber and a vented front one. */
export interface OpenISDBandpass4Box {
  rearVolume_m3: number;
  frontVolume_m3: number;
  /** Front-chamber tuning. */
  Ff_hz: number;
  /** The front chamber's ports — bandpass4 has exactly one. Same arity-by-box-type array as
   *  `OpenISDVentedBox.vents` (QO85), and readonly for the same reason. */
  vents: readonly OpenISDVent[];
}

/** A passive-radiator box OWNS its radiator, for the same reason a vented box owns its vent. */
export interface OpenISDPassiveRadiatorBox {
  volume_m3: number;
  /** System tuning (WinISD: Fp). Tied to the radiator's added mass by one relation. */
  Fp_hz: number;
  /** How many radiators. */
  count: number;
  /** Mass added to the radiator's own Mmd to move the tuning. */
  addedMass_kg: number;
  /** The radiator itself — a COMPONENT, so it carries its own record. Absent until one is
   *  chosen; the box type can be configured before a part is picked. */
  radiator?: OpenISDPassiveRadiatorRef;
}

/** Placeholder for the passive-radiator component (Plan 1 step 5 replaces this with the real
 *  `OpenISDPassiveRadiator`). Named rather than inlined so the swap is one edit, and so the
 *  box type above already expresses that a radiator is a COMPONENT and not loose fields. */
export interface OpenISDPassiveRadiatorRef {
  Sd_m2: number;
  Mmd_kg: number;
  Cms_m_per_N: number;
  Rms_Ns_per_m: number;
  Xmax_m: number;
  name: string;
}

/**
 * The enclosure. Holds EVERY box type at once and names which is active — that is the
 * dormant-data rule expressed in the type, rather than left to callers to honour.
 *
 * 6th-order bandpass and ABC are not here: neither exists in the codebase, and ABC has no field
 * specification anywhere (ledger QO44). Adding an empty member would claim otherwise.
 */
export interface OpenISDBox {
  active: BoxType;
  sealed: OpenISDSealedBox;
  vented: OpenISDVentedBox;
  bandpass4: OpenISDBandpass4Box;
  passiveRadiator: OpenISDPassiveRadiatorBox;
  /** Enclosure losses: leakage, absorption, port. Shared by every box type. */
  Ql: number;
  Qa: number;
  Qp: number;
  /** Rear-chamber tuning target (WinISD: Frc) — read/written by 6th-order bandpass and ABC's
   *  Box tab (both unbuilt, ledger QO44/QO85). Box-level like Ql/Qa/Qp: stored regardless of
   *  which box type is active, because nothing about it depends on one existing. */
  frcHz: number;
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
 *  is never an identity — `OpenISDProject.uuid()` is, and that lives only in memory. */
export interface OpenISDProjectMeta {
  name: string;
  creator: string;
  created: string;
  modified: string;
  description: string;
}

/**
 * THE project's WIRE shape — what `toJsonRecord()` produces and `fromJsonRecord()` adopts.
 * Every member is plain data, because this is the shape that actually crosses a boundary
 * (`structuredClone`, `JSON.stringify`, a file, a share link).
 *
 * `driver` is the driver's OWN wire record (`OpenISDDriver.toJsonRecord()`'s `OpenISDDriverJson`
 * — named openly here, not laundered, and held as OPAQUE data: this file never reads a field
 * off it, only ever passes it whole to `OpenISDDriver.fromJsonRecord()`/`.toJsonRecord()`), so a
 * saved project nests real JSON, not a JSON string escaped inside JSON. Never absent: a project
 * without a driver cannot exist (`docs/design/DRIVER_NON_NULL_INVARIANT.md`, John's ruling
 * "driver in proj is non-null - full stop").
 *
 * This is NOT what `OpenISDProject` holds live (see `ProjectLiveState` below, right above
 * the class) — the driver's record here is a PROJECTION, built once by `toJsonRecord()` at the
 * moment bytes are actually needed, never the class's own in-memory storage.
 */
export interface OpenISDProjectJson {
  driver: OpenISDDriverJson;
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

/**
 * `OpenISDProject`'s actual live, in-memory storage — identical to `OpenISDProjectJson` except
 * `driver` is the real, live `OpenISDDriver` object rather than its serialised text. The project
 * is either wholly a domain object or wholly text, never a mix: `#record` holds this type
 * throughout the object's lifetime, and the ONLY place a driver becomes text is `toJsonRecord()`
 * (output) — the only place text becomes a driver is `fromJsonRecord()` (input). Internal only:
 * this type never crosses `OpenISDProject`'s own boundary, so it is not exported.
 */
interface ProjectLiveState extends Omit<OpenISDProjectJson, 'driver'> {
  driver: OpenISDDriver;
  /** THE project's identity, and IN-MEMORY ONLY — declared here rather than on the wire shape
   *  above, which is the whole point (John 2026-08-26: "lets make the UUID an internal only
   *  feature ... when loading an owdr we assign a new uuid").
   *
   *  It exists so the running app can tell two open projects apart when their NAMES collide —
   *  a store keys on it, and `focusedIndex` can become a `focusedUuid` that survives reordering.
   *  Nothing outside the process needs it, and persisting it would buy a problem rather than
   *  solve one: a file carrying an id makes re-importing it a collision the user has to be
   *  asked about, over an identity they never knew existed. Unpersisted, a load is simply a
   *  new project, which is what it looks like to the user anyway.
   *
   *  Minted at construction, preserved by `copy()` — every layer of a `ManagedProject` is a
   *  copy of ONE project, so they share an id and the wrapper is identified by it too (John:
   *  "the managed project is a wrapper id'd by same id"). */
  uuid: string;
}

// ── Construction and the one legal way to switch box type ────────────────────────────────

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
 * A box with EVERY box type present from the start, and NOTHING sized.
 *
 * None is created lazily on first switch: a lazily-created box type gets DEFAULTS, and a
 * default written over a value restored from a file is the silent-data-loss this whole design
 * exists to prevent. They all exist, one is active, and none carries a number nobody chose.
 *
 * WinISD CALCULATES volume and tuning from driver + box type + alignment in its New Project
 * wizard. OpenISD has no such wizard yet, so every such value is 0 (unset) rather than an
 * invented plausible number — see
 * bugs/BUG_20260821_new_project_invents_box_and_vent_values_instead_of_asking_the_user.md
 */
function prototypeBox(): OpenISDBox {
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
    // Enclosure losses: leakage, absorption, port. They describe the BOX, not one box type,
    // so they sit here and survive every switch. These three are NOT invented: WinISD itself
    // writes Ql=10, Qa=100, Qp=100 — see test/fixtures/winisd-parity/goldens/bandpass4.wpr:69.
    Ql: 10, Qa: 100, Qp: 100,
    // TODO(box-wizard): rear-chamber tuning, calculated from driver + alignment once
    // 6th-order bandpass/ABC exist (QO44/QO85). Unset until then, same as every other
    // un-wizarded box value above — not a plausible invented number.
    frcHz: 0,
  };
}

/**
 * Make one box type active. **This writes exactly one field and nothing else.**
 *
 * It is a function rather than a bare assignment so that the rule has somewhere to be
 * enforced and tested: every dormant box type keeps its values, so flipping a ported box to
 * sealed and back returns it intact. If this ever needs to do more than one write, that is the
 * moment to ask what is being cleared and why.
 */
function setActiveBoxType(box: OpenISDBox, kind: BoxType): void {
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
// bandpass4 is active; every other active box type (sealed, vented, passive-radiator) still
// addresses the VENTED box type's storage, dormant or not — a vent or tuning typed in before
// switching away from vented must stay reachable through the same flat field, matching
// "switching box type deletes nothing." PR fields never depend on `active` at all.

/** The vent object `ventShape`/`ventD`/`ventW`/`ventH`/`ventL`/`endCorrection` address. A LIVE
 *  reference — writing through it mutates the box directly. */
function activeVent(box: OpenISDBox): OpenISDVent {
  assertVentArity(box);
  return (box.active === 'bandpass4' ? box.bandpass4.vents : box.vented.vents)[0]!;
}

/** Vent cross-sectional area, round or slotted. The single source of this formula — it was
 *  independently reimplemented as inline `Math.PI * (ventD / 2) ** 2` arithmetic in four
 *  separate files, one of them inside a module whose own header comment claimed "no physics
 *  is re-derived here" (bugs/BUG_20260818_vent_area_formula_duplicated_four_times_no_engine_
 *  source_of_truth.md). Slotted uses width × height directly; round vents are the only shape
 *  the pre-existing call sites actually computed, so that is the formula being consolidated. */
function ventArea_m2(vent: OpenISDVent): number {
  return vent.shape === 'slotted'
    ? vent.width_m * vent.height_m
    : Math.PI * (vent.diameter_m / 2) ** 2;
}

/** Why a box type the record has no slot for cannot be read or written.
 *
 *  `BoxType` names six enclosures; `OpenISDBox` stores four. `bandpass6` and `abc` are real
 *  WinISD box types (BUG_20260824) with no field specification here yet (QO85), so a project
 *  cannot currently BE one — no UI path constructs it. Should one ever arrive, it says so by
 *  name instead of silently reading another chamber's volume. */
function noStorageFor(kind: 'bandpass6' | 'abc'): string {
  return `This project is a ${kind} enclosure, which has no stored fields yet (QO85) — `
    + 'its volume cannot be read or written until that box type is specified.';
}

/** `Vb` — the rear/primary chamber volume, per active box type. Bandpass4's FRONT chamber is
 *  the separate `Vf` field (`bandpass4.frontVolume_m3`), untouched by this. */
function boxVolume_m3(box: OpenISDBox): number {
  switch (box.active) {
    case 'sealed': return box.sealed.volume_m3;
    case 'vented': return box.vented.volume_m3;
    case 'bandpass4': return box.bandpass4.rearVolume_m3;
    case 'box-passive-radiator': return box.passiveRadiator.volume_m3;
    case 'bandpass6':
    case 'abc':
      throw new Error(noStorageFor(box.active));
  }
}
function setBoxVolume_m3(box: OpenISDBox, value: number): void {
  switch (box.active) {
    case 'sealed': box.sealed.volume_m3 = value; break;
    case 'vented': box.vented.volume_m3 = value; break;
    case 'bandpass4': box.bandpass4.rearVolume_m3 = value; break;
    case 'box-passive-radiator': box.passiveRadiator.volume_m3 = value; break;
    case 'bandpass6':
    case 'abc':
      throw new Error(noStorageFor(box.active));
  }
}

/** `Fb` — system tuning. Bandpass4's `Ff_hz` (front-chamber tuning) IS `Fb` while bandpass4 is
 *  active; every other box type reads/writes the vented box type's `Fb_hz`, dormant or not. */
function boxTuning_Fb_hz(box: OpenISDBox): number {
  return box.active === 'bandpass4' ? box.bandpass4.Ff_hz : box.vented.Fb_hz;
}
function setBoxTuning_Fb_hz(box: OpenISDBox, value: number): void {
  if (box.active === 'bandpass4') box.bandpass4.Ff_hz = value;
  else box.vented.Fb_hz = value;
}

/** A stand-in with every field zeroed, for a read where no radiator has been chosen yet. Frozen
 *  and shared: a read must never allocate, since a reactive UI calls this on every render. */
const NO_RADIATOR: Readonly<OpenISDPassiveRadiatorRef> =
  Object.freeze({ Sd_m2: 0, Mmd_kg: 0, Cms_m_per_N: 0, Rms_Ns_per_m: 0, Xmax_m: 0, name: '' });

/** The radiator's own fields (Sd/Mmd/Cms/Rms/Xmax/name) for READING — zeros when none is
 *  chosen yet. Never creates one; see `ensurePassiveRadiator` for writing. */
function passiveRadiatorOrDefault(
  box: OpenISDPassiveRadiatorBox,
): Readonly<OpenISDPassiveRadiatorRef> {
  return box.radiator ?? NO_RADIATOR;
}

/** The radiator's own fields for WRITING — creates one on first write if none exists yet, and
 *  returns the SAME object on every later call so a second field written right after the first
 *  lands on it rather than silently starting over. */
function ensurePassiveRadiator(
  box: OpenISDPassiveRadiatorBox,
): OpenISDPassiveRadiatorRef {
  return box.radiator ??= { Sd_m2: 0, Mmd_kg: 0, Cms_m_per_N: 0, Rms_Ns_per_m: 0, Xmax_m: 0, name: '' };
}

// ── OpenISDProject — the class facade over `OpenISDProjectJson` ──────────────────────────
//
// Mirrors `OpenISDDriver`'s own pattern (openisdDriver.ts): private constructor, static
// factories, accessors, `copy()`. `ManagedProject` holds three of these (ground /
// committed / what-if) and never touches `OpenISDProjectJson` directly — every read and
// write goes through this class's own API instead.

/** A project with a chosen driver and nothing else set — the seed `OpenISDProject.empty()`
 *  builds. Every OTHER value is a real default a user could have set; none is a fake value
 *  standing in for a real one. `driver` is REQUIRED: a project cannot exist without one
 *  (`docs/design/DRIVER_NON_NULL_INVARIANT.md`). */
function prototypeProject(driver: OpenISDDriver, uuid: string): ProjectLiveState {
  return {
    uuid,
    driver,
    box: prototypeBox(),
    // WinISD's direction: volume, diameter and tuning are typed; vent length is returned.
    // `prMadd` is the PR's own entered member — added mass is typed, its tuning solved.
    // `ventW`/`ventH` mark round-vent dimensions entered even though only a slotted vent
    // solves against them, matching what ships: `ventFieldState` reads this set for EVERY
    // vent field's E/C/N badge, not only the ones the Helmholtz solver consumes. `frcHz` is
    // relation-less (RELATIONLESS set) so it needs no entry here — `cell()` reports it
    // Entered unconditionally, same as Vf/Ql/Qa/Qp.
    target: { entered: {
      Vb: true, ventD: true, ventW: true, ventH: true, Fb: true, prMadd: true,
    } },
    filters: [],
    environment: {
      // DEFAULTS TO TRUE: a new project matches WinISD out of the box (John, 2026-08-28,
      // overriding QO7's physics-by-default). Which air model is used has NO AUDIBLE
      // consequence — worst case across 0-40 C, 0-100 % RH and 95-105 kPa is 0.003 dB of SPL
      // and no change to F3 at all (winisd_research FINDING-008). It IS measurable with
      // instruments; it is a thousandth of the smallest level change a person can detect. So
      // the tie is broken by which numbers a user can check against another tool.
      tempK: 293.15, humidityPct: 30, pressurePa: 101325, ignoreHumidityAndPressure: true,
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
function prCmsFromWinIsdVas(vas_m3: number, sdM2: number): number {
  return new Engine().prCmsFromVas(vas_m3, sdM2);
}
function prMmdFromWinIsdFs(fsHz: number, cmsSI: number): number {
  return new Engine().prMmdFromFs(fsHz, cmsSI);
}
function prRmsFromWinIsdQms(qms: number, mmdSI: number, cmsSI: number): number {
  return new Engine().prRmsFromQms(qms, mmdSI, cmsSI);
}

/**
 * The flat, engine-facing snapshot of one project — a superset of the engine's SweepParams:
 * it adds view-only inputs (ventD/ventL geometry, Pin drive power, prName) and omits the
 * derived fields (eg, Sp, Leff) that `syncedP`/`toUiParams()` compute on the fly. Produced by
 * `toUiParams()`, adopted by `loadUiParams()`, never stored.
 */
export interface UiParams {
  Vb: number;
  Vf: number;
  ventShape: 'round' | 'slotted';
  ventD: number;
  ventW: number;
  ventH: number;
  ventL: number;
  /** Box tuning. Tied to Vb/ventD/ventL by one Helmholtz relation — see `entered`. */
  Fb: number;
  /** Rear-chamber tuning target — WinISD: Frc, for 6th-order bandpass/ABC (both unbuilt,
   *  QO44/QO85). Relation-less like `Ql`/`Qa`/`Qp`: always a real value, never absent. */
  Frc: number;
  /**
   * Passive-radiator system tuning (WinISD: Fp). Tied to `prMadd` by one relation — the PR's
   * intrinsic Mmd/Cms/Sd plus Vb are given, and added mass is what moves the tuning. Enter a
   * target tuning and the mass is solved; enter a mass and the tuning is. See `entered`.
   */
  prFp: number;
  /**
   * Which box/vent fields the user ENTERED. Presence ⇒ Entered: the value is held and never
   * recomputed. Absence ⇒ Calculated, re-solved whenever an entered member changes.
   *
   * Same model as the driver's provenance (`Driver.#inputs`, docs/DRIVER_ADT_DESIGN.md) and
   * the same reason: docs/design/STATE_MODEL.md rule 7 — provenance is recorded where entry happens,
   * never reconstructed downstream from "is the field present".
   *
   * `Fb` and `ventL` are the pair this arbitrates, and BOTH stay fields.
   *
   * **WinISD's direction is the default and is what ships**: `{Vb, ventD, Fb}` entered, vent
   * length calculated — change the diameter and the LENGTH moves while the tuning holds.
   * WinISD itself offers no way to reverse that; its Vents tab renders length, cross area and
   * port resonance greyed/calculated, with only vent count and diameter editable (confirmed
   * live against 0.7.0.950).
   *
   * The reverse — enter `ventL`, let the tuning be solved — falls out of the entered-set
   * model rather than being copied from WinISD. It costs nothing to allow, and it is the
   * foundation the "pin any subset and solve the rest" vent solver builds on (BACKLOG P2).
   * Storing one member and deriving the other would have baked one direction into the schema
   * and made that later work a rewrite.
   *
   * Solved by `composables/useVentGroup.ts`.
   */
  entered: Record<string, true>;
  Ql: number;
  Qa: number;
  Qp: number;
  nDrivers: number;
  wiring: 'series' | 'parallel';
  Pin: number;
  Rs: number;
  prName: string;
  prSd: number;
  prNum: number;
  prMmd: number;
  prMadd: number;
  prCms: number;
  prRms: number;
  prXmax: number;
  fmin: number;
  fmax: number;
  N: number;
  circuitModel: 'winisd' | 'gyrator';
  filters: Filter[];
  // WinISD-parity driver inputs (docs/research/WINISD_PARITY.md). SI/engine units: vcTempRise K, alfaVC /K
  // (UI shows 1000/K), driverAddedMass kg (UI shows g). All 0-safe: no-op at the default.
  vcTempRise: number;
  alfaVC: number;
  driverAddedMass: number;
  // Port end-correction coefficient (× vent diameter): 0.613 two-free / 0.732 one-flanged
  // (default) / 0.849 two-flanged. Feeds Leff → box tuning Fb.
  endCorrection: number;
  // ---- WinISD Advanced-pane simulation options (PLAN_ADVANCED_SIM_OPTIONS.md) ----------
  // The fifth WinISD toggle, "Simulate voice coil inductance", is NOT a field of its own:
  // it is `circuitModel` under WinISD's wording (appState.simVcInductance maps it).
  /** Rg sits in series with each driver (true, the default) rather than at the amplifier. */
  rgAtDriverSide: boolean;
  /** Model the vent as an acoustic transmission line instead of a lumped mass. */
  tlPortModel: boolean;
  /** Auto-EQ the response flat, charging the boost to excursion/velocity/max-SPL. */
  forceFlatResponse: boolean;
  /** Plot the SPL chart backed off to Xmax (engine `splXlim`) instead of the raw SPL. */
  splXmaxLimited: boolean;
  // ---- Environment — per project, as WinISD's .wpr [Box] T / p / phi ------------------
  /** Ambient temperature, K. */
  tempK?: number;
  /** Relative humidity, PERCENT. The .wpr's `phi` is a FRACTION — converted in that writer only. */
  humidityPct?: number;
  /** Static air pressure, Pa. */
  pressurePa?: number;
  /**
   * Opt in to WinISD's behaviour of ignoring humidity and air pressure (ledger QO7).
   * Default false — openisd derives ρ and c from T, RH and p, and thence the SPL constant K.
   */
  ignoreHumidityAndPressure?: boolean;
}

export class OpenISDProject {
  readonly #record: ProjectLiveState;

  private constructor(record: ProjectLiveState) {
    assertVentArity(record.box);
    this.#record = record;
  }

  /** Adopt a wire record — a load from disk, a share link, a restore. The ONE place `driver`'s
   *  record becomes a live `OpenISDDriver`; every other field is adopted BY REFERENCE (not
   *  cloned — `openisdProjectCells.test.ts` pins this: a caller that retains `record` and
   *  mutates it past the type system must see that mutation reflected). `record.driver` is data
   *  from an untrusted boundary (a hand-edited file, an old build's share link), so it is
   *  CHECKED (`driverFromConformingRecord`) rather than trusted outright — a driver record too
   *  broken to load safely means the WHOLE record is refused (throws): a project cannot exist
   *  without a driver, so there is no "load the rest, drop the driver" outcome any more
   *  (`docs/design/DRIVER_NON_NULL_INVARIANT.md`). */
  static fromJsonRecord(record: OpenISDProjectJson): OpenISDProject {
    const { driver, ...rest } = record;
    const liveDriver = driverFromConformingRecord(driver);
    if (!liveDriver) throw new Error('project record carries a driver too broken to load');
    // A LOAD IS A NEW PROJECT. Identity is in-memory only, so a record carries none and there
    // is nothing to restore — every load mints (John 2026-08-26: "when loading an owdr we
    // assign a new uuid").
    return new OpenISDProject({ ...rest, driver: liveDriver, uuid: crypto.randomUUID() });
  }

  /** This project as its wire record — the driver's live object PROJECTED to its own record
   *  (`OpenISDDriver.toJsonRecord()`) here, once, at the moment bytes are actually needed. Paired
   *  with `fromJsonRecord()`. */
  toJsonRecord(): OpenISDProjectJson {
    // `uuid` is destructured off and DROPPED: identity is in-memory only and must not reach
    // any wire — see `ProjectLiveState.uuid`.
    const { driver, uuid: _uuid, ...rest } = this.#record;
    return { ...rest, driver: driver.toJsonRecord() };
  }

  /**
   * THIS design as a WinISD `.wpr` project — the write-side twin of `fromWinISDProject`, and
   * the one place box/vent tuning is derived for export (the owner of the state calculates).
   *
   * `driverSection` is the driver's own `.wdr` text (the DRIVER serialises itself — this
   * project only holds it). `driver` is the engine projection for the sealed-resonance
   * refinement, `curve` the current swept impedance when one exists, and `now` is passed in,
   * never read from the clock, so the same design is byte-reproducible.
   *
   * `lossMode` is the model the user has selected, and it reaches the FILE because
   * `[Box] Fr` is the LOSSY resonance — WinISD writes the same figure it displays, and that
   * figure moves with the loss model (measured: 5.8 Hz for a `Ql` change at fixed volume;
   * `winisd_research/PROBE_FINDINGS.md` FINDING-007). The selection is view state today
   * (`presentationState.lossMode`), so it is passed in rather than read from the record.
   */
  toWinISDProject(driverSection: string, driver: EngineDriver | null, now: Date,
                  curve: SweepResult | null, lossMode: LossMode): WinISDProject {
    const record = this.#record;
    const kind = record.box.active;
    const pad2 = (x: number) => String(x).padStart(2, '0');

    const Vb = kind === 'sealed' ? record.box.sealed.volume_m3
      : kind === 'vented' ? record.box.vented.volume_m3
      : kind === 'bandpass4' ? record.box.bandpass4.rearVolume_m3
      : record.box.passiveRadiator.volume_m3;
    const vent = (kind === 'bandpass4' ? record.box.bandpass4.vents : record.box.vented.vents)[0]!;
    const Sp = ventArea_m2(vent);

    // `[Box] Fr` is the LOSSY sealed resonance, mirroring what the app displays — never the
    // lossless `Fs·√(1+Vas/Vb)`, which is a figure WinISD would not write and the user never saw
    // (bugs/BUG_20260827_wpr_export_writes_a_lossless_Fr_while_the_screen_shows_a_lossy_one.md).
    // Preferred source is the swept impedance peak; the fallback runs the SAME loss model the box
    // panel shows, so file and screen agree by construction.
    const peak = (driver && curve) ? new Engine().findImpedancePeak(curve, driver.Re) : null;
    const sealedFr = peak ? peak.Fsc
      : (driver
          ? new Engine().sealedResonance(lossMode, {
              Fs: driver.Fs, Vas: driver.Vas, Qts: driver.Qts, Vb,
              Ql: record.box.Ql, Qa: record.box.Qa,
            }).Fsc
          : 0);

    const box: Record<string, string | number> = {
      BType: bTypeOfBoxType(kind),
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
      const Ff = new Engine().tuningFromLength(Vf, vent.length_m, Sp, vent.endCorrection); // front: vented
      box.Vf = Vf; box.Ff = Ff; box.Sdfport = Sp;
      sections.VentFront = ventKv(Ff, Vf);
    } else {
      const pr = record.box.passiveRadiator;
      const r = pr.radiator;
      if (r) {
        box.Fr = new Engine().prTuning({ Vb, prMmd: r.Mmd_kg, prMadd: pr.addedMass_kg,
                            prSd: r.Sd_m2, prCms: r.Cms_m_per_N });
        box.Npr = pr.count;
        sections.PassiveRadiator = {
          Vas: new Engine().prVas(r.Cms_m_per_N, r.Sd_m2),
          Qms: new Engine().prQms(r.Mmd_kg, r.Cms_m_per_N, r.Rms_Ns_per_m),
          Fs: new Engine().prFsWithMass(r.Mmd_kg, pr.addedMass_kg, r.Cms_m_per_N),
          Sd: r.Sd_m2, Xmax: r.Xmax_m, Me: pr.addedMass_kg,
        };
      }
    }

    return WinISDProject.build(driverSection, sections);
  }

  /**
   * Whether a project RECORD can hold this box type at all.
   *
   * `BoxType` names six enclosures; the stored box has fields for four. `bandpass6` and `abc`
   * are real WinISD box types with no field specification here yet (QO85), so a project cannot
   * BE one — there is nowhere to put its volume or its ports.
   *
   * A caller adopting a box type from OUTSIDE — a `.owpr`, a share link, an import — asks this
   * FIRST and refuses the payload, rather than constructing a project whose accessors then
   * throw. `boxVolume_m3`'s throw is the last-resort guard for a value that got past every such
   * check; this is the question to ask before it fires.
   *
   * A STATIC, not a free function: it answers for the class, and this module exports no floating
   * functions that augment the project (Lane P5, `architecture-project-symmetry.test.ts`).
   *
   * Distinct from `Engine.simulatableBoxType()`, which asks whether the CIRCUIT can model it.
   * The same two are missing from both today, and that is a coincidence of what has been built,
   * not one fact: a box type could be storable long before it is simulatable.
   */
  static canHold(box: BoxType): boolean {
    switch (box) {
      case 'sealed':
      case 'vented':
      case 'bandpass4':
      case 'box-passive-radiator':
        return true;
      case 'bandpass6':
      case 'abc':
        return false;
    }
  }

  /** A project with the given driver and nothing else chosen. `driver` is REQUIRED — a project
   *  cannot exist without one (`docs/design/DRIVER_NON_NULL_INVARIANT.md`).
   *
   *  Always mints a fresh identity — there is no way to supply one, because identity never
   *  leaves the process for a caller to have kept. */
  static empty(driver: OpenISDDriver): OpenISDProject {
    return new OpenISDProject(prototypeProject(driver, crypto.randomUUID()));
  }

  /** This project's IN-MEMORY identity — stable across every copy, fresh on every load.
   *  See `ProjectLiveState.uuid`. */
  uuid(): string { return this.#record.uuid; }

  /** An independent copy — how `ManagedProject` obtains its ground/committed/what-if
   *  layers without ever touching the JSON itself (`ManagedX` clones `X` by asking `X` for a
   *  copy of itself — never by touching its JSON, ledger QO60/61). */
  copy(): OpenISDProject {
    // `structuredClone` cannot clone a class instance (it drops the private field data that
    // gives it meaning), so `driver` is cloned separately via its own `OpenISDDriver.copy()` —
    // every other field is plain data and clones normally.
    const { driver, ...rest } = this.#record;
    return new OpenISDProject({ ...structuredClone(rest), driver: driver.copy() });
  }

  /** Switch the ACTIVE box type — the others stay populated and dormant. */
  setBoxType(kind: BoxType): void {
    setActiveBoxType(this.#record.box, kind);
  }

  // ── Named box questions — the getter-free surface (M2: no interior value ever crosses) ───

  activeBoxType(): BoxType { return this.#record.box.active; }

  /** The ACTIVE box type's own volume. Raw — no provenance mark, no vent-group solve; a
   *  live user edit goes through `enter('Vb', ...)` instead. */
  volume_m3(): number { return boxVolume_m3(this.#record.box); }
  setVolume_m3(value: number): void { setBoxVolume_m3(this.#record.box, value); }

  tuning_Fb_hz(): number { return boxTuning_Fb_hz(this.#record.box); }
  setTuning_Fb_hz(value: number): void { setBoxTuning_Fb_hz(this.#record.box, value); }

  /** `Vf` — bandpass4's OWN front-chamber volume; unlike `Vb` it has exactly one home. */
  frontVolume_m3(): number { return this.#record.box.bandpass4.frontVolume_m3; }
  setFrontVolume_m3(value: number): void { this.#record.box.bandpass4.frontVolume_m3 = value; }

  /** Rear-chamber tuning target for bandpass6/ABC. RELATIONLESS (`enter()` and `set()` are the
   *  same write here — a stated fact, never solved, always reported Entered). */
  frcHz(): number { return this.#record.box.frcHz; }
  setFrcHz(value: number): void { this.#record.box.frcHz = value; }

  /** One field of the ACTIVE box type's port — PRIVATE. Callers use the named accessors
   *  below; this stays only as the shared implementation. */
  #ventField<K extends keyof OpenISDVent>(field: K): OpenISDVent[K] {
    return activeVent(this.#record.box)[field];
  }
  #setVentField<K extends keyof OpenISDVent>(field: K, value: OpenISDVent[K]): void {
    activeVent(this.#record.box)[field] = value;
  }

  ventDiameter_m(): number { return this.#ventField('diameter_m'); }
  setVentDiameter_m(value: number): void { this.#setVentField('diameter_m', value); }
  ventWidth_m(): number { return this.#ventField('width_m'); }
  setVentWidth_m(value: number): void { this.#setVentField('width_m', value); }
  ventHeight_m(): number { return this.#ventField('height_m'); }
  setVentHeight_m(value: number): void { this.#setVentField('height_m', value); }
  ventLength_m(): number { return this.#ventField('length_m'); }
  setVentLength_m(value: number): void { this.#setVentField('length_m', value); }
  ventEndCorrection(): number { return this.#ventField('endCorrection'); }
  setVentEndCorrection(value: number): void { this.#setVentField('endCorrection', value); }

  // ── Vent-group / PR-group flat enter/clear/provenance pairs — the provenance-marking,
  //    solve-triggering counterpart to the RAW pairs above. Each delegates to the generic
  //    `enter()`/`clear()`/`cell()` at its own fixed key, so the actual mark-and-solve logic
  //    lives in exactly one place. A live user edit uses these; a restore/seed write that must
  //    NOT mark provenance uses the RAW pair instead (`setVolume_m3` etc.). ────────────────────
  enterBoxVolume_m3(value: number): void { this.enter('Vb', value); }
  clearBoxVolume_m3(): void { this.clear('Vb'); }
  boxVolumeProvenance(): Provenance { return this.cell('Vb').state; }

  enterBoxTuning_Fb_hz(value: number): void { this.enter('Fb', value); }
  clearBoxTuning_Fb_hz(): void { this.clear('Fb'); }
  boxTuningProvenance(): Provenance { return this.cell('Fb').state; }

  enterVentDiameter_m(value: number): void { this.enter('ventD', value); }
  clearVentDiameter_m(): void { this.clear('ventD'); }
  ventDiameterProvenance(): Provenance { return this.cell('ventD').state; }

  enterVentLength_m(value: number): void { this.enter('ventL', value); }
  clearVentLength_m(): void { this.clear('ventL'); }
  ventLengthProvenance(): Provenance { return this.cell('ventL').state; }

  enterVentWidth_m(value: number): void { this.enter('ventW', value); }
  clearVentWidth_m(): void { this.clear('ventW'); }
  ventWidthProvenance(): Provenance { return this.cell('ventW').state; }

  enterVentHeight_m(value: number): void { this.enter('ventH', value); }
  clearVentHeight_m(): void { this.clear('ventH'); }
  ventHeightProvenance(): Provenance { return this.cell('ventH').state; }

  enterPrFp_hz(value: number): void { this.enter('prFp', value); }
  clearPrFp_hz(): void { this.clear('prFp'); }
  prFpProvenance(): Provenance { return this.cell('prFp').state; }

  enterPrAddedMass_kg(value: number): void { this.enter('prMadd', value); }
  clearPrAddedMass_kg(): void { this.clear('prMadd'); }
  prAddedMassProvenance(): Provenance { return this.cell('prMadd').state; }

  /** The active vent's cross-sectional area — round or slotted, whichever it currently is. */
  ventArea_m2(): number { return this.#ventCrossArea(); }

  /** The active vent's effective acoustic length — physical length plus the end-correction
   *  term, which needs an equivalent diameter for a slotted vent since the correction is
   *  inherently a round-port concept. */
  ventEffectiveLength_m(): number {
    const vent = activeVent(this.#record.box);
    return new Engine().ventEffectiveLength(vent.length_m, this.#ventCrossArea(), vent.endCorrection);
  }

  /** Enclosure loss factors — leakage (Ql), absorption (Qa), port (Qp). */
  loss(kind: 'Ql' | 'Qa' | 'Qp'): number { return this.#record.box[kind]; }
  setLoss(kind: 'Ql' | 'Qa' | 'Qp', value: number): void { this.#record.box[kind] = value; }

  // ── Passive radiator ──────────────────────────────────────────────────────────────────────

  /** One intrinsic of the chosen radiator; the prototype default before one is chosen —
   *  PRIVATE. Callers use the named accessors below; this stays only as the shared
   *  implementation. */
  #prField<K extends keyof OpenISDPassiveRadiatorRef>(field: K): OpenISDPassiveRadiatorRef[K] {
    return passiveRadiatorOrDefault(this.#record.box.passiveRadiator)[field];
  }
  #setPrField<K extends keyof OpenISDPassiveRadiatorRef>(field: K, value: OpenISDPassiveRadiatorRef[K]): void {
    ensurePassiveRadiator(this.#record.box.passiveRadiator)[field] = value;
  }

  prName(): string { return this.#prField('name'); }
  setPrName(value: string): void { this.#setPrField('name', value); }
  prSd_m2(): number { return this.#prField('Sd_m2'); }
  setPrSd_m2(value: number): void { this.#setPrField('Sd_m2', value); }
  prMmd_kg(): number { return this.#prField('Mmd_kg'); }
  setPrMmd_kg(value: number): void { this.#setPrField('Mmd_kg', value); }
  prCms_m_per_N(): number { return this.#prField('Cms_m_per_N'); }
  setPrCms_m_per_N(value: number): void { this.#setPrField('Cms_m_per_N', value); }
  prRms_Ns_per_m(): number { return this.#prField('Rms_Ns_per_m'); }
  setPrRms_Ns_per_m(value: number): void { this.#setPrField('Rms_Ns_per_m', value); }
  prXmax_m(): number { return this.#prField('Xmax_m'); }
  setPrXmax_m(value: number): void { this.#setPrField('Xmax_m', value); }

  prCount(): number { return this.#record.box.passiveRadiator.count; }
  setPrCount(value: number): void { this.#record.box.passiveRadiator.count = value; }
  prAddedMass_kg(): number { return this.#record.box.passiveRadiator.addedMass_kg; }
  setPrAddedMass_kg(value: number): void { this.#record.box.passiveRadiator.addedMass_kg = value; }
  prFp_hz(): number { return this.#record.box.passiveRadiator.Fp_hz; }
  setPrFp_hz(value: number): void { this.#record.box.passiveRadiator.Fp_hz = value; }

  /** Has a radiator actually been picked? Reads never allocate one — `#prField()` serves
   *  defaults until a write does. */
  prChosen(): boolean { return this.#record.box.passiveRadiator.radiator != null; }

  // ── Datasheet-vocabulary PR views — each a reverse-solve into the canonical fields above,
  //    not simple storage (see `enter()`'s 'prVas'/'prFs'/'prQms' cases). `prVas_m3` takes SI
  //    m³ — the litres↔m³ conversion is the UI's own (a display-unit concern), matching the
  //    generic `enterProjectField('prVas', ...)` contract this replaces. ──────────────────────
  prVas_m3(): number { return this.cell('prVas').value; }
  setPrVas_m3(value: number): void { this.enter('prVas', value); }
  prFs_hz(): number { return this.cell('prFs').value; }
  setPrFs_hz(value: number): void { this.enter('prFs', value); }
  prQms(): number { return this.cell('prQms').value; }
  setPrQms(value: number): void { this.enter('prQms', value); }
  /** Fs including the added mass — derived, no setter (`enter('prFsMass', ...)` itself throws:
   *  "enter prFp (the tuning) or prMadd (the mass)"). */
  prFsMass_hz(): number { return this.cell('prFsMass').value; }

  // ── Non-numeric named accessors — survivors of the keyed surface, each with its reason ──
  // (an enum or boolean cannot be a numeric cell; a string field is not a registered field)

  ventShape(): OpenISDVent['shape'] { return activeVent(this.#record.box).shape; }
  setVentShape(value: OpenISDVent['shape']): void { activeVent(this.#record.box).shape = value; }

  wiring(): OpenISDSignal['wiring'] { return this.#record.signal.wiring; }
  setWiring(value: OpenISDSignal['wiring']): void { this.#record.signal.wiring = value; }
  rgAtDriverSide(): boolean { return this.#record.signal.rgAtDriverSide; }
  setRgAtDriverSide(value: boolean): void { this.#record.signal.rgAtDriverSide = value; }

  circuitModel(): OpenISDSimOptions['circuitModel'] { return this.#record.simOptions.circuitModel; }
  setCircuitModel(value: OpenISDSimOptions['circuitModel']): void { this.#record.simOptions.circuitModel = value; }
  tlPortModel(): boolean { return this.#record.simOptions.tlPortModel; }
  setTlPortModel(value: boolean): void { this.#record.simOptions.tlPortModel = value; }
  forceFlatResponse(): boolean { return this.#record.simOptions.forceFlatResponse; }
  setForceFlatResponse(value: boolean): void { this.#record.simOptions.forceFlatResponse = value; }
  splXmaxLimited(): boolean { return this.#record.simOptions.splXmaxLimited; }
  setSplXmaxLimited(value: boolean): void { this.#record.simOptions.splXmaxLimited = value; }
  /** Voice-coil resistance coefficient (project-side sim option; not a registered field —
   *  the registered `AlfaVC` is the DRIVER's own). */
  alfaVC(): number { return this.#record.simOptions.alfaVC; }
  setAlfaVC(value: number): void { this.#record.simOptions.alfaVC = value; }

  ignoreHumidityAndPressure(): boolean { return this.#record.environment.ignoreHumidityAndPressure; }
  setIgnoreHumidityAndPressure(value: boolean): void { this.#record.environment.ignoreHumidityAndPressure = value; }

  /** Sweep range — not registered fields; the unit suffixes mark genuine raw crossings. */
  sweepFmin_hz(): number { return this.#record.sweep.fmin_hz; }
  setSweepFmin_hz(value: number): void { this.#record.sweep.fmin_hz = value; }
  sweepFmax_hz(): number { return this.#record.sweep.fmax_hz; }
  setSweepFmax_hz(value: number): void { this.#record.sweep.fmax_hz = value; }
  sweepPoints(): number { return this.#record.sweep.points; }
  setSweepPoints(value: number): void { this.#record.sweep.points = value; }

  /** The filter chain, as independent copies both ways. */
  filters(): Filter[] { return this.#record.filters.map(f => ({ ...f })); }
  setFilters(value: Filter[]): void { this.#record.filters = value.map(f => ({ ...f })); }

  /** Project metadata, as a copy. */
  projectMeta(): OpenISDProjectMeta { return { ...this.#record.meta }; }
  setProjectMeta(value: OpenISDProjectMeta): void { this.#record.meta = { ...value }; }

  // ── The entered set — provenance storage, one licensed surface ────────────────────────────
  isEntered(field: string): boolean { return this.#record.target.entered[field] === true; }
  setEntered(field: string, on: boolean): void {
    if (on) this.#record.target.entered[field] = true;
    else delete this.#record.target.entered[field];
  }
  enteredSet(): Record<string, true> { return { ...this.#record.target.entered }; }
  replaceEnteredSet(value: Record<string, true>): void {
    this.#record.target.entered = { ...value };
  }

  /** The project as its flat wire snapshot — every field a plain value, provenance carried
   *  as the entered set. The one producer `serialize()` and the share link read. */
  toUiParams(): UiParams {
    return {
      Vb: this.volume_m3(), Vf: this.frontVolume_m3(),
      ventShape: this.ventShape(), ventD: this.ventDiameter_m(),
      ventW: this.ventWidth_m(), ventH: this.ventHeight_m(),
      ventL: this.ventLength_m(), endCorrection: this.ventEndCorrection(),
      Fb: this.tuning_Fb_hz(), Frc: this.frcHz(),
      prFp: this.prFp_hz(), prName: this.prName(), prSd: this.prSd_m2(),
      prNum: this.prCount(), prMmd: this.prMmd_kg(), prMadd: this.prAddedMass_kg(),
      prCms: this.prCms_m_per_N(), prRms: this.prRms_Ns_per_m(),
      prXmax: this.prXmax_m(),
      entered: this.enteredSet(),
      Ql: this.loss('Ql'), Qa: this.loss('Qa'), Qp: this.loss('Qp'),
      nDrivers: this.cell('nDrivers').value, wiring: this.wiring(),
      Pin: this.cell('Pin').value, Rs: this.cell('Rs').value,
      fmin: this.sweepFmin_hz(), fmax: this.sweepFmax_hz(), N: this.sweepPoints(),
      circuitModel: this.circuitModel(), filters: this.filters(),
      vcTempRise: this.cell('vcTempRise').value, alfaVC: this.alfaVC(),
      driverAddedMass: this.cell('driverAddedMass').value,
      rgAtDriverSide: this.rgAtDriverSide(), tlPortModel: this.tlPortModel(),
      forceFlatResponse: this.forceFlatResponse(), splXmaxLimited: this.splXmaxLimited(),
      tempK: this.cell('advTemp').value, humidityPct: this.cell('advHumidity').value,
      pressurePa: this.cell('advPressure').value,
      ignoreHumidityAndPressure: this.ignoreHumidityAndPressure(),
    };
  }

  /**
   * Adopt a `UiParams` blob — a restore (local save, share link, ground checkpoint) that must
   * land byte-identical on every field IT SUPPLIES, with nothing re-solved
   * (`docs/design/STATE_MODEL.md` rule 3). `box` is set first so every box-type-relative
   * write (`Vb`, the vent fields) lands on the box type the snapshot was taken from.
   *
   * `p` is `Partial<UiParams>` because every real caller's blob can genuinely be partial — a
   * caller restoring only the entered set, or a serialised blob missing fields this build
   * added since it was written. `field()` below is the ONE fallback rule, applied UNIFORMLY
   * to every field: `p`'s own value if it supplied one, else the CURRENT value — restoring
   * one field must not silently reset every other one, and no field gets a special-cased
   * fallback the rest don't have.
   */
  loadUiParams(p: Partial<UiParams>, box: BoxType): void {
    const current = this.toUiParams();
    const field = <K extends keyof UiParams>(k: K): UiParams[K] => (p[k] !== undefined ? p[k]! : current[k]);
    // `tempK`/`humidityPct`/`pressurePa`/`ignoreHumidityAndPressure` are the only FOUR fields
    // `UiParams` itself declares optional (a serialised blob may genuinely omit them —
    // WinISD's own environment fields predate this app tracking them per-project). Every other
    // field is required by the interface, so `field()` alone type-checks for them. These four
    // need one more step: `current[k]` — read from the live record, where the environment's
    // fields are NOT optional — is never actually undefined, so this narrows `field()`'s
    // `T | undefined` back to `T` without inventing a fallback value.
    const requiredField = <K extends 'tempK' | 'humidityPct' | 'pressurePa' | 'ignoreHumidityAndPressure'>(k: K)
      : NonNullable<UiParams[K]> => field(k)!;
    this.setBoxType(box);
    this.setVentShape(field('ventShape'));
    this.setVentDiameter_m(field('ventD'));
    this.setVentWidth_m(field('ventW'));
    this.setVentHeight_m(field('ventH'));
    this.setVentLength_m(field('ventL'));
    this.setVentEndCorrection(field('endCorrection'));
    this.setVolume_m3(field('Vb'));
    this.setFrontVolume_m3(field('Vf'));
    this.setTuning_Fb_hz(field('Fb'));
    this.setFrcHz(field('Frc'));
    this.setLoss('Ql', field('Ql')); this.setLoss('Qa', field('Qa')); this.setLoss('Qp', field('Qp'));
    this.setPrName(field('prName'));
    this.setPrSd_m2(field('prSd'));
    this.setPrMmd_kg(field('prMmd'));
    this.setPrCms_m_per_N(field('prCms'));
    this.setPrRms_Ns_per_m(field('prRms'));
    this.setPrXmax_m(field('prXmax'));
    this.setPrCount(field('prNum'));
    this.setPrAddedMass_kg(field('prMadd'));
    this.setPrFp_hz(field('prFp'));
    this.set('advTemp', requiredField('tempK'));
    this.set('advHumidity', requiredField('humidityPct'));
    this.set('advPressure', requiredField('pressurePa'));
    this.setIgnoreHumidityAndPressure(requiredField('ignoreHumidityAndPressure'));
    this.set('nDrivers', field('nDrivers')); this.setWiring(field('wiring'));
    this.set('Pin', field('Pin')); this.set('Rs', field('Rs'));
    this.setRgAtDriverSide(field('rgAtDriverSide'));
    this.setCircuitModel(field('circuitModel'));
    this.setTlPortModel(field('tlPortModel'));
    this.setForceFlatResponse(field('forceFlatResponse'));
    this.setSplXmaxLimited(field('splXmaxLimited'));
    this.set('vcTempRise', field('vcTempRise')); this.setAlfaVC(field('alfaVC'));
    this.set('driverAddedMass', field('driverAddedMass'));
    this.setSweepFmin_hz(field('fmin')); this.setSweepFmax_hz(field('fmax')); this.setSweepPoints(field('N'));
    this.setFilters(field('filters'));
    this.replaceEnteredSet({ ...field('entered') });
  }

  /** Adopt a radiator from its DATASHEET vocabulary (Vas, Fs, Qms, Sd, Xmax — SI throughout) —
   *  the one conversion into canonical Cms/Mmd/Rms, on the owner. The datasheet↔canonical
   *  converters are not reachable any other way. */
  enterPrDatasheet(d: { vasM3: number; fsHz: number; qms: number; sdM2: number; xmaxM?: number }): void {
    const cms = prCmsFromWinIsdVas(d.vasM3, d.sdM2);
    const mmd = prMmdFromWinIsdFs(d.fsHz, cms);
    const rms = prRmsFromWinIsdQms(d.qms, mmd, cms);
    const radiator = ensurePassiveRadiator(this.#record.box.passiveRadiator);
    radiator.Sd_m2 = d.sdM2;
    radiator.Cms_m_per_N = cms;
    radiator.Mmd_kg = mmd;
    radiator.Rms_Ns_per_m = rms;
    if (d.xmaxM != null) radiator.Xmax_m = d.xmaxM;
  }

  // ---- driver ------------------------------------------------------------------------------

  /** The live driver this project holds — the same public domain object throughout, never
   *  round-tripped through text on the way in or out. Never absent: a project cannot exist
   *  without a driver (`docs/design/DRIVER_NON_NULL_INVARIANT.md`). */
  driver(): OpenISDDriver { return this.#record.driver; }

  /** REPLACE this project's driver — the ONE adoption channel, taking the public domain
   *  object (QO73/human ruling 2026-08-22: no UI code may name or infer the driver's private
   *  record shape) and HOLDING it: the project is either wholly a domain object or wholly
   *  text, never a mix — text exists only as `toJsonRecord()`'s output, built once, at the
   *  moment bytes are actually needed. There is no "clear": a project's driver is always
   *  replaced with another, never removed (`docs/design/DRIVER_NON_NULL_INVARIANT.md`). */
  setDriver(driver: OpenISDDriver): void {
    this.#record.driver = driver;
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
   * Errors are returned, never thrown; `value` is null when the file cannot be read. A `.wpr`
   * with no `[Driver]` block is refused outright — a project cannot exist without a driver
   * (`docs/design/DRIVER_NON_NULL_INVARIANT.md`), so there is no "load the box, driverless" any
   * more.
   */
  static fromWprText(text: string): Result<OpenISDProject> {
    const fail = (message: string): Result<OpenISDProject> =>
      ({ value: null, errors: [{ level: 'error', field: 'wpr', message }] });

    const wpr = WinISDProject.fromWprIni(text);
    if (wpr.driverWdrText().trim().length === 0) {
      return fail('.wpr has no [Driver] block — a project cannot exist without a driver');
    }
    let driver: OpenISDDriver;
    try { driver = OpenISDDriver.fromWdrText(wpr.driverWdrText()); }
    catch (err) { return fail(`the .wpr's [Driver] block could not be read: ${(err as Error).message}`); }

    let project: OpenISDProject;
    try { project = OpenISDProject.fromWinISDProject(wpr, driver); }
    catch (err) { return fail((err as Error).message); }
    return { value: project, errors: [] };
  }

  /**
   * The ONE place a raw `.wpr` parse (`@openisd/winisd`'s `parseWprRaw`) becomes a real
   * project — box-type→box-kind mapping and the PR WinISD-vocabulary→canonical conversion both
   * happen here, never at the caller (PLAN_QO60_LAYERING_REMEDIATION.md objective 2b). Builds
   * on `prototypeProject()`'s defaults; a raw field present overwrites its default, absent
   * leaves the default untouched — a value the file does not state is never fabricated, and a
   * default the file does not override is never cleared. `driver` is supplied by the caller
   * (`fromWprText`, which reads `wpr.driverWdrText()` via `OpenISDDriver.fromWdrText()` — this
   * method is not one of the licensed construction sites for that) — a project cannot exist
   * without one.
   */
  static fromWinISDProject(wpr: WinISDProject, driver: OpenISDDriver): OpenISDProject {
    const n = (sec: string, key: string) => wpr.number(sec, key);
    const t = (sec: string, key: string) => wpr.value(sec, key);

    const kind = boxTypeOfBType(n('Box', 'BType'));
    if (kind == null) {
      const bType = n('Box', 'BType');
      throw new Error(bType == null
        ? '.wpr has no [Box] BType — the box type is not stated, and this reader will not assume one'
        : `.wpr states BType=${bType}, which is not a box type OpenISD models (0/1/2/4)`);
    }

    // A fresh id: a `.wpr` is WinISD's own format and carries no OpenISD identity, so an
    // import is a genuinely new project, not the return of one this app already stored.
    const record = prototypeProject(driver, crypto.randomUUID());
    setActiveBoxType(record.box, kind);

    const Vr = n('Box', 'Vr');
    if (Vr != null) {
      switch (kind) {
        case 'sealed': record.box.sealed.volume_m3 = Vr; break;
        case 'vented': record.box.vented.volume_m3 = Vr; break;
        case 'bandpass4': record.box.bandpass4.rearVolume_m3 = Vr; break;
        case 'box-passive-radiator': record.box.passiveRadiator.volume_m3 = Vr; break;
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

    if (kind === 'box-passive-radiator') {
      const Sd = n('PassiveRadiator', 'Sd'), Vas = n('PassiveRadiator', 'Vas');
      const Fs = n('PassiveRadiator', 'Fs'), Qms = n('PassiveRadiator', 'Qms');
      const hasPr = Sd != null && Sd > 0 && Vas != null && Fs != null && Fs > 0 && Qms != null && Qms > 0;
      if (!hasPr) {
        throw new Error('.wpr states BType=4 (passive radiator) but [PassiveRadiator] does not '
          + 'carry Sd, Vas, Fs and Qms — the radiator cannot be reconstructed and will not be invented');
      }
      const cms = new Engine().prCmsFromVas(Vas, Sd);
      const mmd = new Engine().prMmdFromFs(Fs, cms);
      const rms = new Engine().prRmsFromQms(Qms, mmd, cms);
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

  // ---- sub-object accessors — live references, named exactly like `OpenISDProjectJson`'s
  // own fields so a caller reads and writes them precisely as it would the raw record, without
  // ever naming `OpenISDProjectJson` itself. "The box IS the storage" (managedProject.ts):
  // these are `OpenISDBox` and its siblings, not the wire record itself, so handing out a
  // live reference does not hand out the record shape. --------------------


  /** How many ports the ACTIVE box type has (sealed and PR: 0). */
  ventCount(): number {
    assertVentArity(this.#record.box); // readonly is erased at runtime — never report a corrupt state as fact
    const box = this.#record.box;
    return box.active === 'vented' ? box.vented.vents.length
      : box.active === 'bandpass4' ? box.bandpass4.vents.length
      : 0;
  }

  /** One port of the active box type, as an independent copy — mutating it changes nothing.
   *  Index-based from day one so a multi-port box type (QO85) adds no new accessor shape. */
  vent(i: number): OpenISDVent | undefined {
    assertVentArity(this.#record.box); // readonly is erased at runtime — never report a corrupt state as fact
    const box = this.#record.box;
    const vents = box.active === 'vented' ? box.vented.vents
      : box.active === 'bandpass4' ? box.bandpass4.vents
      : [];
    const v = vents[i];
    return v ? { ...v } : undefined;
  }

  // ── Field cells — value + provenance, the driver's own model applied to the project ──────
  //
  // The vent group (Vb, ventD, Fb, ventL — one Helmholtz relation, three chosen, the fourth
  // follows) and the PR group (prFp ↔ prMadd) are solved HERE, by the owner of the state.
  // `target.entered` decides which members are held; a member not entered is Calculated when
  // the rest of its group determines it, NotAvailable otherwise. An over-determined group
  // solves nothing and is left as typed — WinISD's own observed behaviour.

  cell(field: ProjectFieldId): { value: number; state: Provenance } {
    const value = this.#fieldValue(field);
    if (field === 'prVas' || field === 'prFs' || field === 'prQms' || field === 'prFsMass') {
      // Derived views of the canonical radiator — Calculated whenever one is defined.
      return { value, state: this.#prIsDefined() ? Provenance.Calculated : Provenance.NotAvailable };
    }
    if (field === 'prSd' || field === 'prXmax' || field === 'prNum' || RELATIONLESS.has(field)) {
      // Stated facts (by the user, a datasheet, or the prototype — QO36-B4), never solved.
      return { value, state: Provenance.Entered };
    }
    if (field === 'Sp') {
      // Always derived (πD²/4 round, W×H slotted), never entered: no one states an area.
      return { value, state: value > 0 ? Provenance.Calculated : Provenance.NotAvailable };
    }
    if (this.#isEntered(field)) return { value, state: Provenance.Entered };
    const derivable = field === 'prFp' || field === 'prMadd'
      ? this.#prIsDefined()
      : this.#ventDerivable(field);
    return { value, state: derivable ? Provenance.Calculated : Provenance.NotAvailable };
  }

  /** Write a field's value with NO provenance mark and NO solve — the restore/wire verb, for
   *  adopting persisted state verbatim. A user ACTION goes through `enter()`. */
  set(field: ProjectFieldId, value: number): void {
    const record = this.#record;
    switch (field) {
      case 'Sp': throw new Error('Sp is derived from the port geometry — set ventD, or ventW/ventH');
      case 'Vb': setBoxVolume_m3(record.box, value); return;
      case 'Fb': setBoxTuning_Fb_hz(record.box, value); return;
      case 'ventD': activeVent(record.box).diameter_m = value; return;
      case 'ventL': activeVent(record.box).length_m = value; return;
      case 'ventW': activeVent(record.box).width_m = value; return;
      case 'ventH': activeVent(record.box).height_m = value; return;
      case 'endCorrection': activeVent(record.box).endCorrection = value; return;
      case 'prFp': record.box.passiveRadiator.Fp_hz = value; return;
      case 'prMadd': record.box.passiveRadiator.addedMass_kg = value; return;
      case 'prSd': this.#setPrField('Sd_m2', value); return;
      case 'prXmax': this.#setPrField('Xmax_m', value); return;
      case 'prNum': record.box.passiveRadiator.count = value; return;
      case 'prVas': case 'prFs': case 'prQms': case 'prFsMass':
        throw new Error(`${field} is datasheet vocabulary — enter() it, or set the canonical fields`);
      case 'Vf': record.box.bandpass4.frontVolume_m3 = value; return;
      case 'Ql': record.box.Ql = value; return;
      case 'Qa': record.box.Qa = value; return;
      case 'Qp': record.box.Qp = value; return;
      case 'frcHz': record.box.frcHz = value; return;
      case 'advTemp': record.environment.tempK = value; return;
      case 'advHumidity': record.environment.humidityPct = value; return;
      case 'advPressure': record.environment.pressurePa = value; return;
      case 'Pin': record.signal.inputPower_W = value; return;
      case 'Rs': record.signal.seriesResistance_ohm = value; return;
      case 'nDrivers': record.signal.driverCount = value; return;
      case 'vcTempRise': record.simOptions.vcTempRise = value; return;
      case 'driverAddedMass': record.simOptions.driverAddedMass = value; return;
    }
  }

  /** Enter a field: held from now on, never recomputed, until an explicit `clear()`. The
   *  write, the provenance mark and the group re-solve are one operation. A relation-less
   *  field has no group and no mark — its enter IS the plain write. */
  enter(field: ProjectFieldId, value: number): void {
    if (RELATIONLESS.has(field)) { this.set(field, value); return; }
    const record = this.#record;
    switch (field) {
      case 'Sp': throw new Error('Sp is derived from the port geometry — enter ventD, or ventW/ventH');
      case 'Vb': setBoxVolume_m3(record.box, value); break;
      case 'Fb': setBoxTuning_Fb_hz(record.box, value); break;
      case 'ventD': activeVent(record.box).diameter_m = value; break;
      case 'ventL': activeVent(record.box).length_m = value; break;
      case 'ventW': activeVent(record.box).width_m = value; break;
      case 'ventH': activeVent(record.box).height_m = value; break;
      case 'prFp': record.box.passiveRadiator.Fp_hz = value; break;
      case 'prMadd': record.box.passiveRadiator.addedMass_kg = value; break;
      case 'prSd': this.#setPrField('Sd_m2', value); break;
      case 'prXmax': this.#setPrField('Xmax_m', value); break;
      case 'prNum': record.box.passiveRadiator.count = value; break;
      case 'prFsMass': throw new Error('prFsMass is derived — enter prFp (the tuning) or prMadd (the mass)');
      // Datasheet vocabulary: each entry re-solves the canonical set, holding what the
      // ruled conversions hold (the former prWinIsdFields solves, now owned here).
      case 'prVas': {
        if (!(value > 0)) return;
        const sd = this.#prField('Sd_m2');
        const fs = this.cell('prFs').value || 30;
        const qms = this.cell('prQms').value || 5;
        const cms = prCmsFromWinIsdVas(value, sd);
        const mmd = prMmdFromWinIsdFs(fs, cms);
        this.#setPrField('Cms_m_per_N', cms);
        this.#setPrField('Mmd_kg', mmd);
        this.#setPrField('Rms_Ns_per_m', prRmsFromWinIsdQms(qms, mmd, cms));
        return; // not an entered-set member; the canonical fields carry the state
      }
      case 'prFs': {
        if (!(value > 0)) return;
        const qms = this.cell('prQms').value || 5;
        const cms = this.#prField('Cms_m_per_N');
        const mmd = prMmdFromWinIsdFs(value, cms);
        this.#setPrField('Mmd_kg', mmd);
        this.#setPrField('Rms_Ns_per_m', prRmsFromWinIsdQms(qms, mmd, cms));
        return;
      }
      case 'prQms': {
        if (!(value > 0)) return;
        this.#setPrField('Rms_Ns_per_m',
          prRmsFromWinIsdQms(value, this.#prField('Mmd_kg'), this.#prField('Cms_m_per_N')));
        return;
      }
    }
    record.target.entered[field] = true;
    if (field === 'ventD' || field === 'ventW' || field === 'ventH') {
      // New geometry re-solves the LENGTH for the held tuning, never the other way round.
      record.target.entered['Fb'] = true;
      delete record.target.entered['ventL'];
    }
    if (field === 'prFp' || field === 'prMadd') this.solvePrGroup();
    else this.solveVentGroup();
  }

  /** Clear a field — the only way to un-hold one. It becomes Calculated immediately if the
   *  remaining entered set determines it, NotAvailable if nothing can. */
  clear(field: ProjectFieldId): void {
    delete this.#record.target.entered[field];
    if (field === 'prFp' || field === 'prMadd') this.solvePrGroup();
    else this.solveVentGroup();
  }

  /** Re-solve every Calculated vent-group member from the Entered ones, in place. Never
   *  writes an entered field; an over-determined set is left exactly as typed. */
  solveVentGroup(): void {
    const record = this.#record;
    const Sp = this.#ventCrossArea();
    const V = this.#ventVolume();
    if (!(V > 0) || !(Sp > 0)) return;
    const vent = activeVent(record.box);
    if (!this.#isEntered('ventL') && this.#ventDerivable('ventL')) {
      const Fb = boxTuning_Fb_hz(record.box);
      if (Fb > 0) vent.length_m = new Engine().ventLength(V, Fb, Sp, vent.endCorrection);
    } else if (!this.#isEntered('Fb') && this.#ventDerivable('Fb')) {
      if (vent.length_m > 0) {
        setBoxTuning_Fb_hz(record.box, new Engine().tuningFromLength(V, vent.length_m, Sp, vent.endCorrection));
      }
    }
  }

  /** Re-solve whichever PR member is Calculated from the entered one. Added mass is clamped
   *  at zero: mass cannot be removed from a radiator, so a target above the bare in-box
   *  resonance is unreachable (see `prTargetUnreachable`). */
  solvePrGroup(): void {
    if (!this.#prIsDefined()) return;
    const pr = this.#record.box.passiveRadiator;
    const fpEntered = this.#isEntered('prFp');
    if (fpEntered && !this.#isEntered('prMadd')) {
      if (pr.Fp_hz > 0) {
        const params = this.#prParams();
        pr.addedMass_kg = Math.max(0, new Engine().prMassForFp(params, pr.Fp_hz) - params.prMmd);
      }
    } else if (!fpEntered) {
      pr.Fp_hz = new Engine().prTuning(this.#prParams());
    }
  }

  /** The tuning the CURRENT vent length actually delivers, or null when undefined. */
  ventAchievedFb(): number | null {
    const Sp = this.#ventCrossArea();
    const V = this.#ventVolume();
    const vent = activeVent(this.#record.box);
    if (!(V > 0) || !(Sp > 0) || !(vent.length_m > 0)) return null;
    return new Engine().tuningFromLength(V, vent.length_m, Sp, vent.endCorrection);
  }

  /** The highest tuning this volume and port area can reach with ANY vent — the tuning at
   *  L = 0 (the end correction alone still contributes acoustic mass). */
  ventMaxReachableFb(): number | null {
    const Sp = this.#ventCrossArea();
    const V = this.#ventVolume();
    if (!(V > 0) || !(Sp > 0)) return null;
    return new Engine().tuningFromLength(V, 0, Sp, activeVent(this.#record.box).endCorrection);
  }

  /** True when the solver cannot deliver the entered target tuning with this volume and port
   *  area — judged by consequence (the solved length is absent, non-positive, or does not
   *  reproduce the target), never by a second copy of the physics. Reported only while the
   *  length is the SOLVED member; an entered length beside an entered tuning is the user's
   *  own over-determined choice and no claim of the solver's to contradict. */
  ventTargetUnreachable(): boolean {
    const record = this.#record;
    const Fb = boxTuning_Fb_hz(record.box);
    if (!this.#isEntered('Fb') || this.#isEntered('ventL')) return false;
    if (!this.#ventDerivable('ventL') || !(Fb > 0)) return false;
    if (this.ventMaxReachableFb() == null) return false;
    const ventL = activeVent(record.box).length_m;
    if (!(ventL > 0)) return true;
    const achieved = this.ventAchievedFb();
    if (achieved == null) return false;
    return Math.abs(achieved - Fb) > 1e-6 * Fb;
  }

  /** True when the entered target tuning cannot be reached by ADDING mass — the solver hit
   *  its zero floor. The honest answer is "this PR cannot tune that high in this box". */
  prTargetUnreachable(): boolean {
    if (!this.#isEntered('prFp') || !this.#prIsDefined()) return false;
    const params = this.#prParams();
    return new Engine().prMassForFp(params, this.#record.box.passiveRadiator.Fp_hz) - params.prMmd < 0;
  }

  #isEntered(field: string): boolean { return this.#record.target.entered[field] === true; }

  #fieldValue(field: ProjectFieldId): number {
    const record = this.#record;
    const vent = activeVent(record.box);
    switch (field) {
      // Registry semantics: the ACTIVE box type's own volume (bandpass4: the REAR chamber —
      // its front chamber is 'Vf'). The Helmholtz solver's per-chamber volume is the internal
      // #ventVolume(), which is NOT this field.
      case 'Vb': return boxVolume_m3(record.box);
      case 'Vf': return record.box.bandpass4.frontVolume_m3;
      case 'Ql': return record.box.Ql;
      case 'Qa': return record.box.Qa;
      case 'Qp': return record.box.Qp;
      case 'frcHz': return record.box.frcHz;
      case 'endCorrection': return vent.endCorrection;
      case 'advTemp': return record.environment.tempK;
      case 'advHumidity': return record.environment.humidityPct;
      case 'advPressure': return record.environment.pressurePa;
      case 'Pin': return record.signal.inputPower_W;
      case 'Rs': return record.signal.seriesResistance_ohm;
      case 'nDrivers': return record.signal.driverCount;
      case 'vcTempRise': return record.simOptions.vcTempRise;
      case 'driverAddedMass': return record.simOptions.driverAddedMass;
      case 'Fb': return boxTuning_Fb_hz(record.box);
      case 'ventD': return vent.diameter_m;
      case 'ventL': return vent.length_m;
      case 'ventW': return vent.width_m;
      case 'ventH': return vent.height_m;
      case 'Sp': return this.#ventCrossArea();
      case 'prFp': return record.box.passiveRadiator.Fp_hz;
      case 'prMadd': return record.box.passiveRadiator.addedMass_kg;
      case 'prSd': return this.#prField('Sd_m2');
      case 'prXmax': return this.#prField('Xmax_m');
      case 'prNum': return record.box.passiveRadiator.count;
      case 'prVas': return new Engine().prVas(this.#prField('Cms_m_per_N'), this.#prField('Sd_m2'));
      case 'prFs': return new Engine().prFsWithMass(this.#prField('Mmd_kg'), 0, this.#prField('Cms_m_per_N'));
      case 'prQms': return new Engine().prQms(this.#prField('Mmd_kg'), this.#prField('Cms_m_per_N'), this.#prField('Rms_Ns_per_m'));
      case 'prFsMass': return new Engine().prFsWithMass(this.#prField('Mmd_kg'), this.#record.box.passiveRadiator.addedMass_kg, this.#prField('Cms_m_per_N'));
    }
  }

  /** The volume this vent tunes. Per-chamber: a bandpass4's port belongs to its FRONT
   *  chamber; every other vented type ports the whole box. */
  #ventVolume(): number {
    const box = this.#record.box;
    return box.active === 'bandpass4' ? box.bandpass4.frontVolume_m3 : boxVolume_m3(box);
  }

  #ventCrossArea(): number { return ventArea_m2(activeVent(this.#record.box)); }

  /** Can `field` be solved from the current entered set? One equation solves one unknown, so
   *  every OTHER member must be entered. `ventD` is never derivable: it appears in both Sp
   *  and Leff, so solving for it has no closed form — cleared, it is genuinely NotAvailable. */
  #ventDerivable(field: string): boolean {
    if (field === 'ventD') return false;
    const box = this.#record.box;
    // A bandpass4 ports its front chamber, whose volume is always an entered fact.
    const volEntered = box.active === 'bandpass4' ? true : this.#isEntered('Vb');
    if (activeVent(box).shape === 'slotted') {
      if (field === 'Fb') return volEntered && this.#isEntered('ventL');
      if (field === 'ventL') return volEntered && this.#isEntered('Fb');
      return false;
    }
    const group = ['Vb', 'ventD', 'Fb', 'ventL'];
    return group.every(f => f === field || (f === 'Vb' ? volEntered : this.#isEntered(f)));
  }

  #prParams(): { Vb: number; prSd: number; prCms: number; prMmd: number; prMadd: number } {
    const pr = this.#record.box.passiveRadiator;
    const r = pr.radiator;
    return {
      Vb: boxVolume_m3(this.#record.box),
      prSd: r?.Sd_m2 ?? 0, prCms: r?.Cms_m_per_N ?? 0, prMmd: r?.Mmd_kg ?? 0,
      prMadd: pr.addedMass_kg,
    };
  }

  /** Enough of a PR to have a tuning at all — otherwise both members are NotAvailable. */
  #prIsDefined(): boolean {
    const p = this.#prParams();
    return p.Vb > 0 && p.prSd > 0 && p.prCms > 0 && p.prMmd > 0;
  }
}
