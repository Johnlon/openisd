import type { Calculatable, Calculated, Clearable, Entered, Readable, Writable } from '../cell.js';

/** One air condition of a project: E when typed, else C, never N. */
export type EnvironmentField = Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number>;

/** A project's three air conditions. */
export interface EnvironmentFields {
    readonly tempK: EnvironmentField;
    readonly humidityPct: EnvironmentField;
    readonly pressurePa: EnvironmentField;
}
