import {NumberField} from '../../fields/field.js';

/** The mechanical figures the charts work out while a datasheet states another value for them. */
export type ChartFigure = 'Cms' | 'Mms' | 'Rms';

/** The field whose unit and decimals the figure is written in. */
function fieldOf(figure: ChartFigure): NumberField {
    switch (figure) {
        case 'Cms': return NumberField.CMS_M_PER_N;
        case 'Mms': return NumberField.MMS_KG;
        case 'Rms': return NumberField.RMS_KG_PER_S;
    }
}

/** What the engine's chain works the figure out from. */
function workedOutFrom(figure: ChartFigure): string {
    switch (figure) {
        case 'Cms': return 'Vas';
        case 'Mms': return 'Fs and Cms';
        case 'Rms': return 'Fs, Mms and Qms';
    }
}

/** The popup sentence for a figure whose stated value the charts do not use, with both values in the field's own unit:
 *  "Datasheet Cms is 0.60 mm/N. It does not agree with Vas, so the charts use 1.19 mm/N, worked out from Vas. Untick Cms from Vas to use the datasheet value." */
export function chartFigureNote(figure: ChartFigure, statedSI: number, chartSI: number): string {
    const field = fieldOf(figure);
    const stated = `${field.format(statedSI)} ${field.unitLabel()}`;
    const chart = `${field.format(chartSI)} ${field.unitLabel()}`;
    const why = figure === 'Cms' ? 'It does not agree with Vas, so the charts' : 'The charts';
    return `Datasheet ${figure} is ${stated}. ${why} use ${chart}, worked out from ${workedOutFrom(figure)}. Untick Cms from Vas to use the datasheet value.`;
}
