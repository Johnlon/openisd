/**
 * The driver range and calc quality checks, as the `driver.yml` projection (and so the V8 bridge
 * `winisd_tools` calls) reports them. Rebuilt in openisd from the scraper's deleted
 * `semantic_dq` (winisd_tools bugs/BUG_20260823_f4-deleted-semantic-dq-range-calc-marks-no-longer-stamped.md,
 * ruling 2026-10-07): the first case is the bug's own exemplar, Visaton GF 200 with SPL = 1.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {WinIsdDriverConverter} from '../../domain/winIsdDriverConverter.js';
import {createEngine} from '../../engine/index.js';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus',
  'visaton-gf-200-2-x-4-ohm.driver.json');

/** The Visaton record's `driver.json` with one woofer reading replaced. JSON is YAML, so the
 *  text goes to the projection as it is. */
function gf200With(field: string, actualReading: string, value: number, precision: number): string {
  const record: unknown = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  if (typeof record !== 'object' || record === null || !('specs' in record)) throw new Error('fixture shape');
  const specs = record.specs;
  if (typeof specs !== 'object' || specs === null || !('woofer' in specs)) throw new Error('fixture shape');
  const woofer = specs.woofer;
  if (typeof woofer !== 'object' || woofer === null) throw new Error('fixture shape');
  Object.assign(woofer, {
    [field]: {
      definition: 'probe',
      readings: {manufacturer_product_page: {actual_reading: actualReading, read_precision: precision, read_value: value}},
    },
  });
  return JSON.stringify(record);
}

describe('driver range check through the driver.yml projection', () => {
  it('reports Visaton GF 200 with SPL = 1 as below the SPL minimum of 50, as a warn the tools read', () => {
    const result = new WinIsdDriverConverter(createEngine())
      .driverYmlToOpenisdAndWdr(gf200With('SPL_dB', '1 dB', 1, 0.5));

    expect(result.errors).toContainEqual({
      level: 'warn', field: 'SPL_dB', message: 'SPL_dB 1 is below the physical limit 50.',
    });
  });
});

describe('driver calc check through the driver.yml projection', () => {
  it('reports a stated Qts that Qes/Qms contradict as a warn on Qts', () => {
    // Qes 0.37 and Qms 4.12 imply Qts ≈ 0.34.
    const result = new WinIsdDriverConverter(createEngine())
      .driverYmlToOpenisdAndWdr(gf200With('Qts', '0.50', 0.5, 0.005));

    const qts = result.errors.filter(e => e.field === 'Qts');
    expect(qts.map(e => e.level)).toEqual(['warn']);
    expect(qts[0]?.message).toContain('Qts = Qes·Qms/(Qes+Qms)');
  });

  it('does not report the printed Qts 0.34 the datasheet rounds from 0.3397', () => {
    const result = new WinIsdDriverConverter(createEngine())
      .driverYmlToOpenisdAndWdr(gf200With('Qts', '0.34', 0.34, 0.005));

    expect(result.errors.filter(e => e.field === 'Qts')).toEqual([]);
  });
});
