import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {OpenISDDeviceJson} from '../../domain/openIsdDeviceJsonIo.js';

const W5_RECORD = readFileSync(
  new URL('../../../ui/public/drivers/tang-band/w5-1138smf.json', import.meta.url), 'utf-8');

describe('retired driver field `authoritative`', () => {
  it('an old driver record that still carries it loads', () => {
    const old: unknown = {...JSON.parse(W5_RECORD), authoritative: {value: 'manufacturer_datasheet'}};
    const loaded = OpenISDDeviceJson.fromConformingRecord(old);
    expect('json' in loaded).toBe(true);
    if ('json' in loaded) expect(loaded.json).not.toHaveProperty('authoritative');
  });

  it('the current bundled record does not carry it', () => {
    expect(JSON.parse(W5_RECORD)).not.toHaveProperty('authoritative');
  });
});
