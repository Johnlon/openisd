import {describe, expect, it} from 'vitest';
import {DriverListMode} from '../../src/logic/driverListMode.js';

describe('DriverListMode', () => {
  it('distinguishes manage, choose, and information views', () => {
    expect(DriverListMode.Manage).toBe('manage');
    expect(DriverListMode.Pick).toBe('pick');
    expect(DriverListMode.Info).toBe('info');
  });
});
