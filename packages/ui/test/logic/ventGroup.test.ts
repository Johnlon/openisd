/**
 * ventGroup — the vent group's E/C/N provenance: which of Vb / ventD / Fb / ventL is HELD and
 * which is SOLVED.
 *
 * One relation ties all four: Fb = (c/2π)·√(Sp/(Vb·Leff)), Leff = L + k·d. So exactly one
 * unknown is solvable, and WHICH one is a property of the entered set, not of the schema.
 * the tuning and length cells (and `VentMember` for the rest) exercise the provenance through
 * `box.vented.*`'s `FieldHandle`s; the Helmholtz solve lives on `OpenISDProject#resolve()` and
 * runs synchronously on every `.set()`/`.clear()` those helpers make.
 *
 * Numbers come from WinISD 0.7.0.950 itself, Vents tab, Vb=0.02 m³ / Fb=40 Hz / k=0.6:
 * 0.154 m at d=5 cm and 0.318 m at d=7 cm (winisd_research/CALC_FINDINGS_FOR_REVIEW.md).
 * The direct vent-length physics is in design/test/domain/project-vent-length.test.ts.
 */
import {beforeEach, describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, ProjectBuilder, type OpenISDProject} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {newProject, requireFocusedProject} from '../../src/logic/appState.js';
import {
  notifyVentChanged,
  ventAchievedFb,
  VentMember,
  ventMaxReachableFb,
} from '../../src/logic/ventGroup.js';

/** The tuning and vent length of the project's ported chamber, the cells the Box and Vents rows bind. */
const tuning = (p: OpenISDProject) => p.box.ventGroupOf(p.box.boxType.value).tuning_goal_hz;
const ventLength = (p: OpenISDProject) => p.box.ventGroupOf(p.box.boxType.value).vent.length_m;

/** Vb=0.02 m³, round 5 cm vent, k=0.6 — WinISD's own Vents-tab trial. */
function ventedProject() {
  const engine = createEngine();
  // This test is about box/vent/filter fields, not about any driver's contents, so the driver
  // states nothing — the domain's own blank rather than a record assembled here.
  const driver = OpenISDDriver.empty(engine);
  const p = new ProjectBuilder(driver, engine).vented().volume_m3(0.02).tuning_goal_hz(40).build();
  p.box.vented.vent.shape.set('round');
  p.box.vented.vent.diameter_m.set(0.05);
  p.box.vented.vent.endCorrection_m.set(0.6);
  p.notifyVentChanged();
  return p;
}

function bandpass4Project() {
  const engine = createEngine();
  const driver = OpenISDDriver.empty(engine);
  const p = new ProjectBuilder(driver, engine).bandpass4().rearVolume_m3(0.03).frontVolume_m3(0.02)
    .frontTuning_hz(40).build();
  p.box.bandpass4.vents.front.shape.set('round');
  p.box.bandpass4.vents.front.endCorrection_m.set(0.6);
  return p;
}

/** The L = 0 ceiling for the trial geometry — the highest tuning any vent here can deliver.
 *  OpenISD's own computed output, not a WinISD golden — it scales with c² via
 *  L = c²·Sp/(4π²·Fb²·V) − k·d, so it shifts by a few ppm whenever the project's air model
 *  or reference conditions change. Rebaselined 2026-09-26 at the project's default air
 *  (WinISD model, reference environment; `packages/design/engine/air.ts`), after
 *  BUG_20260924_driver-solve-and-sweep-use-different-air-models moved the vent's air off the
 *  embedded driver's own field and onto the project's canonical air. */
const CEILING_HZ = 80.79291711567225;

function blankDriverRecord(): unknown {
  return {
    uuid: { value: crypto.randomUUID() },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: '' }, brand: { value: '' }, model: { value: '' },
    sku: { value: '', grounds: [{ origin: 'entered', reading: '' }] },
    driver_type: { value: 'woofer' },
    data_sources: { value: {} },
    specs: { woofer: {} },
  };
}

/** Vb = 30 L, round 5 cm vent, k = 0.6, tuning entered. */
function trial(targetFb: number) {
  const engine = createEngine();
  const driver = OpenISDDriver.fromConformingRecord(blankDriverRecord(), engine);
  if (Array.isArray(driver)) throw new Error(`blankDriverRecord() does not conform: ${driver.join('; ')}`);
  const p = new ProjectBuilder(driver, engine).vented().volume_m3(0.03).tuning_goal_hz(targetFb).build();
  p.box.vented.vent.shape.set('round');
  p.box.vented.vent.diameter_m.set(0.05);
  p.box.vented.vent.endCorrection_m.set(0.6);
  return p;
}

function isTargetUnreachable(p: ReturnType<typeof trial>): boolean {
  return p.box.vented.vent.length_m.dq.some(issue => issue.kind === 'target-unreachable');
}

function countNotifications(fn: () => void): number {
  let count = 0;
  const unsub = requireFocusedProject().subscribe(() => { count++; });
  try { fn(); } finally { unsub(); }
  return count;
}

describe('ventGroup', () => {
  describe('the entered set decides the direction', () => {
    it('the length the volume/area/tuning actually require matches WinISD\'s published values', () => {
      const p = ventedProject();
      const Sp = p.box.vented.vent.area_m2.value;
      assert.ok(Sp != null);
      const len5cm = p.box.vented.vent.lengthForTuning_m(0.02, 40);
      assert.ok(len5cm != null && Math.abs(len5cm - 0.154) < 0.001,
        `d=5cm → ${len5cm?.toFixed(4)} m, WinISD shows 0.154`);

      p.box.vented.vent.diameter_m.set(0.07);
      const len7cm = p.box.vented.vent.lengthForTuning_m(0.02, 40);
      assert.ok(len7cm != null && Math.abs(len7cm - 0.318) < 0.001,
        `d=7cm → ${len7cm?.toFixed(4)} m, WinISD shows 0.318`);
    });

    it('clearing both of the pair leaves both N — one equation cannot solve two unknowns', () => {
      const p = ventedProject();
      tuning(p).clear();
      ventLength(p).clear();
      assert.equal(tuning(p).provenance, 'N');
      assert.equal(ventLength(p).provenance, 'N');
    });
  });


  // QO126 RESOLVED (S2-7d2, bugs/archive/BUG_20260908_tuning_and_its_paired_quantity_never_solve_each_other.md):
  // the tuning ↔ vent-length relation is now wired into `OpenISDProject#resolve()`, run
  // synchronously by every `.set()`/`.clear()` a `VentMember` write makes. The record
  // can hold only ONE stated target per pair at a time — entering either member atomically clears
  // the other's entered fact and lets the solver re-derive it — so an "over-determined" pair
  // (both members simultaneously 'entered' and contradictory) can no longer occur BY DESIGN; the
  // old test asserting that state persisted is gone, replaced below.
  describe('notifyVentChanged() re-derives the calculated member', () => {
    let p: ReturnType<typeof ventedProject>;
    beforeEach(() => { p = ventedProject(); });

    it('ships WinISD\'s direction: tuning entered, vent length calculated', () => {
      assert.equal(tuning(p).provenance, 'E');
      assert.equal(ventLength(p).provenance, 'C');
    });

    // John, 2026-10-06: tuning and length are relative to each other — typing one makes the other
    // the calculated side; clearing the calculated side changes nothing.
    it('entering the second of the pair makes it E and the first C; clearing the C side keeps both', () => {
      ventLength(p).set(0.154);
      assert.equal(tuning(p).provenance, 'C');
      assert.equal(ventLength(p).provenance, 'E');

      tuning(p).clear();
      assert.equal(tuning(p).provenance, 'C');
      assert.equal(ventLength(p).provenance, 'E');
      assert.equal(p.box.vented.vent.length_m.value, 0.154);
    });

    it('THE DIRECTION TEST — changing vent diameter holds the tuning and moves the length', () => {
      const lenBefore = p.box.vented.vent.length_m.value;
      p.box.vented.vent.diameter_m.set(0.07);
      notifyVentChanged(p);
      assert.equal(p.box.vented.tuning_goal_hz.value, 40, 'an entered tuning must never be rewritten by the solver');
      assert.notEqual(p.box.vented.vent.length_m.value, lenBefore, 'the length must absorb the diameter change');
    });

    it('the reverse direction is the same solver: enter the length, the tuning is solved', () => {
      tuning(p).clear();
      ventLength(p).set(0.154);
      p.box.vented.vent.diameter_m.set(0.07);
      notifyVentChanged(p);
      assert.equal(p.box.vented.vent.length_m.value, 0.154, 'an entered length must never be rewritten');
      assert.notEqual(p.box.vented.tuning_goal_hz.value, 40, 'now the TUNING absorbs the diameter change');
    });

    it('entering a new length target retires the old tuning target, not just adds to it', () => {
      // Same relation the reverse-direction test above proves — entering ventL always displaces
      // whatever was previously the pair's stated target, even one as far off as 0.999 m.
      ventLength(p).set(0.999);
      p.box.vented.vent.diameter_m.set(0.07);
      notifyVentChanged(p);
      assert.equal(p.box.vented.vent.length_m.value, 0.999, 'the entered length is held exactly');
      assert.equal(p.box.vented.tuning_goal_hz.calculated, true, 'the domain re-derives tuning, not the UI');
      assert.notEqual(p.box.vented.tuning_goal_hz.value, 40, 'the old entered tuning target is gone, not held alongside it');
    });
  });

  // The pair's entered side lives on the project's own cells, so one project's entry never changes
  // what another project reports (no module-level state).
  describe('the pair state belongs to the project', () => {
    it('a length entered on one project does not make another project\'s tuning calculated', () => {
      const first = ventedProject();
      ventLength(first).set(0.154);
      assert.equal(tuning(first).provenance, 'C');
      const second = ventedProject();
      assert.equal(tuning(second).provenance, 'E');
      assert.equal(ventLength(second).provenance, 'C');
    });
  });

  // John, 2026-10-01: clearing the entered side of the pair must not leave both blank
  // ("unrecoverable"): it falls back to the starting alignment a fresh box gets.
  describe('clearing the entered side of the tuning/length pair falls back to the starting alignment', () => {
    function projectWithDriver() {
      const p = ProjectBuilder.empty(createEngine());
      p.driver.specs.Fs_hz.set(40);
      p.driver.specs.Qts.set(0.38);
      p.driver.specs.Qes.set(0.45);
      p.driver.specs.Vas_m3.set(0.03);
      p.box.boxType.set('vented');
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.05);
      p.box.vented.vent.endCorrection_m.set(0.6);
      return p;
    }
    function startingAlignment(): {Vb: number | null; Fb: number | null} {
      const ref = projectWithDriver();
      ref.box.resetVentedAlignment();
      return {Vb: ref.box.vented.volume_m3.value, Fb: ref.box.vented.tuning_goal_hz.value};
    }

    it('clearing an entered tuning restores the alignment tuning and volume as entered', () => {
      const want = startingAlignment();
      const p = projectWithDriver();
      tuning(p).set(77.777);
      p.box.vented.volume_m3.set(0.123456);
      tuning(p).clear();
      assert.equal(p.box.vented.tuning_goal_hz.value, want.Fb);
      assert.equal(p.box.vented.volume_m3.value, want.Vb);
      assert.equal(tuning(p).provenance, 'E');
      assert.equal(ventLength(p).provenance, 'C');
    });

    it('clearing an entered length restores the alignment the same way', () => {
      const want = startingAlignment();
      const p = projectWithDriver();
      ventLength(p).set(0.222222);
      ventLength(p).clear();
      assert.equal(p.box.vented.tuning_goal_hz.value, want.Fb);
      assert.equal(tuning(p).provenance, 'E');
      assert.equal(ventLength(p).provenance, 'C');
    });
  });

  describe('on a 4th-order bandpass it writes the front chamber', () => {
    it('entering Fb sets the front chamber tuning and leaves the vented box alone', () => {
      const p = bandpass4Project();
      const ventedBefore = p.box.vented.tuning_goal_hz.value;
      tuning(p).set(47.8);
      assert.equal(p.box.bandpass4.chambers.front.tuning_goal_hz.value, 47.8);
      assert.equal(p.box.vented.tuning_goal_hz.value, ventedBefore);
    });

    it('entering a diameter sets the front vent, and the front length then solves', () => {
      const p = bandpass4Project();
      tuning(p).set(47.8);
      VentMember.DIAMETER.enter(p, 0.05);
      assert.equal(p.box.bandpass4.vents.front.diameter_m.value, 0.05);
      const length = p.box.bandpass4.vents.front.length_m.value;
      assert.ok(length !== null && length > 0, `front vent length solved, got ${length}`);
      assert.equal(tuning(p).provenance, 'E');
      assert.equal(ventLength(p).provenance, 'C');
    });

    it('clearing Fb clears the front chamber tuning', () => {
      const p = bandpass4Project();
      VentMember.DIAMETER.enter(p, 0.05);
      ventLength(p).set(0.15);
      tuning(p).clear();
      assert.equal(tuning(p).provenance, 'C');
    });
  });

  describe('one user action is one notification, never an extra store-triggered re-solve', () => {
    beforeEach(() => {
      // The app starts with NO project (QO121), so each run opens its own and tunes it to vented.
      newProject();
      requireFocusedProject().box.boxType.set('vented');
      requireFocusedProject().box.vented.volume_m3.set(0.02);
      requireFocusedProject().box.vented.vent.diameter_m.set(0.05);
      requireFocusedProject().box.vented.vent.endCorrection_m.set(0.6);
      // setEnteredSet is no longer needed; .set() sets origin to entered
    });

    it('tuning cell set — value write + provenance write + one solve write, no more', () => {
      const count = countNotifications(() => tuning(requireFocusedProject()).set(40));
      // setBoxTuning_Fb_hz + setEntered('Fb') + notifyVentChanged's own ventL write = 3.
      // Before the fix (trailing solve outside suspension) this counted 4: the store's
      // auto-solve watch, unsuspended by the time the solve's own write landed, ran a second,
      // fully redundant `notifyVentChanged`.
      assert.equal(count, 2,
        `expected 2 notifications (the cell write and the domain's own solve write) — got ${count}; ` +
        `a third means the store re-ran the solver a second time for one user action`);
    });

    it('tuning cell clear — provenance write + one solve write, no more', () => {
      // Over-determine first (both Fb and ventL entered), so clearing Fb leaves ventL as the
      // sole entered member and Fb genuinely becomes the CALCULATED one — otherwise nothing is
      // derivable after the clear and the solve step is a real no-op (a different, equally
      // valid scenario, but not one that exercises a solve write).
      ventLength(requireFocusedProject()).set(0.15);
      const count = countNotifications(() => tuning(requireFocusedProject()).clear());
      assert.equal(count, 2,
        `expected 2 notifications (the clear and the domain's own solve write) — got ${count}`);
    });
  });


  describe('an unreachable tuning target surfaces through the wrappers', () => {
    it('a reachable target is delivered exactly by the solved length', () => {
      const p = trial(40);
      tuning(p).set(40);
      const achieved = ventAchievedFb(p);
      assert.ok(achieved != null && Math.abs(achieved - 40) < 1e-6);
      assert.equal(isTargetUnreachable(p), false);
    });

    it('an ENTERED length is the user\'s own choice — never reported as unreachable', () => {
      const p = trial(90);
      ventLength(p).set(0.005);
      assert.equal(isTargetUnreachable(p), false);
    });

    it('reports the ceiling via the wrapper', () => {
      const p = trial(90);
      const ceiling = ventMaxReachableFb(p);
      assert.ok(ceiling != null && Math.abs(ceiling - CEILING_HZ) < 1e-6);
    });
  });
});
