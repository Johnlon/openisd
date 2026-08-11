import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { driverShort } from '../../src/logic/store.js';

// A driver is CALLED `<brand> <model>`. Brand leads because that is what the driver is sold
// and filed under — `driverId()` and the driver database's folders key on it, and WinISD's
// Save-Driver defaults to `<brand> <model>.wdr`. `manufacturer` is second-order: it appears
// only when it differs from the brand, and then as a trailing note.

describe('driverShort - the display/search name', () => {
  it('reads <brand> <model>, with no mention of an identical manufacturer', () => {
    const name = driverShort({
      manufacturer: 'Dayton Audio',
      brand: 'Dayton Audio',
      model: 'Epique Series E150HE-44',
    });
    assert.equal(name, 'Dayton Audio Epique Series E150HE-44');
  });

  it('trails a differing manufacturer as context, leaving brand in the lead', () => {
    const name = driverShort({
      manufacturer: 'SoundImports',
      brand: 'Dayton Audio',
      model: 'Epique Series E150HE-44',
    });
    assert.equal(name, 'Dayton Audio Epique Series E150HE-44 (SoundImports)');
  });

  it('falls back to manufacturer only when there is no brand', () => {
    assert.equal(driverShort({ manufacturer: 'Dayton Audio', model: 'E150HE-44' }),
      'Dayton Audio E150HE-44');
  });

  it('handles a missing manufacturer without stray spacing', () => {
    assert.equal(driverShort({ brand: 'Dayton Audio', model: 'E150HE-44' }),
      'Dayton Audio E150HE-44');
  });

  it('respects an explicit name — the user\'s own label wins', () => {
    assert.equal(driverShort({ name: 'Explicit Override Name', brand: 'Dayton Audio', model: 'E150HE-44' }),
      'Explicit Override Name');
  });

  it('falls back to "Driver" when nothing identifies it', () => {
    assert.equal(driverShort({}), 'Driver');
    assert.equal(driverShort(null), 'Driver');
  });
});
