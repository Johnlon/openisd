import {describe, expect, it, vi} from 'vitest';
import {type DriverIssue, createEngine} from '@openisd/design/engine';
import {OpenISDDriver, ProjectBuilder, VoiceCoilWiring} from '../../domain/index.js';
import {fixedAppContext, scraped, wooferOf, specSection, tuneSpec, prSpecSection, driverFrom, driverJson} from '../fixtures/domainBuilders.js';

describe('OpenISDDriver record', () => {
  describe('OpenISDDriver.cloneDriver() — the persistence layer\'s one seam onto the raw record', () => {
    it('returns the record the driver holds, readable by a repo without any field access', () => {
      const driver = driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      });

      const record = driver.cloneDriver();
      expect(record.brand.value).toBe('Dayton');
      const fs = wooferOf(record)?.Fs_hz;
      if (fs?.state !== 'E') throw new Error('expected an entered Fs_hz entry');
      expect(fs.origin).toBeDefined();
    });

    it('a write to the driver after the call does not retroactively change the returned record', () => {
      const driver = driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      });

      const before = driver.cloneDriver();
      driver.specs.Fs_hz.set(99);
      const fsBeforeStr = JSON.stringify(wooferOf(before)?.Fs_hz);
      driver.specs.Fs_hz.set(99);

      // `before` is unmodified by the subsequent set.
      expect(wooferOf(before)?.Fs_hz).toBeDefined();
      expect(JSON.stringify(wooferOf(before)?.Fs_hz)).toBe(fsBeforeStr);
    });
  });

  describe('OpenISDDriver.issues() — the last resolve()\'s own diagnostic (S2-10: renamed from checkConsistency())', () => {
    it('reports no issues for a driver whose stated Qes/Qms are mutually consistent', () => {
      const driver = driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: tuneSpec({ Fs_hz: 40, Vas_m3: 0.00765, Qes: 0.45, Qms: 2.94, Re_ohm: 6.6 }),
      });
      const issues: readonly DriverIssue[] = driver.issues();
      expect(issues).toEqual([]);
    });

    it('reports an inconsistent-inputs issue when a stated Qts contradicts stated Qes/Qms', () => {
      // A driver stating ONLY Qts/Qes/Qms — deliberately minimal, so no OTHER relation (Fs/Mms/Cms,
      // Rms/Fs/Mms/Qms, ...) can also fire and make this test's one contradiction hard to isolate.
      // The gap is a gross error (32%), not a rounding artifact (D13/D12): Qts=0.4/Qes=0.45/Qms=2.94's
      // ~0.010 disagreement is fully absorbed by their own typed-to-two-decimals precision and, since
      // O2, correctly reports no issue at all — this fixture states a disagreement wide enough to
      // survive that.
      const driver = OpenISDDriver.empty(createEngine());
      driver.specs.Qts.set(0.60);
      driver.specs.Qes.set(0.50);
      driver.specs.Qms.set(4.75);
      // Qts=0.60 was stated directly; Qes/Qms imply ~0.452 — a gross, genuine contradiction.

      const issues = driver.issues();
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ kind: 'inconsistent-inputs', target: 'Qts', actual: 0.60 });
    });

    it('a derived Qts (T11: resolve() writes it back on load) reads back calculated, and issues() ' +
      'still agrees with itself rather than reporting the solved Qts as a contradiction of Qes/Qms', () => {
      const driver = driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: tuneSpec({ Fs_hz: 40, Vas_m3: 0.00765, Qes: 0.45, Qms: 2.94, Re_ohm: 6.6 }),
      });
      // S2-10: there is no longer a separate what-if `solveConsistencyGroup()` — `driverFrom()`'s
      // own `resolve()` (S2-7c, run once on load) already wrote the derived Qts back as 'C'.
      expect(driver.specs.Qts.calculated).toBe(true);
      expect(driver.specs.Qts.value).toBeCloseTo((0.45 * 2.94) / (0.45 + 2.94), 6);
      expect(driver.issues()).toEqual([]);
    });
  });

  describe('the driver — a window, not a copy', () => {
    it('reads and writes through to the record it was given', () => {
      const driver = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build().driver;

      expect(driver.specs.Fs_hz.value).toBe(30);
      driver.specs.Fs_hz.set(35);
      expect(driver.specs.Fs_hz.value).toBe(35);
      expect(driver.brand.value).toBe('Dayton');
    });

    it('driverType() answers the scraper-stated classification off the record, read-only', () => {
      const driver = driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      });

      expect(driver.driverType()).toBe('woofer');
    });

    it('the handle a caller holds survives every layer transition', async () => {
      // The failure this pins: components used to belong to a LAYER, and a write moves which
      // layer is effective — writing to committed opens an edit layer. A caller that bound the
      // handle once (the ordinary shape of UI code) then read stale values from its own first
      // edit onwards, so the write looked lost.
      const project = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build();
      const driver = project.driver;      // bound ONCE, before the edited state exists

      driver.specs.Fs_hz.set(35);               // creates the edited state under the caller's feet
      expect(driver.specs.Fs_hz.value).toBe(35);

      project.save();                     // the edited state is promoted; the handle must follow
      expect(driver.specs.Fs_hz.value).toBe(35);

      driver.specs.Fs_hz.set(40);               // a fresh edited state, again under the caller's feet
      expect(driver.specs.Fs_hz.value).toBe(40);

      await project.cancel(async () => true);   // and back to the saved state
      expect(driver.specs.Fs_hz.value).toBe(35);
    });

    it('what-if edits are transient and cancel preserves ordinary edits', () => {
      const project = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build();

      project.driver.specs.Fs_hz.set(35);
      project.beginWhatIf();
      expect(project.isWhatIfActive()).toBe(true);
      project.driver.specs.Fs_hz.set(40);
      expect(project.driver.specs.Fs_hz.value).toBe(40);

      project.cancelWhatIf();
      expect(project.isWhatIfActive()).toBe(false);
      expect(project.driver.specs.Fs_hz.value).toBe(35);
    });

    it('beginWhatIf() is a no-op once a what-if is already active — the running session is not restarted', () => {
      const project = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build();

      project.beginWhatIf();
      project.driver.specs.Fs_hz.set(40);
      project.beginWhatIf();

      expect(project.driver.specs.Fs_hz.value).toBe(40);
    });

    it('cancelWhatIf()/resetWhatIf() are no-ops when no what-if session is active', () => {
      const project = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build();

      expect(project.isWhatIfActive()).toBe(false);
      expect(() => project.cancelWhatIf()).not.toThrow();
      expect(() => project.resetWhatIf()).not.toThrow();
      expect(project.isWhatIfActive()).toBe(false);
      expect(project.driver.specs.Fs_hz.value).toBe(30);
    });

    it('what-if values are absent from the persisted session', () => {
      // A deterministic id — never randomly generated — removes the one way this test could fail
      // for a reason that has nothing to do with what it is testing: a random UUID happening to
      // contain the digits '40' inside it (the flake this fixture replaces, 2026-09-15).
      const appContext = fixedAppContext('11111111-1111-4111-8111-111111111111');
      const project = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine(), appContext).sealed().volume_m3(0.03).build();

      project.driver.specs.Fs_hz.set(35);
      project.beginWhatIf();
      project.driver.specs.Fs_hz.set(40);

      const session = project.cloneSession();
      // Proves the injected AppContext is actually wired in, not merely accepted and ignored —
      // the real `newUuid()` would never produce this exact string.
      expect(session.edited?.driverEmbedding.device.uuid.value).toBe('11111111-1111-4111-8111-111111111111');

      // Structural, not raw string containment (S2-7d2: the fixture's Fs/Mms/Cms are jointly
      // over-determined, so the cascade now also attaches a formula dq to Fs_hz — a real, separate
      // fact this test is not about; asserting on `state`/`value` alone keeps it that way).
      expect(session.edited && wooferOf(session.edited.driverEmbedding.device)?.Fs_hz).toMatchObject({ state: 'E', value: 35 });
      expect(wooferOf(session.saved.driverEmbedding.device)?.Fs_hz).toMatchObject({ state: 'E', value: 30 });
    });

    it('gives every field a STABLE identity across accesses', () => {
      const driver = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build().driver;

      // Identity must hold, or reference-equality memoization sees every read as a change.
      expect(driver.specs.Fs_hz).toBe(driver.specs.Fs_hz);
      expect(driver.brand).toBe(driver.brand);
    });

    it('makes a blank driver an editor can fill in, stating no specs at all', () => {
      const blank = OpenISDDriver.empty(createEngine());

      // The record's own bookkeeping (uuid, quality, the three name fields) is required by the
      // conformance guard, so a blank record carries empty names rather than absent ones.
      expect(blank.brand.value).toBe('');
      expect(blank.model.value).toBe('');
      // Every SPEC field, by contrast, is genuinely unstated — nothing to render, nothing to solve.
      expect(blank.specs.Fs_hz.value).toBe(null);
      expect(blank.specs.Fs_hz.value).toBeNull();
      expect(blank.specs.Qts.value).toBeNull();
    });

    it('a blank driver accepts edits, and the solver derives from what was stated', () => {
      const blank = OpenISDDriver.empty(createEngine());
      blank.brand.set('Dayton');
      blank.specs.Fs_hz.set(30);

      expect(blank.brand.value).toBe('Dayton');
      expect(blank.specs.Fs_hz.value).toBe(30);
    });

    it('sku accepts edits — a manufacturer\'s part number the editor writes, not scraper-only', () => {
      const blank = OpenISDDriver.empty(createEngine());
      blank.sku.set('W5-1138SMF');

      expect(blank.sku.value).toBe('W5-1138SMF');

      // No clear() — sku is mandatory, schema-guaranteed, with no "not entered" state to clear
      // to. Emptying it is set(''), same as brand/model.
      blank.sku.set('');
      expect(blank.sku.value).toBe('');
    });

    it('gives each blank driver its own record, so editing one leaves the next untouched', () => {
      const engine = createEngine();
      const one = OpenISDDriver.empty(engine);
      const two = OpenISDDriver.empty(engine);
      one.model.set('RS225');

      expect(two.model.value).toBe('');
    });

    it('stamps added from the injected AppContext, and providedBy from the platform user when known', () => {
      const appContext = fixedAppContext('id', '2026-03-04T00:00:00.000Z', 'johnl');
      const blank = OpenISDDriver.empty(createEngine(), appContext);

      expect(blank.added.value).toBe('20260304');
      expect(blank.providedBy.value).toBe('johnl');
    });

    it('pre: providedBy N | trigger: set \'jl\' | post: providedBy \'jl\' E', () => {
      const blank = OpenISDDriver.empty(createEngine(), fixedAppContext('id', '2026-03-04T00:00:00.000Z', null));
      blank.providedBy.set('jl');
      expect(blank.providedBy.value).toBe('jl');
      expect(blank.providedBy.entered).toBe(true);
    });

    it('leaves providedBy absent — never \'\' — when the platform user is not known', () => {
      const appContext = fixedAppContext('id', '2026-03-04T00:00:00.000Z', null);
      const blank = OpenISDDriver.empty(createEngine(), appContext);

      expect(blank.providedBy.value).toBeNull();
      // added is unconditional — it stamps even with no known platform user.
      expect(blank.added.value).toBe('20260304');
    });

    it('reports what is wrong with a record instead of throwing, so a picker can show it', () => {
      const noSection = driverJson({
        brand: 'Dayton', model: 'RS225', section: 'passive-radiator',
        spec: prSpecSection({ Fs_hz: 30, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      });

      const result = OpenISDDriver.fromConformingRecord(noSection, createEngine());

      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('no woofer section — this record is a passive radiator, nothing to simulate');
    });

    it('reports EVERY problem at once, not just the first', () => {
      const result = OpenISDDriver.fromConformingRecord({ brand: { value: 'Dayton', origin: 'x' } }, createEngine());

      expect(result).toEqual(expect.arrayContaining([
        expect.stringContaining("'model'"),
        expect.stringContaining("'manufacturer'"),
        expect.stringContaining("'uuid'"),
      ]));
    });

    it('says nothing about SECTIONS of a record that is not a record', () => {
      // A section fault is a statement about a device's specs. This value has no specs and is not
      // a record at all, so "no woofer section" would be a second-hand restatement of
      // "'specs' is missing" — the same fault, worded as if it were another one.
      const result = OpenISDDriver.fromConformingRecord({ brand: { value: 'Dayton', origin: 'x' } }, createEngine());

      expect(result).toEqual(expect.arrayContaining([expect.stringContaining("'specs'")]));
      expect(result).not.toEqual(expect.arrayContaining([
        expect.stringContaining('no woofer section'),
      ]));
    });

    it('names EVERY bad reading inside one spec field, not just the first', () => {
      // Two faults in ONE field's readings. A walk that returns on its first fault reports the
      // datasheet reading and stops, so the picker shows a reader one problem, they fix it, and
      // are then shown the next — which is what "every problem at once" is supposed to prevent.
      const record = {
        brand: { value: 'Dayton' },
        model: { value: 'RS225' },
        manufacturer: { value: 'Dayton' },
        uuid: { value: '00000000-0000-4000-8000-000000000000' },
        sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
        driver_type: { value: 'woofer' },
        data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
        quality: {
          confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
          parse_errors: [], cross_source_only: [],
        },
        specs: {
          woofer: {
            Fs_hz: {
              state: 'E', value: 30,
              origin: 'datasheet',
              readings: {
                datasheet: { read_value: 'thirty' },
                measured: { read_value: null },
              },
            },
          },
        },
      };

      const result = OpenISDDriver.fromConformingRecord(record, createEngine());

      expect(result).toEqual(expect.arrayContaining([
        expect.stringContaining('specs.woofer.Fs_hz.readings.datasheet.read_value'),
        expect.stringContaining('specs.woofer.Fs_hz.readings.measured.read_value'),
      ]));
    });

    it('detach() yields an instance that no longer shares storage with the original', () => {
      const original = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build().driver;

      const copy = original.detach();
      copy.specs.Fs_hz.set(99);

      expect(copy.specs.Fs_hz.value).toBe(99);
      expect(original.specs.Fs_hz.value).toBe(30);
    });
  });

  describe('OpenISDDriver — provenance the driver picker reads', () => {
    const driverWithProvenance = () => {
      const base = driverJson({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      });
      const record = {
        ...base,
        series: scraped('Reference Series'),
        description: scraped('an 8 inch reference woofer'),
        data_sources: { value: {
          manufacturer_datasheet: 'https://example.invalid/ds.pdf',
          manufacturer_product_page: 'https://example.invalid/product',
        } },
      };
      const result = OpenISDDriver.fromConformingRecord(record, createEngine());
      if (Array.isArray(result)) throw new Error(`fixture invalid: ${result.join(', ')}`);
      return result;
    };

    it('dataSource(role) returns the recorded URL for that role, or null when absent', () => {
      const driver = driverWithProvenance();
      expect(driver.dataSource('manufacturer_datasheet')).toBe('https://example.invalid/ds.pdf');
      expect(driver.dataSource('manufacturer_product_page')).toBe('https://example.invalid/product');
      expect(driver.dataSource('manufacturer_listing_page')).toBeNull();
    });

    it('series / description read straight off the record as read-only cells', () => {
      const driver = driverWithProvenance();
      // Catalogue facts carry no provenance: a bare `Readable`, so `value` is the whole read.
      expect(driver.series.value).toBe('Reference Series');
      expect(driver.description.value).toBe('an 8 inch reference woofer');
    });

    it('sku reads straight off the record, and the editor can write it', () => {
      const driver = driverWithProvenance();
      // sku is schema-guaranteed (derivedFieldOf(z.string())) — never not-available, so its
      // `value` is plain `string`, not `string | null`, with no null-check needed to prove it.
      const sku: string = driver.sku.value;
      expect(sku).toBe('TEST-SKU');
    });

    it('series and description are not-available when the record omits them', () => {
      const driver = driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      });
      expect(driver.series.value).toBeNull();
      expect(driver.series.value).toBe(null);
      expect(driver.description.value).toBeNull();
      expect(driver.description.value).toBe(null);
    });
  });

  describe('a spec field the record does not state resolves on write (T11/S2-7c)', () => {
    // T11 (2026-09-16) supersedes the earlier QO127 "stated-only" ruling: a driver's own writes
    // now trigger a resolve that writes every derivable field back into the record as `'C'` —
    // the record itself is a cache the solver keeps current, not a value computed fresh at read
    // time and never stored.

    /** A driver stating Vas and Sd and nothing else derivable — the solver's geometry route to
     *  Cms (`solver.ts` block 4) needs exactly those two plus the air constants, which a driver
     *  always has. */
    function vasAndSd(): OpenISDDriver {
      const d = OpenISDDriver.empty(createEngine());
      d.specs.Vas_m3.set(0.05);
      d.specs.Sd_m2.set(0.02);
      return d;
    }

    it('Cms comes back calculated from the stated Vas and Sd', () => {
      const cms = vasAndSd().specs.Cms_m_per_N;
      expect(cms.calculated).toBe(true);
      // Cms = Vas / (ρ·c²·Sd²) — the same relation, evaluated here from the driver's own air
      // constants rather than from a constant copied into this test.
      const air = vasAndSd().specs;
      const rho = air.roo_kg_per_m3.value!;
      const c = air.c_m_per_s.value!;
      expect(cms.value).toBeCloseTo(0.05 / (rho * c * c * 0.02 * 0.02), 12);
    });

    it('a stated value still reads entered — the solver never overrides what the record says', () => {
      const d = vasAndSd();
      d.specs.Cms_m_per_N.set(0.000123);
      const cms = d.specs.Cms_m_per_N;
      expect(cms.entered).toBe(true);
      expect(cms.value).toBe(0.000123);
    });

    it('a field the solver cannot reach stays not-available', () => {
      // Nothing in the record implies Xmax, so the distinction between "absent" and "derived"
      // survives — a solver that answered everything would be no better than a blank.
      expect(vasAndSd().specs.Xmax_m.value).toBe(null);
    });

    it('the solved value IS written into the record, as a calculated entry (T11)', () => {
      // The whole point of T11: a resolve runs on every write, and a derivable field's cell is
      // backed by a real `'C'` entry in the record — not recomputed fresh at every read with
      // nothing persisted.
      const d = vasAndSd();
      const entry = wooferOf(d.cloneDriver())?.Cms_m_per_N;
      expect(entry).toMatchObject({ state: 'C' });
      expect(entry?.value).toBeCloseTo(d.specs.Cms_m_per_N.value!, 12);
    });

    it('changing a stated input changes what the derived field reports', () => {
      // A cached solve that never invalidated would pass every test above and still be wrong.
      const d = vasAndSd();
      const before = d.specs.Cms_m_per_N.value!;
      d.specs.Vas_m3.set(0.10);
      expect(d.specs.Cms_m_per_N.value!).toBeCloseTo(before * 2, 12);
    });
  });

  describe('OpenISDDriver — resolves on every write (S2-7c)', () => {
    /** Qes+Qms entered, nothing else — Qts = Qes·Qms/(Qes+Qms) is the one relation this can
     *  derive; every OTHER relation needs at least one field this driver never states. */
    function qesQms(): OpenISDDriver {
      const d = OpenISDDriver.empty(createEngine());
      d.specs.Qes.set(0.4);
      d.specs.Qms.set(3.0);
      return d;
    }

    it('a derivable field is written into the record as a calculated entry right after construction', () => {
      const d = qesQms();
      const entry = wooferOf(d.cloneDriver())?.Qts;
      expect(entry).toMatchObject({ state: 'C' });
      expect(entry?.value).toBeCloseTo((0.4 * 3.0) / (0.4 + 3.0), 12);
    });

    it('setting a field the record already resolved from changes the dependent calculated entry', () => {
      const d = qesQms();
      d.specs.Qms.set(6.0);
      const entry = wooferOf(d.cloneDriver())?.Qts;
      expect(entry?.value).toBeCloseTo((0.4 * 6.0) / (0.4 + 6.0), 12);
    });

    it('an entered Qts survives a resolve untouched, even though it disagrees with Qes/Qms', () => {
      const d = qesQms();
      d.specs.Qts.set(111111);
      const entry = wooferOf(d.cloneDriver())?.Qts;
      // Not `toEqual`: S2-7d2 also projects the group's formula dq onto every disagreeing field —
      // a real, separate fact from what this test is pinning (the VALUE is never overwritten).
      expect(entry).toMatchObject({ state: 'E', value: 111111 });
    });

    it('clearing a field the resolve depended on removes the now-underivable calculated entry', () => {
      const d = qesQms();
      expect(wooferOf(d.cloneDriver())?.Qts).toMatchObject({ state: 'C' });
      d.specs.Qes.clear();
      expect(wooferOf(d.cloneDriver())?.Qts).toBeUndefined();
      expect(d.specs.Qts.value).toBe(null);
    });

    it('exactly one engine.solveDriver call happens per field set()', () => {
      const engine = createEngine();
      const d = OpenISDDriver.empty(engine);
      d.specs.Qes.set(0.4);
      const spy = vi.spyOn(engine.driver, 'solve');
      d.specs.Qms.set(3.0);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('a not-entered c_m_per_s lands in the record as a calculated entry equal to the driver\'s own air', () => {
      const engine = createEngine();
      const d = OpenISDDriver.empty(engine);
      const air = engine.environment.solve({}).values;
      const entry = wooferOf(d.cloneDriver())?.c_m_per_s;
      expect(entry).toMatchObject({ state: 'C', value: air.c });
    });

    // VCCon follows the same route as c_m_per_s above: the default is a STORED 'C' entry, so a
    // saved driver states its wiring instead of leaving the reader to guess the app's default.
    // John, 2026-09-24: "simply no reason for these exceptions to the rule".

    it('an entered VCCon is stored as an entered entry and survives a later resolve', () => {
      const d = OpenISDDriver.empty(createEngine());
      d.specs.VCCon.set(VoiceCoilWiring.Series);
      d.specs.Qes.set(0.4);
      expect(wooferOf(d.cloneDriver())?.VCCon).toMatchObject({ state: 'E', value: 2 });
      expect(d.specs.VCCon.entered).toBe(true);
      expect(d.specs.VCCon.value).toBe(VoiceCoilWiring.Series);
    });

    it('clearing VCCon restamps the calculated default rather than leaving the record silent', () => {
      const d = OpenISDDriver.empty(createEngine());
      d.specs.VCCon.set(VoiceCoilWiring.Series);
      d.specs.VCCon.clear();
      expect(wooferOf(d.cloneDriver())?.VCCon).toMatchObject({ state: 'C', value: 1 });
      expect(d.specs.VCCon.calculated).toBe(true);
    });

    it('a record stating VCCon=2 reads back as an entered series wiring, not as the default', () => {
      const d = OpenISDDriver.empty(createEngine());
      d.specs.VCCon.set(VoiceCoilWiring.Series);
      const reopened = d.detach();
      expect(reopened.specs.VCCon.value).toBe(VoiceCoilWiring.Series);
      expect(reopened.specs.VCCon.entered).toBe(true);
      expect(wooferOf(reopened.cloneDriver())?.VCCon).toMatchObject({ state: 'E', value: 2 });
    });
  });
});
