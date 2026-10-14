/** The driver embedded in a stored or exported project carries what the Driver Editor shows and
 *  the calculation reads: identity, each parameter's value, state and stated precision, and the
 *  provided-by, comment and added texts. Sources, readings, scraper data and quality marks stay in
 *  the catalogue record. Loading works out everything else it needs. The result still parses
 *  under the project schema every earlier build reads: required keys remain, empty. */
import {statedPrecisionOf} from '../cell.js';
import {specEntryJsonSchema} from '../openisdSchema.js';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The device's text fields a screen shows: the name, and the three the editor lets the user edit. */
const NAME_KEYS = ['manufacturer', 'brand', 'model'] as const;
const EDITOR_TEXT_KEYS = ['provided_by', 'comment', 'added'] as const;

/** A text-like field cut to its value: its source marks go. */
function valueOnly(field: unknown): unknown {
    return isRecord(field) && 'value' in field ? {value: field.value} : field;
}

/** An entered or calculated entry cut to state, value and the precision it states; a
 *  not-available entry holds only readings no screen shows, and is absent in effect. */
function slimmedEntry(entry: unknown): unknown {
    const parsed = specEntryJsonSchema.safeParse(entry);
    if (!parsed.success) return entry;
    const e = parsed.data;
    switch (e.state) {
        case 'N':
            return undefined;
        case 'C':
            return e.precision === undefined ? {state: 'C', value: e.value} : {state: 'C', value: e.value, precision: e.precision};
        case 'E': {
            const precision = statedPrecisionOf(e);
            return precision === undefined ? {state: 'E', value: e.value} : {state: 'E', value: e.value, precision};
        }
    }
}

function slimmedSection(section: unknown): unknown {
    if (!isRecord(section)) return section;
    const entries: [string, unknown][] = [];
    for (const [key, entry] of Object.entries(section)) {
        const slim = slimmedEntry(entry);
        if (slim !== undefined) entries.push([key, slim]);
    }
    return Object.fromEntries(entries);
}

function slimmedSpecs(specs: unknown): unknown {
    if (!isRecord(specs)) return specs;
    return Object.fromEntries(Object.entries(specs).map(([section, entries]) => [section, slimmedSection(entries)]));
}

/** The quality summary the schema requires, with nothing in it. */
function emptyQuality(): Readonly<Record<string, readonly unknown[]>> {
    return {missing: [], invalid: [], parse_errors: [], cross_source_only: []};
}

function slimmedDevice(device: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    const slim: Record<string, unknown> = {};
    if ('uuid' in device) slim.uuid = valueOnly(device.uuid);
    slim.quality = emptyQuality();
    for (const key of NAME_KEYS) if (key in device) slim[key] = valueOnly(device[key]);
    if ('sku' in device) slim.sku = device.sku;
    if ('driver_type' in device) slim.driver_type = valueOnly(device.driver_type);
    slim.data_sources = {value: {}};
    for (const key of EDITOR_TEXT_KEYS) if (key in device) slim[key] = valueOnly(device[key]);
    if ('specs' in device) slim.specs = slimmedSpecs(device.specs);
    return slim;
}

function slimmedProject(project: unknown): unknown {
    if (!isRecord(project) || !isRecord(project.driverEmbedding) || !isRecord(project.driverEmbedding.device)) return project;
    return {...project, driverEmbedding: {...project.driverEmbedding, device: slimmedDevice(project.driverEmbedding.device)}};
}

/** A project session with its saved and edited states' embedded drivers slimmed; anything that is
 *  not such a session comes back as it was. */
export function slimmedProjectSession(session: unknown): unknown {
    if (!isRecord(session)) return session;
    return {...session, saved: slimmedProject(session.saved), edited: slimmedProject(session.edited)};
}
