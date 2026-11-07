/**
 * Saved projects (.owpr), saved drivers (.owdr, stored records) carry `schemaVersion` (QO395,
 * John 4 Nov 2026). The slim format writes 3; a file with none reads as 2. Load upgrades step by
 * step before the strict parse. A file with a newer number than the app knows is refused with an
 * "update the app" message, never blank and never silently dropped.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {WinISDDriver} from '@openisd/design/winisd';
import {OpenISDDriver} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {winISDDriverToOpenISDDeviceJson} from '../../domain/winIsdDriverImport.js';
import {OpenISDDeviceJson} from '../../domain/openIsdDeviceJsonIo.js';
import {CURRENT_SCHEMA_VERSION, UNVERSIONED_SCHEMA_VERSION, upgradeToCurrent} from '../../domain/schemaVersion.js';
import {owprTextOf, parseOwprSession, parseOwprSessionRepairing, storedTextOf} from '../../domain/project/projectSerialization.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..', '..', '..');
const SAVED_PROJECT = readFileSync(join(here, '..', 'fixtures', 'air-migration', 'saved-by-t375-sample_project_vented.owpr'), 'utf8');
const DIA_123 = readFileSync(join(ROOT, 'drivers', 'myprobes', 'per_field_and_misc', 's-dia-roundtrip-123.wdr'), 'utf8');

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The `schemaVersion` of a JSON text. */
function versionIn(text: string): unknown {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed.schemaVersion : undefined;
}

function deviceRecordOf(text: string): Record<string, unknown> {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) throw new Error('not an object');
    return parsed;
}

function projectWith(schemaVersion: unknown): string {
    const parsed: unknown = JSON.parse(SAVED_PROJECT);
    if (!isRecord(parsed)) throw new Error('fixture shape');
    return JSON.stringify({...parsed, schemaVersion});
}

function deviceRecord(): Record<string, unknown> {
    const {record} = winISDDriverToOpenISDDeviceJson(WinISDDriver.fromWdrIni(DIA_123));
    const parsed: unknown = JSON.parse(JSON.stringify(record));
    if (!isRecord(parsed)) throw new Error('fixture shape');
    return parsed;
}

describe('schema versions', () => {
    it('slim is 3 and an unversioned file is 2', () => {
        assert.equal(CURRENT_SCHEMA_VERSION, 3);
        assert.equal(UNVERSIONED_SCHEMA_VERSION, 2);
    });

    it('upgradeToCurrent stamps an unversioned value with the current version', () => {
        const result = upgradeToCurrent({a: 1});
        if ('refusal' in result) throw new Error(result.refusal);
        assert.deepEqual(result.value, {a: 1, schemaVersion: 3});
    });

    it('upgradeToCurrent leaves a current value as it was', () => {
        const result = upgradeToCurrent({a: 1, schemaVersion: 3});
        if ('refusal' in result) throw new Error(result.refusal);
        assert.deepEqual(result.value, {a: 1, schemaVersion: 3});
    });

    it('upgradeToCurrent refuses a newer version and says to update the app', () => {
        const result = upgradeToCurrent({schemaVersion: 4});
        if (!('refusal' in result)) throw new Error('expected a refusal');
        assert.match(result.refusal, /update the app/i);
        assert.match(result.refusal, /4/);
    });

    it('upgradeToCurrent refuses a version that is not a whole number of at least 2', () => {
        for (const bad of ['3', 1.5, 0, 1, -1, null]) {
            const result = upgradeToCurrent({schemaVersion: bad});
            assert.ok('refusal' in result, `accepted ${String(bad)}`);
        }
    });

    it('upgradeToCurrent applies the upgrade steps in order, once each', () => {
        const calls: number[] = [];
        const steps = [
            {from: 2, upgrade: (v: Record<string, unknown>) => { calls.push(2); return {...v, two: true}; }},
            {from: 3, upgrade: (v: Record<string, unknown>) => { calls.push(3); return {...v, three: true}; }},
        ];
        const result = upgradeToCurrent({}, 4, steps);
        if ('refusal' in result) throw new Error(result.refusal);
        assert.deepEqual(calls, [2, 3]);
        assert.deepEqual(result.value, {two: true, three: true, schemaVersion: 4});
    });

    it('a device record with a newer version is refused with the update message', () => {
        const result = OpenISDDeviceJson.fromConformingRecord({...deviceRecord(), schemaVersion: 99});
        if (!('problems' in result)) throw new Error('expected a refusal');
        assert.match(result.problems.join(' '), /update the app/i);
    });

    it('an unversioned device record loads and carries the current version', () => {
        const result = OpenISDDeviceJson.fromConformingRecord(deviceRecord());
        if ('problems' in result) throw new Error(result.problems.join(', '));
        assert.equal(result.json.schemaVersion, 3);
    });

    it('a saved driver (.owdr text) carries schemaVersion 3 and reads back', () => {
        const driver = OpenISDDriver.fromConformingRecord(deviceRecord(), createEngine());
        if (Array.isArray(driver)) throw new Error(driver.join(', '));
        const text = driver.toOwdrText();
        assert.equal(versionIn(text), 3);
        assert.ok(!Array.isArray(OpenISDDriver.fromOwdrText(text, createEngine())));
    });

    it('a .owdr with a newer version is refused with the update message', () => {
        const driver = OpenISDDriver.fromConformingRecord(deviceRecord(), createEngine());
        if (Array.isArray(driver)) throw new Error(driver.join(', '));
        const newer = JSON.stringify({...deviceRecordOf(driver.toOwdrText()), schemaVersion: 4});
        const back = OpenISDDriver.fromOwdrText(newer, createEngine());
        assert.ok(Array.isArray(back));
        assert.match(back.join(' '), /update the app/i);
    });

    it('an unversioned project loads; saving it writes 3, as a file and as stored text', () => {
        const loaded = parseOwprSession(SAVED_PROJECT, () => 'p1');
        if ('errors' in loaded) throw new Error(loaded.errors.join(', '));
        assert.equal(loaded.session.schemaVersion, 3);
        assert.equal(versionIn(owprTextOf(loaded.session)), 3);
        assert.equal(versionIn(storedTextOf(loaded.session)), 3);
    });

    it('a project with a newer version is refused by both parsers with the update message', () => {
        const strict = parseOwprSession(projectWith(4), () => 'p1');
        if (!('errors' in strict)) throw new Error('expected a refusal');
        assert.match(strict.errors.join(' '), /update the app/i);
        const repairing = parseOwprSessionRepairing(projectWith(4), () => 'p1');
        if (!Array.isArray(repairing)) throw new Error('expected a refusal, not a repair');
        assert.match(repairing.join(' '), /update the app/i);
    });
});
