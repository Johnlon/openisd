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
    /** WinISD ABC intra-port velocity: Ricl left out of the divider. */
    readonly abcIntraPortVelocity: ErrorSwitchState;
    /** WinISD driver model: two BLs. */
    readonly driverModel: ErrorSwitchState;
    /** WinISD VA model: Re where the amplifier sees Re + Rg. */
    readonly vaModel: ErrorSwitchState;
    /** PR Npr resonance: the passive-radiator box's fixed losses at an ωr that uses Npr where the
     *  tuning divides by it. */
    readonly prNprResonance: ErrorSwitchState;
}

export interface ErrorSwitchInputs {
    readonly boxType: BoxType;
    readonly winisdDriverModel: boolean;
    readonly winisdVaModel: boolean;
    readonly winisdAbcIntraPortVelocity: boolean;
    readonly winisdPrNprResonance: boolean;
}

export function errorSwitchStatesOf(i: ErrorSwitchInputs): ErrorSwitchStates {
    return {
        abcIntraPortVelocity: {marked: true, applicable: i.boxType === 'abc', reproducesError: i.winisdAbcIntraPortVelocity},
        driverModel: {marked: true, applicable: true, reproducesError: i.winisdDriverModel},
        vaModel: {marked: true, applicable: true, reproducesError: i.winisdVaModel},
        prNprResonance: {marked: true, applicable: i.boxType === 'box-passive-radiator', reproducesError: i.winisdPrNprResonance},
    };
}
