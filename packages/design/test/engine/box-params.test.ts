import {describe, it, expect} from 'vitest';
import assert from 'node:assert/strict';
import type {SimulatableBoxType, SweepParams} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

const P_SEALED: SweepParams = { Vb: 0.030, eg: 2.83, Ql: 10, fmin: 10, fmax: 1000, N: 50 };

/** Sp/Leff are what the store's `syncedP` computes from a 50 mm × 100 mm vent. */
const P_VENTED: SweepParams = { ...P_SEALED, Sp: Math.PI * 0.025 ** 2, Leff: 0.1366 };

const P_PR: SweepParams = { ...P_SEALED, prSd: 0.0133, prNum: 1, prMmd: 0.030, prMadd: 0, prCms: 0.0008, prRms: 1.0 };

const P_BP4: SweepParams = { ...P_VENTED, Vf: 0.020 };

// `bandpass6`/`abc` read Fr/Ff (chamber tuning) for their port mass in every lossMode, never
// Leff/Sp geometry (`Bandpass6Box.ts`'s own doc) — see `boxModel.test.ts`'s own P_BP6/P_ABC.
const P_BP6: SweepParams = { ...P_SEALED, Vf: 0.020, Fr: 45, Ff: 60 };

const P_ABC: SweepParams = { ...P_BP6, SpIntra: Math.PI * 0.02 ** 2, LeffIntra: 0.05 };

const targets = (issues: readonly { target: string }[]): string[] => issues.map(i => i.target);

describe('Engine.solveBoxParams', () => {
  // ── Criterion 2 ──────────────────────────────────────────────────────────────
  describe('a zero box volume is a named error, not Infinity-poisoned curves', () => {
    it('Vb = 0 is rejected by the box-parameter precondition, naming Vb, with null values', () => {
      const result = engine.simulation.solveBoxParams('sealed', { ...P_SEALED, Vb: 0 });
      assert.equal(result.values, null, 'a zero-volume box cannot be simulated');
      assert.equal(result.issues.length, 1, 'exactly the one broken field should be reported');
      assert.equal(result.issues[0].kind, 'missing-dependencies');
      assert.equal(result.issues[0].target, 'Vb', 'the issue must name the field the user has to change');
      if (result.issues[0].kind === 'missing-dependencies') {
        assert.match(result.issues[0].routes[0].formula, /Box volume \(Vb\)/, 'the route must use the UI label for the field');
      }
    });

    it('the route formula explains the consequence, so the user is not told merely that a number is wrong', () => {
      const [issue] = engine.simulation.solveBoxParams('sealed', { ...P_SEALED, Vb: 0 }).issues;
      assert.equal(issue.kind, 'missing-dependencies');
      if (issue.kind === 'missing-dependencies') {
        assert.match(issue.routes[0].formula, /compliance/i, 'the message must say what breaks in the model');
      }
    });

    it('Vb absent and Vb negative are rejected the same as zero', () => {
      for (const Vb of [undefined, -0.01, NaN, Infinity] as const)
        assert.ok(targets(engine.simulation.solveBoxParams('sealed', { ...P_SEALED, Vb }).issues).includes('Vb'),
          `Vb = ${Vb} must be rejected — only a finite positive volume is simulatable`);
    });

    it('a healthy design of every SIMULATABLE box type raises no parameter issue and returns its own params as values', () => {
      // Total over `SimulatableBoxType`, so giving the circuit a new topology fails to compile
      // here until this table names it.
      const healthy: Record<SimulatableBoxType, SweepParams> = {
        sealed: P_SEALED, vented: P_VENTED, 'box-passive-radiator': P_PR, bandpass4: P_BP4,
        bandpass6: P_BP6, abc: P_ABC,
      };
      const boxes: SimulatableBoxType[] =
        ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'];
      for (const box of boxes) {
        const result = engine.simulation.solveBoxParams(box, healthy[box]);
        assert.deepEqual(result.issues, [],
          `${box}: a valid design must produce no parameter issue (a false positive would block a good design)`);
        assert.equal(result.values, healthy[box], `${box}: a valid design's values must be its own params`);
      }
    });

    it('bandpass6/abc: a missing chamber volume is rejected the same as sealed/vented — Vb and Vf both required', () => {
      // `Bandpass6Box`/`AbcBox` divide by both chamber compliances (Cabr = Vb/(ρc²), Cabf =
      // Vf/(ρc²)) in every lossMode — `engine/params.ts`'s REQUIRED_BY_BOX bandpass6/abc entries.
      for (const [box, healthy] of [['bandpass6', P_BP6], ['abc', P_ABC]] as const) {
        assert.deepEqual(engine.simulation.solveBoxParams(box, healthy).issues, [],
          `${box}: a valid design must produce no parameter issue`);
        assert.ok(targets(engine.simulation.solveBoxParams(box, { ...healthy, Vb: 0 }).issues).includes('Vb'),
          `${box}: Vb = 0 must be rejected — the rear chamber compliance collapses to zero`);
        assert.ok(targets(engine.simulation.solveBoxParams(box, { ...healthy, Vf: 0 }).issues).includes('Vf'),
          `${box}: Vf = 0 must be rejected — the front chamber compliance collapses to zero`);
      }
    });

    it('every box type is genuinely simulatable — non-vacuity for the healthy-design test above', () => {
      // If `simulatableBoxType` ever started refusing a box the engine really does model, that
      // test would still pass while the app lost a feature.
      for (const box of ['sealed', 'vented', 'bandpass4', 'box-passive-radiator', 'bandpass6', 'abc'] as const)
        assert.notEqual(engine.box.simulatableBoxType(box), null, `${box} must remain simulatable`);
    });

    it('6th-order bandpass and ABC are not implemented yet; every other box type is', () => {
      for (const box of ['sealed', 'vented', 'bandpass4', 'box-passive-radiator'] as const)
        assert.equal(engine.box.implemented(box), true, box);
      for (const box of ['bandpass6', 'abc'] as const)
        assert.equal(engine.box.implemented(box), false, box);
    });

    it('a vented box with no vent area is rejected, naming Sp', () => {
      assert.deepEqual(targets(engine.simulation.solveBoxParams('vented', { ...P_VENTED, Sp: 0 }).issues), ['Sp'],
        'the port mass Map = ρ·Leff/Sp is infinite at Sp = 0');
    });

    it('a 4th-order bandpass with no front chamber is rejected, naming Vf', () => {
      assert.deepEqual(targets(engine.simulation.solveBoxParams('bandpass4', { ...P_BP4, Vf: 0 }).issues), ['Vf'],
        'a bandpass needs both chambers; the front compliance is Vf/(ρc²)');
    });

    it('a passive-radiator box with no PR parameters reports every missing one, not just the first', () => {
      assert.deepEqual(targets(engine.simulation.solveBoxParams('box-passive-radiator', P_SEALED).issues), ['prSd', 'prCms', 'prMmd'],
        'the user should see the whole list, not fix one field and be told about the next');
    });

    it('the sealed box does not demand vent or PR parameters it never uses', () => {
      const result = engine.simulation.solveBoxParams('sealed', P_SEALED);
      assert.deepEqual(result.issues, [], 'requiring an unused field would block a perfectly valid sealed design');
      assert.equal(result.values, P_SEALED);
    });

    it('every parameter issue is missing-dependencies, naming a field with a non-empty human-readable route', () => {
      for (const issue of engine.simulation.solveBoxParams('box-passive-radiator', { ...P_SEALED, Vb: 0 }).issues) {
        assert.equal(issue.kind, 'missing-dependencies', 'no enclosure parameter contradicts another');
        assert.ok(issue.target.length > 0, 'target must identify an input');
        if (issue.kind === 'missing-dependencies') {
          assert.ok(issue.routes[0].formula.trim().length > 10, 'route formula must be readable prose, not a code');
        }
      }
    });
  });

  describe('Engine.solveBoxParams — {values, issues} enclosure precondition', () => {
    it('returns the same params as values, and no issues, for a sealed box with a usable Vb', () => {
      const P = { Vb: 0.03 };
      const result = engine.simulation.solveBoxParams('sealed', P);
      expect(result.values).toBe(P);
      expect(result.issues).toEqual([]);
    });

    it('reports a missing-dependencies issue naming Vb, and null values, when a sealed box has no volume', () => {
      const result = engine.simulation.solveBoxParams('sealed', {});
      expect(result.values).toBeNull();
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'Vb' });
    });

    it('reports one issue per missing field for a vented box missing both Vb and Sp', () => {
      const result = engine.simulation.solveBoxParams('vented', {});
      expect(result.values).toBeNull();
      expect(result.issues.map(i => i.target).sort()).toEqual(['Sp', 'Vb']);
    });

    it.each(['bandpass6', 'abc'] as const)('a %s box missing Vf is not told it is a 4th-order bandpass', (box) => {
      const result = engine.simulation.solveBoxParams(box, { Vb: 0.02 });
      const vf = result.issues.find(i => i.target === 'Vf');
      expect(vf?.text).toBeDefined();
      expect(vf?.text).not.toMatch(/4th-order/);
    });

    it('reports every passive-radiator field the circuit divides by', () => {
      const result = engine.simulation.solveBoxParams('box-passive-radiator', { Vb: 0.02 });
      expect(result.values).toBeNull();
      expect(result.issues.map(i => i.target).sort()).toEqual(['prCms', 'prMmd', 'prSd']);
    });

    it('reports one issue per missing field for a bandpass6/abc box missing both Vb and Vf', () => {
      for (const box of ['bandpass6', 'abc'] as const) {
        const result = engine.simulation.solveBoxParams(box, {});
        expect(result.values).toBeNull();
        expect(result.issues.map(i => i.target).sort()).toEqual(['Vb', 'Vf']);
      }
    });
  });
});
