import {FixedAir} from '../../engine/index.js';
import type {Air, AirInput, AirIssue, AirQuantityName, AirSolution, EnvironmentEngine} from '../../engine/index.js';
import {entryField, focus} from '../cell.js';
import type {Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable} from '../cell.js';
import type {OpenISDEnvironmentJson} from '../openisdSchema.js';

/** One air quantity of a project, as a screen reads and edits it: E when typed, C when the air
 *  solver worked it out, with its half-width. `clear()` just empties it; the solver fills it again. */
export type AirField = Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable;

/** An `AirField` as the air resolve writes it. */
type SolverAirField = AirField & Calculatable<number> & Unsolvable;

/** The five air quantities, each a field over its own entry in the environment record. */
export interface AirFields {
    readonly tempK: SolverAirField;
    readonly humidityPct: SolverAirField;
    readonly pressurePa: SolverAirField;
    readonly c: SolverAirField;
    readonly rho: SolverAirField;
}

/** The issues that belong on one air quantity's field: those aimed at it, and every conflict that
 *  names it among the quantities of its relation. */
function issuesFor(name: AirQuantityName, issues: readonly AirIssue[]): readonly AirIssue[] {
    return issues.filter(issue => issue.target === name || issue.fields.includes(name));
}

/** The five air fields over `environment`. `issues` is read live on every field read, so a mark
 *  is never older than the last resolve. */
export function airFieldsOver(environment: SimpleField<OpenISDEnvironmentJson>, issues: () => readonly AirIssue[]): AirFields {
    return {
        tempK: entryField(focus(environment, 'temperature_K'), 'temperature_K', () => issuesFor('tempK', issues())),
        humidityPct: entryField(focus(environment, 'humidity_pct'), 'humidity_pct', () => issuesFor('humidityPct', issues())),
        pressurePa: entryField(focus(environment, 'pressure_Pa'), 'pressure_Pa', () => issuesFor('pressurePa', issues())),
        c: entryField(focus(environment, 'c_m_per_s'), 'c_m_per_s', () => issuesFor('c', issues())),
        rho: entryField(focus(environment, 'roo_kg_per_m3'), 'roo_kg_per_m3', () => issuesFor('rho', issues())),
    };
}

function inputOf(field: SolverAirField): AirInput {
    const {value, precision} = field;
    return field.entered && value !== null && precision !== null ? {kind: 'entered', value, precision} : {kind: 'open'};
}

/** What the air resolve found: the issues of the air, and the air itself. There is always one. */
export interface AirResolution {
    readonly issues: readonly AirIssue[];
    readonly air: Air;
}

/** The air solver over a record's five fields, writing nothing. */
function solveFields(fields: AirFields, environment: EnvironmentEngine): AirSolution {
    return environment.solveAir({
        tempK: inputOf(fields.tempK), humidityPct: inputOf(fields.humidityPct), pressurePa: inputOf(fields.pressurePa),
        c: inputOf(fields.c), rho: inputOf(fields.rho),
    });
}

/** The air of a record's fields: its c and ρ, as the resolve settles them. */
export function airOf(fields: AirFields, environment: EnvironmentEngine): Air {
    const {values} = solveFields(fields, environment);
    return new FixedAir({c: values.c, rho: values.rho});
}

/** Solves the air from the entered quantities: every one not entered is written back as a
 *  calculated entry (or emptied when nothing gives it), every one carries the solver's marks.
 *  Writes only to `fields`' own entries. */
export function resolveAir(fields: AirFields, environment: EnvironmentEngine): AirResolution {
    const {values, widths, issues} = solveFields(fields, environment);
    const write = (name: AirQuantityName, field: SolverAirField): void => {
        if (!field.entered) field.setCalculated(values[name], undefined, widths[name] > 0 ? widths[name] : undefined);
        // Marks are written only where there are some to record or an earlier resolve's to replace:
        // an entry with nothing to say carries no empty list.
        const marks = issuesFor(name, issues);
        if (marks.length > 0 || field.dq.length > 0) field.setDq(marks);
    };
    write('tempK', fields.tempK);
    write('humidityPct', fields.humidityPct);
    write('pressurePa', fields.pressurePa);
    write('c', fields.c);
    write('rho', fields.rho);
    return {issues, air: new FixedAir({c: values.c, rho: values.rho})};
}
