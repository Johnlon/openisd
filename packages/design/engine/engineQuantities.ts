/**
 * Every quantity the consistency solver reads or writes, by the domain's own name — and
 * NOTHING ELSE. `Le_H` and `numVC` are driver quantities the solver has no relation for, so they
 * live with their real consumers: `Le_H` on `CircuitQuantities` (the impedance plot), `numVC` on
 * the domain, which scales `Re`/`BL` into terminal values before the engine sees anything.
 *
 * A CLASS, and MUTABLE: the solver fills fields in place across a dozen relations until nothing
 * changes, and uses "did I write anything this pass" as its loop condition. A fresh object per
 * step would make "what is known now" unanswerable.
 *
 * Mutability is internal. At the boundary the semantics are by-value — a solve takes a
 * `Readonly<EngineQuantities>` and returns a NEW one, so a caller's object is never written
 * through. `Readonly<>` is checked by the compiler rather than asserted, so that is a guarantee
 * and not a convention, and it costs no second type.
 *
 * Every field is OPTIONAL because absence is the input condition: a driver states what its
 * datasheet printed and nothing else. Absence is not zero — zero is a value a driver can
 * genuinely have.
 *
 * NAMING CONVENTION — `Winisdname_unit`. The stored record uses WinISD's own name (`Fs`, `Sd`,
 * `Cms`); this public surface adds the unit, because a caller reading a raw number is the one
 * who can get the unit wrong. Dimensionless quantities — `Qts`, `Qes`, `Qms`, `no`, `Gloss`,
 * `numVC` — take no suffix, having no unit. The convention governs every field here whether or
 * not the domain publishes that quantity: `SPLref_dB` is a solver intermediate no record states,
 * and is spelled the same way as the rest.
 *
 * Definitions below are condensed from `docs/FIELD_REFERENCE.md`, which carries the full wording
 * and the source for each one.
 */
export class EngineQuantities {
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
    /** Motor force factor — flux density crossed with wire length in the gap. */
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

    /**
     * Every field of this class, for the callers that must walk all of them.
     *
     * A STATIC on the class, not a loose module constant: the engine's door exports `Engine` and
     * the types its signatures name, nothing else (`engine/index.ts`), and
     * `test/architecture-engine-boundary.test.ts` enforces it. It is also where this repo puts a
     * closed set — the `static ALL` convention in `packages/design/AGENTS.md`.
     *
     * `Object.keys()` types its result as `string[]`, which cannot index this class, and the usual
     * escape is a cast — the compiler being told to stop checking exactly where a typo does the
     * most damage. This list is CHECKED instead, twice: `satisfies` proves every entry names a real
     * field, and `MissingQuantity` below proves none was left out, failing with the field's NAME.
     *
     * Declared LAST because static fields initialise in source order.
     *
     * It is an enumeration, not a lookup table: callers iterate it, nothing indexes it by a runtime
     * key (`packages/design/AGENTS.md`, "ENUMERATIONS ARE PERMITTED").
     */
    static readonly NAMES = [
        'Fs_hz', 'Re_ohm', 'Znom_ohm', 'Qes', 'Qms', 'Qts', 'Vas_m3', 'Sd_m2', 'Dd_m',
        'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'EBP_hz',
        'Xmax_m', 'Vd_m3', 'Hc_m', 'Hg_m', 'Pe_W',
        'no', 'SPLref_dB', 'SPL_dB', 'USPL_dB', 'SPLmax_dB', 'SPLmaxLF_dB',
        'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'gamma_m_per_s2_A', 'Gloss',
        'Vcd_m', 'Depth_m', 'MagDepth_m', 'Magnet_m', 'DVol_m3',
        'c_m_per_s', 'roo_kg_per_m3',
    ] as const satisfies readonly (keyof EngineQuantities)[];
}

/** This is an assertion if the completeness of the NAMES- `never` when `EngineQuantities.NAMES` is complete; otherwise the name of a field it forgot. */
type MissingQuantity = Exclude<keyof EngineQuantities, typeof EngineQuantities.NAMES[number]>;
const _everyQuantityIsListed: MissingQuantity extends never ? true : MissingQuantity = true;
void _everyQuantityIsListed;
