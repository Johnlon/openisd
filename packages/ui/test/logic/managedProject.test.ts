/**
 * `ManagedProject` — the one facade over every state layer of a project.
 *
 * Seam under test: the public API only. `#ground`/`#committed`/`#overlay` are private, and so is
 * the `OpenISDProject` inside each — that is the property being asserted, not an obstacle to
 * asserting it.
 *
 * The notification counts ARE the specification (ARCHITECTURE.md §3): an edit is silent until
 * commit, a what-if is live. The tests that matter most here are the ones proving a scrubbed
 * BOX value behaves exactly like a scrubbed DRIVER value — that is the whole reason the facade
 * wraps the project rather than the driver.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { ManagedProject, emptyProject } from '../../src/logic/managedProject.js';
import type { OpenISDDriverJson } from '@openisd/model';

/** A minimal, valid driver record — one stated field, enough to exercise enter()/clear(). */
function driverRecord(): OpenISDDriverJson {
  return {
    uuid: { value: 'test-0000', definition: 'stable record identity' },
    quality: {
      rating: 'M', confirmed_fields: ['Fs'], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: 'Acme', origin: 'manufacturer_datasheet', definition: 'd', dq: [] },
    brand: { value: 'Acme', origin: 'manufacturer_datasheet', definition: 'd', dq: [] },
    model: { value: 'Test-1', origin: 'manufacturer_datasheet', definition: 'd', dq: [] },
    sku: { value: 'test-1', definition: 'd', grounds: [
      { origin: 'manufacturer_datasheet', reading: 'Test-1', definition: 'd' },
    ] },
    driver_type: { value: 'woofer', origin: 'manufacturer_datasheet', definition: 'd', dq: [] },
    disposition: { value: 'ok', definition: 'd', detail: 'complete' },
    data_sources: { value: {}, definition: 'd' },
    authoritative: { value: 'manufacturer_datasheet', definition: 'd' },
    specs: {
      woofer: {
        Fs: {
          origin: 'manufacturer_datasheet',
          readings: { manufacturer_datasheet: { read_value: 37, actual_reading: '37 Hz' } },
          dq: [],
        },
      },
    },
  };
}

/** A project with a driver AND a distinctive box, so a box scrub is observable. */
function projectWithDriver() {
  const p = emptyProject();
  p.driver = driverRecord();
  p.box.vented.volume_m3 = 0.030;
  return p;
}

const managed = () => ManagedProject.fromProject(projectWithDriver());

describe('ManagedProject — notification asymmetry (the specification)', () => {
  it('an edit with N changes then a commit produces exactly ONE notification, at the commit', () => {
    const mp = managed();
    let n = 0;
    mp.subscribe(() => { n++; });

    mp.beginEdit();
    mp.enter('Fs', 40);
    mp.enter('Qts', 0.35);
    mp.mutate(p => { p.box.vented.volume_m3 = 0.045; });
    assert.equal(n, 0, 'an open draft is silent — driver fields AND box fields alike');

    mp.commitEdit();
    assert.equal(n, 1, 'the write into committed state is the one notification');
  });

  it('a what-if with N scrubs produces N+2 (begin + each scrub + cancel)', () => {
    const mp = managed();
    let n = 0;
    mp.subscribe(() => { n++; });

    mp.beginWhatIf();
    assert.equal(n, 1, 'beginWhatIf notifies — it changes which layer is effective');

    mp.enter('Fs', 41);
    mp.enter('Qts', 0.36);
    mp.mutate(p => { p.box.vented.volume_m3 = 0.050; });
    assert.equal(n, 4, 'every live scrub notifies — a BOX scrub exactly like a DRIVER scrub');

    mp.cancelWhatIf();
    assert.equal(n, 5, 'cancel notifies — it changes which layer is effective back');
  });

  it('an edit that never commits produces ZERO notifications', () => {
    const mp = managed();
    let n = 0;
    mp.subscribe(() => { n++; });

    mp.beginEdit();
    mp.enter('Fs', 40);
    mp.mutate(p => { p.box.vented.volume_m3 = 0.099; });
    mp.cancelEdit();

    assert.equal(n, 0, 'nothing about committed state changed, so nothing is announced');
  });
});

describe('ManagedProject — the overlay covers the WHOLE design', () => {
  it('cancelling a what-if restores a scrubbed BOX value, with no hand-rolled snapshot', () => {
    const mp = managed();
    mp.beginWhatIf();
    mp.mutate(p => { p.box.vented.volume_m3 = 0.075; });
    assert.equal(mp.snapshot().box.vented.volume_m3, 0.075, 'the overlay shows the scrub');

    mp.cancelWhatIf();

    assert.equal(mp.snapshot().box.vented.volume_m3, 0.030,
      'Vb is IN the overlay, so cancelling restores it. This is what deletes OgTune.vue\'s ' +
      'vbSnapshot: no panel needs to remember one field by hand.');
  });

  it('a driver scrub and a box scrub are both discarded by one cancel', () => {
    const mp = managed();
    mp.beginWhatIf();
    mp.enter('Fs', 99);
    mp.mutate(p => { p.box.vented.volume_m3 = 0.075; });

    mp.cancelWhatIf();

    assert.equal(mp.cell('Fs').value, 37);
    assert.equal(mp.snapshot().box.vented.volume_m3, 0.030);
  });
});

describe('ManagedProject — a what-if never leaks into anything persistent', () => {
  it('recordToPersist() cancels an active what-if itself', () => {
    const mp = managed();
    mp.beginWhatIf();
    mp.enter('Fs', 99);
    mp.mutate(p => { p.box.vented.volume_m3 = 0.075; });

    const saved = mp.recordToPersist();

    assert.equal(mp.isWhatIfActive(), false, 'a save must never observe the live overlay');
    assert.equal(saved.box.vented.volume_m3, 0.030, 'committed state was never touched');
    assert.equal(saved.driver?.specs.woofer?.Fs?.readings.manufacturer_datasheet?.read_value, 37);
  });

  it('beginEdit() cancels an active what-if first', () => {
    const mp = managed();
    let n = 0;
    mp.subscribe(() => { n++; });

    mp.beginWhatIf();
    assert.equal(n, 1);

    mp.beginEdit();

    assert.equal(mp.isWhatIfActive(), false, 'gone, not merely superseded');
    assert.equal(n, 2, "the cancel's own notification — beginEdit itself stays silent");
    assert.equal(mp.isEditActive(), true);
  });

  it('beginWhatIf() discards an open edit draft — never both at once', () => {
    const mp = managed();
    mp.beginEdit();
    mp.enter('Fs', 12345);
    assert.equal(mp.isEditActive(), true);

    mp.beginWhatIf();

    assert.equal(mp.isEditActive(), false);
    assert.equal(mp.isWhatIfActive(), true);
    assert.equal(mp.recordToPersist().driver?.specs.woofer?.Fs
      ?.readings.manufacturer_datasheet?.read_value, 37,
      'the discarded draft never reached committed state');
  });
});

describe('ManagedProject — the project never leaves', () => {
  it('snapshot() hands back a COPY: mutating it changes nothing inside', () => {
    const mp = managed();
    const snap = mp.snapshot();
    snap.box.vented.volume_m3 = 999;

    assert.equal(mp.snapshot().box.vented.volume_m3, 0.030,
      'if a snapshot were the live object, every caller would be a second writer with no ' +
      'notification and no what-if guard');
  });

  it('Reset goes back to GROUND, not to the last keystroke', () => {
    const mp = managed();
    mp.beginEdit();
    mp.mutate(p => { p.box.vented.volume_m3 = 0.060; });
    mp.commitEdit();

    mp.beginWhatIf();
    mp.mutate(p => { p.box.vented.volume_m3 = 0.080; });
    mp.resetOverlayToGround();

    assert.equal(mp.snapshot().box.vented.volume_m3, 0.030,
      'STATE_MODEL.md rule 5 — Reset returns to the design as loaded, not to committed');
  });
});

describe('ManagedProject — no driver chosen', () => {
  it('reads answer honestly rather than inventing a value', () => {
    const mp = ManagedProject.createEmpty();
    assert.equal(mp.hasDriver(), false);
    assert.equal(mp.cell('Fs').state, 'N', 'absent is a real answer; a zero would look measured');
    assert.equal(mp.cell('Fs').value, null);
    assert.equal(mp.toDriver(), null);
    assert.deepEqual(mp.errors(), []);
  });

  it('choosing a driver keeps the box — it is not opening a new project', () => {
    const mp = ManagedProject.createEmpty();
    mp.mutate(p => { p.box.vented.volume_m3 = 0.044; });

    mp.loadDriverRecord(driverRecord());

    assert.equal(mp.hasDriver(), true);
    assert.equal(mp.cell('Fs').value, 37);
    assert.equal(mp.snapshot().box.vented.volume_m3, 0.044,
      'the user picked a driver, not a new design');
  });
});
