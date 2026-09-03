/**
 * The persistence boundary, exercised through the SAME composition the app uses
 * (`composeInMemoryApp`) — differing only in which store is installed.
 *
 * The point of these tests is the BOUNDARY, not the storage: this file imports only PUBLISHED
 * entry points — `@openisd/design` and `@openisd/design/browser`, never a relative path into the
 * package — so anything it cannot express is a gap in the API rather than a gap in the tests. It
 * never names a record type, because nothing outside the domain module can.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Engine } from '@openisd/design/engine';
import { assemble } from '../app/composition.js';
import { memoryStore } from '@openisd/design/browser';
import {
  newProject, conformingRecordToDriver,
  type ProjectRepo, type OpenISDProject, type OpenISDDriver,
} from '@openisd/design';

/** A conforming driver record, built inline so each test's data is readable where it is used. */
function aDriver(brand: string, model: string): OpenISDDriver {
  const scraped = <T,>(value: T) => ({ value, origin: 'test' });
  // A spec entry states no value of its own — the number lives on the reading `origin` names,
  // exactly as the corpus writes it.
  const num = (read_value: number) => ({ origin: 'test', readings: { test: { read_value } } });
  const record = {
    brand: scraped(brand), model: scraped(model), manufacturer: scraped(brand),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    // The scrape provenance every openisd.yml record carries (`model_openisd.py:55-73`). A
    // fixture without them is not a record, and the conformance guard says so.
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    // `sku` is a DERIVED field: no origin, but `grounds` carrying the evidence it was
    // derived from, at least one entry.
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
        Fs: num(30), Sd: num(0.02), Cms: num(0.0005),
        Mms: num(0.05), Rms: num(2), Xmax: num(0.008),
      },
    },
  };
  const driver = conformingRecordToDriver(record, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a conforming driver: ${driver.join('; ')}`);
  return driver;
}

/** A clock whose every reading is later than the last, so orderings are assertable. */
function tickingClock(): () => string {
  let n = 0;
  return () => `2026-01-01T00:00:${String(n++).padStart(2, '0')}.000Z`;
}

let repo: ProjectRepo;
beforeEach(() => { repo = assemble(memoryStore, tickingClock()).repo; });

function aProject(name: string, brand = 'Dayton', model = 'RS225'): OpenISDProject {
  const p = newProject(aDriver(brand, model), new Engine()).sealed().volume_m3(0.03).build();
  p.name.set(name);
  return p;
}

describe('save and load', () => {
  it('a saved project comes back with its design intact', () => {
    const p = aProject('Ported 8in v3');
    p.box.sealed.volume_m3.set(0.045);
    repo.save(p);

    const back = repo.load(repo.list()[0].id);
    if (Array.isArray(back)) throw new Error(back.join('; '));
    expect(back.box.sealed.volume_m3.get()).toBe(0.045);
    expect(back.name.get()).toBe('Ported 8in v3');
  });

  it('loading an id nothing is stored under reports the problem rather than throwing', () => {
    const back = repo.load('no-such-id');
    expect(Array.isArray(back)).toBe(true);
  });

  it('a loaded project ADOPTS the store key as its identity', () => {
    // Without this its next save would mint a new key and orphan the entry it came from —
    // reopening a design would silently duplicate it (BUG_20260826_reopening_a_stored_project…).
    const p = aProject('Reopened');
    repo.save(p);
    const id = repo.list()[0].id;

    const back = repo.load(id);
    if (Array.isArray(back)) throw new Error(back.join('; '));
    expect(back.uuid()).toBe(id);
    expect(back.uuid()).toBe(p.uuid());
  });

  it('editing a reopened project writes back to its own entry, never a second one', () => {
    const p = aProject('Ported 8in v3');
    repo.save(p);
    const back = repo.load(repo.list()[0].id);
    if (Array.isArray(back)) throw new Error(back.join('; '));

    back.box.sealed.volume_m3.set(0.05);
    repo.save(back);
    expect(repo.list()).toHaveLength(1);
  });

  it('saving twice under one project replaces its entry rather than adding one', () => {
    const p = aProject('Same project');
    repo.save(p);
    repo.save(p);
    expect(repo.list()).toHaveLength(1);
  });
});

describe('what gets written', () => {
  it('a cancelled edit never reaches the store', async () => {
    // There is no separate what-if layer any more: a what-if IS an edit the user throws away
    // (John 2026-08-27). So the property to hold is that a CANCELLED edit leaves no trace.
    const p = aProject('Exploring');
    p.box.sealed.volume_m3.set(0.030);
    p.save();
    repo.save(p);

    p.box.sealed.volume_m3.set(0.999);        // tried, then discarded
    await p.cancel(async () => true);
    repo.save(p);

    const back = repo.load(repo.list()[0].id);
    if (Array.isArray(back)) throw new Error(back.join('; '));
    expect(back.box.sealed.volume_m3.get()).toBe(0.030);
  });

  it('an open EDIT layer does reach the store — a save writes work in progress', () => {
    const p = aProject('Half-typed');
    p.box.sealed.volume_m3.set(0.077);   // creates the edited state, never saved by the user
    repo.save(p);

    const back = repo.load(repo.list()[0].id);
    if (Array.isArray(back)) throw new Error(back.join('; '));
    expect(back.box.sealed.volume_m3.get()).toBe(0.077);
  });
});

describe('listing', () => {
  it('two projects with the SAME NAME are two entries — the name is a label, not an identity', () => {
    repo.save(aProject('My Build'));
    repo.save(aProject('My Build'));
    const rows = repo.list();
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it('is ordered most-recently-modified first', () => {
    repo.save(aProject('older'));
    repo.save(aProject('newer'));
    expect(repo.list().map(r => r.name)).toEqual(['newer', 'older']);
  });
});

describe('delete is challenged', () => {
  it('deletes only when the challenge agrees', async () => {
    repo.save(aProject('Doomed'));
    const id = repo.list()[0].id;

    expect(await repo.remove(id, async () => false)).toBe('declined');
    expect(repo.list()).toHaveLength(1);

    expect(await repo.remove(id, async () => true)).toBe('deleted');
    expect(repo.list()).toHaveLength(0);
  });

  it('shows the challenge the entry actually about to be destroyed', async () => {
    repo.save(aProject('The real name'));
    const id = repo.list()[0].id;

    let shown = '';
    await repo.remove(id, async (entry) => { shown = entry.name; return false; });
    expect(shown).toBe('The real name');
  });

  it('does not challenge about a project that is not there', async () => {
    let asked = false;
    const outcome = await repo.remove('no-such-id', async () => { asked = true; return true; });
    expect(outcome).toBe('absent');
    expect(asked).toBe(false);
  });
});
