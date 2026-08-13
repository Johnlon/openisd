/**
 * The bundler's disposition guard — scripts/bundle-drivers.mjs.
 *
 * A record whose `disposition` is not `ok` is the pipeline's own verdict that the app
 * cannot use it (`incomplete` = missing a parameter the simulation engine needs, set by
 * winisd_tools `model_driver.py::is_incomplete_for_ui`). Such a record must never reach
 * the bundle, however complete its Fs/Sd look.
 *
 * The disposition lives at `quality.disposition.value` — winisd_tools
 * `model_driver.py::QualityBlock` leads the quality block with it, because the verdict and
 * the evidence for it are one statement. A guard that reads it anywhere else reads
 * `undefined` for every record and silently filters nothing.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parse as parseYaml } from 'yaml';
import { project, isBundlable } from '../../../../scripts/bundle-drivers.mjs';

/** One openisd.yml as winisd_tools writes it, trimmed to what the bundler reads. */
const record = (disposition: string) => parseYaml(`
quality:
  disposition:
    value: ${disposition}
    definition: "the record's standing — one of: ok, no-ts-published, incomplete"
  rating: M
manufacturer:
  value: GRS
brand:
  value: GRS
model:
  value: 8FR-8
sku:
  value: 8fr-8
driver_type:
  value: full-range
specs:
  woofer:
    Fs:
      origin: manufacturer_product_page
      readings:
        manufacturer_product_page:
          read_value: 45.0
`);

describe('bundle-drivers — disposition guard', () => {
  it('bundles a record whose disposition is ok', () => {
    assert.equal(isBundlable(project(record('ok'))), true);
  });

  it('excludes a record whose disposition is incomplete', () => {
    const projected = project(record('incomplete'));
    assert.equal(
      projected.disposition,
      'incomplete',
      'the disposition lives at quality.disposition.value; reading it anywhere else yields ' +
      'undefined for every record and the guard filters nothing',
    );
    assert.equal(isBundlable(projected), false);
  });
});
