/**
 * `OpenISDProject.cell()/enter()/clear()` — the project's own field provenance and group
 * solving, the driver's model applied to the project (docs/design/PROJECT_DOMAIN_SYMMETRY.md
 * P2). The vent group (Vb/ventD/Fb/ventL, one Helmholtz relation) and the PR group
 * (prFp ↔ prMadd) solve INSIDE the domain object; `target.entered` decides what is held.
 *
 * Also pins P1's public surface (vent(i)/ventCount(), opus2 K1) and the enforced per-alignment
 * vent arity (opus2 K2): a wrong-arity record is refused loudly, never silently truncated.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { OpenISDProject, VENT_ARITY, Provenance } from '../src/index.js';
import type { OpenISDProjectJson } from '../src/openisdProject.js';
import { WinISDProject } from '@openisd/winisd';
import { ventLength, tuningFromLength } from '@openisd/engine';


/** A complete, valid record literal — the by-reference door `fromJsonRecord` adopts, retained
 *  so a test can corrupt it PAST the type system and prove the runtime guards. */
function corruptibleRecord(): OpenISDProjectJson {
  const vent = { shape: 'round' as const, diameter_m: 0.05, width_m: 0, height_m: 0, length_m: 0.1, endCorrection: 0.732 };
  return {
    driver: undefined,
    box: {
      active: 'vented' as const,
      sealed: { volume_m3: 0.02 },
      vented: { volume_m3: 0.02, Fb_hz: 45, vents: [vent] },
      bandpass4: { rearVolume_m3: 0, frontVolume_m3: 0, Ff_hz: 0, vents: [{ ...vent }] },
      passiveRadiator: { volume_m3: 0, Fp_hz: 0, count: 1, addedMass_kg: 0 },
      Ql: 10, Qa: 100, Qp: 100,
    },
    target: { entered: {} as Record<string, true> },
    filters: [],
    environment: { tempK: 293.15, humidityPct: 30, pressurePa: 101325, ignoreHumidityAndPressure: false },
    signal: { inputPower_W: 1, seriesResistance_ohm: 0.1, driverCount: 1, wiring: 'parallel' as const, rgAtDriverSide: false },
    listening: { distance_m: 1, angle_rad: 0 },
    simOptions: { circuitModel: 'winisd' as const, tlPortModel: false, forceFlatResponse: false,
      splXmaxLimited: false, vcTempRise: 0, alfaVC: 0.0039, driverAddedMass: 0 },
    sweep: { fmin_hz: 1, fmax_hz: 20000, points: 400 },
    meta: { name: '', creator: '', created: '', modified: '', description: '' },
  };
}

function ventedProject(): OpenISDProject {
  const p = OpenISDProject.empty();
  p.setAlignment('vented');
  return p;
}

describe('cell() — provenance over the vent group', () => {
  it('a fresh vented project is born over-determined and states it: Vb, ventD, Fb all Entered', () => {
    // A1 (QO36-B4): the prototype is the STATER — its defaults are Entered, and the group
    // solves nothing until a member is cleared, matching WinISD's own observed acceptance of
    // over-determined input.
    const p = ventedProject();
    assert.equal(p.cell('Vb').state, Provenance.Entered);
    assert.equal(p.cell('ventD').state, Provenance.Entered);
    assert.equal(p.cell('Fb').state, Provenance.Entered);
    assert.equal(p.cell('ventL').state, Provenance.Calculated,
      'ventL is the un-entered member the entered trio determines');
  });

  it('Sp is always Calculated when derivable and never Entered — no one states an area', () => {
    const p = ventedProject();
    p.enter('ventD', 0.05);
    const sp = p.cell('Sp');
    assert.equal(sp.state, Provenance.Calculated);
    assert.ok(Math.abs(sp.value - Math.PI * 0.025 ** 2) < 1e-12);
    assert.throws(() => p.enter('Sp', 0.001), /derived from the port geometry/);
  });

  it('ventD cleared is NotAvailable, never Calculated — it has no closed-form solve', () => {
    const p = ventedProject();
    p.clear('ventD');
    assert.equal(p.cell('ventD').state, Provenance.NotAvailable);
  });
});

describe('enter()/clear() — the solve happens inside the domain object', () => {
  it('entering Vb, ventD and Fb solves the length to the engine relation, marked Calculated', () => {
    const p = ventedProject();
    p.clear('ventL');
    p.enter('Vb', 0.02);
    p.enter('ventD', 0.06);
    p.enter('Fb', 45);
    const Sp = Math.PI * 0.03 ** 2;
    const expected = ventLength(0.02, 45, Sp, p.vent(0)!.endCorrection);
    assert.equal(p.cell('ventL').state, Provenance.Calculated);
    assert.ok(Math.abs(p.cell('ventL').value - expected) / expected < 1e-12,
      `solved length must be the engine's ${expected}, got ${p.cell('ventL').value}`);
  });

  it('entering the length instead solves the tuning — the group runs both directions', () => {
    const p = ventedProject();
    p.enter('Vb', 0.02);
    // geometry first: entering ventD re-holds Fb by design, so the clear must FOLLOW it
    p.enter('ventD', 0.06);
    p.clear('Fb');
    p.enter('ventL', 0.15);
    const Sp = Math.PI * 0.03 ** 2;
    const expected = tuningFromLength(0.02, 0.15, Sp, p.vent(0)!.endCorrection);
    assert.equal(p.cell('Fb').state, Provenance.Calculated);
    assert.ok(Math.abs(p.cell('Fb').value - expected) / expected < 1e-12);
  });

  it('an over-determined group solves nothing — both members stay exactly as typed', () => {
    const p = ventedProject();
    p.enter('Fb', 45);
    p.enter('ventL', 0.123);
    assert.equal(p.cell('Fb').value, 45);
    assert.equal(p.cell('ventL').value, 0.123);
    assert.equal(p.cell('Fb').state, Provenance.Entered);
    assert.equal(p.cell('ventL').state, Provenance.Entered);
  });

  it('new port geometry re-solves the LENGTH for the held tuning, never the tuning', () => {
    const p = ventedProject();
    p.enter('Vb', 0.02);
    p.enter('Fb', 45);
    p.enter('ventL', 0.2);   // over-determined for a moment
    p.enter('ventD', 0.05);  // geometry entry: Fb held, ventL released and re-solved
    assert.equal(p.cell('Fb').state, Provenance.Entered);
    assert.equal(p.cell('Fb').value, 45);
    assert.equal(p.cell('ventL').state, Provenance.Calculated);
    const Sp = Math.PI * 0.025 ** 2;
    const expected = ventLength(0.02, 45, Sp, p.vent(0)!.endCorrection);
    assert.ok(Math.abs(p.cell('ventL').value - expected) / expected < 1e-12);
  });
});

describe('the PR group — prFp ↔ prMadd on the domain object', () => {
  function prProject(): OpenISDProject {
    // A PR with real intrinsics, reached through the domain's own .wpr reader — the licensed
    // construction route for a radiator.
    return OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni([
      '[Box]', 'BType=4', 'Vr=0.04', 'Npr=1', '',
      '[PassiveRadiator]', 'Vas=0.0048', 'Qms=3.3', 'Fs=30', 'Sd=0.0095', 'Xmax=0.019', 'Me=0', '',
    ].join('\n')));
  }

  it('with mass entered (the default direction) the tuning is Calculated', () => {
    const p = prProject();
    p.enter('prMadd', 0.005);
    assert.equal(p.cell('prMadd').state, Provenance.Entered);
    assert.equal(p.cell('prFp').state, Provenance.Calculated);
    assert.ok(p.cell('prFp').value > 0, 'a defined PR has a real tuning');
  });

  it('entering a target tuning solves the added mass, clamped at zero', () => {
    const p = prProject();
    p.clear('prMadd');
    p.enter('prFp', 1000);   // far above the bare in-box resonance — unreachable by adding mass
    assert.equal(p.cell('prMadd').value, 0, 'mass cannot be removed from a radiator');
    assert.equal(p.prTargetUnreachable(), true);
  });
});

describe('vent(i)/ventCount() — P1 public surface (opus2 K1)', () => {
  it('ventCount() states each alignment\'s arity', () => {
    const p = OpenISDProject.empty();
    p.setAlignment('sealed');
    assert.equal(p.ventCount(), 0);
    p.setAlignment('vented');
    assert.equal(p.ventCount(), 1);
    p.setAlignment('bandpass4');
    assert.equal(p.ventCount(), 1);
    p.setAlignment('passive-radiator');
    assert.equal(p.ventCount(), 0);
  });

  it('vent(i) returns an independent copy — mutating it changes nothing', () => {
    const p = ventedProject();
    p.enter('ventD', 0.05);
    const copy = p.vent(0)!;
    copy.diameter_m = 99;
    assert.equal(p.vent(0)!.diameter_m, 0.05, 'the record must be untouched by copy mutation');
  });

  it('out of range is undefined, never a throw and never a fabricated vent', () => {
    const p = ventedProject();
    assert.equal(p.vent(1), undefined);
    assert.equal(p.vent(-1), undefined);
    p.setAlignment('sealed');
    assert.equal(p.vent(0), undefined);
  });
});

describe('vent arity is ENFORCED, not commented (opus2 K2)', () => {
  it('the declared arity table matches what the accessors report', () => {
    assert.deepEqual(VENT_ARITY, { sealed: 0, vented: 1, bandpass4: 1, 'passive-radiator': 0 });
  });

  it('a record whose vents array disagrees with its alignment\'s arity is refused loudly', () => {
    const record = corruptibleRecord();
    (record.box.vented.vents as unknown as unknown[]).push({ ...record.box.vented.vents[0]! });
    assert.throws(() => OpenISDProject.fromJsonRecord(record),
      /arity is fixed per alignment \(QO85\)/,
      'a two-port vented record must refuse, never have vents[1] silently ignored');
  });

  it('a correct-arity record is accepted', () => {
    assert.ok(OpenISDProject.fromJsonRecord(corruptibleRecord()));
  });
});

describe('the read paths refuse a corrupt record even past the type system (opus2 P3 bar)', () => {
  it('growing vents is a compile error — pinned so the readonly ban can never silently lapse', () => {
    const record = corruptibleRecord();
    const p = OpenISDProject.fromJsonRecord(record);
    void p;
    // @ts-expect-error vents is readonly — the push route must not compile
    if (p.vent(0)) record.box.vented.vents.push({ ...record.box.vented.vents[0]! });
  });

  it('ventCount()/vent(i) throw rather than report a wrong-arity state as fact', () => {
    // `fromJsonRecord` adopts BY REFERENCE, so the route past the type system is to retain
    // the record, adopt it while valid, then corrupt the retained reference with a cast —
    // deliberate type laundering, in a TEST only, to prove the guard erased readonly cannot.
    const record = corruptibleRecord();
    const p = OpenISDProject.fromJsonRecord(record);
    (record.box.vented.vents as unknown as unknown[]).push({ ...record.box.vented.vents[0]! });
    assert.throws(() => p.ventCount(), /arity is fixed per alignment \(QO85\)/);
    assert.throws(() => p.vent(0), /arity is fixed per alignment \(QO85\)/);
  });
});

describe('the PR datasheet vocabulary is the domain\'s own keyed surface (P4a)', () => {
  function prProject(): OpenISDProject {
    return OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni([
      '[Box]', 'BType=4', 'Vr=0.04', 'Npr=1', '',
      '[PassiveRadiator]', 'Vas=0.0048', 'Qms=3.3', 'Fs=30', 'Sd=0.0095', 'Xmax=0.019', 'Me=0', '',
    ].join('\n')));
  }

  it('cells read the derived views in SI, Calculated while a radiator is defined', () => {
    const p = prProject();
    assert.equal(p.cell('prVas').state, Provenance.Calculated);
    assert.ok(Math.abs(p.cell('prVas').value - 0.0048) / 0.0048 < 1e-9, 'Vas in m³, round-tripping the imported value');
    assert.ok(Math.abs(p.cell('prQms').value - 3.3) / 3.3 < 1e-9);
    assert.ok(Math.abs(p.cell('prFs').value - 30) / 30 < 1e-9);
    assert.equal(p.cell('prSd').state, Provenance.Entered, 'a component fact is stated, never solved');
  });

  it('entering Vas re-solves the canonical set holding Fs and Qms', () => {
    const p = prProject();
    p.enter('prVas', 0.0060);
    assert.ok(Math.abs(p.cell('prVas').value - 0.0060) / 0.0060 < 1e-9, 'the entered Vas reads back');
    assert.ok(Math.abs(p.cell('prFs').value - 30) / 30 < 1e-6, 'Fs held across the Vas entry');
    assert.ok(Math.abs(p.cell('prQms').value - 3.3) / 3.3 < 1e-6, 'Qms held across the Vas entry');
  });

  it('entering Fs re-solves Mmd/Rms holding Qms; entering Qms re-solves Rms alone', () => {
    const p = prProject();
    const mmdBefore = p.prField('Mmd_kg');
    p.enter('prFs', 25);
    assert.ok(Math.abs(p.cell('prFs').value - 25) / 25 < 1e-9);
    assert.notEqual(p.prField('Mmd_kg'), mmdBefore, 'a lower Fs means more moving mass');
    assert.ok(Math.abs(p.cell('prQms').value - 3.3) / 3.3 < 1e-6, 'Qms held');
    p.enter('prQms', 5);
    assert.ok(Math.abs(p.cell('prQms').value - 5) / 5 < 1e-9);
  });

  it('prFsMass is derived and refuses entry, naming the real knobs', () => {
    const p = prProject();
    assert.throws(() => p.enter('prFsMass', 25), /enter prFp .* or prMadd/);
  });
});
