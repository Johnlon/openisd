/**
 * `WinISDDriver.build()` requires every one of the 48 `.wdr` keys. A caller that omits one has
 * drifted out of sync with `INI_ROWS` — a real incompatibility bug, never a normal absent-field
 * case (that is `state: 'not-available'`, a PRESENT cell with no value) — so `build()` throws
 * naming the missing keys, rather than reporting the gap via `missingKeys()` (removed) and
 * having `toWdrIni()` silently fill it later.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { WinISDDriver, INI_ROWS } from '../../winisd/winisdDriver.js';

describe('WinISDDriver.build() completeness', () => {
  it('throws, naming the missing keys, when the cells map omits some of the 48', () => {
    const cells = new Map([['Fs', { value: '40', state: 'entered' as const }]]);

    assert.throws(() => WinISDDriver.build({}, cells), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /47 of the 48/);
      assert.match(err.message, /roo/);
      assert.doesNotMatch(err.message, /\bFs\b,|\bFs\b$/);
      return true;
    });
  });

  it('succeeds when every one of the 48 keys is supplied', () => {
    const cells = new Map(INI_ROWS.map((key, i) =>
      [key, { value: String(100 + i), state: 'entered' as const }]));

    assert.doesNotThrow(() => WinISDDriver.build({}, cells));
  });
});
