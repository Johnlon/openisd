import type {ChartingSource, ShownMechanics} from '../../engine/index.js';
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
export function chartFigureNote(figure: ChartFigure, statedSI: number, chartSI: number, source: ChartingSource): string {
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
export function cmsConflictNote(source: ChartingSource, statedSI: number, fromVasSI: number): string {
    const unit = NumberField.CMS_M_PER_N.unitLabel();
    const value = (si: number): string => `${NumberField.CMS_M_PER_N.format(si)} ${unit}`;
    switch (source.kind) {
        case 'VasWins': return `The stated Cms and Vas disagree, so the charts use Cms from Vas (${value(fromVasSI)}).`;
        case 'StatedCmsWins': return `The stated Cms and Vas disagree, so the charts use the stated Cms (${value(statedSI)}).`;
    }
}

/** A figure the datasheet states and the charts may not use: the stated value (null if not stated) and the one the charts use (null if the engine has none). */
export interface ChartFigureFact<Name extends string> {
    readonly figure: ChartFigure;
    readonly name: Name;
    readonly statedSI: number | null;
    readonly chartSI: number | null;
}

/** The stated Cms against the Cms worked out from the stated Vas, when they disagree. */
export interface CmsConflict {
    readonly expected: number;
    readonly actual: number;
    readonly relative: number;
    readonly text: string;
}

/** Every note a spec attaches to its boxes: the Cms/Vas conflict (if any) and one sentence per stated Mms or Rms the charts do not use. */
export interface ChartNotes<Name extends string> {
    readonly cmsConflict: CmsConflict | null;
    readonly figures: readonly {readonly name: Name; readonly text: string}[];
}

/** Two figures agree when they are within this share of the stated one. */
const SAME_FIGURE = 1e-9;
const differs = (stated: number, other: number): boolean => Math.abs(other - stated) > SAME_FIGURE * Math.abs(stated);

/** The notes for one spec, driver or radiator alike: which stated figures the charts do not use, and whether the stated Cms
 *  disagrees with the Cms the stated Vas gives (`fromVasSI`, null when Vas is not stated). */
export function chartNotes<Name extends string>(
    source: ChartingSource, facts: readonly ChartFigureFact<Name>[], statedCmsSI: number | null, fromVasSI: number | null,
): ChartNotes<Name> {
    const figures = facts.flatMap(({figure, name, statedSI, chartSI}) =>
        statedSI === null || chartSI === null || !differs(statedSI, chartSI) ? []
            : [{name, text: chartFigureNote(figure, statedSI, chartSI, source)}]);
    const cmsConflict = statedCmsSI === null || fromVasSI === null || !differs(statedCmsSI, fromVasSI) ? null : {
        expected: fromVasSI, actual: statedCmsSI, relative: Math.abs(fromVasSI - statedCmsSI) / statedCmsSI,
        text: cmsConflictNote(source, statedCmsSI, fromVasSI),
    };
    return {cmsConflict, figures};
}

/** No note at all: what a driver or radiator outside a project carries (it shows its datasheet, so the charts differ from nothing). */
export const NO_CHART_NOTES: ChartNotes<never> = Object.freeze({cmsConflict: null, figures: Object.freeze([])});

/** No figure worked out: what a driver or radiator outside a project shows (its boxes read the stored entries). */
export const NOTHING_SHOWN: ShownMechanics = Object.freeze({Cms_m_per_N: null, Mms_kg: null, Rms_kg_per_s: null, BL_terminal_Tm: null});

/** The Cms, Mms and Rms a datasheet states (null where not stated). */
export interface StatedMechanics {
    readonly Cms_m_per_N: number | null;
    readonly Mms_kg: number | null;
    readonly Rms_kg_per_s: number | null;
}

/** The names a note can attach to. */
export type NotedFigure = 'Mms_kg' | 'Rms_kg_per_s';

/** The notes for a project's spec: `shown` is what the charts use under `source`, `fromVas` what they would use were Vas to win. */
export function notesFor(source: ChartingSource, stated: StatedMechanics, shown: ShownMechanics, fromVas: ShownMechanics): ChartNotes<NotedFigure> {
    return chartNotes<NotedFigure>(source, [
        {figure: 'Mms', name: 'Mms_kg', statedSI: stated.Mms_kg, chartSI: shown.Mms_kg},
        {figure: 'Rms', name: 'Rms_kg_per_s', statedSI: stated.Rms_kg_per_s, chartSI: shown.Rms_kg_per_s},
    ], stated.Cms_m_per_N, fromVas.Cms_m_per_N);
}
