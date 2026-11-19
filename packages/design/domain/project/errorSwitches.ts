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
    /** WinISD sealed picker volume: the picker's volume does not give the picked Qtc on the Box tab. */
    readonly sealedPicker: ErrorSwitchState;
    /** WinISD TL port without end correction: the transmission-line port pipe leaves out the end correction. */
    readonly tlPortEndCorrection: ErrorSwitchState;
    /** WinISD coil wiring: only Re and BL change with the wiring, Le and Znom stay as published. */
    readonly coilWiringReBlOnly: ErrorSwitchState;
    /** WinISD coil coefficient from project: the coil is heated with the project's AlfaVC, never the driver's own. */
    readonly projectAlfaVC: ErrorSwitchState;
}

export interface ErrorSwitchInputs {
    readonly boxType: BoxType;
    readonly winisdDriverModel: boolean;
    readonly winisdVaModel: boolean;
    readonly winisdPrNprResonance: boolean;
    readonly winisdBesselHighpass: boolean;
    /** The number of drivers in the box. */
    readonly nDrivers: number;
    /** The number of passive radiators (Npr). */
    readonly nPassiveRadiators: number;
    /** The project has at least one enabled Bessel high-pass filter. */
    readonly hasBesselHighpass: boolean;
    readonly winisdAbcGroupDelay: boolean;
    readonly winisdSealedPicker: boolean;
    readonly winisdTlPortNoEndCorrection: boolean;
    readonly winisdCoilWiringReBlOnly: boolean;
    /** The driver has 2 or more coils and a stated measured wiring: the project's coil wiring can be chosen. */
    readonly coilWiringApplies: boolean;
    /** "Use transmission line model for port simulation" is ticked. */
    readonly tlPortModel: boolean;
    readonly winisdProjectAlfaVC: boolean;
    /** The coil runs hot (dTVC not 0) and the driver states an AlfaVC other than 0 and other than the project's: the
     *  two ways of choosing the coil's coefficient give different sums. */
    readonly coilAlfaVCChoiceMatters: boolean;
}

export function errorSwitchStatesOf(i: ErrorSwitchInputs): ErrorSwitchStates {
    const isPr = i.boxType === 'box-passive-radiator';
    const isAbc = i.boxType === 'abc';
    const isSealed = i.boxType === 'sealed';
    const hasLinePort = i.boxType === 'vented' || i.boxType === 'bandpass4' || i.boxType === 'bandpass6' || isAbc;
    return {
        driverModel: {marked: true, applicable: true, inScope: true, reproducesError: i.winisdDriverModel},
        vaModel: {marked: true, applicable: true, inScope: true, reproducesError: i.winisdVaModel},
        besselHighpass: {marked: true, applicable: i.hasBesselHighpass, inScope: true, reproducesError: i.winisdBesselHighpass},
        prNprResonance: {marked: true, applicable: isPr && i.nPassiveRadiators > 1, inScope: isPr, reproducesError: i.winisdPrNprResonance},
        abcGroupDelay: {marked: true, applicable: isAbc, inScope: isAbc, reproducesError: i.winisdAbcGroupDelay},
        sealedPicker: {marked: true, applicable: isSealed, inScope: isSealed, reproducesError: i.winisdSealedPicker},
        tlPortEndCorrection: {marked: true, applicable: i.tlPortModel && hasLinePort, inScope: hasLinePort, reproducesError: i.winisdTlPortNoEndCorrection},
        coilWiringReBlOnly: {marked: true, applicable: i.coilWiringApplies, inScope: true, reproducesError: i.winisdCoilWiringReBlOnly},
        projectAlfaVC: {marked: true, applicable: i.coilAlfaVCChoiceMatters, inScope: i.coilAlfaVCChoiceMatters, reproducesError: i.winisdProjectAlfaVC},
    };
}
