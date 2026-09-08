import { describe, it, expect } from 'vitest';
import { Engine } from '@openisd/design/engine';
import { OpenISDProject, OpenISDDriver } from '../domain/index.js';

// This test is the package's PROXY CONSUMER: it imports from `index.js` only.
const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) =>
  ({ origin: 'scraped', readings: { scraped: { read_value } } });

function ventedProject() {
  const record = {
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    manufacturer: scraped('Dayton'), brand: scraped('Dayton'), model: scraped('RS225'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    authoritative: { value: 'manufacturer_datasheet' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs: spec(30), Qts: spec(0.4), Sd: spec(0.02), Cms: spec(0.0005),
        Mms: spec(0.05), Rms: spec(2), Xmax: spec(0.008),
      },
    },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return OpenISDProject.builder(driver, new Engine()).vented().volume_m3(0.03).tuning_hz(35).build();
}

/**
 * The six vent/PR group-solve methods report "nothing solved, nothing known".
 *
 * They answer the tuning ↔ paired-quantity relation — vent length on a vented box, added cone mass
 * on a passive-radiator one — which is NOT WIRED: `tuning_hz` is a stored value no calculation
 * consumes, and the forward/inverse methods that would close the loop have no callers. That
 * feature is ruled and scoped in QO126
 * (`bugs/BUG_20260908_tuning_and_its_paired_quantity_never_solve_each_other.md`).
 *
 * What is pinned here is the INTERIM contract, and specifically that these do not THROW:
 * `solveVentGroup()` runs on every project change (`packages/ui/src/logic/appState.ts`), so a
 * throw means no project can be opened at all. Doing nothing is what the app did before the
 * migration, when neither direction had a caller.
 *
 * These assertions are expected to CHANGE when QO126 lands — a solved pair makes
 * `ventAchievedFb()` return a real frequency. This file pins today's behaviour so that change is
 * deliberate and visible, not a silent drift.
 */
describe('vent-group solve/reachability — nothing wired, so nothing solved', () => {
  it('solveVentGroup() runs without throwing — the store calls it on every project change', () => {
    expect(() => ventedProject().solveVentGroup()).not.toThrow();
  });

  it('solveVentGroup() rewrites nothing, since no relation exists to solve through', () => {
    const p = ventedProject();
    const lengthBefore = p.box.vented.vent.length_m.get();
    const tuningBefore = p.box.vented.tuning_hz.get();

    p.solveVentGroup();

    expect(p.box.vented.vent.length_m.get()).toEqual(lengthBefore);
    expect(p.box.vented.tuning_hz.get()).toEqual(tuningBefore);
  });

  it('ventAchievedFb() reports no frequency', () => {
    expect(ventedProject().ventAchievedFb()).toBeNull();
  });

  it('ventMaxReachableFb() reports no ceiling', () => {
    expect(ventedProject().ventMaxReachableFb()).toBeNull();
  });

  it('ventTargetUnreachable() claims nothing is unreachable, rather than warning with nothing behind it', () => {
    expect(ventedProject().ventTargetUnreachable()).toBe(false);
  });
});

describe('PR-group solve/reachability — nothing wired, so nothing solved', () => {
  it('solvePrGroup() runs without throwing', () => {
    expect(() => ventedProject().solvePrGroup()).not.toThrow();
  });

  it('prTargetUnreachable() claims nothing is unreachable', () => {
    expect(ventedProject().prTargetUnreachable()).toBe(false);
  });
});
