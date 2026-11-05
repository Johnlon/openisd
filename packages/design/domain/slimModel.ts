/**
 * The slim model (QO395, John 3 Nov 2026): openisd.json holds only what the app uses. A record or
 * project saved before `schemaVersion` 3 carries more: each source's readings and the winning
 * origin, the corroboration verdict, data-quality marks, a `quality` summary, a short code's
 * grounds, data sources other than links, categories and the nominal size. `withSlimModel` takes them
 * off a parsed JSON value, before the strict schema reads it, and keeps what the app reads.
 *
 * The one thing worked out from what goes: an entered value's stated precision, taken from the
 * winning reading's `read_precision`, else the entry's own `precision`, as `statedPrecisionOf` read
 * them. Everything else dropped lives on in driver.json.
 *
 * Kept on purpose: a not-available entry's readings, because the Driver Editor still says what
 * the maker printed under Re and BL (`unknownVoiceCoilReading`); QO420 decides whether that note
 * goes, and these readings with it.
 *
 * Idempotent, and run on a value already stamped 3 too: a build before this model wrote 3 with
 * the old shapes (T668), and those files must load.
 */

type PlainRecord = Record<string, unknown>;

function isRecord(v: unknown): v is PlainRecord {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The placeholder short code an old WinISD import stored (QO259). */
const IMPORT_PLACEHOLDER = 'WPR-IMPORT';
/** The text-like device fields that are `{value}` and nothing more once slim. */
const VALUE_ONLY_KEYS: readonly string[] = Object.freeze([
    'manufacturer', 'brand', 'model', 'sku', 'driver_type', 'series', 'product_image',
    'description', 'surround_material', 'provided_by', 'comment', 'added', 'uuid',
]);
/** Device keys the slim model does not have. */
const DROPPED_DEVICE_KEYS: readonly string[] = Object.freeze(['quality', 'authoritative', 'categories', 'nominal_size_cm']);
/** The links the app opens: the maker's three and, as a backup, the distributor's three (QO282). */
const KEPT_DATA_SOURCES: readonly string[] = Object.freeze([
    'manufacturer_datasheet', 'manufacturer_product_page', 'manufacturer_listing_page',
    'distributor_datasheet', 'distributor_product_page', 'distributor_listing_page',
]);

function positiveNumberOrUndefined(v: unknown): number | undefined {
    return typeof v === 'number' && v > 0 ? v : undefined;
}

/** The precision an old entered entry states: its winning usable reading's `read_precision`, else its own `precision`. */
function statedPrecision(entry: PlainRecord): number | undefined {
    const {origin, readings} = entry;
    const reading = typeof origin === 'string' && isRecord(readings) ? readings[origin] : undefined;
    const read = isRecord(reading) && !('rejected' in reading) ? positiveNumberOrUndefined(reading.read_precision) : undefined;
    return read ?? positiveNumberOrUndefined(entry.precision);
}

function slimEntry(entry: PlainRecord): PlainRecord {
    switch (entry.state) {
        case 'E': {
            const precision = statedPrecision(entry);
            return precision === undefined ? {state: 'E', value: entry.value} : {state: 'E', value: entry.value, precision};
        }
        case 'C': {
            const precision = positiveNumberOrUndefined(entry.precision);
            return precision === undefined ? {state: 'C', value: entry.value} : {state: 'C', value: entry.value, precision};
        }
        case 'N':
            return isRecord(entry.readings) && Object.keys(entry.readings).length > 0 ? {state: 'N', readings: entry.readings} : {state: 'N'};
        default:
            return entry;
    }
}

function isSpecEntry(v: PlainRecord): boolean {
    return v.state === 'E' || v.state === 'C' || v.state === 'N';
}

function isDeviceRecord(v: PlainRecord): boolean {
    return isRecord(v.specs) && 'model' in v;
}

function slimDataSources(field: unknown): unknown {
    if (!isRecord(field) || !isRecord(field.value)) return field;
    return {value: Object.fromEntries(Object.entries(field.value).filter(([key]) => KEPT_DATA_SOURCES.includes(key)))};
}

/** An old WinISD import stored the model as the short code, grounded on 'manual' alone: that is not a
 *  code. The grounds go with this upgrade, so the case is handed on as the import placeholder, which
 *  is cleared after the parse where the repair is reported (`withoutImportSku.ts`). */
function slimSku(device: PlainRecord): unknown {
    const sku = device.sku;
    if (!isRecord(sku)) return sku;
    const model = isRecord(device.model) ? device.model.value : undefined;
    const grounds = Array.isArray(sku.grounds) ? sku.grounds : [];
    const importedModel = sku.value !== '' && sku.value === model && grounds.length > 0 && grounds.every(g => isRecord(g) && g.origin === 'manual');
    return importedModel ? {value: IMPORT_PLACEHOLDER} : {value: sku.value};
}

/** A device record in the slim model: the bridge's own record, and anything `withSlimModel` finds. */
export function slimmedDevice(device: PlainRecord): PlainRecord {
    const slim: PlainRecord = {};
    for (const [key, v] of Object.entries(device)) {
        if (DROPPED_DEVICE_KEYS.includes(key)) continue;
        if (key === 'sku') slim[key] = slimSku(device);
        else if (key === 'data_sources') slim[key] = slimDataSources(v);
        else if (VALUE_ONLY_KEYS.includes(key) && isRecord(v) && 'value' in v) slim[key] = {value: v.value};
        else slim[key] = withSlimModel(v);
    }
    return slim;
}

/** `value`, parsed from JSON and not yet validated, as a copy in the slim model at every depth: a
 *  device record, a spec entry, or a project or session holding them. `value` is not changed. */
export function withSlimModel(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(withSlimModel);
    if (!isRecord(value)) return value;
    if (isSpecEntry(value)) return slimEntry(value);
    if (isDeviceRecord(value)) return slimmedDevice(value);
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, withSlimModel(v)]));
}
