/**
 * `ManagedDriver` — the one facade over every driver state layer (ARCHITECTURE.md §3
 * "`ManagedDriver` — the one facade over every state layer", `docs/design/STATE_MODEL.md`).
 *
 * Seam under test: the public API only — `beginEdit`/`commitEdit`/`cancelEdit`,
 * `beginWhatIf`/`cancelWhatIf`, `read`/`readModified`/`readGround`, `load`, `subscribe`.
 * Nothing reaches `#ground`/`#modified`/the overlay directly — those are private.
 *
 * These three scenarios ARE the specification (Step 10 brief): an edit session with N field
 * changes and a commit produces exactly ONE notification, at commit; a what-if session with N
 * scrubs produces N+2 notifications (N scrubs + begin + cancel); an edit session that never
 * commits produces ZERO notifications. A fourth, added by human ruling after `ARCHITECTURE.md`
 * §3 gained "a what-if never leaks into anything persistent": `beginEdit()` (and any other
 * read of modified state for a purpose beyond driving the open charts) cancels an active
 * what-if itself, as an observable side effect.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { OpenISDDriver } from '@openisd/model';
import { ManagedDriver } from '../../src/logic/managedDriver.js';

/** A minimal, valid record — one stated field (Fs), enough to exercise enter()/clear()
 *  without pulling in a fixture file this package does not own. Shape verified against
 *  `packages/model/test/openisdRecord.test.ts`'s own literal. */
function minimalRecord(): Parameters<typeof OpenISDDriver.fromRecord>[0] {
  return {
    uuid: { value: 'test-0000-0000-0000-000000000000', definition: 'stable record identity' },
    quality: {
      rating: 'M', confirmed_fields: ['Fs'], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: 'Acme', origin: 'manufacturer_datasheet', definition: 'the company that makes the driver', dq: [] },
    brand: { value: 'Acme', origin: 'manufacturer_datasheet', definition: 'the selling brand', dq: [] },
    model: { value: 'Test-1', origin: 'manufacturer_datasheet', definition: "the vendor's exact designation", dq: [] },
    sku: { value: 'test-1', definition: 'canonical identity code', grounds: [
      { origin: 'manufacturer_datasheet', reading: 'Test-1', definition: 'the printed designation' },
    ] },
    driver_type: { value: 'woofer', origin: 'manufacturer_datasheet', definition: 'what kind of driver this is', dq: [] },
    disposition: { value: 'ok', definition: "the record's own account of its standing", detail: 'complete' },
    data_sources: {
      value: { manufacturer_datasheet: 'https://example.invalid/acme-test-1.pdf' },
      definition: 'the record-wide provenance index',
    },
    authoritative: { value: 'manufacturer_datasheet', definition: 'which indexed source wins the datasheet waterfall' },
    specs: {
      woofer: {
        Fs: { origin: 'manufacturer_datasheet', readings: { manufacturer_datasheet: { read_value: 37, actual_reading: '37 Hz' } }, dq: [] },
      },
    },
  };
}

/** A fresh `OpenISDDriver` built from `minimalRecord()` — `ManagedDriver.create`/`load`
 *  take a driver, never a bare record (`OpenISDDriver` is the one external form). */
function minimalDriver(): OpenISDDriver {
  return OpenISDDriver.fromRecord(minimalRecord());
}

describe('ManagedDriver — notification asymmetry (the specification)', () => {
  it('an edit session with N field changes and a commit produces exactly ONE notification, at commit', () => {
    const md = ManagedDriver.create(minimalDriver());
    let notifications = 0;
    md.subscribe(() => { notifications++; });

    md.beginEdit();
    const draft = md.read();
    draft.enter('Fs', 40);
    draft.enter('Qts', 0.35);
    draft.enter('Vas', 0.03);
    assert.equal(notifications, 0, 'a draft edit must be silent while open');

    md.commitEdit();
    assert.equal(notifications, 1, 'commitEdit writes the draft into modified state — that write is the one notification');
  });

  it('a what-if session with N scrubs produces N+2 notifications (N scrubs + begin + cancel)', () => {
    const md = ManagedDriver.create(minimalDriver());
    let notifications = 0;
    md.subscribe(() => { notifications++; });

    md.beginWhatIf();
    assert.equal(notifications, 1, 'beginWhatIf notifies — it changes which layer resolves');

    const overlay = md.read();
    overlay.enter('Fs', 41);
    overlay.enter('Qts', 0.36);
    overlay.enter('Vas', 0.031);
    assert.equal(notifications, 4, 'every change to the live overlay notifies immediately');

    md.cancelWhatIf();
    assert.equal(notifications, 5, 'cancelWhatIf notifies — it changes which layer resolves back');
  });

  it('an edit session that never commits produces ZERO notifications', () => {
    const md = ManagedDriver.create(minimalDriver());
    let notifications = 0;
    md.subscribe(() => { notifications++; });

    md.beginEdit();
    const draft = md.read();
    draft.enter('Fs', 40);
    draft.enter('Qts', 0.35);
    md.cancelEdit();

    assert.equal(notifications, 0, 'cancelEdit discards the draft without ever writing modified state');
  });
});

describe('ManagedDriver — a what-if never leaks into anything persistent (ARCHITECTURE.md §3)', () => {
  it('beginEdit() cancels an active what-if itself, as an observable side effect', () => {
    const md = ManagedDriver.create(minimalDriver());
    let notifications = 0;
    md.subscribe(() => { notifications++; });

    md.beginWhatIf();
    assert.equal(md.isWhatIfActive(), true);
    assert.equal(notifications, 1, 'beginWhatIf notified once');

    md.beginEdit();

    assert.equal(md.isWhatIfActive(), false, 'the what-if must be gone, not merely superseded');
    assert.equal(notifications, 2, "the cancel's own notification fired — beginEdit() itself stays silent");
    assert.equal(md.isEditActive(), true);
  });

  it('readModified() — the path saving/exporting/sharing must use — cancels an active what-if itself', () => {
    const md = ManagedDriver.create(minimalDriver());

    md.beginWhatIf();
    md.read().enter('Fs', 99);   // an unverified scrub, live on the overlay only

    md.readModified();

    assert.equal(md.isWhatIfActive(), false, 'a save/export must never observe the live overlay');
    assert.equal(md.readModified().cell('Fs').value, 37, 'modified state was never touched by the what-if');
  });

  it('load() cancels an active what-if before adopting the new driver', () => {
    const md = ManagedDriver.create(minimalDriver());
    md.beginWhatIf();
    assert.equal(md.isWhatIfActive(), true);

    md.load(minimalDriver());

    assert.equal(md.isWhatIfActive(), false);
  });

  it('beginWhatIf() discards an active edit draft — never both at once', () => {
    const md = ManagedDriver.create(minimalDriver());
    md.beginEdit();
    md.read().enter('Fs', 12345);   // typed into the draft, never committed
    assert.equal(md.isEditActive(), true);

    md.beginWhatIf();

    assert.equal(md.isEditActive(), false);
    assert.equal(md.isWhatIfActive(), true);
    assert.equal(md.readModified().cell('Fs').value, 37, 'the discarded draft never reached modified state');
  });
});

describe('ManagedDriver — cancelEdit() is byte-identical (docs/design/STATE_MODEL.md rule 3)', () => {
  it('modified state after cancelEdit() matches modified state before beginEdit(), provenance included', () => {
    const md = ManagedDriver.create(minimalDriver());
    const before = JSON.stringify(md.readModified().toRecord());

    md.beginEdit();
    md.read().enter('Fs', 999);
    md.read().enter('Qts', 0.9);
    md.cancelEdit();

    const after = JSON.stringify(md.readModified().toRecord());
    assert.equal(after, before);
  });
});

describe('ManagedDriver — read() resolves to the highest layer that exists', () => {
  it('resolves to modified state with no overlay open', () => {
    const md = ManagedDriver.create(minimalDriver());
    assert.equal(md.read().cell('Fs').value, 37);
  });

  it('resolves to the what-if overlay while one is active, without touching modified state', () => {
    const md = ManagedDriver.create(minimalDriver());
    md.beginWhatIf();
    md.read().enter('Fs', 41);

    assert.equal(md.read().cell('Fs').value, 41);
    assert.equal(md.readModified().cell('Fs').value, 37);
  });

  it('resolves to the edit draft while one is active, without touching modified state', () => {
    const md = ManagedDriver.create(minimalDriver());
    md.beginEdit();
    md.read().enter('Fs', 41);

    assert.equal(md.read().cell('Fs').value, 41);
    assert.equal(md.readModified().cell('Fs').value, 37);
  });
});
