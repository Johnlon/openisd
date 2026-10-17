/**
 * The air solver: the five air quantities (T, RH, p, c, ρ), each entered or open, and the two
 * relations between them (c = f(T,RH,p) and ρ = γ·p/c²). Open quantities are back-calculated;
 * conflicts and gaps are issues naming the relation's fields.
 *
 * Golden numbers come from the existing air model (`solveEnvironment`), which air.test.ts pins to
 * WinISD at double precision.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/Engine.js';
import type {AirInput, AirInputs} from '../../engine/environment/airSolver.js';

const engine = createEngine();

const entered = (value: number, precision = 0): AirInput => ({kind: 'entered', value, precision});
const open: AirInput = {kind: 'open'};
const relative = (got: number | null, want: number) => Math.abs((got! - want) / want);

/** The forward air of 300.15 K / 55 % / 98765 Pa: a fixed, non-default environment. */
const T = 300.15, RH = 55, P = 98765;
const AIR = engine.environment.solve({tempK: T, humidityPct: RH, pressurePa: P}).values;

function inputs(partial: Partial<AirInputs>): AirInputs {
  return {tempK: open, humidityPct: open, pressurePa: open, c: open, rho: open, ...partial};
}

describe('air solver — forward', () => {
  it('T, RH, p entered: c and ρ equal solveEnvironment bit for bit', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), pressurePa: entered(P)}));
    assert.equal(r.values.c, AIR.c);
    assert.equal(r.values.rho, AIR.rho);
    assert.deepEqual(r.issues, []);
  });
});

describe('air solver — back-solving one cleared value', () => {
  it('T from a typed c', () => {
    const r = engine.environment.solveAir(inputs({
      humidityPct: entered(RH), pressurePa: entered(P), c: entered(AIR.c)}));
    assert.ok(relative(r.values.tempK, T) < 1e-9, `T ${r.values.tempK}`);
    assert.ok(relative(r.values.rho, AIR.rho) < 1e-9);
    assert.deepEqual(r.issues, []);
  });

  it('p from a typed c (T and RH entered)', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), c: entered(AIR.c)}));
    assert.ok(relative(r.values.pressurePa, P) < 1e-9, `p ${r.values.pressurePa}`);
  });

  it('RH from a typed c (T and p entered)', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), pressurePa: entered(P), c: entered(AIR.c)}));
    assert.ok(relative(r.values.humidityPct, RH) < 1e-9, `RH ${r.values.humidityPct}`);
  });

  it('p from a typed ρ with c entered', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), c: entered(AIR.c), rho: entered(AIR.rho)}));
    assert.ok(relative(r.values.pressurePa, P) < 1e-12, `p ${r.values.pressurePa}`);
    assert.deepEqual(r.issues, []);
  });

  it('c from ρ and p', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), pressurePa: entered(P), rho: entered(AIR.rho)}));
    assert.equal(r.values.c, AIR.c);
  });

  it('ρ from c and p, with T and RH open', () => {
    const r = engine.environment.solveAir(inputs({pressurePa: entered(P), c: entered(AIR.c)}));
    assert.ok(relative(r.values.rho, AIR.rho) < 1e-14);
  });

  it('T from ρ, p, RH (c solved first from ρ and p)', () => {
    const r = engine.environment.solveAir(inputs({
      humidityPct: entered(RH), pressurePa: entered(P), rho: entered(AIR.rho)}));
    assert.ok(relative(r.values.tempK, T) < 1e-9, `T ${r.values.tempK}`);
  });
});

describe('air solver — coupled p and c', () => {
  it('T, RH, ρ entered: p and c solved together', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), rho: entered(AIR.rho)}));
    assert.ok(relative(r.values.pressurePa, P) < 1e-9, `p ${r.values.pressurePa}`);
    assert.ok(relative(r.values.c, AIR.c) < 1e-9, `c ${r.values.c}`);
    assert.deepEqual(r.issues, []);
  });
});

describe('air solver — round trip', () => {
  it('forward then clearing each of T, RH, p recovers it', () => {
    for (const [t, rh, p] of [[T, RH, P], [278.15, 10, 105000], [313.15, 90, 80000]] as const) {
      const a = engine.environment.solve({tempK: t, humidityPct: rh, pressurePa: p}).values;
      const fromT = engine.environment.solveAir(inputs({humidityPct: entered(rh), pressurePa: entered(p), c: entered(a.c)}));
      const fromP = engine.environment.solveAir(inputs({tempK: entered(t), humidityPct: entered(rh), c: entered(a.c)}));
      assert.ok(relative(fromT.values.tempK, t) < 1e-9, `T at ${t}`);
      assert.ok(relative(fromP.values.pressurePa, p) < 1e-9, `p at ${p}`);
    }
  });
});

describe('air solver — conflicts', () => {
  it('all five entered and consistent: no issue', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), pressurePa: entered(P),
      c: entered(AIR.c, 0.005), rho: entered(AIR.rho, 0.000005)}));
    assert.deepEqual(r.issues, []);
  });

  it('c typed 2 decimals off the model but within its precision: no issue', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), pressurePa: entered(P),
      c: entered(Math.round(AIR.c * 100) / 100, 0.005)}));
    assert.deepEqual(r.issues, []);
  });

  it('c beyond its precision from T, RH, p: inconsistent, naming the sound relation fields', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), pressurePa: entered(P),
      c: entered(AIR.c + 1, 0.005)}));
    const bad = r.issues.filter(i => i.kind === 'inconsistent-inputs');
    assert.equal(bad.length, 1);
    assert.deepEqual([...bad[0]!.fields].sort(), ['c', 'humidityPct', 'pressurePa', 'tempK']);
    assert.equal(r.values.c, AIR.c + 1, 'the entered value is kept');
  });

  it('ρ beyond its precision from p and c: inconsistent, naming the density relation fields', () => {
    const r = engine.environment.solveAir(inputs({
      pressurePa: entered(P), c: entered(AIR.c), rho: entered(AIR.rho * 1.01, 0.000005)}));
    const bad = r.issues.filter(i => i.kind === 'inconsistent-inputs');
    assert.equal(bad.length, 1);
    assert.deepEqual([...bad[0]!.fields].sort(), ['c', 'pressurePa', 'rho']);
  });

  it('T, RH, c, ρ entered with p open: p comes from one relation, the other is checked', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), c: entered(AIR.c + 1, 0.005), rho: entered(AIR.rho)}));
    assert.ok(r.issues.some(i => i.kind === 'inconsistent-inputs'));
  });
});

describe('air solver — missing and unreachable', () => {
  it('T and RH open with only p, c entered: both missing, issue names the sound relation', () => {
    const r = engine.environment.solveAir(inputs({pressurePa: entered(P), c: entered(AIR.c)}));
    assert.equal(r.values.tempK, null);
    assert.equal(r.values.humidityPct, null);
    const missing = r.issues.filter(i => i.kind === 'missing-dependencies');
    assert.ok(missing.some(i => i.target === 'tempK' && i.fields.includes('humidityPct')));
    assert.ok(missing.some(i => i.target === 'humidityPct' && i.fields.includes('tempK')));
  });

  it('T from a c no temperature in range gives: not available, with an issue on tempK', () => {
    const r = engine.environment.solveAir(inputs({
      humidityPct: entered(RH), pressurePa: entered(P), c: entered(999, 0.005)}));
    assert.equal(r.values.tempK, null);
    assert.ok(r.issues.some(i => i.kind === 'missing-dependencies' && i.target === 'tempK'));
  });

  it('entered T outside the supported range keeps the temperature range issue', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(1000), humidityPct: entered(RH), pressurePa: entered(P)}));
    assert.ok(r.issues.some(i => i.kind === 'missing-dependencies' && i.target === 'tempK'));
  });
});

describe('air solver — ill-conditioned back-solves are not available, never a wild number', () => {
  it('RH from a c that implies RH above 100: not available', () => {
    const c100 = engine.environment.solve({tempK: T, humidityPct: 100, pressurePa: P}).values.c;
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), pressurePa: entered(P), c: entered(c100 + 0.5, 0.0005)}));
    assert.equal(r.values.humidityPct, null);
    assert.ok(r.issues.some(i => i.kind === 'missing-dependencies' && i.target === 'humidityPct'));
  });

  it('RH from a c that implies RH below 0: not available', () => {
    const c0 = engine.environment.solve({tempK: T, humidityPct: 0, pressurePa: P}).values.c;
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), pressurePa: entered(P), c: entered(c0 - 0.5, 0.0005)}));
    assert.equal(r.values.humidityPct, null);
    assert.ok(r.issues.some(i => i.kind === 'missing-dependencies' && i.target === 'humidityPct'));
  });

  it('RH from a c typed so coarsely that every humidity matches it: not available', () => {
    const c0 = engine.environment.solve({tempK: T, humidityPct: 0, pressurePa: P}).values.c;
    const c100 = engine.environment.solve({tempK: T, humidityPct: 100, pressurePa: P}).values.c;
    const mid = (c0 + c100) / 2;
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), pressurePa: entered(P), c: entered(Math.round(mid), 5)}));
    assert.equal(r.values.humidityPct, null);
    assert.ok(r.issues.some(i => i.kind === 'missing-dependencies' && i.target === 'humidityPct'));
  });

  it('RH from a c typed finely enough to pin it: solved', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), pressurePa: entered(P), c: entered(AIR.c, 0.0005)}));
    assert.ok(relative(r.values.humidityPct, RH) < 1e-9);
  });

  it('RH just past 100 but within the typed c precision: clamps to the limit', () => {
    const c100 = engine.environment.solve({tempK: T, humidityPct: 100, pressurePa: P}).values.c;
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), pressurePa: entered(P), c: entered(c100 + 0.0004, 0.0005)}));
    assert.equal(r.values.humidityPct, 100);
  });
});
