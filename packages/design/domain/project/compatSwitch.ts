import {ToggleField} from '../../fields/field.js';
import type {SimpleField} from '../cell.js';
import type {OpenISDProject} from './openISDProject.js';

/** `bug`: ticked brings a WinISD calculation bug back. `option`: ticked is WinISD's way of a
 *  calculation that has another valid form. */
export type CompatSwitchKind = 'bug' | 'option';

/**
 * A WinISD Compatibility switch (John, 2026-10-05): a WinISD bug ("Enable WinISD <name> bug") or a
 * WinISD option ("Enable WinISD style <name>"). Its title and tooltip are `field`'s.
 */
export class CompatSwitch {
    private constructor(
        readonly field: ToggleField,
        readonly kind: CompatSwitchKind,
        readonly of: (p: OpenISDProject) => SimpleField<boolean>,
    ) {}

    static readonly DRIVER_MODEL = new CompatSwitch(ToggleField.ADV_WINISDDRIVERMODEL, 'bug', p => p.winisdDriverModel);
    static readonly VA_MODEL = new CompatSwitch(ToggleField.ADV_WINISDVAMODEL, 'bug', p => p.winisdVaModel);
    static readonly PR_NPR_RESONANCE = new CompatSwitch(ToggleField.ADV_WINISDPRNPRRESONANCE, 'bug', p => p.winisdPrNprResonance);
    static readonly BESSEL_HIGHPASS = new CompatSwitch(ToggleField.ADV_WINISDBESSELHIGHPASS, 'bug', p => p.winisdBesselHighpass);

    static readonly WRAP_PHASE = new CompatSwitch(ToggleField.ADV_WINISDWRAPPHASE, 'option', p => p.winisdWrapPhase);
    static readonly DRIVER_COUNT = new CompatSwitch(ToggleField.ADV_WINISDDRIVERCOUNTMODEL, 'option', p => p.winisdDriverCountModel);
    static readonly FLAT_MODEL = new CompatSwitch(ToggleField.ADV_WINISDFLATMODEL, 'option', p => p.winisdFlatModel);
    static readonly ABC_INTRA_PORT_VELOCITY = new CompatSwitch(ToggleField.ADV_WINISDABCINTRAPORTVELOCITY, 'option', p => p.winisdAbcIntraPortVelocity);

    /** What a new project, or a file that does not say, has:
     *  a bug unticked (fixed), an option ticked (WinISD's way). */
    get winisdValue(): boolean {
        switch (this.kind) {
            case 'bug': return false;
            case 'option': return true;
        }
    }

    /** Every switch, bugs first; declared last. */
    static readonly ALL: readonly CompatSwitch[] =
        Object.freeze(Object.values(CompatSwitch).filter((v): v is CompatSwitch => v instanceof CompatSwitch));
    static readonly BUGS: readonly CompatSwitch[] = Object.freeze(CompatSwitch.ALL.filter(s => s.kind === 'bug'));
    static readonly OPTIONS: readonly CompatSwitch[] = Object.freeze(CompatSwitch.ALL.filter(s => s.kind === 'option'));
}
