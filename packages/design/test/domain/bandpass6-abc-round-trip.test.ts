/**
 * A 6th-order bandpass or ABC project keeps its volumes, tunings and vents through `.owpr`
 * save/load and through `.wpr` export/import (plan PLAN_20261007_bp6_abc_complete.md step 10).
 * Golden values: the sample `.wpr` files under `../winisd/fixtures/` (bp6-w5-base2, abc-w5-base2),
 * which WinISD itself wrote.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {driverFrom, whatIfSpec} from '../fixtures/domainBuilders.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures');
type Type = 'bandpass6' | 'abc';

function parts(p: OpenISDProject, type: Type) {
  const g = type === 'bandpass6' ? p.box.bandpass6 : p.box.abc;
  const vent = (v: typeof g.vents.rear) => ({
    dia: v.diameter_m.value, len: v.length_m.value, count: v.count.value, end: v.endCorrection_m.value,
  });
  return {
    type: p.box.boxType.value,
    Vr: g.chambers.rear.volume_m3.value, Fr: g.chambers.rear.tuning_goal_hz.value,
    Vf: g.chambers.front.volume_m3.value, Ff: g.chambers.front.tuning_goal_hz.value,
    rear: vent(g.vents.rear), front: vent(g.vents.front),
    ...(type === 'abc' ? {intra: vent(p.box.abc.vents.intra)} : {}),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

function near(a: unknown, b: unknown, path: string): void {
  if (typeof a === 'number' && typeof b === 'number') {
    assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)), `${path}: ${a} vs ${b}`);
  } else if (isRecord(a) && isRecord(b)) {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), `${path}: keys`);
    for (const [k, v] of Object.entries(a)) near(v, b[k], `${path}.${k}`);
  } else {
    assert.equal(a, b, path);
  }
}

function edited(type: Type): OpenISDProject {
  const engine = createEngine();
  const driver = driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: whatIfSpec({Fs_hz: 37, Vas_m3: 0.03, Qes: 0.4, Qms: 7, Re_ohm: 5.6}),
  });
  const b = new ProjectBuilder(driver, engine);
  const p = (type === 'bandpass6' ? b.bandpass6() : b.abc())
    .rearVolume_m3(0.0421).rearTuning_hz(38.5).frontVolume_m3(0.0173).frontTuning_hz(27.25).build();
  const g = type === 'bandpass6' ? p.box.bandpass6 : p.box.abc;
  g.vents.rear.diameter_m.set(0.0763);
  g.vents.front.diameter_m.set(0.0911);
  if (type === 'abc') {
    p.box.abc.vents.intra.diameter_m.set(0.0555);
    p.box.abc.vents.intra.length_m.set(0.123);
  }
  return p;
}

/** The `edited` project with the vent LENGTHS entered, so each tuning is the calculated side. */
function lengthEntered(type: Type): OpenISDProject {
  const p = edited(type);
  const g = type === 'bandpass6' ? p.box.bandpass6 : p.box.abc;
  g.vents.rear.length_m.set(0.321);
  g.vents.front.length_m.set(0.789);
  return p;
}

interface Stated { readonly value: number | null; readonly entered: boolean }

function pair(p: OpenISDProject, type: Type) {
  const g = type === 'bandpass6' ? p.box.bandpass6 : p.box.abc;
  const side = (c: {tuning_goal_hz: Stated}, v: {length_m: Stated}) => ({
    lenEntered: v.length_m.entered, len: v.length_m.value,
    tuneEntered: c.tuning_goal_hz.entered, tune: c.tuning_goal_hz.value,
  });
  return {rear: side(g.chambers.rear, g.vents.rear), front: side(g.chambers.front, g.vents.front)};
}

function wprRoundTrip(p: OpenISDProject): OpenISDProject {
  const conv = new WinIsdProjectConverter(createEngine());
  const out = conv.openIsdProjectToWinIsdProject(p);
  if (out.value === null) throw new Error('export failed: ' + JSON.stringify(out.errors));
  const back = conv.winIsdProjectToOpenIsdProject(out.value.toWpr());
  if (back.value === null) throw new Error('import failed: ' + JSON.stringify(back.errors));
  return back.value;
}

for (const type of ['bandpass6', 'abc'] as const) {
  describe(`${type} round trips`, () => {
    it('.owpr save then load gives equal volumes, tunings and vents', () => {
      const p = edited(type);
      const back = OpenISDProject.fromOwprText(p.toOwprText(), createEngine());
      if (Array.isArray(back)) throw new Error(back.join('; '));
      near(parts(back, type), parts(p, type), 'owpr');
    });

    it('.wpr export then import gives equal volumes, tunings and vents', () => {
      const p = edited(type);
      near(parts(wprRoundTrip(p), type), parts(p, type), 'wpr');
    });

    it('.owpr keeps an entered vent length as the stated side and the tuning as calculated', () => {
      const p = lengthEntered(type);
      const before = pair(p, type);
      const back = OpenISDProject.fromOwprText(p.toOwprText(), createEngine());
      if (Array.isArray(back)) throw new Error(back.join('; '));
      const after = pair(back, type);
      for (const s of ['rear', 'front'] as const) {
        assert.equal(before[s].lenEntered, true, `${s} before: length entered`);
        assert.equal(before[s].tuneEntered, false, `${s} before: tuning calculated`);
        assert.equal(after[s].lenEntered, true, `${s} length entered`);
        assert.equal(after[s].tuneEntered, false, `${s} tuning calculated`);
        near(after[s].len, before[s].len, `${s}.len`);
        near(after[s].tune, before[s].tune, `${s}.tune`);
      }
      assert.equal(after.rear.len, 0.321);
      assert.equal(after.front.len, 0.789);
    });

    it('.wpr export then import keeps the lengths and tunings (entered length)', () => {
      const p = lengthEntered(type);
      const back = wprRoundTrip(p);
      const a = pair(back, type);
      const b = pair(p, type);
      for (const s of ['rear', 'front'] as const) {
        near(a[s].len, b[s].len, `${s}.len`);
        near(a[s].tune, b[s].tune, `${s}.tune`);
        // a .wpr stores both values; the import takes the tuning as the stated one
        assert.equal(a[s].lenEntered, false, `${s} length calculated after import`);
        assert.equal(a[s].tuneEntered, true, `${s} tuning entered after import`);
      }
    });

    it('a WinISD-written .wpr imports, exports and imports again to the same values', () => {
      const file = type === 'bandpass6' ? 'bp6-w5-base2.wpr' : 'abc-w5-base2.wpr';
      const first = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(join(FIXTURES, file), 'utf8'));
      if (first.value === null) throw new Error(JSON.stringify(first.errors));
      near(parts(wprRoundTrip(first.value), type), parts(first.value, type), 'golden');
    });
  });
}

describe('WinISD-written sample values survive import', () => {
  it('abc-w5-base2: Vr 0.01 at 42 Hz, Vf 0.005 at 60 Hz, 0.05 m round vents, intra 0.1 m long', () => {
    const r = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(join(FIXTURES, 'abc-w5-base2.wpr'), 'utf8'));
    if (r.value === null) throw new Error(JSON.stringify(r.errors));
    const x = parts(r.value, 'abc');
    assert.equal(x.Vr, 0.01); assert.equal(x.Fr, 42); assert.equal(x.Vf, 0.005); assert.equal(x.Ff, 60);
    assert.equal(x.rear.dia, 0.05); assert.equal(x.front.dia, 0.05); assert.equal(x.intra?.dia, 0.05);
    assert.equal(x.intra?.len, 0.1);
  });
});
