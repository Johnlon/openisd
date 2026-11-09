import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { Air, CmsSource, PrEngine, PrSpecIssue, PrSpecPrecision, PrSpecValues } from '../../engine/index.js';
import { chartFigureNote, cmsConflictNote } from '../driver/chartFigureNote.js';
import type { ChartFigure } from '../driver/chartFigureNote.js';
import { NumberField } from '../../fields/field.js';
import type { RadiatorDeviceJson, SpecEntryJson } from '../openisdSchema.js';
import { prSpec, type PassiveRadiatorFieldName } from '../box/prSpec.js';
import { radiatorSection } from '../box/radiatorSection.js';

type SpecField = Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

/** What a radiator inside a project needs to show the figures its charts use: the PR engine, the project's air and the "Cms from Vas" choice. */
export interface PrChart {
    readonly pr: PrEngine;
    readonly air: () => Air;
    readonly cmsSource: () => CmsSource;
}

/**
 * ONE PASSIVE-RADIATOR SPEC SECTION, PUBLISHED — the radiator's counterpart to `DriverSpec`.
 *
 * A window onto the `passive-radiator` section of a device record, with every parameter that
 * section can carry. Separate from `DriverSpec` because a radiator has no motor: `Re`, `BL`,
 * `Qes`, `Znom`, `Pe` and the thermal parameters are not absent from it, they are meaningless to
 * it, and one shared class would have to model one of the two dishonestly.
 */
export class OpenIsdPassiveRadiatorSpec {
    readonly Fs_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Qms: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Cms_m_per_N: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Mms_kg: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Rms_kg_per_s: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Sd_m2: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Vas_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Vd_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Xmax_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Xlim_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Dd_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly DVol_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Thick_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Depth_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Basket_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Outer_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly OuterX_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly OuterY_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly weight_kg: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

    /** The stored Mms, Cms and Rms: what the record states. The public ones show the charts' figure where it differs. */
    readonly #storedMms: SpecField;
    readonly #storedCms: SpecField;
    readonly #storedRms: SpecField;
    readonly #chart: PrChart | undefined;

    constructor(slot: SimpleField<RadiatorDeviceJson>, conflicts: () => readonly PrSpecIssue[] = () => [], chart?: PrChart) {
        this.#chart = chart;
        const section = radiatorSection(slot);
        const shownEntry = (name: 'Mms_kg' | 'Cms_m_per_N' | 'Rms_kg_per_s') => (): SpecEntryJson | undefined => {
            const value = this.#shown()?.[name];
            return value === null || value === undefined ? undefined : {state: 'C', value};
        };
        const marks = (name: keyof PrSpecValues) => (): readonly PrSpecIssue[] =>
            conflicts().filter(issue => issue.fields.some(field => field === name));
        this.Fs_hz = prSpec(section, 'Fs_hz', marks('Fs_hz'), () => this.#fsMoves());
        this.Qms = prSpec(section, 'Qms', marks('Qms'), () => this.#qmsMoves());
        this.#storedCms = prSpec(section, 'Cms_m_per_N', undefined, () => this.#cmsMoves());
        this.#storedMms = prSpec(section, 'Mms_kg');
        this.#storedRms = prSpec(section, 'Rms_kg_per_s');
        this.Cms_m_per_N = prSpec(section, 'Cms_m_per_N', marks('Cms_m_per_N'), () => this.#cmsMoves(), shownEntry('Cms_m_per_N'));
        this.Mms_kg = prSpec(section, 'Mms_kg', marks('Mms_kg'), () => this.#mmsMoves(), shownEntry('Mms_kg'));
        this.Rms_kg_per_s = prSpec(section, 'Rms_kg_per_s', marks('Rms_kg_per_s'), () => this.#rmsMoves(), shownEntry('Rms_kg_per_s'));
        this.Sd_m2 = prSpec(section, 'Sd_m2', marks('Sd_m2'), () => this.#sdMoves());
        this.Vas_m3 = prSpec(section, 'Vas_m3', marks('Vas_m3'), () => this.#vasMoves());
        this.Vd_m3 = prSpec(section, 'Vd_m3');
        this.Xmax_m = prSpec(section, 'Xmax_m');
        this.Xlim_m = prSpec(section, 'Xlim_m');
        this.Dd_m = prSpec(section, 'Dd_m');
        this.DVol_m3 = prSpec(section, 'DVol_m3');
        this.Thick_m = prSpec(section, 'Thick_m');
        this.Depth_m = prSpec(section, 'Depth_m');
        this.Basket_m = prSpec(section, 'Basket_m');
        this.Outer_m = prSpec(section, 'Outer_m');
        this.OuterX_m = prSpec(section, 'OuterX_m');
        this.OuterY_m = prSpec(section, 'OuterY_m');
        this.weight_kg = prSpec(section, 'weight_kg');
    }

    // The figure typed last wins (QO463, John 8 Nov 2026; docs/design/FIELD_CLEAR_RULE.md
    // "Passive radiator pairs"). The charts read Cms, Mms and Rms; Vas, Fs and Qms reach them only
    // through those. Each method names the stated figures a typed one moves; `prSpec` drops them in
    // the same write and `resolve` works them out again. A figure is named only when its inputs are there.

    /** Vas typed: Cms follows Vas and Sd; Mms (Fs stated) and Rms (Qms stated) follow Cms. */
    #vasMoves(): PassiveRadiatorFieldName[] {
        return this.Sd_m2.value === null ? [] : this.#cmsFollowers();
    }

    /** Sd typed: with Vas stated, as Vas typed; else Vas follows the stated Cms and nothing is dropped. */
    #sdMoves(): PassiveRadiatorFieldName[] {
        return this.Vas_m3.entered ? this.#cmsFollowers() : [];
    }

    /** Cms, and the stated Mms and Rms that follow it once Cms is worked out from Vas and Sd. */
    #cmsFollowers(): PassiveRadiatorFieldName[] {
        return ['Cms_m_per_N', ...(this.Fs_hz.entered ? ['Mms_kg' as const] : []), ...(this.Qms.entered ? ['Rms_kg_per_s' as const] : [])];
    }

    /** Fs typed: Mms follows Fs and Cms; Rms (Qms stated) follows Mms. */
    #fsMoves(): PassiveRadiatorFieldName[] {
        if (this.Cms_m_per_N.value === null) return [];
        return ['Mms_kg', ...(this.Qms.entered ? ['Rms_kg_per_s' as const] : [])];
    }

    /** Qms typed: Rms follows Qms, Mms and Cms. */
    #qmsMoves(): PassiveRadiatorFieldName[] {
        return this.Mms_kg.value === null || this.Cms_m_per_N.value === null ? [] : ['Rms_kg_per_s'];
    }

    /** Cms typed: Vas follows Cms and Sd; Fs (Mms stated) and Qms (Rms stated) follow Cms. */
    #cmsMoves(): PassiveRadiatorFieldName[] {
        return [
            ...(this.Sd_m2.value !== null ? ['Vas_m3' as const] : []),
            ...(this.Mms_kg.entered ? ['Fs_hz' as const] : []),
            ...(this.Rms_kg_per_s.entered && this.Mms_kg.value !== null ? ['Qms' as const] : []),
        ];
    }

    /** Mms typed: Fs follows Mms and Cms; Qms (Rms stated) follows Mms. */
    #mmsMoves(): PassiveRadiatorFieldName[] {
        if (this.Cms_m_per_N.value === null) return [];
        return ['Fs_hz', ...(this.Rms_kg_per_s.entered ? ['Qms' as const] : [])];
    }

    /** Rms typed: Qms follows Rms, Mms and Cms. */
    #rmsMoves(): PassiveRadiatorFieldName[] {
        return this.Mms_kg.value === null || this.Cms_m_per_N.value === null ? [] : ['Qms'];
    }

    /** The Xmax this radiator has once picked into a project: its own, else its Xlim ("Xmech"). A
     *  radiator has no voice coil, so a record that states a mechanical limit and no Xmax has that
     *  limit as its Xmax (QO327, John 31 Oct 2026: "stick xmech in the Xmax field as that's what a
     *  Human would do"). Null when the record has neither; the box's starting rule then applies. */
    get pickedXmax_m(): number | null {
        return this.Xmax_m.entered ? this.Xmax_m.value : (this.Xlim_m.entered ? this.Xlim_m.value : null);
    }

    /** The seven figures of the radiator's T/S set that were typed or loaded, nothing derived. */
    #stated(): PrSpecValues {
        const stated = (f: Entered & Readable<number | null>): number | null => f.entered ? f.value : null;
        return {
            Fs_hz: stated(this.Fs_hz), Qms: stated(this.Qms), Vas_m3: stated(this.Vas_m3), Sd_m2: stated(this.Sd_m2),
            Mms_kg: stated(this.#storedMms), Cms_m_per_N: stated(this.#storedCms), Rms_kg_per_s: stated(this.#storedRms),
        };
    }

    /** Each stated figure's own half-width, 0 for one not stated. */
    #precisions(): PrSpecPrecision {
        // An entered figure always states a width; `Number(null)` is 0 for the type's sake.
        const width = (f: Entered & Precise): number => f.entered ? Number(f.precision) : 0;
        return {
            Fs_hz: width(this.Fs_hz), Qms: width(this.Qms), Vas_m3: width(this.Vas_m3), Sd_m2: width(this.Sd_m2),
            Mms_kg: width(this.#storedMms), Cms_m_per_N: width(this.#storedCms), Rms_kg_per_s: width(this.#storedRms),
        };
    }

    /** Write every figure the stated ones derive onto its field as calculated, `air` being the
     *  project's, and return the stated figures that contradict each other. A stated figure is
     *  never touched; one nothing derives reads not-available. */
    resolve(pr: PrEngine, air: Air): PrSpecIssue[] {
        const stated = this.#stated();
        const solved = pr.solveSpec(stated, air);
        const write = (field: Entered & Calculatable<number> & Unsolvable, value: number | null): void => {
            if (field.entered) return;
            if (value === null) field.setNotAvailable(); else field.setCalculated(value);
        };
        write(this.Fs_hz, solved.Fs_hz); write(this.Qms, solved.Qms); write(this.Vas_m3, solved.Vas_m3);
        write(this.Sd_m2, solved.Sd_m2); write(this.#storedMms, solved.Mms_kg);
        write(this.#storedCms, solved.Cms_m_per_N); write(this.#storedRms, solved.Rms_kg_per_s);
        return this.#withChartNotes(pr.checkSpec(stated, this.#precisions(), air));
    }

    /** A record just adopted into a project: its Xlim becomes its Xmax when it has none. The record's Cms, Mms and Rms stay as the
     *  datasheet states them; where the charts use another figure the box shows that one (`#shown`), and the saved record is unchanged. */
    adoptDatasheetFigures(): void {
        const picked = this.pickedXmax_m;
        if (!this.Xmax_m.entered && picked !== null) this.Xmax_m.set(picked, this.Xlim_m.precision ?? undefined);
    }

    /** The Cms, Mms and Rms the charts use when the radiator states Vas: worked out by the engine from Vas, Sd, Fs and Qms (the stated Cms joins
     *  only when the project says the stated Cms wins). Null when the radiator is standalone, shows its datasheet, or states no Vas. */
    #shown(): {readonly Cms_m_per_N: number | null; readonly Mms_kg: number | null; readonly Rms_kg_per_s: number | null} | null {
        const chart = this.#chart;
        if (chart === undefined) return null;
        const source = chart.cmsSource();
        if (source.kind === 'StoredShown') return null;
        const stated = this.#stated();
        if (stated.Vas_m3 === null) return null;
        const solved = chart.pr.solveSpec({
            Fs_hz: stated.Fs_hz, Qms: stated.Qms, Vas_m3: stated.Vas_m3, Sd_m2: stated.Sd_m2,
            Mms_kg: null, Rms_kg_per_s: null, Cms_m_per_N: source.kind === 'StatedCmsWins' ? stated.Cms_m_per_N : null,
        }, chart.air());
        return {Cms_m_per_N: source.kind === 'VasWins' ? solved.Cms_m_per_N : null, Mms_kg: solved.Mms_kg, Rms_kg_per_s: solved.Rms_kg_per_s};
    }

    /** The issues, with the stated Cms that disagrees with the stated Vas named in one sentence on Cms (the generic Vas/Cms disagreement is dropped
     *  for it), and each stated Mms or Rms the charts do not use named in its own sentence (the driver's rule). */
    #withChartNotes(issues: PrSpecIssue[]): PrSpecIssue[] {
        const chart = this.#chart;
        if (chart === undefined) return issues;
        const source = chart.cmsSource();
        if (source.kind === 'StoredShown') return issues;
        const shown = this.#shown();
        const figures: readonly {readonly figure: ChartFigure; readonly name: PrSpecIssue['target']; readonly stored: SpecField; readonly chart: number | null}[] = [
            {figure: 'Mms', name: 'Mms_kg', stored: this.#storedMms, chart: shown?.Mms_kg ?? null},
            {figure: 'Rms', name: 'Rms_kg_per_s', stored: this.#storedRms, chart: shown?.Rms_kg_per_s ?? null},
        ];
        const differing = figures.flatMap(({figure, name, stored, chart}) => {
            const statedSI = stored.entered ? stored.value : null;
            return statedSI === null || chart === null || Math.abs(chart - statedSI) <= 1e-9 * Math.abs(statedSI) ? [] : [{figure, name, statedSI, chart}];
        });
        const stated = this.#stated();
        const fromVas = stated.Vas_m3 === null ? null : chart.pr.solveSpec({
            Fs_hz: stated.Fs_hz, Qms: stated.Qms, Vas_m3: stated.Vas_m3, Sd_m2: stated.Sd_m2, Mms_kg: null, Rms_kg_per_s: null, Cms_m_per_N: null,
        }, chart.air()).Cms_m_per_N;
        const cmsConflict = stated.Cms_m_per_N !== null && fromVas !== null && Math.abs(fromVas - stated.Cms_m_per_N) > 1e-9 * Math.abs(stated.Cms_m_per_N);
        const kept = issues.map((issue): PrSpecIssue => issue.kind === 'inconsistent-inputs' && cmsConflict
            ? {...issue, fields: issue.fields.filter(f => f !== 'Cms_m_per_N')} : issue);
        const cmsNotes: PrSpecIssue[] = stated.Cms_m_per_N === null || fromVas === null || !cmsConflict ? [] : [{
            kind: 'inconsistent-inputs', target: 'Cms_m_per_N', fields: ['Cms_m_per_N'], formula: NumberField.CMS_M_PER_N.formula ?? '', expected: fromVas, actual: stated.Cms_m_per_N,
            relative: Math.abs(fromVas - stated.Cms_m_per_N) / stated.Cms_m_per_N, text: cmsConflictNote(source, stated.Cms_m_per_N, fromVas),
        }];
        const notes = differing.map(({figure, name, statedSI, chart}): PrSpecIssue => (
            {kind: 'approximate-charts', target: name, fields: [name], text: chartFigureNote(figure, statedSI, chart)}));
        return [...kept, ...cmsNotes, ...notes];
    }
}
