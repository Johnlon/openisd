import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expect} from 'vitest';
import {z} from 'zod';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {createEngine} from '../../engine/Engine.js';

const engine = createEngine();
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'scraper-driver-json');
const recordSchema = z.record(z.string(), z.unknown());
const BASE = recordSchema.parse(JSON.parse(readFileSync(join(FIXTURES, 'morel-tiw-634nd.driver.json'), 'utf8')));

/** One printed figure as the scraper stores it. `precision` is half the last printed digit, in SI like `value`. */
export interface Printed { readonly text: string; readonly value: number; readonly precision: number }

const reading = (p: Printed) => ({readings: {manufacturer_product_page: {actual_reading: p.text, read_value: p.value, read_precision: p.precision}}});

/** A scraper record made by `maker` whose woofer section prints exactly `specs` (and nothing else). */
export function printedRecord(maker: string, specs: Readonly<Record<string, Printed>>): string {
  const woofer = Object.fromEntries(Object.entries(specs).map(([field, p]) => [field, reading(p)]));
  return JSON.stringify({
    ...BASE,
    manufacturer: {value: maker, origin: 'manufacturer_product_page'},
    brand: {value: maker, origin: 'manufacturer_product_page'},
    specs: {woofer},
  });
}

/** The record through the bridge, loaded as the app loads it, and solved. */
export function projectPrinted(text: string): OpenISDDriver {
  const result = new DriverRecordConverter(engine).driverYmlToOpenisdAndWdr(text);
  expect(result.errors.filter(e => e.level === 'error')).toEqual([]);
  if (result.openisd === null) throw new Error('did not project');
  const driver = OpenISDDriver.fromConformingRecord(recordSchema.parse(JSON.parse(result.openisd)), engine);
  if (Array.isArray(driver)) throw new Error(driver.join('; '));
  driver.resolve();
  return driver;
}
