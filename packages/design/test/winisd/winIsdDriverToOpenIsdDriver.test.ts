import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {WinIsdDriverConverter} from '../../domain/winIsdDriverConverter.js';
import {createEngine} from '../../engine/index.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus');

/** A real `driver.yml`: Dayton CE28N-4, a woofer-section record carrying `scraper_meta`. */
function daytonDriverYml(): string {
  return readFileSync(join(FIXTURES, 'dayton-ce28n-4.driver.yml'), 'utf8');
}

describe('winIsdDriverToOpenIsdDriver', () => {
  describe('winIsdDriverToOpenIsdDriver — the reverse direction, for .wdr/.owdr import', () => {
    it('a .wdr with a non-numeric stated field loads, leaves the field out and warns (T017: a .wdr text cell is never a reading)', () => {
      const engine = createEngine();
      const { wdr } = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(daytonDriverYml());
      assert.ok(wdr !== null);
      // Corrupt a mandatory, ParState-E ("Q") row so the record this text reads back as fails the
      // same schema that accepted the untouched fixture — a real .wdr's own reader disagreeing with
      // the driver seam, not a defect in the Dayton fixture (see the round-trip test above).
      const corrupted = wdr.replace(/^Qts=.*$/m, 'Qts=not-a-number');

      const { value, errors } = new WinIsdDriverConverter(engine).winIsdDriverToOpenIsdDriver(corrupted);

      assert.ok(value !== null, 'a non-numeric cell is left out, not a reason to refuse the driver');
      assert.ok(errors.some(e => e.level === 'warn' && e.field === 'Qts' && /not a number: left out/.test(e.message)),
        `expected a Qts warning, got: ${JSON.stringify(errors)}`);
    });
  });
});
