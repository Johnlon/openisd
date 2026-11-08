import {NumberField} from '../../fields/field.js';

/** The mechanical figures the charts work out while a datasheet states another value for them. */
export type ChartFigure = 'Cms' | 'Mms' | 'Rms';

const FIELD: Readonly<Record<ChartFigure, NumberField>> = {Cms: NumberField.CMS_M_PER_N, Mms: NumberField.MMS_KG, Rms: NumberField.RMS_KG_PER_S};
const WORKED_OUT_FROM: Readonly<Record<ChartFigure, string>> = {Cms: 'Vas', Mms: 'Fs and Cms', Rms: 'Fs, Mms and Qms'};

/** The popup sentence for a figure whose stated value the charts do not use, with both values in the field's own unit:
 *  "Datasheet Cms is 0.60 mm/N. It does not agree with Vas, so the charts use 1.19 mm/N, worked out from Vas. Untick Cms from Vas to use the datasheet value." */
export function chartFigureNote(figure: ChartFigure, statedSI: number, chartSI: number): string {
    const field = FIELD[figure];
    const stated = `${field.format(statedSI)} ${field.unitLabel()}`;
    const chart = `${field.format(chartSI)} ${field.unitLabel()}`;
    const why = figure === 'Cms' ? 'It does not agree with Vas, so the charts' : 'The charts';
    return `Datasheet ${figure} is ${stated}. ${why} use ${chart}, worked out from ${WORKED_OUT_FROM[figure]}. Untick Cms from Vas to use the datasheet value.`;
}
