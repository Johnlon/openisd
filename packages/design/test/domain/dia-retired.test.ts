/**
 * Dia is gone from the driver model (QO398, John 3 Nov 2026). Dd holds the diaphragm diameter;
 * WinISD renamed Dia to Dd in 0.50alpha3 and writes Dia=0, unmarked, in every file it saves.
 * OpenISD ignores Dia on .wdr import, writes Dia=0 unmarked on export, and drops an old Dia_m
 * from a stored record instead of refusing the record.
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
import {openIsdDriverToWinIsdDriver} from '../../domain/driverRecordConverter.js';
import {OpenISDDeviceJson} from '../../domain/openIsdDeviceJsonIo.js';
import {parseOwprSession} from '../../domain/project/projectSerialization.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..', '..', '..');
const SAVED_PROJECT = readFileSync(join(here, '..', 'fixtures', 'air-migration', 'saved-by-t375-sample_project_vented.owpr'), 'utf8');
const DIA_123 = readFileSync(join(ROOT, 'drivers', 'myprobes', 'per_field_and_misc', 's-dia-roundtrip-123.wdr'), 'utf8');

/** The `.wdr` value and ParState mark of one row. */
function rowOf(wdr: WinISDDriver, key: string): {value: string; state: string} {
    const cell = wdr.cell(key);
    return {value: cell.value, state: cell.state};
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

describe('Dia is not part of the driver model (QO398)', () => {
    it('a .wdr stating Dia=123 imports with no Dia, and exports Dia=0 unmarked', () => {
        const {record} = winISDDriverToOpenISDDeviceJson(WinISDDriver.fromWdrIni(DIA_123));
        assert.equal(JSON.stringify(record).includes('Dia_m'), false);
        const driver = OpenISDDriver.fromConformingRecord(record, createEngine());
        if (Array.isArray(driver)) throw new Error(driver.join(', '));
        assert.deepEqual(rowOf(openIsdDriverToWinIsdDriver(driver, []), 'Dia'), {value: '0', state: 'not-available'});
    });

    it('a stored record still carrying Dia_m loads, without it', () => {
        const {record} = winISDDriverToOpenISDDeviceJson(WinISDDriver.fromWdrIni(DIA_123));
        const parsed: unknown = JSON.parse(JSON.stringify(record));
        if (!isRecord(parsed) || !isRecord(parsed.specs) || !isRecord(parsed.specs.woofer)) throw new Error('fixture shape');
        parsed.specs.woofer.Dia_m = {state: 'E', value: 0.123, origin: 'manual', readings: {manual: {actual_reading: '0.123', read_value: 0.123}}};
        const result = OpenISDDeviceJson.fromDriverYmlRecord(parsed);
        if ('problems' in result) throw new Error(result.problems.join(', '));
        assert.equal(JSON.stringify(result.json).includes('Dia_m'), false);
    });

    it('a saved project whose driver still carries Dia_m loads, without it', () => {
        const parsed: unknown = JSON.parse(SAVED_PROJECT);
        if (!isRecord(parsed) || !isRecord(parsed.saved) || !isRecord(parsed.saved.driverEmbedding)) throw new Error('fixture shape');
        const device = parsed.saved.driverEmbedding.device;
        if (!isRecord(device) || !isRecord(device.specs) || !isRecord(device.specs.woofer)) throw new Error('fixture shape');
        device.specs.woofer.Dia_m = {state: 'E', value: 0.123, origin: 'manual', readings: {manual: {actual_reading: '0.123', read_value: 0.123}}};
        const result = parseOwprSession(JSON.stringify(parsed), () => 'p1');
        if ('errors' in result) throw new Error(result.errors.join(', '));
        assert.equal(JSON.stringify(result.session).includes('Dia_m'), false);
    });
});
