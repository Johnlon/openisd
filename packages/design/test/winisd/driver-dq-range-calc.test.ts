/**
 * The driver range and calc quality checks, as the `driver.yml` projection (and so the V8 bridge
 * `winisd_tools` calls) reports them. Rebuilt in openisd from the scraper's deleted
 * `semantic_dq` (winisd_tools bugs/BUG_20260823_f4-deleted-semantic-dq-range-calc-marks-no-longer-stamped.md,
 * ruling 2026-10-07): the first case is the bug's own exemplar, Visaton GF 200 with SPL = 1.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {withNamedWiringReadings} from '../fixtures/scraperWiringShape.js';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import {createEngine} from '../../engine/Engine.js';
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus',
  'visaton-gf-200-2-x-4-ohm.driver.json');

/** The Visaton record's `driver.json` with one woofer reading replaced. JSON is YAML, so the
 *  text goes to the projection as it is. */
function gf200With(field: string, actualReading: string, value: number, precision: number): string {
  const record: unknown = JSON.parse(withNamedWiringReadings(readFileSync(FIXTURE, 'utf8')));
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
    const result = new DriverRecordConverter(createEngine())
      .driverYmlToOpenisdAndWdr(gf200With('SPL_dB', '1 dB', 1, 0.5));

    expect(result.errors).toContainEqual({
      level: 'warn', field: 'SPL_dB', message: 'SPL_dB 1 is below the physical limit 50.',
    });
  });
});

describe('an exact printed zero is not provided (QO935)', () => {
  // Accuton C51-6-286 prints Mms "0 g": a placeholder, the same as no figure. The field is not
  // available (the scraper keeps the zero as printed) and raises no physical-limit line.
  it.each([
    ['Mms_kg', '0 g'], ['Cms_m_per_N', '0 mm/N'], ['Rms_kg_per_s', '0 kg/s'], ['Le_H', '0 mH'], ['Xmax_m', '0 mm'],
  ])('%s printed as zero raises no physical-limit warning', (field, printed) => {
    const result = new DriverRecordConverter(createEngine())
      .driverYmlToOpenisdAndWdr(gf200With(field, printed, 0, 0.0005));

    expect(result.errors.filter(e => e.message.includes('physical limit'))).toEqual([]);
  });

  it('a negative figure in a positive field is still reported', () => {
    const result = new DriverRecordConverter(createEngine())
      .driverYmlToOpenisdAndWdr(gf200With('Mms_kg', '-1 g', -0.001, 0.0005));

    expect(result.errors.some(e => e.message.includes('physical limit'))).toBe(true);
  });
});

describe('driver calc check through the driver.yml projection', () => {
  it('reports a stated Qts that Qes/Qms contradict as a warn on Qts', () => {
    // Qes 0.37 and Qms 4.12 imply Qts ≈ 0.34.
    const result = new DriverRecordConverter(createEngine())
      .driverYmlToOpenisdAndWdr(gf200With('Qts', '0.50', 0.5, 0.005));

    const qts = result.errors.filter(e => e.field === 'Qts');
    expect(qts.map(e => e.level)).toEqual(['warn']);
    expect(qts[0]?.message).toContain('Qts = Qes·Qms/(Qes+Qms)');
  });

  it('does not report the printed Qts 0.34 the datasheet rounds from 0.3397', () => {
    const result = new DriverRecordConverter(createEngine())
      .driverYmlToOpenisdAndWdr(gf200With('Qts', '0.34', 0.34, 0.005));

    expect(result.errors.filter(e => e.field === 'Qts')).toEqual([]);
  });
});
