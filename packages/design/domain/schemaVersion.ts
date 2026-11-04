/**
 * Schema version numbers for saved data (QO395, John 4 Nov 2026). A saved project (.owpr), a saved
 * driver (.owdr, stored record) and openisd.json carry `schemaVersion`. The slim format is 3; a
 * file with none is 2. Load upgrades it one step at a time, on the parsed JSON, BEFORE the strict
 * schema reads it (the schema refuses undeclared keys, so removed fields must be gone first).
 * A file newer than this app knows is refused with a message saying so: never a blank, never a
 * silent drop of what the older app cannot read.
 */
import {withoutRetiredSpecKeys} from './retiredSpecKeys.js';

export const CURRENT_SCHEMA_VERSION = 3;
/** What a file with no `schemaVersion` is: everything saved before versions existed. */
export const UNVERSIONED_SCHEMA_VERSION = 2;

type PlainRecord = Record<string, unknown>;

/** One step: a value saved at `from`, as a value saved at `from + 1`. */
export interface UpgradeStep {
    readonly from: number;
    readonly upgrade: (value: PlainRecord) => PlainRecord;
}

export type UpgradeResult = {readonly value: unknown} | {readonly refusal: string};

function isRecord(v: unknown): v is PlainRecord {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function recordOr(upgraded: unknown, fallback: PlainRecord): PlainRecord {
    return isRecord(upgraded) ? upgraded : fallback;
}

/** 2 to 3: the retired spec keys go. */
const UPGRADE_STEPS: readonly UpgradeStep[] = Object.freeze([
    {from: 2, upgrade: (value: PlainRecord) => recordOr(withoutRetiredSpecKeys(value), value)},
]);

function versionOf(value: PlainRecord): number | string {
    if (!('schemaVersion' in value)) return UNVERSIONED_SCHEMA_VERSION;
    const v = value.schemaVersion;
    if (typeof v === 'number' && Number.isInteger(v) && v >= UNVERSIONED_SCHEMA_VERSION) return v;
    return `schemaVersion must be a whole number of ${UNVERSIONED_SCHEMA_VERSION} or more, not ${JSON.stringify(v)}.`;
}

/**
 * `value`, parsed from JSON and not yet validated, upgraded to `current`, with `schemaVersion`
 * set. `value` itself is not changed. A value that is not an object comes back as it was for the
 * schema to refuse.
 */
export function upgradeToCurrent(value: unknown, current: number = CURRENT_SCHEMA_VERSION, steps: readonly UpgradeStep[] = UPGRADE_STEPS): UpgradeResult {
    if (!isRecord(value)) return {value};
    const version = versionOf(value);
    if (typeof version === 'string') return {refusal: version};
    if (version > current) {
        return {refusal: `This file was saved by a newer OpenISD (schema version ${version}; this app reads up to ${current}). Please update the app to open it.`};
    }
    let upgraded: PlainRecord = value;
    for (let at = version; at < current; at++) {
        const step = steps.find(s => s.from === at);
        upgraded = step === undefined ? upgraded : step.upgrade(upgraded);
    }
    return {value: {...upgraded, schemaVersion: current}};
}
