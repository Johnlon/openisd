import type {BoxType} from '../../engine/index.js';

/** One control that can reproduce a known WinISD error.
 *  `marked`: the control carries the warning look. `applicable`: the open box has what the
 *  control acts on. `reproducesError`: the control is reproducing the error now. */
export interface ErrorSwitchState {
    readonly marked: boolean;
    readonly applicable: boolean;
    readonly reproducesError: boolean;
}

/** The error switches, one member each. */
export interface ErrorSwitchStates {
    /** WinISD driver model: two BLs. */
    readonly driverModel: ErrorSwitchState;
    /** WinISD Re without Rg: Re where the amplifier sees Re + Rg (VA chart, power/voltage readout). */
    readonly vaModel: ErrorSwitchState;
    /** PR Npr resonance: the passive-radiator box's fixed losses at an ωr that uses Npr where the
     *  tuning divides by it. */
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
    /** The project has at least one enabled Bessel high-pass filter. */
    readonly hasBesselHighpass: boolean;
    readonly winisdAbcGroupDelay: boolean;
}

export function errorSwitchStatesOf(i: ErrorSwitchInputs): ErrorSwitchStates {
    return {
        driverModel: {marked: true, applicable: true, reproducesError: i.winisdDriverModel},
        vaModel: {marked: true, applicable: true, reproducesError: i.winisdVaModel},
        besselHighpass: {marked: true, applicable: i.hasBesselHighpass, reproducesError: i.winisdBesselHighpass},
        prNprResonance: {marked: true, applicable: i.boxType === 'box-passive-radiator', reproducesError: i.winisdPrNprResonance},
        abcGroupDelay: {marked: true, applicable: i.boxType === 'abc', reproducesError: i.winisdAbcGroupDelay},
        driverCount: {marked: true, applicable: i.nDrivers > 1, reproducesError: i.winisdDriverCountModel},
    };
}
