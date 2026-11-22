import { describe, expect, it } from 'vitest';
import { DeviceName } from '../../cloud/deviceName.js';
import { conflictCopyName, deviceNameOfBody, setDeviceModelInBody, setProjectNameInBody } from '../../cloud/conflictNames.js';
import { DeviceId, DriverId, PrId, ProjectId, conflictKeptText, conflictKindWord } from '../../cloud/syncStatus.js';

const ANDROID_PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

describe('conflictNames', () => {
  it('names a kept copy "<name> (conflict, <day>, <device>)"', () => {
    const at = new Date(2026, 9, 13, 21, 5).getTime();
    const device = DeviceName.ofBrowser(ANDROID_PHONE_UA, 5);
    expect(conflictCopyName('Sub 12', device, at)).toBe('Sub 12 (conflict, 13 Oct 2026, Android phone)');
  });

  it('reads a saved driver\'s model, in the {value} form or bare, else its brand', () => {
    expect(deviceNameOfBody(JSON.stringify({ brand: { value: 'Dayton' }, model: { value: 'W5-1138SMF' } }))).toBe('W5-1138SMF');
    expect(deviceNameOfBody(JSON.stringify({ brand: 'Dayton', model: 'RSS265' }))).toBe('RSS265');
    expect(deviceNameOfBody(JSON.stringify({ brand: { value: 'Dayton' }, model: { value: '' } }))).toBe('Dayton');
    expect(deviceNameOfBody('not json')).toBeNull();
  });

  it('sets the model of a saved driver or radiator, keeping its form and other fields', () => {
    const body = JSON.stringify({ brand: { value: 'Dayton' }, model: { value: 'W5-1138SMF', unit: '' }, Fs: { value: '40' } });
    expect(JSON.parse(setDeviceModelInBody(body, 'W5-1138SMF (conflict, 14 Oct 2026, iPhone)'))).toEqual({
      brand: { value: 'Dayton' },
      model: { value: 'W5-1138SMF (conflict, 14 Oct 2026, iPhone)', unit: '' },
      Fs: { value: '40' },
    });
    expect(JSON.parse(setDeviceModelInBody(JSON.stringify({ model: 'X' }), 'Y'))).toEqual({ model: 'Y' });
    expect(setDeviceModelInBody('[1]', 'Y')).toBe('[1]');
  });

  it('says what was kept twice, naming the kind, the item and the other device', () => {
    const copy = {
      id: DriverId.of('d-2')!,
      name: 'W5-1138SMF (conflict, 14 Oct 2026, Windows PC)',
      item: 'W5-1138SMF',
      otherDevice: 'iPhone',
      from: DeviceId.of('dev-1')!,
      at_ms: 0,
    };
    expect(conflictKeptText(copy)).toBe('Driver "W5-1138SMF" kept both: yours and the copy from iPhone');
    expect(conflictKeptText({ ...copy, otherDevice: '' })).toBe('Driver "W5-1138SMF" kept both: yours and the copy from another device');
    expect(conflictKindWord(PrId.of('p')!)).toBe('Passive radiator');
    expect(conflictKindWord(ProjectId.of('p')!)).toBe('Project');
  });

  it('updates project name in .owpr JSON body', () => {
    const original = JSON.stringify({
      label: 'Sub 12',
      saved: { meta: { name: 'Sub 12' } },
      edited: null,
    });
    const updated = setProjectNameInBody(original, 'Sub 12 (conflict, phone, 13 Oct 2026, 21:05)');
    const parsed: unknown = JSON.parse(updated);
    expect(parsed).toMatchObject({
      label: 'Sub 12 (conflict, phone, 13 Oct 2026, 21:05)',
      saved: { meta: { name: 'Sub 12 (conflict, phone, 13 Oct 2026, 21:05)' } },
    });
  });

  it('updates meta.name in edited if present', () => {
    const original = JSON.stringify({
      label: 'Sub 12',
      saved: { meta: { name: 'Sub 12' } },
      edited: { meta: { name: 'Sub 12' } },
    });
    const updated = setProjectNameInBody(original, 'New Name');
    const parsed: unknown = JSON.parse(updated);
    expect(parsed).toMatchObject({
      label: 'New Name',
      saved: { meta: { name: 'New Name' } },
      edited: { meta: { name: 'New Name' } },
    });
  });
});