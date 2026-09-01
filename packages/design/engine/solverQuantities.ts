/**
 * WHAT THE SOLVER IS GIVEN.
 *
 * Every quantity a device can STATE, plus the two facts about its voice coils that are not
 * quantities at all: how many there are and how they are wired. Wiring is a NAME, which is why
 * this is its own type — `EngineQuantities` is all-numeric, and the solver's `setVal` writes a
 * `number` through a `keyof` union, which compiles only while that stays true.
 *
 * The terminal values are absent here BY CONSTRUCTION: they are always derived, never stated, so
 * there is no way to hand the solver one.
 */
/**
 * The name of one NUMERIC quantity. Called `QuantityName` rather than `SolverQuantity` so it
 * cannot be mistaken for `SolverQuantities`, which is the whole set a caller hands in.
 */
export class SolverQuantities {
    // Thiele/Small
    /** Free-air resonance frequency of the driver. */
  Fs_hz?: number;
    /** DC resistance of the voice coil. */
  Re_ohm?: number;
    /** Nominal impedance. Not a simulation input. */
  Znom_ohm?: number;
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

}


/**
 * A NUMERIC quantity's name — derived from `SolverQuantities`, so a new numeric field IS a new member
 * here with nothing to keep in step by hand.

 */
export type QuantityName =
  { [K in keyof SolverQuantities]-?: SolverQuantities[K] extends number | undefined ? K : never }[keyof SolverQuantities];

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
  'Fs_hz', 'Re_ohm', 'Znom_ohm', 'Qes', 'Qms',
  'Qts', 'Vas_m3', 'Sd_m2', 'Dd_m', 'BL_Tm',
  'Re_terminal_ohm', 'BL_terminal_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s',
  'EBP_hz', 'Xmax_m', 'Vd_m3', 'Hc_m', 'Hg_m',
  'Pe_W', 'no', 'SPLref_dB', 'SPL_dB', 'USPL_dB',
  'SPLmax_dB', 'SPLmaxLF_dB', 'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s',
  'gamma_m_per_s2_A', 'Gloss', 'Vcd_m', 'Depth_m', 'MagDepth_m',
  'Magnet_m', 'DVol_m3', 'c_m_per_s', 'roo_kg_per_m3',
] as const satisfies readonly QuantityName[];

/** `never` when `QUANTITY_NAMES` is complete; otherwise the quantity it forgot. */
type MissingQuantity = Exclude<QuantityName, typeof QUANTITY_NAMES[number]>;
const _everyQuantityIsListed: MissingQuantity extends never ? true : MissingQuantity = true;
void _everyQuantityIsListed;

