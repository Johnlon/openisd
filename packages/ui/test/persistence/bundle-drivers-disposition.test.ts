/**
 * The bundler's bundling gate — scripts/bundle-drivers.mjs / bundleProjection.mjs.
 *
 * QO79, FINAL (John, amended, verbatim: "tis is a fail - they shoudl be bundheld with the
 * usual health warnings visible in the UI"; QO81, John, verbatim: "it is improtant NOT DRIER
 * GETS EXCLIDED BECAUSE OF MISSIG SPEC PARAMS !!!!"): every structurally readable record
 * BUNDLES. Simulatability
 * (`recordIsSimulatable`, `packages/model/src/driverSimulatability.ts`) is DISPLAY
 * INFORMATION ONLY — the ⚠ health badge `driverRepo.ts::driverHasDqIssues` computes — never a
 * bundling gate. Datasheet completeness (`recordStandingIsOk`) was already settled wrong;
 * simulatability-gating is now settled wrong too, permanently. This file must never
 * reintroduce either as a bundling criterion.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parse as parseYaml } from 'yaml';
import { project, isBundlable } from '../../../../scripts/bundleProjection.mjs';
import { driverHasDqIssues } from '@openisd/persistence';
import { OpenISDDriver } from '@openisd/model';

describe('bundle-drivers — bundling gates on structural readability alone', () => {
  it('bundles a fully simulatable, structurally sound record', () => {
    const full = parseYaml(`
quality:
  rating: M
  missing: []
  parse_errors: []
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
    assert.equal(isBundlable(project(full)), true);
  });

  it('THE RULING: a structurally sound record with no Fs (not simulatable) still bundles, and driverHasDqIssues still flags it', () => {
    const notSimulatable = parseYaml(`
quality:
  rating: M
  missing: []
  parse_errors: []
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
  woofer: {}
`);
    const projected = project(notSimulatable);
    assert.equal(
      isBundlable(projected),
      true,
      'no driver is excluded for missing spec params (QO81) — Fs is a spec param like any other',
    );
    assert.equal(
      driverHasDqIssues({ name: 'x', record: OpenISDDriver.fromJsonRecord(projected.record) }),
      true,
      'the record still ships without a usable Fs, so the health-warning badge must fire',
    );
  });

  it('excludes a structurally unreadable record (no `specs` container at all)', () => {
    const unreadable = parseYaml(`
manufacturer:
  value: GRS
brand:
  value: GRS
model:
  value: 8FR-8
`);
    assert.equal('specs' in unreadable, false, 'the fixture must genuinely omit the key');
    assert.equal(isBundlable(project(unreadable)), false);
  });

  it('excludes a record that has `specs` but no `quality` block at all — the second throw class recordStandingIsOk would hit', () => {
    const noQuality = parseYaml(`
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
    assert.equal('quality' in noQuality, false, 'the fixture must genuinely omit the key');
    assert.equal(isBundlable(project(noQuality)), false);
  });

  it('QO81: a record with a non-empty quality.missing (Cms) still bundles', () => {
    const incomplete = parseYaml(`
quality:
  rating: M
  missing: [Cms]
  parse_errors: []
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
    assert.equal(isBundlable(project(incomplete)), true);
  });
});
