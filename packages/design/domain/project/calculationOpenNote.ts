import {NumberField} from '../../fields/field.js';
import {formatFixedOrDash} from '../../fields/format.js';
import type {Box} from '../box/box.js';
import type {OpenISDProject} from './openISDProject.js';

/** The same box, solved under each calculation. Only the active box's readouts are shown. */
export function calculationOpenNote(before: OpenISDProject, after: OpenISDProject): string | undefined {
    const moved: string[] = [];
    const report = (name: string, field: NumberField, oldValue: number | null, newValue: number | null, decimals: number): void => {
        const display = (value: number | null) => formatFixedOrDash(value === null ? null : field.toDisplay(value), decimals);
        const oldText = display(oldValue);
        const newText = display(newValue);
        const unit = field.unitLabel();
        if (oldText !== newText) moved.push(`${name} ${oldText} -> ${newText}${unit === '' ? '' : ` ${unit}`}`);
    };
    const oldBox: Box = before.box;
    const newBox: Box = after.box;
    switch (newBox.boxType.value) {
        case 'sealed':
            report('box resonance', NumberField.BOX_FSC_HZ, oldBox.sealed.resonance_hz.value, newBox.sealed.resonance_hz.value, 1);
            report('Qtc', NumberField.BOX_QTC_VALUE, oldBox.sealed.q_tc.value, newBox.sealed.q_tc.value, 2);
            report('box volume', NumberField.BOX_VB_L, oldBox.sealed.volume_m3.value, newBox.sealed.volume_m3.value, 2);
            break;
        case 'bandpass4': {
            const oldRear = oldBox.bandpass4.chambers.rear;
            const newRear = newBox.bandpass4.chambers.rear;
            report('rear chamber resonance', NumberField.BOX_REARRESONANCE_HZ, oldRear.resonance_hz.value, newRear.resonance_hz.value, 1);
            report('rear chamber Qtc', NumberField.BOX_QTC_VALUE, oldRear.q_tc.value, newRear.q_tc.value, 2);
            break;
        }
        case 'box-passive-radiator': {
            const oldPr = oldBox.passiveRadiator;
            const newPr = newBox.passiveRadiator;
            report('box tuning', NumberField.PR_FP_HZ, oldPr.systemTuning_hz.value, newPr.systemTuning_hz.value, 1);
            report('box tuning without added mass', NumberField.BOX_RESONANCE_HZ, oldPr.naturalTuning_hz.value, newPr.naturalTuning_hz.value, 1);
            report('radiator resonance with added mass', NumberField.PR_FSMASS_HZ, oldPr.resonanceWithAddedMass_hz.value, newPr.resonanceWithAddedMass_hz.value, 1);
            report('radiator added mass', NumberField.PR_MADD_G, oldPr.addedMass_kg.value, newPr.addedMass_kg.value, 2);
            break;
        }
        case 'vented':
        case 'bandpass6':
        case 'abc':
            break;
    }
    if (moved.length === 0) {
        const oldSweep = before.sweep({}).values;
        const newSweep = after.sweep({}).values;
        report('F3', NumberField.BOX_FSC_HZ, oldSweep && before.rolloffFreq(oldSweep, 3), newSweep && after.rolloffFreq(newSweep, 3), 1);
        if (moved.length === 0 && oldSweep && newSweep) {
            // A chart can move without crossing a different F3. Show a changed SPL reading.
            const index = oldSweep.spl.findIndex((level, i) => Math.abs(level - newSweep.spl[i]) >= 0.1);
            if (index >= 0) {
                report(`SPL at ${formatFixedOrDash(oldSweep.fs[index], 1)} Hz`, NumberField.SPL_DB, oldSweep.spl[index], newSweep.spl[index], 1);
            }
        }
    }
    return moved.length === 0 ? undefined : `Calculated with your typed Mms, Cms and Rms: ${moved.join(', ')}`;
}
