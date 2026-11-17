import {ToggleField} from '../../fields/field.js';
import type {SimpleField} from '../cell.js';
import type {OpenISDProject} from './openISDProject.js';

/** `bug`: ticked brings a WinISD calculation bug back. `option`: ticked is WinISD's way of a
 *  calculation that has another valid form. */
export type CompatSwitchKind = 'bug' | 'option';

/**
 * A WinISD Compatibility switch (John, 2026-10-05): a WinISD bug (under "Enable WinISD bugs") or a
 * WinISD option (under "Enable WinISD-style"). Its title and tooltip are `field`'s.
 */
export class CompatSwitch {
    /** `winisdValue`: what a new project, or a file that does not say, has. A bug is unticked (fixed) and an option is ticked
     *  (WinISD's way), except where a ruling names the switch. */
    private constructor(
        readonly field: ToggleField,
        readonly kind: CompatSwitchKind,
        readonly winisdValue: boolean,
        readonly of: (p: OpenISDProject) => SimpleField<boolean>,
    ) {}

    static readonly DRIVER_MODEL = new CompatSwitch(ToggleField.ADV_WINISDDRIVERMODEL, 'bug', false, p => p.winisdDriverModel);
    static readonly VA_MODEL = new CompatSwitch(ToggleField.ADV_WINISDVAMODEL, 'bug', false, p => p.winisdVaModel);
    static readonly PR_NPR_RESONANCE = new CompatSwitch(ToggleField.ADV_WINISDPRNPRRESONANCE, 'bug', false, p => p.winisdPrNprResonance);
    static readonly BESSEL_HIGHPASS = new CompatSwitch(ToggleField.ADV_WINISDBESSELHIGHPASS, 'bug', false, p => p.winisdBesselHighpass);
    static readonly ABC_GROUP_DELAY = new CompatSwitch(ToggleField.ADV_WINISDABCGROUPDELAY, 'bug', false, p => p.winisdAbcGroupDelay);
    static readonly SEALED_PICKER = new CompatSwitch(ToggleField.ADV_WINISDSEALEDPICKER, 'bug', false, p => p.winisdSealedPicker);
    static readonly TL_PORT_END_CORRECTION = new CompatSwitch(ToggleField.ADV_WINISDTLPORTNOENDCORRECTION, 'bug', false, p => p.winisdTlPortNoEndCorrection);
    static readonly COIL_WIRING_RE_BL_ONLY = new CompatSwitch(ToggleField.ADV_WINISDCOILWIRINGREBLONLY, 'bug', false, p => p.winisdCoilWiringReBlOnly);

    static readonly WRAP_PHASE = new CompatSwitch(ToggleField.ADV_WINISDWRAPPHASE, 'option', true, p => p.winisdWrapPhase);
    static readonly FLAT_MODEL = new CompatSwitch(ToggleField.ADV_WINISDFLATMODEL, 'option', true, p => p.winisdFlatModel);
    static readonly ABC_INTRA_PORT_VELOCITY = new CompatSwitch(ToggleField.ADV_WINISDABCINTRAPORTVELOCITY, 'option', true, p => p.winisdAbcIntraPortVelocity);

    /** Every switch, bugs first; declared last. */
    static readonly ALL: readonly CompatSwitch[] =
        Object.freeze(Object.values(CompatSwitch).filter((v): v is CompatSwitch => v instanceof CompatSwitch));
    static readonly BUGS: readonly CompatSwitch[] = Object.freeze(CompatSwitch.ALL.filter(s => s.kind === 'bug'));
    static readonly OPTIONS: readonly CompatSwitch[] = Object.freeze(CompatSwitch.ALL.filter(s => s.kind === 'option'));
}
