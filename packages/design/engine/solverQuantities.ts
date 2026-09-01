/**
 * THE QUANTITIES `solveConsistencyGroup` WORKS OVER — every one it can be given, and every one it
 * can derive. Membership means a quantity takes part in at least one relation; a quantity in no
 * relation would only be copied through untouched, so it has no reason to be here.
 *
 * Not every member is a quantity. `numVC` and `wiring` are FACTS ABOUT THE COIL: they take part
 * in no relation and cannot be solved for, but the terminal values cannot be derived without them,
 * so they are carried here. `QuantityName` — not `keyof SolverQuantities` — is what the solver's
 * `setVal` ranges over, and it excludes those two, which is why a coil count never acquires a
 * tolerance.
 *
 * **A quantity missing from this class is a MISSING RELATION, not a considered exclusion.** Before
 * concluding some quantity is rightly absent, look for a relation naming it in
 * `docs/design/WINISD_SCHEMA.md` §5. Relation 24 (`KLe = Le·√(2π·fLe)`) went unimplemented for
 * exactly as long as `Le_H`/`fLe_hz`/`KLe_H_sqrtHz` were missing from here, and WinISD computes it
 * — `bugs/BUG_20260831_the_solver_omits_relation_24_so_KLe_is_never_computed_from_Le_and_fLe.md`.
 */
import type { Wiring } from './types.js';

export class SolverQuantities {
    // Thiele/Small
    /** Free-air resonance frequency of the driver. */
  Fs_hz?: number;
    /** DC resistance of the voice coil. */
  Re_ohm?: number;
    /** Nominal impedance. Not a simulation input. */
  Znom_ohm?: number;
    /** Voice-coil inductance. Shapes the impedance curve, not the acoustic path
     *  (`circuit.ts`: `Zcoil = Rdc + jωLe`). Never derived — WinISD calculates no route to it. */
  Le_H?: number;
    /** The frequency at which `Le` and `KLe` were measured. Never derived; `0` means the
     *  semi-inductance model is off. Input to relation 24 only. */
  fLe_hz?: number;
    /** Vanderkooy semi-inductance, `Le·√(2π·fLe)` — henries times the square root of hertz, not
     *  dimensionless. Relation 24, and the only one of these three that is ever computed. */
  KLe_H_sqrtHz?: number;
    /** Electrical Q — how readily the driver resonates at Fs by electrical means. */
  Qes?: number;
    /** Mechanical Q — the same, by mechanical means. */
  Qms?: number;
    /** Total damping: Qes and Qms in parallel. */
  Qts?: number;
    /** The volume of air whose springiness equals the suspension's own compliance. */
  Vas_m3?: number;
    /** Effective piston area of the diaphragm. */
  Sd_m2?: number;
    /** Diameter of the diaphragm. */
  Dd_m?: number;
    /** Motor force factor — flux density crossed with wire length in the gap. PER COIL, exactly
     *  as the datasheet prints it. */
  BL_Tm?: number;
    /** Moving mass, including the air load. */
  Mms_kg?: number;
    /** Suspension compliance — the inverse of spring stiffness. */
  Cms_m_per_N?: number;
    /** Mechanical damping from friction and the resistive part of the radiation load. */
  Rms_kg_per_s?: number;
    /** Efficiency-bandwidth product, Fs/Qes. A rough sealed-versus-vented indicator, and a real
     *  input: a driver stating EBP and Qes derives its Fs from them. */
  EBP_hz?: number;
    // Large signal and power
    /** Maximum LINEAR excursion, one-way peak — not the damage limit. */
  Xmax_m?: number;
    /** Volume displacement over the linear range, Xmax·Sd. */
  Vd_m3?: number;
    /** Height of the voice coil. */
  Hc_m?: number;
    /** Height of the magnetic airgap. */
  Hg_m?: number;
    /** Thermally limited maximum CONTINUOUS power. */
  Pe_W?: number;
    // Sensitivity
    /** Efficiency eta-zero, as a FRACTION. The percent exists in the display layer only. */
  no?: number;
    /** Reference sensitivity derived from eta-zero — a solver intermediate no record states. */
  SPLref_dB?: number;
    /** Power sensitivity: dB per watt, 1 m, half-space. */
  SPL_dB?: number;
    /** Voltage sensitivity: dB per 2.83 V. Rises below 8 ohm. */
  USPL_dB?: number;
    /** Maximum thermally limited SPL into 2-pi at Pe, allowing 3 dB of power compression. */
  SPLmax_dB?: number;
    /** How loud the driver plays at 20 Hz, 1 m, half-space, at maximum excursion. */
  SPLmaxLF_dB?: number;
    // Figures of merit — WinISD displays these; nothing simulates from them
    /** Electromagnetic damping, BL squared over Re. Rme is to Qes what Rms is to Qms. */
  Rme_kg_per_s?: number;
    /** Motor power factor, BL over root Re. Independent of the driver's impedance. */
  Mpow_N_per_sqrtW?: number;
    /** Motor cost factor: Rme penalised by how far the coil leaves the gap. */
  Mcost_kg_per_s?: number;
    /** Acceleration factor, BL over Mms — acceleration per ampere. */
  gamma_m_per_s2_A?: number;
    /** Static cone sag under gravity as a fraction of Xmax. Over about 5% means the driver
     *  should not be mounted facing up. */
  Gloss?: number;
    // Dimensions
    /** Voice-coil diameter. */
  Vcd_m?: number;
    /** Overall depth of the driver. */
  Depth_m?: number;
    /** Magnet depth — the cylinder height. */
  MagDepth_m?: number;
    /** Magnet diameter. */
  Magnet_m?: number;
    /** Driver displacement volume — the box volume the driver itself occupies. */
  DVol_m3?: number;
    // The air THIS DRIVER's own figures were measured at — never the simulation's environment
    /** Speed of sound the driver's own figures assume. */
  c_m_per_s?: number;
    /** Air density the driver's own figures assume. */
  roo_kg_per_m3?: number;
  /** Re AS THE AMPLIFIER SEES IT — `Engine.terminalRe_ohm()` from the per-coil `Re_ohm`, `numVC`
   *  and `wiring`. Its OWN field, never a rewrite of `Re_ohm`: WinISD overwrites the stated value
   *  in place and leaves it marked entered, so its file claims the user typed a number the app
   *  computed. Here both survive, and which one a reader wants is answered by which it names. */
  Re_terminal_ohm?: number;

  /** BL as the amplifier sees it — the same rule as `Re_terminal_ohm`. */
  BL_terminal_Tm?: number;

  // ── THE COIL, which is what turns a per-coil value into a terminal one ────────────────────
  //
  // Not quantities: they take part in no relation, carry no uncertainty, and cannot be solved
  // for. They are here because the terminal values CANNOT be derived without them, and a solver
  // that cannot finish its own output makes every caller finish it instead.

  /** How many voice coils. Absent means one. */
  numVC?: number;
  /** How the coils are wired. Absent means the single-coil case, where it does not matter. */
  wiring?: Wiring;
}


/**
 * The name of a QUANTITY — something that takes part in at least one relation, carries an
 * uncertainty, and can be solved for. Derived from `SolverQuantities`, so a new numeric field is a
 * new member here with nothing to keep in step by hand.
 *
 * `wiring` drops out on its own, being a string. `numVC` does NOT — it is a number — so it is
 * excluded BY NAME, and that exclusion is load-bearing: this list drives `consistency.ts`'s
 * uncertainty propagation and `sweep.ts`'s "which value would unblock this driver" search.
 * Propagating a tolerance through a coil count, or telling a user to type a numVC to make their
 * driver simulate, would both be wrong. A coil count is a FACT about the driver, not a measurement
 * of it.
 */
type NotAQuantity = 'numVC' | 'wiring';

/** The numeric field names of `SolverQuantities`, less `NotAQuantity`. */
export type QuantityName = Exclude<
  // Go through every field, keep the name of each one holding a number, collect those names.
  { [K in keyof SolverQuantities]-?: SolverQuantities[K] extends number | undefined ? K : never }[keyof SolverQuantities],
  // Then drop the two that are not quantities.
  NotAQuantity>;

/**
 * Every quantity name, for the two places that genuinely LOOP over the whole set —
 * `consistency.ts`'s uncertainty propagation and `sweep.ts`'s unblocker search. Code that reads
 * named values writes them out long-hand instead; this exists only where a loop is the real shape
 * of the work.
 *
 * `Object.keys()` types its result `string[]`, which cannot index `SolverQuantities`, and the usual
 * escape is a cast. This is CHECKED instead, twice: `satisfies` proves every entry names a real
 * quantity, and `MissingQuantity` proves none was left out, failing with the field's NAME. That
 * matters most in `consistency.ts`, where a forgotten quantity would not fail to compile — it
 * would silently under-state a tolerance and stop reporting a real contradiction.
 *
 * NOT exported from `engine/index.ts`: it is the engine's own business, and the door publishes
 * `Engine` and the types its signatures name.
 */
export const QUANTITY_NAMES = [
  'Fs_hz', 'Re_ohm', 'Znom_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Qes', 'Qms',
  'Qts', 'Vas_m3', 'Sd_m2', 'Dd_m', 'BL_Tm',
  'Re_terminal_ohm', 'BL_terminal_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s',
  'EBP_hz', 'Xmax_m', 'Vd_m3', 'Hc_m', 'Hg_m',
  'Pe_W', 'no', 'SPLref_dB', 'SPL_dB', 'USPL_dB',
  'SPLmax_dB', 'SPLmaxLF_dB', 'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s',
  'gamma_m_per_s2_A', 'Gloss', 'Vcd_m', 'Depth_m', 'MagDepth_m',
  'Magnet_m', 'DVol_m3', 'c_m_per_s', 'roo_kg_per_m3',
] as const satisfies readonly QuantityName[];

/** Every quantity name, minus the ones the list above actually contains — so nothing
 *  when the list is complete, and the forgotten name when it is not. */
type MissingQuantity = Exclude<QuantityName, typeof QUANTITY_NAMES[number]>;
/** Nothing missing, so this is just `true`. Something missing, and the compiler complains
 *  that `true` is not the missing name — which is how the name gets reported. */
const _everyQuantityIsListed: MissingQuantity extends never ? true : MissingQuantity = true;
void _everyQuantityIsListed;

