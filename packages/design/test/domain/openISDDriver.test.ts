import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {createEngine} from '../../engine/Engine.js';

describe('OpenISDDriver.dataQualityWarnings', () => {
  it('names a value outside its plausible band, as a warning on that field', () => {
    const driver = OpenISDDriver.empty(createEngine());
    driver.specs.Fs_hz.set(1_000_000);
    const warnings = driver.dataQualityWarnings();
    const fs = warnings.find(w => w.field === 'Fs_hz');
    expect(fs).toMatchObject({level: 'warn', field: 'Fs_hz'});
    expect(fs?.message.length).toBeGreaterThan(0);
  });
});
