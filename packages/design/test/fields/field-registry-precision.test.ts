import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/index.js';

// BUG_20260821_rme_mcost_numinput_precision_defaults_to_2_not_registry_5: Rme and Mcost are
// declared at 5 decimals (WinISD prints 5). A value in the editor is formatted by its field, so
// it must carry those 5 decimals.
describe('Rme and Mcost display at the registry precision', () => {
  it('Rme formats with 5 decimals', () => {
    expect(NumberField.RME_KG_PER_S.precision).toBe(5);
    expect(NumberField.RME_KG_PER_S.format(0.12345, undefined, 'kg/s')).toBe('0.12345');
  });

  it('Mcost formats with 5 decimals', () => {
    expect(NumberField.MCOST_KG_PER_S.precision).toBe(5);
    expect(NumberField.MCOST_KG_PER_S.format(0.5, undefined, 'kg/s')).toBe('0.50000');
  });
});
