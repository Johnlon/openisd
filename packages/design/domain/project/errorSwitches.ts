import type {BoxType} from '../../engine/index.js';

/** One control that can reproduce a known WinISD error.
 *  `marked`: the control carries the warning look. `applicable`: the open box's settings make the
 *  switch do something (its counts and filters included); the switch is editable only then.
 *  `inScope`: the open box is of the kind the bug concerns (its box type), whatever its counts;
 *  the ≠W cue shows while in scope and not reproducing (John, 2026-10-05). `reproducesError`: the
 *  control is reproducing the error now. */
export interface ErrorSwitchState {
    readonly marked: boolean;
    readonly applicable: boolean;
    readonly inScope: boolean;
    readonly reproducesError: boolean;
}

/** The error switches, one member each. */
export interface ErrorSwitchStates {
    /** WinISD driver model: two BLs. */
    readonly driverModel: ErrorSwitchState;
    /** WinISD Re without Rg: Re where the amplifier sees Re + Rg (VA chart, power/voltage readout). */
    readonly vaModel: ErrorSwitchState;
    /** PR Npr resonance: the passive-radiator box's fixed losses at an ωr that uses Npr where the
     *  tuning divides by it. Applies with more than one radiator: at Npr 1 the two agree. */
    readonly prNprResonance: ErrorSwitchState;
    /** WinISD Bessel high-pass: not the mirror of the Bessel low-pass. */
    readonly besselHighpass: ErrorSwitchState;
    /** WinISD ABC group delay: the driver part held at the chart frequency while the box is stepped. */
    readonly abcGroupDelay: ErrorSwitchState;
    /** WinISD per-driver impedance: the impedance chart shows one driver's, not the array's. */
    readonly driverCount: ErrorSwitchState;
}

export interface ErrorSwitchInputs {
    readonly boxType: BoxType;
    readonly winisdDriverModel: boolean;
    readonly winisdVaModel: boolean;
    readonly winisdPrNprResonance: boolean;
    readonly winisdBesselHighpass: boolean;
    readonly winisdDriverCountModel: boolean;
    /** The number of drivers in the box. */
    readonly nDrivers: number;
    /** The number of passive radiators (Npr). */
    readonly nPassiveRadiators: number;
    /** The project has at least one enabled Bessel high-pass filter. */
    readonly hasBesselHighpass: boolean;
    readonly winisdAbcGroupDelay: boolean;
}

export function errorSwitchStatesOf(i: ErrorSwitchInputs): ErrorSwitchStates {
    const isPr = i.boxType === 'box-passive-radiator';
    const isAbc = i.boxType === 'abc';
    return {
        driverModel: {marked: true, applicable: true, inScope: true, reproducesError: i.winisdDriverModel},
        vaModel: {marked: true, applicable: true, inScope: true, reproducesError: i.winisdVaModel},
        besselHighpass: {marked: true, applicable: i.hasBesselHighpass, inScope: true, reproducesError: i.winisdBesselHighpass},
        prNprResonance: {marked: true, applicable: isPr && i.nPassiveRadiators > 1, inScope: isPr, reproducesError: i.winisdPrNprResonance},
        abcGroupDelay: {marked: true, applicable: isAbc, inScope: isAbc, reproducesError: i.winisdAbcGroupDelay},
        driverCount: {marked: true, applicable: i.nDrivers > 1, inScope: true, reproducesError: i.winisdDriverCountModel},
    };
}
