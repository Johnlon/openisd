/**
 * `ManagedProject` — the one facade over every state layer of a project.
 *
 * Seam under test: the public API only. `#ground`/`#committed`/`#overlay` are private, and so is
 * the `OpenISDProjectJson` inside each — that is the property being asserted, not an obstacle to
 * asserting it.
 *
 * The notification counts ARE the specification (`docs/design/REACTIVITY.md`): every public
 * mutator notifies EXACTLY ONCE per call, unconditionally — whether it writes straight to
 * committed state or into a live what-if. `mutate()` and the four driver methods
 * (`enter`/`clear`/`enterMeta`/`clearMeta`) each call `#notify()` themselves, on every call, with
 * no mode guard; there is no separate driver-notify bridge to reach — a what-if's own
 * `OpenISDDriver` is never subscribed to, so a driver instance re-materialised mid-what-if (any
 * box/vent/PR edit rebuilds it, `mutate()`) cannot silently drop out of the notification path.
 *
 * The what-if LIFECYCLE methods are the exception, and correctly so: they notify once per actual
 * change of EFFECTIVE LAYER, not once per call. `beginWhatIf()`/`cancelWhatIf()` notify zero times
 * when called while already in (or already out of) that state — there is no layer change to
 * announce. `resetOverlayToGround()` notifies TWICE per call (end the current what-if, reopen a
 * fresh one over ground) because it is genuinely two layer changes, not one.
 *
 * The tests that matter most here are the ones proving a scrubbed BOX value behaves exactly like
 * a scrubbed DRIVER value — that is the whole reason the facade wraps the project rather than
 * the driver.
 */
import { describe, it } from 'vitest';

/** Read one dormant-or-active slot off an INDEPENDENT snapshot: switching the copy's
 *  alignment is safe (it is a copy) and is the public route to a dormant slot's value. */
function slotOf(p: import('@openisd/model').OpenISDProject, kind: 'sealed' | 'vented' | 'bandpass4' | 'passive-radiator') {
  p.setAlignment(kind);
  return p;
}

import { OpenISDDriver, OpenISDProject, Provenance } from '@openisd/model';
import assert from 'node:assert/strict';
import { ManagedProject } from '../../src/logic/managedProject.js';
import { LossMode } from '@openisd/design/engine';
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
function projectWithDriver(): OpenISDProject {
  const p = OpenISDProject.empty(OpenISDDriver.fromJsonRecord(driverRecord()));
  p.setAlignment('vented');
  p.set('Vb', 0.030);
  return p;
}

const managed = () => ManagedProject.fromProject(projectWithDriver());

describe('ManagedProject — notification asymmetry (the specification)', () => {
  it('a what-if with N scrubs produces N+2 (begin + each scrub + cancel)', () => {
    const mp = managed();
    let n = 0;
    mp.subscribe(() => { n++; });

    mp.beginWhatIf();
    assert.equal(n, 1, 'beginWhatIf notifies — it changes which layer is effective');

    mp.enterFs(41);
    mp.enterQts(0.36);
    mp.mutate(p => p.set('Vb', 0.050));
    assert.equal(n, 4, 'every live scrub notifies — a BOX scrub exactly like a DRIVER scrub');

    mp.cancelWhatIf();
    assert.equal(n, 5, 'cancel notifies — it changes which layer is effective back');
  });

});

describe('ManagedProject — every public mutator notifies exactly once (docs/design/REACTIVITY.md)', () => {
  it('enter/clear/enterMeta/clearMeta notify on COMMITTED state — no what-if open', () => {
    const mp = managed();
    let n = 0;
    mp.subscribe(() => { n++; });

    mp.enterQts(0.36);
    assert.equal(n, 1, 'enter() on committed state must notify — REACTIVITY.md: every public mutator does');
    mp.clearQts();
    assert.equal(n, 2, 'clear() on committed state must notify');
    // 'manufacturer', not 'comment': driverRecord()'s 'comment' is never entered by the fixture,
    // so OpenISDDriver.clearMeta() (openisdDriver.ts:721-730) finds nothing "displaced" and
    // returns before notifying — 'manufacturer' carries a real manufacturer_datasheet origin the
    // fixture sets, so enterMeta()/clearMeta() actually override/restore it and notify both ways.
    mp.enterManufacturer('Overridden Co');
    assert.equal(n, 3, 'enterMeta() on committed state must notify');
    mp.clearManufacturer();
    assert.equal(n, 4, 'clearMeta() on committed state must notify');
  });

  it('enter/clear/enterMeta/clearMeta notify EXACTLY ONCE during a live what-if', () => {
    const mp = managed();
    mp.beginWhatIf();
    let n = 0;
    mp.subscribe(() => { n++; });

    mp.enterQts(0.36);
    assert.equal(n, 1, 'exactly one notification per call — the facade\'s own unconditional #notify()');
    mp.clearQts();
    assert.equal(n, 2);
    mp.enterManufacturer('Overridden Co');
    assert.equal(n, 3);
    mp.clearManufacturer();
    assert.equal(n, 4);
  });

  it('setBoxVolume_m3 (a mutate()-based setter) notifies exactly once on COMMITTED state', () => {
    const mp = managed();
    let n = 0;
    mp.subscribe(() => { n++; });

    mp.setBoxVolume_m3(0.05);
    assert.equal(n, 1, 'mutate() must notify on committed state too — REACTIVITY.md: every public mutator does');
  });

  it('setBoxVolume_m3 notifies exactly once during a live what-if', () => {
    const mp = managed();
    mp.beginWhatIf();
    let n = 0;
    mp.subscribe(() => { n++; });

    mp.setBoxVolume_m3(0.05);
    assert.equal(n, 1, 'mutate() during a what-if still notifies exactly once, not twice');
  });

  it('a driver scrub after a box scrub in the SAME what-if still notifies — regression for ' +
     'BUG_20260821_whatif_bridge_detaches_when_mutate_rematerialises_the_driver.md: the box scrub ' +
     '(mutate()) re-materialises the effective layer\'s OpenISDDriver instance, which used to ' +
     'orphan a driver-notify bridge subscribed to the OLD instance', () => {
    const mp = managed();
    mp.beginWhatIf();
    let n = 0;
    mp.subscribe(() => { n++; });

    mp.enterQts(0.36);
    assert.equal(n, 1);
    mp.setBoxVolume_m3(0.05);              // rematerialises openIsdDriver on the effective layer
    assert.equal(n, 2);
    mp.enterFs(41);                    // must still notify — was silently lost before the fix
    assert.equal(n, 3, 'a driver scrub after a box scrub must still notify');
  });
});

describe('ManagedProject — the overlay covers the WHOLE design', () => {
  it('cancelling a what-if restores a scrubbed BOX value, with no hand-rolled snapshot', () => {
    const mp = managed();
    mp.beginWhatIf();
    mp.mutate(p => p.set('Vb', 0.075));
    assert.equal(mp.snapshot().cell('Vb').value, 0.075, 'the overlay shows the scrub');

    mp.cancelWhatIf();

    assert.equal(mp.snapshot().cell('Vb').value, 0.030,
      'Vb is IN the overlay, so cancelling restores it. This is what deletes OgTune.vue\'s ' +
      'vbSnapshot: no panel needs to remember one field by hand.');
  });

  it('a driver scrub and a box scrub are both discarded by one cancel', () => {
    const mp = managed();
    mp.beginWhatIf();
    mp.enterFs(99);
    mp.mutate(p => p.set('Vb', 0.075));

    mp.cancelWhatIf();

    assert.equal(mp.FsCell().value, 37);
    assert.equal(mp.snapshot().cell('Vb').value, 0.030);
  });
});

describe('ManagedProject — a what-if never leaks into anything persistent', () => {
  it('projectToPersist() cancels an active what-if itself', () => {
    const mp = managed();
    mp.beginWhatIf();
    mp.enterFs(99);
    mp.mutate(p => p.set('Vb', 0.075));

    const saved = mp.projectToPersist();

    assert.equal(mp.isWhatIfActive(), false, 'a save must never observe the live overlay');
    assert.equal(slotOf(saved, 'vented').cell('Vb').value, 0.030, 'committed state was never touched');
    assert.equal(saved.driver().FsCell().value, 37);
  });
});

describe('ManagedProject — the project never leaves', () => {
  it('snapshot() hands back a COPY: mutating it changes nothing inside', () => {
    const mp = managed();
    const snap = mp.snapshot();
    snap.set('Vb', 999);

    assert.equal(mp.snapshot().cell('Vb').value, 0.030,
      'if a snapshot were the live object, every caller would be a second writer with no ' +
      'notification and no what-if guard');
  });

  it('Reset goes back to GROUND, not to the last keystroke', () => {
    const mp = managed();
    mp.mutate(p => p.set('Vb', 0.060));   // writes committed directly, no overlay open

    mp.beginWhatIf();
    mp.mutate(p => p.set('Vb', 0.080));
    mp.resetOverlayToGround();

    assert.equal(mp.snapshot().cell('Vb').value, 0.030,
      'STATE_MODEL.md rule 5 — Reset returns to the design as loaded, not to committed');
  });
});

describe('ManagedProject — an empty (unfilled) driver', () => {
  it('reads answer honestly rather than inventing a value', () => {
    const mp = ManagedProject.createEmpty();
    assert.equal(mp.FsCell().state, Provenance.NotAvailable, 'absent is a real answer; a zero would look measured');
    assert.equal(mp.FsCell().value, null);
    assert.equal(mp.toEngineDriver(), null);
    // An unfilled driver genuinely IS incomplete — errors() reports its real required-field
    // problems (Fs/Re/Sd/Vas/Qts), not an empty list. Suppressing them for "no driver chosen"
    // was the special case this invariant removes (docs/design/DRIVER_NON_NULL_INVARIANT.md).
    assert.ok(mp.errors().some(e => e.field === 'Fs' && e.level === 'error'));
  });

  it('choosing a driver keeps the box — it is not opening a new project', () => {
    const mp = ManagedProject.createEmpty();
    mp.mutate(p => { p.setAlignment('vented'); p.set('Vb', 0.044); });

    mp.loadDriverFromOwdrText(JSON.stringify(driverRecord()));

    assert.equal(mp.FsCell().value, 37);
    assert.equal(slotOf(mp.snapshot(), 'vented').cell('Vb').value, 0.044,
      'the user picked a driver, not a new design');
  });
});

/**
 * File IO on the managed layer (QO78: driver/project file IO lives IN the domain module that
 * owns what it reads/writes). The driver crosses the boundary only as serialised text/bytes;
 * construction of the live driver happens inside this licensed module.
 */
describe('ManagedProject — driver file IO', () => {
  it('persistedDriverText round-trips through loadDriverFromPersistedText', () => {
    const src = ManagedProject.createEmpty();
    src.loadDriverFromOwdrText(JSON.stringify(driverRecord()));
    const text = src.persistedDriverText();
    assert.ok(text, 'a chosen driver serialises');

    const dst = ManagedProject.createEmpty();
    const problems = dst.loadDriverFromPersistedText(text);
    assert.deepEqual(problems, []);
    assert.equal(dst.FsCell().value, 37);
  });

  it('persistedDriverText and exportDriverWdr both succeed for an empty (unfilled) driver', () => {
    const mp = ManagedProject.createEmpty();
    assert.equal(typeof mp.persistedDriverText(), 'string',
      'driver is REQUIRED (docs/design/DRIVER_NON_NULL_INVARIANT.md) — always serialises');
    assert.ok(mp.exportDriverOwdr(), 'an empty driver still projects to .owdr — always representable as JSON');
    const { value, errors } = mp.exportDriverWdr();
    assert.ok(value, 'every field not entered falls back to its WinISD default '
      + '(OpenISDDriver.toWinISDDriver()) — an empty driver still projects to .wdr');
    assert.deepEqual(errors, []);
  });

  it('loadDriverFromPersistedText REFUSES malformed and structurally unloadable text', () => {
    const mp = ManagedProject.createEmpty();
    assert.ok(mp.loadDriverFromPersistedText('not json{').length > 0, 'malformed JSON is refused');
    assert.ok(mp.loadDriverFromPersistedText('{"no_specs":true}').length > 0,
      'a record with no specs container is refused, not adopted to crash later');
    assert.equal(mp.FsCell().state, Provenance.NotAvailable,
      'a refused driver is not adopted — the empty driver this project was created with remains');
  });

  it('exportDriverOwdr bytes ARE the persisted record — loadable back via owdr text', () => {
    const mp = ManagedProject.createEmpty();
    mp.loadDriverFromOwdrText(JSON.stringify(driverRecord()));
    const bytes = mp.exportDriverOwdr();
    assert.ok(bytes);
    const dst = ManagedProject.createEmpty();
    dst.loadDriverFromOwdrText(new TextDecoder().decode(bytes));
    assert.equal(dst.FsCell().value, 37);
  });

  it('exportDriverWdr → loadDriverFromWdrText round-trips the stated Fs', () => {
    const mp = ManagedProject.createEmpty();
    mp.loadDriverFromOwdrText(JSON.stringify(driverRecord()));
    const { value: bytes, errors } = mp.exportDriverWdr();
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.ok(bytes);
    const dst = ManagedProject.createEmpty();
    dst.loadDriverFromWdrText(new TextDecoder().decode(bytes!));
    assert.equal(dst.FsCell().value, 37);
  });

  it('adopting a different driver REPLACES the previous one wholesale — there is no clear, only a replace', () => {
    const mp = ManagedProject.createEmpty();
    mp.loadDriverFromOwdrText(JSON.stringify(driverRecord()));
    assert.equal(mp.FsCell().value, 37);
    const other = { ...driverRecord(), model: { value: 'Test-2', origin: 'manufacturer_datasheet' as const, definition: 'd', dq: [] } };
    mp.loadDriverFromOwdrText(JSON.stringify(other));
    assert.equal(mp.modelCell().value, 'Test-2', 'the new driver replaces the old one entirely');
  });
});

describe('ManagedProject — project file IO (.wpr)', () => {
  it('exportWpr → importWpr round-trips the box volume, driver Fs and meta', () => {
    const src = ManagedProject.createEmpty();
    src.loadDriverFromOwdrText(JSON.stringify(driverRecord()));
    src.setActiveAlignment('sealed');
    src.setBoxVolume_m3(777777e-6);
    src.mutate(p => p.setProjectMeta({ ...p.projectMeta(), description: 'probe-description-123456', creator: 'probe-creator' }));

    const { value: bytes, errors } = src.exportWpr(new Date('2026-01-01'), null, LossMode.Default);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.ok(bytes);

    const dst = ManagedProject.createEmpty();
    const { value: meta, errors: importErrors } = dst.importWpr(bytes!);
    assert.deepEqual(importErrors, []);
    assert.equal(dst.activeAlignment(), 'sealed');
    assert.ok(Math.abs(dst.boxVolume_m3() - 777777e-6) < 1e-9);
    assert.equal(dst.FsCell().value, 37);
    assert.equal(meta?.description, 'probe-description-123456');
    assert.equal(meta?.creator, 'probe-creator');
  });

  it('exportWpr succeeds for an empty (unfilled) driver — every field falls back to its WinISD default', () => {
    const { value, errors } = ManagedProject.createEmpty().exportWpr(new Date(), null, LossMode.Default);
    assert.ok(value);
    assert.deepEqual(errors, []);
  });

  it('importWpr refuses bytes with no [Box] BType — never guesses a box type', () => {
    const { value, errors } = ManagedProject.createEmpty()
      .importWpr(new TextEncoder().encode('[ProjectInfo]\n\n[Driver]\n[Box]\n'));
    assert.equal(value, null);
    assert.ok(errors.length > 0);
  });
});


describe('OpenISDProject — relation-less fields are always Entered (QO36-B4)', () => {
  // A relation-less registered field is a stated fact — by the user, a datasheet, or the
  // prototype — so cell() reports it Entered unconditionally, and no verb can strip that:
  // clear() has no mark to delete and enter()/set() are the same plain write.
  //
  // Exercised directly on `OpenISDProject` (not through `ManagedProject`): the generic
  // `cell()`/`enter()`/`clear()` this invariant lives in are `ManagedProject`-private now
  // (docs/design/ENCAPSULATION_AND_LAYERING.md) — the managed layer's own named setters
  // (`setEnvTempK` etc, still routing through `enter()` internally —
  // bugs/BUG_20260823_managed_user_setters_route_set_instead_of_enter.md) are covered by their
  // own read/write round-trip tests elsewhere; this invariant is the domain object's own.
  const fields = ['advTemp', 'advHumidity', 'advPressure', 'nDrivers', 'Pin', 'Rs', 'vcTempRise', 'driverAddedMass'] as const;
  for (const field of fields) {
    it(`${field} stays Entered through clear() and carries the entered value`, () => {
      const p = projectWithDriver();
      p.clear(field);
      assert.equal(p.cell(field).state, Provenance.Entered, `${field} must report Entered even after clear()`);
      p.enter(field, 12345);
      assert.equal(p.cell(field).value, 12345, `enter(${field}, ...) must write the value`);
      assert.equal(p.cell(field).state, Provenance.Entered, `${field} must report Entered after enter()`);
    });
  }
});
