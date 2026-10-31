import {describe, expect, it, vi} from 'vitest';
import type {SimpleField} from '../../domain/cell.js';
import {driverSection} from '../../domain/driver/driverSection.js';
import type {DriverDeviceJson} from '../../domain/openisdSchema.js';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {createEngine} from '../../engine/Engine.js';

describe('driverSection', () => {
  const woofer = {Fs_hz: {state: 'E' as const, value: 40}};
  const base = (specs: DriverDeviceJson['specs']): DriverDeviceJson => ({
    ...OpenISDDriver.empty(createEngine()).toOpenIsdDeviceJson(),
    specs,
  });

  it('reads the named section', () => {
    const slot: SimpleField<DriverDeviceJson> = {value: base({woofer}), set: vi.fn()};
    expect(driverSection(slot, 'woofer').value).toEqual(woofer);
  });

  it('reads an absent tweeter section as empty', () => {
    const slot: SimpleField<DriverDeviceJson> = {value: base({woofer}), set: vi.fn()};
    expect(driverSection(slot, 'tweeter').value).toEqual({});
  });

  it('writes a new tweeter section beside the woofer one', () => {
    const set = vi.fn();
    const slot: SimpleField<DriverDeviceJson> = {value: base({woofer}), set};
    const tweeter = {Fs_hz: {state: 'E' as const, value: 900}};
    driverSection(slot, 'tweeter').set(tweeter);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({specs: {woofer, tweeter}}));
  });
});
