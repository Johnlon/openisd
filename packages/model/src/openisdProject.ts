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
import type { _OpenISDDriverJson } from './openisdDriver.js';
import type { Filter } from "@openisd/engine";

/** Which alignment is ACTIVE. The others stay populated and dormant. */
export type AlignmentKind = 'sealed' | 'vented' | 'bandpass4' | 'passive-radiator';

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
  vent: OpenISDVent;
}

/** 4th-order bandpass: a sealed rear chamber and a vented front one. */
export interface OpenISDBandpass4Alignment {
  rearVolume_m3: number;
  frontVolume_m3: number;
  /** Front-chamber tuning. */
  Ff_hz: number;
  frontVent: OpenISDVent;
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
  /** The driver, as a RECORD. Absent before one is chosen — the app opens with no driver, not
   *  with a fake one.
   *
   *  A record, not the live `OpenISDDriver`: this project is cloned three ways by
   *  `ManagedProject`, and `structuredClone` silently reduces a class instance to a plain
   *  object. `ManagedProject` materialises a live driver over whichever layer is effective. */
  driver?: _OpenISDDriverJson;
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
 * The ONLY files, `packages/`-relative, permitted to name `_OpenISDProjectJson`. An absent or
 * empty list denies everyone outside this file — the absence of a control is never permission.
 *
 * ONLY the human may add, remove, or change an entry here — no agent may edit this list on its
 * own judgement, however legitimate a call site looks. A failing test naming a new offender is
 * the correct, expected result, not authorization to widen this list to make it pass.
 */
export const _OpenISDProjectJsonPrivateAllow: string[] = [];

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
    vented: { volume_m3: 0, Fb_hz: 0, vent: prototypeVent() },
    // TODO(box-wizard): bandpass chamber volumes and front tuning, calculated from driver +
    //   alignment. Unset until then.
    bandpass4: {
      rearVolume_m3: 0, frontVolume_m3: 0, Ff_hz: 0, frontVent: prototypeVent(),
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
  return box.active === 'bandpass4' ? box.bandpass4.frontVent : box.vented.vent;
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
