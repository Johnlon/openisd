/**
 * `OpenISDDeviceJson` at its two boundaries: parsing an untrusted value (a conforming record, a
 * `driver.yml` record, JSON text) into one, and serialising one back to JSON. Split out of
 * `openisdSchema.ts` (that file declares data shapes only) — this is logic: stripping the keys
 * only `driver.yml` carries, minting a fresh identity, and a stable key order for a diff-quiet
 * save.
 */
import {newUuid} from './newUuid.js';
import {openISDDeviceJsonSchema} from './openisdSchema.js';
import type {OpenISDDeviceJson as OpenISDDeviceJsonRecord} from './openisdSchema.js';

// A local type alias, not a re-export statement: the re-export form (`export type {X} from 'Y'`)
// creates its own local binding for X, which then collides with the `export const OpenISDDeviceJson`
// below (TS2323, "Cannot redeclare exported variable"). A type alias declaration merges with a
// value declaration of the same name in the same file (same as the original combined file did),
// so consumers can still `import {OpenISDDeviceJson}` for the value or `import type
// {OpenISDDeviceJson}` for the type, from this one module.
export type OpenISDDeviceJson = OpenISDDeviceJsonRecord;

/** The keys `driver.yml` carries that an openisd record does not. `definition` sits at EVERY
 *  depth — on each metadata envelope, each `sku.grounds` entry and each spec entry — so removing
 *  them is a walk, not a top-level filter. */
const DRIVER_YML_ONLY_KEYS: readonly string[] = Object.freeze(['definition', 'scraper', 'scraper_meta']);

/**
 * The same value with every `driver.yml`-only key removed, at any depth.
 *
 *  `unknown` IN AND OUT IS APPROVED HERE, AND ONLY BECAUSE THIS FUNCTION IS PRIVATE (John,
 *  2026-09-09). It runs between the YAML parse and the strict schema, where the value genuinely
 *  has no type yet: the strip must happen first, because `z.strictObject` REFUSES an undeclared
 *  key rather than dropping it, and zod 4's loose mode passes unknown keys through instead of
 *  removing them. Because the function is not exported and `fromDriverYmlRecord` is the only way
 *  to reach it, no caller ever holds the untyped value — they get a validated
 *  `OpenISDDeviceJson`. Export this and the approval no longer holds.
 *
 *  Rebuilt rather than deleted from: the parsed object is the caller's own reference and must not
 *  be mutated by the thing reading it. A clone of the structure with only `DRIVER_YML_ONLY_KEYS`
 *  pruned — `specs` keys pass through untouched, because `driver.yml` already spells them the
 *  openisd way (`Fs_hz`, `Vas_m3`, …), so no canonicalisation belongs here.
 */
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

function freshDriverRecord(value: unknown): unknown {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
    return { ...value, uuid: { value: newUuid() } };
}

export function sortKeysDeep(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeysDeep);
    if (typeof value !== 'object' || value === null) return value;

    // Two ascending arms only: `Object.entries` never yields two entries sharing one key within
    // the same object, so `a === b` cannot occur here — there is no third, equal, outcome to
    // return 0 for.
    return Object.fromEntries(
        Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([k, v]) => [k, sortKeysDeep(v)]),
    );
}

export const OpenISDDeviceJson = Object.freeze({
    fromOpenisdDriverJson(jsonText: string): { json: OpenISDDeviceJson } | { problems: string[] } {
        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonText);
        } catch (e) {
            return {problems: [`not valid JSON: ${String(e)}`]};
        }
        return OpenISDDeviceJson.fromDriverYmlRecord(parsed);
    },

    toOpenisdDriverJson(json: OpenISDDeviceJson): string {
        const { uuid, ...withoutUuid } = json;
        void uuid;
        return JSON.stringify(sortKeysDeep(withoutUuid), null, 2);
    },

    fromConformingRecord(record: unknown): { json: OpenISDDeviceJson } | { problems: string[] } {
        const result = openISDDeviceJsonSchema.safeParse(record);
        if (result.success) return {json: result.data};
        return {
            problems: result.error.issues.map(issue => issue.path.length === 0
                ? issue.message
                : `'${issue.path.join('.')}': ${issue.message}`),
        };
    },

    /** A `driver.yml` record as an openisd one: drop the keys `driver.yml` carries and an openisd
     *  record does not, then validate what is left against the strict schema.
     *
     *  STRIP FIRST, THEN STRICT. The two cannot be one step: `z.strictObject` REFUSES an
     *  undeclared key rather than dropping it, so `scraper_meta`/`scraper`/`definition` have to be
     *  gone before the schema sees the record. Loosening the schema to strip them instead is not
     *  the alternative it looks like — zod 4's loose mode PASSES unknown keys through rather than
     *  removing them. */
    fromDriverYmlRecord(value: unknown): { json: OpenISDDeviceJson } | { problems: string[] } {
        return OpenISDDeviceJson.fromConformingRecord(freshDriverRecord(stripDriverYmlOnlyFields(value)));
    }
});
