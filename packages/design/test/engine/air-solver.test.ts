/**
 * The air solver: the five air quantities (T, RH, p, c, ρ), each entered or open, and the two
 * relations between them (c = f(T,RH,p) and ρ = γ·p/c²). Open quantities are back-calculated;
 * conflicts and gaps are issues naming the relation's fields.
 *
 * Golden numbers come from the existing air model (`solveEnvironment`), which air.test.ts pins to
 * WinISD at double precision.
 */
import {describe, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/Engine.js';
import {DEFAULT_ENV_DEFAULTS, DEFAULT_VENTED_DESIGN_LIMITS} from '../../engine/index.js';
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

describe('air solver — pressure and c from a round-number density', () => {
  it('ρ = 1.2 with T and RH: no double satisfies ρ·c² = γ·p exactly, so the bisection runs to the last double', () => {
    const r = engine.environment.solveAir(inputs({tempK: entered(T), humidityPct: entered(RH), rho: entered(1.2)}));
    assert.deepEqual(r.issues, []);
    assert.ok(relative(1.2 * r.values.c! ** 2, 1.4 * r.values.pressurePa!) < 1e-12);
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

  it('a typed c never solves p: p takes the app value and the typed c is marked against the model', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), c: entered(AIR.c)}));
    assert.equal(r.values.pressurePa, engine.environment.appAir.pressure());
    assert.equal(r.values.c, AIR.c);
    assert.ok(r.issues.some(i => i.kind === 'inconsistent-inputs' && i.fields.includes('c')));
  });

  it('a typed c never solves RH: RH takes the app value and the typed c is marked against the model', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), pressurePa: entered(P), c: entered(AIR.c)}));
    assert.equal(r.values.humidityPct, engine.environment.appAir.humidity());
    assert.equal(r.values.c, AIR.c);
    assert.ok(r.issues.some(i => i.kind === 'inconsistent-inputs' && i.fields.includes('c')));
  });

  it('a typed c with nothing else solves T alone: p and RH take the app values (fill order p, RH, T)', () => {
    const app = engine.environment.appAir;
    const c = engine.environment.solve({tempK: 290, humidityPct: app.humidity(), pressurePa: app.pressure()}).values.c;
    const r = engine.environment.solveAir(inputs({c: entered(c)}));
    assert.equal(r.values.pressurePa, app.pressure());
    assert.equal(r.values.humidityPct, app.humidity());
    assert.ok(relative(r.values.tempK, 290) < 1e-9, `T ${r.values.tempK}`);
    assert.deepEqual(r.issues, []);
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
  it('forward then clearing T recovers it from a typed c', () => {
    for (const [t, rh, p] of [[T, RH, P], [278.15, 10, 105000], [313.15, 90, 80000]] as const) {
      const a = engine.environment.solve({tempK: t, humidityPct: rh, pressurePa: p}).values;
      const fromT = engine.environment.solveAir(inputs({humidityPct: entered(rh), pressurePa: entered(p), c: entered(a.c)}));
      assert.ok(relative(fromT.values.tempK, t) < 1e-9, `T at ${t}`);
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
  it('RH and T open with only p, c entered: RH takes the app value and T is solved from c', () => {
    const app = engine.environment.appAir;
    const c = engine.environment.solve({tempK: 305, humidityPct: app.humidity(), pressurePa: P}).values.c;
    const r = engine.environment.solveAir(inputs({pressurePa: entered(P), c: entered(c, 0.0005)}));
    assert.equal(r.values.humidityPct, app.humidity());
    assert.ok(relative(r.values.tempK, 305) < 1e-3);
    assert.deepEqual(r.issues.filter(i => i.kind === 'missing-dependencies'), []);
  });

  it('nothing entered: T, RH and p take the app value, c and ρ are calculated from them', () => {
    const r = engine.environment.solveAir(inputs({}));
    const app = engine.environment.appAir;
    assert.equal(r.values.tempK, app.temperature());
    assert.equal(r.values.humidityPct, app.humidity());
    assert.equal(r.values.pressurePa, app.pressure());
    const wanted = engine.environment.solve({tempK: app.temperature(), humidityPct: app.humidity(), pressurePa: app.pressure()}).values;
    assert.equal(r.values.c, wanted.c);
    assert.equal(r.values.rho, wanted.rho);
    assert.deepEqual(r.issues, []);
  });

  it('a typed c with T open gives T from c, not the app T', () => {
    const r = engine.environment.solveAir(inputs({humidityPct: entered(RH), pressurePa: entered(P), c: entered(AIR.c, 0.005)}));
    assert.ok(relative(r.values.tempK, T) < 1e-3);
    assert.notEqual(r.values.tempK, engine.environment.appAir.temperature());
  });

  it('T from a c no temperature in range gives: T takes the app value, c stays as typed, and both carry the reason', () => {
    const r = engine.environment.solveAir(inputs({
      humidityPct: entered(RH), pressurePa: entered(P), c: entered(999, 0.005)}));
    assert.equal(r.values.tempK, engine.environment.appAir.temperature());
    assert.equal(r.values.c, 999);
    const issue = r.issues.find(i => i.kind === 'missing-dependencies' && i.target === 'tempK');
    assert.ok(issue);
    assert.deepEqual(issue.fields, ['tempK', 'c']);
    assert.match(issue.text, /no temperature in range gives this c/);
    assert.match(issue.text, /typed sound velocity/);
  });

  it('there is no typing band on temperature: 150 K and 400 K raise no range issue', () => {
    for (const t of [150, 400]) {
      const r = engine.environment.solveAir(inputs({tempK: entered(t), humidityPct: entered(RH), pressurePa: entered(P)}));
      assert.deepEqual(r.issues, [], `T ${t}`);
    }
  });

  it('a temperature the model does not cover (above 1000 K) keeps the temperature issue', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(5000), humidityPct: entered(RH), pressurePa: entered(P)}));
    assert.ok(r.issues.some(i => i.kind === 'missing-dependencies' && i.target === 'tempK'));
  });
});

describe('air solver — a typed c never moves RH or p, however far off', () => {
  it('a c that implies RH above 100 leaves RH at the app value and marks the disagreement', () => {
    const c100 = engine.environment.solve({tempK: T, humidityPct: 100, pressurePa: P}).values.c;
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), pressurePa: entered(P), c: entered(c100 + 0.5, 0.0005)}));
    assert.equal(r.values.humidityPct, engine.environment.appAir.humidity());
    assert.ok(r.issues.some(i => i.kind === 'inconsistent-inputs' && i.fields.includes('c')));
  });

  it('a c that implies a wild pressure (349 m/s with T and RH entered) leaves p at the app value', () => {
    const r = engine.environment.solveAir(inputs({tempK: entered(T), humidityPct: entered(RH), c: entered(349, 0.005)}));
    assert.equal(r.values.pressurePa, engine.environment.appAir.pressure());
  });
});

describe('air solver — edges of the solvable range', () => {
  const forward = (tempK: number) => engine.environment.solve({tempK, humidityPct: RH, pressurePa: P}).values.c;

  it.each([[1000]])('a c that is exactly the value at T = %s K gives that end', (end) => {
    const r = engine.environment.solveAir(inputs({
      humidityPct: entered(RH), pressurePa: entered(P), c: entered(forward(end))}));
    assert.equal(r.values.tempK, end);
  });

  it('a ρ too high for any pressure in range gives no p or c from it, naming both relations', () => {
    const r = engine.environment.solveAir(inputs({tempK: entered(T), humidityPct: entered(RH), rho: entered(5)}));
    assert.equal(r.values.pressurePa, engine.environment.appAir.pressure(), 'p takes the app value');
    const targets = r.issues.filter(i => i.kind === 'missing-dependencies').map(i => i.target);
    assert.deepEqual(targets.sort(), ['c', 'pressurePa']);
  });

  it('a ρ just inside the pressure limit gives p and c, but their widths are lost once ρ may be a hair higher', () => {
    const cAtMax = engine.environment.solve({tempK: T, humidityPct: RH, pressurePa: 200000}).values.c;
    const rhoLimit = 1.4 * 200000 / (cAtMax * cAtMax);
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), rho: entered(rhoLimit * (1 - 1e-9), 1e-3)}));
    assert.ok(relative(r.values.pressurePa, 200000) < 1e-6);
    assert.equal(r.widths.pressurePa, 0);
    assert.equal(r.widths.c, 0);
  });

  it('coupled p and c carry the widths of T, RH and ρ', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T, 0.05), humidityPct: entered(RH, 0.5), rho: entered(AIR.rho, 0.0005)}));
    assert.ok(r.widths.pressurePa > 0);
    assert.ok(r.widths.c > 0);
  });

  it('T, RH, p with widths give c a width', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T, 0.05), humidityPct: entered(RH, 0.5), pressurePa: entered(P, 5)}));
    assert.ok(r.widths.c > 0);
  });
});

describe('air solver — a density that cannot be calculated', () => {
  it('c of zero gives no ρ from it, with the reason on ρ', () => {
    const r = engine.environment.solveAir(inputs({pressurePa: entered(P), c: entered(0)}));
    const issue = r.issues.find(i => i.target === 'rho');
    assert.match(issue!.text, /density relation gives no number/);
  });

  it('a c so small that ρ is above its limit gives no ρ from it, and says the answer is outside its limits', () => {
    const r = engine.environment.solveAir(inputs({pressurePa: entered(P), c: entered(1e-3)}));
    assert.match(r.issues.find(i => i.target === 'rho')!.text, /outside its limits/);
  });

  it('a c of -w with width w is checked against ρ without taking the tolerance from the infinite prediction', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), pressurePa: entered(P),
      c: entered(-1e-3, 1e-3), rho: entered(1)}));
    assert.ok(r.issues.some(i => i.kind === 'inconsistent-inputs'));
  });
});

describe('air solver — an app air outside the limits is the built-in constant', () => {
  it.each([
    ['tempK', 0, DEFAULT_ENV_DEFAULTS.tempK],
    ['humidityPct', -1, DEFAULT_ENV_DEFAULTS.humidityPct],
    ['pressurePa', 0, DEFAULT_ENV_DEFAULTS.pressurePa],
    ['pressurePa', NaN, DEFAULT_ENV_DEFAULTS.pressurePa],
  ] as const)('%s of %s in the app setting gives the constant %s and a full air', (field, outside, constant) => {
    const settings = {
      ventedLimits: () => DEFAULT_VENTED_DESIGN_LIMITS,
      envDefaults: vi.fn(() => ({...DEFAULT_ENV_DEFAULTS, [field]: outside})),
    };
    const r = createEngine(settings).environment.solveAir(inputs({}));
    assert.equal(r.values[field], constant);
    assert.equal(Number.isFinite(r.values.c), true);
    assert.equal(Number.isFinite(r.values.rho), true);
    assert.deepEqual(r.issues, []);
  });
});

describe('air solver — c that does not sit on the model', () => {
  const forward = (tempK: number) => engine.environment.solve({tempK, humidityPct: RH, pressurePa: P}).values.c;

  it('a rounded c gives the T whose model c is that figure, to the last digit', () => {
    const r = engine.environment.solveAir(inputs({humidityPct: entered(RH), pressurePa: entered(P), c: entered(340.5, 0.05)}));
    assert.ok(Math.abs(forward(r.values.tempK) - 340.5) < 1e-9);
  });

  it('a c just above the value at the hottest T, within its precision, gives the hottest T', () => {
    const r = engine.environment.solveAir(inputs({
      humidityPct: entered(RH), pressurePa: entered(P), c: entered(forward(1000) + 0.001, 0.01)}));
    assert.equal(r.values.tempK, 1000);
  });

  it('a c that is not a number gives no T from it, with the reason on T', () => {
    const r = engine.environment.solveAir(inputs({
      humidityPct: entered(RH), pressurePa: entered(P), c: entered(NaN), rho: entered(AIR.rho)}));
    assert.ok(r.issues.some(i => i.kind === 'missing-dependencies' && i.target === 'tempK'));
    assert.equal(r.values.tempK, engine.environment.appAir.temperature(), 'T takes the app value');
  });

  it('a c of zero makes the density check impossible, so it raises no density conflict', () => {
    const r = engine.environment.solveAir(inputs({
      tempK: entered(T), humidityPct: entered(RH), pressurePa: entered(P), c: entered(0), rho: entered(1)}));
    assert.deepEqual(r.issues.filter(i => i.kind === 'inconsistent-inputs' && i.target === 'rho'), []);
  });
});
