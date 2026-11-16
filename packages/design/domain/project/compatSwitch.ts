import {ToggleField} from '../../fields/field.js';
import type {SimpleField} from '../cell.js';
import type {OpenISDProject} from './openISDProject.js';

/** `bug`: ticked brings a WinISD calculation bug back; a new project has it unticked. `option`: ticked is WinISD's way of a
 *  calculation that has another valid form; a new project has it ticked, but for "Chart from Fs, Vas, Qms" (QO539). */
export type CompatSwitchKind = 'bug' | 'option';

/** A switch that acts on every box. */
const ALWAYS = (): boolean => true;

/**
 * A WinISD Compatibility switch (John, 2026-10-05): a WinISD bug (under "Enable WinISD bugs") or a
 * WinISD option (under "Enable WinISD-style"). Its title and tooltip are `field`'s.
 */
export class CompatSwitch {
    private constructor(
        readonly field: ToggleField,
        readonly kind: CompatSwitchKind,
        readonly of: (p: OpenISDProject) => SimpleField<boolean>,
        /** What a new project, or a file that does not say, has. */
        readonly startValue: boolean,
        /** Whether the switch acts on the open box; a switch that does not is shown greyed. */
        readonly appliesTo: (p: OpenISDProject) => boolean,
    ) {}

    /** The key the switch's checkbox carries on screen: the field's name without its `adv_` prefix, first letter lower case. */
    get fieldKey(): string {
        const name = this.field.value.replace(/^adv_/, '');
        return name.charAt(0).toLowerCase() + name.slice(1);
    }

    static readonly DRIVER_MODEL = new CompatSwitch(ToggleField.ADV_WINISDDRIVERMODEL, 'bug', p => p.winisdDriverModel, false, ALWAYS);
    static readonly VA_MODEL = new CompatSwitch(ToggleField.ADV_WINISDVAMODEL, 'bug', p => p.winisdVaModel, false, ALWAYS);
    static readonly PR_NPR_RESONANCE = new CompatSwitch(ToggleField.ADV_WINISDPRNPRRESONANCE, 'bug', p => p.winisdPrNprResonance, false, ALWAYS);
    static readonly BESSEL_HIGHPASS = new CompatSwitch(ToggleField.ADV_WINISDBESSELHIGHPASS, 'bug', p => p.winisdBesselHighpass, false, ALWAYS);
    static readonly ABC_GROUP_DELAY = new CompatSwitch(ToggleField.ADV_WINISDABCGROUPDELAY, 'bug', p => p.winisdAbcGroupDelay, false, ALWAYS);
    static readonly SEALED_PICKER = new CompatSwitch(ToggleField.ADV_WINISDSEALEDPICKER, 'bug', p => p.winisdSealedPicker, false, ALWAYS);
    static readonly TL_PORT_END_CORRECTION = new CompatSwitch(ToggleField.ADV_WINISDTLPORTNOENDCORRECTION, 'bug', p => p.winisdTlPortNoEndCorrection, false, ALWAYS);
    static readonly COIL_WIRING_RE_BL_ONLY = new CompatSwitch(ToggleField.ADV_WINISDCOILWIRINGREBLONLY, 'bug', p => p.winisdCoilWiringReBlOnly, false, ALWAYS);

    static readonly WRAP_PHASE = new CompatSwitch(ToggleField.ADV_WINISDWRAPPHASE, 'option', p => p.winisdWrapPhase, true, ALWAYS);
    static readonly FLAT_MODEL = new CompatSwitch(ToggleField.ADV_WINISDFLATMODEL, 'option', p => p.winisdFlatModel, true, ALWAYS);
    static readonly ABC_INTRA_PORT_VELOCITY = new CompatSwitch(ToggleField.ADV_WINISDABCINTRAPORTVELOCITY, 'option', p => p.winisdAbcIntraPortVelocity, true, p => p.winisdAbcIntraPortVelocityApplies);
    /** Unticked in a new project (John, 11 Nov 2026, QO539: picked B): the charts use the Mms, Cms and Rms boxes. */
    static readonly CHART_FROM_FS_VAS_QMS = new CompatSwitch(ToggleField.ADV_WINISDCHARTFROMFSVASQMS, 'option', p => p.winisdChartFromFsVasQms, false, ALWAYS);

    /** Every switch, bugs first; declared last. */
    static readonly ALL: readonly CompatSwitch[] =
        Object.freeze(Object.values(CompatSwitch).filter((v): v is CompatSwitch => v instanceof CompatSwitch));
    static readonly BUGS: readonly CompatSwitch[] = Object.freeze(CompatSwitch.ALL.filter(s => s.kind === 'bug'));
    static readonly OPTIONS: readonly CompatSwitch[] = Object.freeze(CompatSwitch.ALL.filter(s => s.kind === 'option'));
}
