/**
 * The inputs the proof runs both schemas over: every driver record in the corpus, every driver
 * fixture in the openisd tests, and generated edge cases.
 *
 * A record file is prepared exactly as `OpenISDDeviceJson.fromDriverYmlRecord` prepares it before
 * the schema sees it: the `driver.yml`-only keys (`definition`, `scraper`, `scraper_meta`) are
 * removed at every depth and `uuid` is minted (here: a fixed one, so both sides see the same
 * input). The preparation is openisd's, not the schema's, so it is repeated here rather than
 * exported from the private module. A record written before the slim model (QO395) is then upgraded
 * the way a load does (`withSlimModel`), so the proof runs over records the schema can accept.
 */
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {parse as parseYaml} from 'yaml';
import {withSlimModel} from '../../packages/design/domain/slimModel.js';

export interface Case { readonly id: string; readonly input: unknown }

const DRIVER_YML_ONLY_KEYS: readonly string[] = ['definition', 'scraper', 'scraper_meta'];
const FIXED_UUID = '00000000-0000-4000-8000-000000000000';

function stripDriverYmlOnlyFields(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripDriverYmlOnlyFields);
    if (typeof value !== 'object' || value === null) return value;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
        if (DRIVER_YML_ONLY_KEYS.includes(key)) continue;
        out[key] = stripDriverYmlOnlyFields(v);
    }
    return out;
}

function prepared(value: unknown): unknown {
    const stripped = stripDriverYmlOnlyFields(value);
    if (typeof stripped !== 'object' || stripped === null || Array.isArray(stripped)) return stripped;
    const slim = withSlimModel(stripped);
    if (typeof slim !== 'object' || slim === null || Array.isArray(slim)) return slim;
    return {...slim, uuid: {value: FIXED_UUID}};
}

// The corpus holds `driver.json`/`openisd.json`; the openisd fixtures also hold `*.driver.yml`.
const RECORD_FILE = /^(driver|openisd)\.json$|\.(driver|openisd)\.(json|yml)$/;

function* walk(dir: string): Generator<string> {
    for (const name of readdirSync(dir).sort()) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) yield* walk(path);
        else if (RECORD_FILE.test(name)) yield path;
    }
}

/** A record file whose text is not JSON/YAML at all: no schema ever sees it, so it is no case. */
export interface Unreadable { readonly path: string; readonly reason: string }

/** Every record file under `root`, prepared, one case each, id = the path relative to `label`. */
export function recordCases(root: string, label: string): {cases: Case[]; unreadable: Unreadable[]} {
    const cases: Case[] = [];
    const unreadable: Unreadable[] = [];
    for (const path of walk(root)) {
        const text = readFileSync(path, 'utf-8');
        let value: unknown;
        try {
            value = path.endsWith('.yml') ? parseYaml(text) : JSON.parse(text);
        } catch (e) {
            unreadable.push({path, reason: String(e).split('\n')[0]});
            continue;
        }
        cases.push({id: `${label}:${relative(root, path)}`, input: prepared(value)});
    }
    return {cases, unreadable};
}

// ── Generated edge cases ──────────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

/** A record every side accepts, the base every edge case is a mutation of. */
function baseRecord(): Json {
    return {
        uuid: {value: FIXED_UUID},
        manufacturer: {value: 'Acme'},
        brand: {value: 'Acme'},
        model: {value: 'X1'},
        sku: {value: 'x1'},
        driver_type: {value: ['woofer']},
        data_sources: {value: {manufacturer_product_page: 'https://acme.example/x1'}},
        description: {value: 'A woofer'},
        specs: {
            woofer: {
                Fs_hz: {state: 'E', value: 40, precision: 0.5},
                Qts: {state: 'C', value: 0.4, precision: 0.01},
                Vas_m3: {state: 'E', value: 0.03},
                // The one entry that keeps its readings (the Driver Editor quotes them, QO420).
                Re_ohm: {state: 'N', readings: {
                    manufacturer_datasheet: {actual_reading: '40 Hz', read_value: 40, read_precision: 0.5,
                        reads: {text_layer: {actual_reading: '40 Hz', read_value: 40, read_precision: 0.5}, ocr_tesseract: {actual_reading: '-', read_value: null, read_precision: null}}},
                    manufacturer_product_page: {actual_reading: '40', read_value: 40, rejected: 'no-unit', note: 'at 2.83 V', conformed_reading: '40 Hz', conformed_by: 'unit-added'},
                }},
            },
        },
        curves: {impedance: {value: {type: 'impedance', data_format: 'csv', local_path: 'z.csv'}, origin: 'manufacturer_datasheet'}},
    };
}

const DELETE = Symbol('delete');

/** A copy of `value` with the JSON path `path` set to `v` (or the key removed, for `DELETE`). */
function set(value: unknown, path: readonly (string | number)[], v: unknown): unknown {
    if (path.length === 0) return v;
    const [head, ...rest] = path;
    if (Array.isArray(value)) {
        const copy: unknown[] = [...value];
        copy[Number(head)] = set(copy[Number(head)], rest, v);
        return copy;
    }
    if (typeof value === 'object' && value !== null) {
        const entries = new Map<string, unknown>(Object.entries(value));
        if (rest.length === 0 && v === DELETE) entries.delete(String(head));
        else entries.set(String(head), set(entries.get(String(head)), rest, v));
        return Object.fromEntries(entries);
    }
    throw new Error(`cannot set ${path.join('.')} on a ${typeof value}`);
}

export function edgeCases(): Case[] {
    const base = baseRecord();
    const woofer = ['specs', 'woofer'] as const;
    const fsEntry = [...woofer, 'Fs_hz'] as const;
    const noneEntry = [...woofer, 'Re_ohm'] as const;
    const reading = [...noneEntry, 'readings', 'manufacturer_datasheet'] as const;
    const mutations: [string, (string | number)[], unknown][] = [
        ...['uuid', 'manufacturer', 'brand', 'model', 'sku', 'driver_type', 'data_sources', 'specs']
            .map((k): [string, (string | number)[], unknown] => [`missing ${k}`, [k], DELETE]),
        ['unknown top key', ['bogus'], 1],
        ['unknown key in woofer', [...woofer, 'Bogus_x'], {state: 'E', value: 1}],
        ['unknown key in entry', [...fsEntry, 'bogus'], 1],
        ['unknown key in reading', [...reading, 'bogus'], 1],
        ['unknown key in reader read', [...reading, 'reads', 'text_layer', 'bogus'], 1],
        ['unknown reader', [...reading, 'reads', 'ocr_other'], {actual_reading: 'x', read_value: null, read_precision: null}],
        ['manufacturer.value is a number', ['manufacturer', 'value'], 5],
        ['specs is a string', ['specs'], 'x'],
        ['specs is a list', ['specs'], []],
        ['specs is null', ['specs'], null],
        ['specs neither section', ['specs'], {}],
        ['specs both sections', ['specs'], {woofer: {}, 'passive-radiator': {}}],
        ['specs with tweeter', ['specs', 'tweeter'], {Fs_hz: {state: 'E', value: 2000}}],
        ['specs woofer not an object', ['specs', 'woofer'], 5],
        ['specs bad entries in both sections', ['specs'], {woofer: {Fs_hz: {state: 'E', value: 'x'}}, tweeter: {Qts: {state: 'C'}}}],
        ['passive radiator record', ['specs'], {'passive-radiator': {Fs_hz: {state: 'E', value: 30}, Sd_m2: {state: 'C', value: 0.01}}}],
        ['passive radiator with Re', ['specs'], {'passive-radiator': {Re_ohm: {state: 'E', value: 4}}}],
        ['driver_type number', ['driver_type', 'value'], 5],
        ['driver_type list of numbers', ['driver_type', 'value'], [1]],
        ['driver_type empty list', ['driver_type', 'value'], []],
        ['driver_type duplicate', ['driver_type', 'value'], ['woofer', 'woofer']],
        ['driver_type bare string', ['driver_type', 'value'], 'woofer'],
        ['driver_type two roles', ['driver_type', 'value'], ['woofer', 'midrange']],
        ['driver_type null', ['driver_type', 'value'], null],
        ['series present', ['series'], {value: 'S'}],
        ['series null', ['series'], null],
        ['series missing value', ['series'], {note: 'x'}],
        ['data_sources unknown role', ['data_sources', 'value', 'other'], 'https://x'],
        ['data_sources empty', ['data_sources', 'value'], {}],
        ['authoritative present', ['authoritative'], {value: 'manufacturer_datasheet'}],
        ['entry is a number', [...fsEntry], 5],
        ['entry is null', [...fsEntry], null],
        ['entry missing state', [...fsEntry, 'state'], DELETE],
        ['entry bad state', [...fsEntry, 'state'], 'X'],
        ['entry value string', [...fsEntry, 'value'], '40'],
        ['entry value missing', [...fsEntry, 'value'], DELETE],
        ['entry precision zero', [...fsEntry, 'precision'], 0],
        ['entry precision negative', [...fsEntry, 'precision'], -1],
        ['entry precision null', [...fsEntry, 'precision'], null],
        ['entry corroboration present', [...fsEntry, 'corroboration'], 'MATCH'],
        ['reading read_value missing', [...reading, 'read_value'], DELETE],
        ['reading read_value null', [...reading, 'read_value'], null],
        ['reading note number', [...reading, 'note'], 5],
        ['reads empty', [...reading, 'reads'], {}],
        ['reads precision without value', [...reading, 'reads', 'text_layer'], {actual_reading: 'x', read_value: null, read_precision: 1}],
        ['reads value without precision', [...reading, 'reads', 'text_layer'], {actual_reading: 'x', read_value: 1, read_precision: null}],
        ['reads missing actual_reading', [...reading, 'reads', 'text_layer'], {read_value: 1, read_precision: null}],
        ['reads read_value string', [...reading, 'reads', 'text_layer', 'read_value'], '1'],
        ['reading rejected unparsed N/A', [...reading], {actual_reading: 'N/A', rejected: 'no-numeric-value'}],
        ['reading rejected unparsed banana with note', [...reading], {actual_reading: 'banana', rejected: 'no-numeric-value', note: 'x', conformed_reading: 'b', conformed_by: 'r'}],
        ['reading rejected unparsed no text', [...reading], {rejected: 'no-numeric-value'}],
        ['reading rejected parsed', [...reading], {actual_reading: '4 Ω', read_value: 40, read_precision: 0.5, rejected: 'ohm-glyph-merged-as-digit'}],
        ['reading rejected parsed without text', [...reading], {read_value: 40, rejected: 'ohm-glyph-merged-as-digit'}],
        ['reading parsed reason on unparsed shape', [...reading], {actual_reading: 'x', rejected: 'ohm-glyph-merged-as-digit'}],
        ['reading unparsed reason on parsed shape', [...reading], {actual_reading: 'x', read_value: 1, rejected: 'no-numeric-value'}],
        ['reading unrecognised reason unparsed', [...reading], {actual_reading: 'x', rejected: 'from-the-future'}],
        ['reading unrecognised reason parsed', [...reading], {actual_reading: 'x', read_value: 1, rejected: 'from-the-future', reads: {text_layer: {actual_reading: 'x', read_value: 1, read_precision: null}}}],
        ['reading rejected reason number', [...reading], {actual_reading: 'x', rejected: 5}],
        ['reading rejected with extra key', [...reading], {actual_reading: 'x', rejected: 'no-numeric-value', bogus: 1}],
        ['reading usable with extra key', [...reading], {actual_reading: 'x', read_value: 1, bogus: 1}],
        ['reading empty object', [...reading], {}],
        ['reading is a string', [...reading], 'x'],
        ['curves missing origin', ['curves', 'impedance', 'origin'], DELETE],
        ['curves bad payload', ['curves', 'impedance', 'value'], {type: 1}],
        ['curves empty', ['curves'], {}],
        ['curves null', ['curves'], null],
        ['uuid value number', ['uuid', 'value'], 1],
        ['uuid extra key', ['uuid', 'origin'], 'x'],
        // The slim model (QO395) refuses what stays in driver.json.
        ...[
            ['quality', {missing: [], invalid: [], parse_errors: [], cross_source_only: []}],
            ['categories', {value: [{label: 'Woofers', url: 'https://acme.example/woofers'}]}],
            ['nominal_size_cm', {value: 20}],
        ].map(([key, v]): [string, (string | number)[], unknown] => [`${String(key)} present`, [String(key)], v]),
        ['sku grounds present', ['sku', 'grounds'], [{origin: 'x', reading: 'X1'}]],
        ['manufacturer origin present', ['manufacturer', 'origin'], 'manufacturer_product_page'],
        ['description note present', ['description', 'note'], null],
        ['description readings present', ['description', 'readings'], {manufacturer_datasheet: 'A woofer'}],
        ['driver_type origin present', ['driver_type', 'origin'], 'manufacturer_product_page'],
        ['entry readings present', [...fsEntry, 'readings'], {manufacturer_datasheet: {actual_reading: '40 Hz', read_value: 40}}],
        ['entry dq_calculated present', [...fsEntry, 'dq_calculated'], []],
        ['calculated entry with origin', [...woofer, 'Qts', 'origin'], 'x'],
        ['calculated entry with readings', [...woofer, 'Qts', 'readings'], {}],
        ['not-available entry readings empty', [...noneEntry, 'readings'], {}],
        ['not-available entry readings absent', [...noneEntry, 'readings'], DELETE],
        ['not-available entry with a value', [...noneEntry, 'value'], 1],
        ['not-available entry readings not an object', [...noneEntry, 'readings'], []],
        ['distributor source', ['data_sources', 'value', 'distributor_datasheet'], 'https://parts.example/d.pdf'],
    ];
    const cases: Case[] = [{id: 'edge:base record', input: base}];
    for (const [name, path, v] of mutations) cases.push({id: `edge:${name}`, input: set(base, path, v)});
    for (const [name, v] of [['top is a list', []], ['top is a string', 'x'], ['top is null', null], ['top is a number', 5], ['top is empty object', {}]] as const) {
        cases.push({id: `edge:${name}`, input: v});
    }
    return cases;
}
