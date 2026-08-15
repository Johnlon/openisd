/**
 * `OpenISDProject` — one speaker design, whole.
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
import type { OpenISDDriverJson } from './openisdDriver.js';
import type { Filter } from '@openisd/engine';

/** Which alignment is ACTIVE. The others stay populated and dormant. */
export type AlignmentKind = 'sealed' | 'vented' | 'bandpass4' | 'passive-radiator';

/** A vent, as cut. Not a component: nobody buys a hole, so it has no catalogue record. */
export interface OpenISDVent {
  shape: 'round' | 'slotted';
  /** Round: the diameter. */
  diameter_m: number;
  /** Slotted: the two cross-section sides. */
  width_m: number;
  height_m: number;
  /** Physical length. Tied to the tuning by one Helmholtz relation — see `OpenISDTarget`. */
  length_m: number;
  /** × diameter: 0.613 two-free, 0.732 one-flanged (default), 0.849 two-flanged. */
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
export interface OpenISDProject {
  /** The driver, as a RECORD. Absent before one is chosen — the app opens with no driver, not
   *  with a fake one.
   *
   *  A record, not the live `OpenISDDriver`: this project is cloned three ways by
   *  `ManagedProject`, and `structuredClone` silently reduces a class instance to a plain
   *  object. `ManagedProject` materialises a live driver over whichever layer is effective. */
  driver?: OpenISDDriverJson;
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
