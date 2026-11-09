import type {CmsSource} from '../../engine/index.js';
import {NumberField} from '../../fields/field.js';

/** The mechanical figures the charts work out while a datasheet states another value for them (Cms has its own note, `cmsConflictNote`). */
export type ChartFigure = 'Mms' | 'Rms';

/** The field whose unit and decimals the figure is written in. */
function fieldOf(figure: ChartFigure): NumberField {
    switch (figure) {
        case 'Mms': return NumberField.MMS_KG;
        case 'Rms': return NumberField.RMS_KG_PER_S;
    }
}

/** What the engine's chain works the figure out from. */
function workedOutFrom(figure: ChartFigure): string {
    switch (figure) {
        case 'Mms': return 'Fs and Cms';
        case 'Rms': return 'Fs, Mms and Qms';
    }
}

/** The popup sentence for a figure whose stated value the charts do not use, with both values in the field's own unit:
 *  "Datasheet Mms is 50.00 g. The charts use 21.65 g, worked out from Fs and Cms. Untick Cms from Vas to use the datasheet value."
 *  (The last sentence is only said while the option is ticked.) */
export function chartFigureNote(figure: ChartFigure, statedSI: number, chartSI: number, source: Exclude<CmsSource, {readonly kind: 'StoredShown'}>): string {
    const field = fieldOf(figure);
    const stated = `${field.format(statedSI)} ${field.unitLabel()}`;
    const chart = `${field.format(chartSI)} ${field.unitLabel()}`;
    const worked = `Datasheet ${figure} is ${stated}. The charts use ${chart}, worked out from ${workedOutFrom(figure)}.`;
    // Unticked already: the option has nothing left to offer, so the sentence stops.
    switch (source.kind) {
        case 'VasWins': return `${worked} Untick Cms from Vas to use the datasheet value.`;
        case 'StatedCmsWins': return worked;
    }
}

/** The one sentence on a Cms that disagrees with the stated Vas, naming the Cms the charts use (the option "Cms from Vas" decides):
 *  "The stated Cms and Vas disagree, so the charts use Cms from Vas (1.19 mm/N)." */
export function cmsConflictNote(source: Exclude<CmsSource, {readonly kind: 'StoredShown'}>, statedSI: number, fromVasSI: number): string {
    const unit = NumberField.CMS_M_PER_N.unitLabel();
    const value = (si: number): string => `${NumberField.CMS_M_PER_N.format(si)} ${unit}`;
    switch (source.kind) {
        case 'VasWins': return `The stated Cms and Vas disagree, so the charts use Cms from Vas (${value(fromVasSI)}).`;
        case 'StatedCmsWins': return `The stated Cms and Vas disagree, so the charts use the stated Cms (${value(statedSI)}).`;
    }
}
