/**
 * `Engine.chartsFor` — which charts a project shows, by box type
 * (bugs/BUG_20260927_winisd-charts-missing.md): a design decision, not a UI one. A chart is
 * listed where it logically applies to a component the box has, never "when the data exists".
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {Engine} from '../../engine/index.js';
import {openISDProjectJsonSchema} from '../../domain/openisdSchema.js';

const engine = new Engine();

describe('Engine.chartsFor', () => {
  it('a sealed box: the ten system charts and the three filter charts, no port, no PR', () => {
    const charts = engine.chartsFor('sealed');
    assert.deepEqual(charts, [
      'TFMag', 'Phase', 'GD', 'MaxPwr', 'MaxSPL', 'VA', 'SPL', 'Excursion', 'Zmag', 'Zph',
      'FltMag', 'FltPhase', 'FltGD',
    ]);
  });

  it('a vented box adds RearPort and RearPortGain, in WinISD chart-menu position, no FrontPort, no PR', () => {
    const charts = engine.chartsFor('vented');
    assert.ok(charts.includes('RearPort'));
    assert.ok(charts.includes('RearPortGain'));
    assert.ok(!charts.includes('FrontPort'));
    assert.ok(!charts.includes('PRTFMag') && !charts.includes('PRTFPhase') && !charts.includes('PRExcursion'));
    assert.deepEqual([...charts].sort(), [...engine.chartsFor('sealed'), 'RearPort', 'RearPortGain'].sort());
    // WinISD row order: the port chart sits after Zph, before the filter trio, gain right after it.
    assert.ok(charts.indexOf('RearPort') > charts.indexOf('Zph'));
    assert.equal(charts.indexOf('RearPortGain'), charts.indexOf('RearPort') + 1);
    assert.ok(charts.indexOf('RearPortGain') < charts.indexOf('FltMag'));
  });

  it('a 4th-order bandpass box adds FrontPort and FrontPortGain, in WinISD chart-menu position, no RearPort, no RearPortGain, no PR', () => {
    const charts = engine.chartsFor('bandpass4');
    assert.ok(charts.includes('FrontPort'));
    assert.ok(charts.includes('FrontPortGain'));
    assert.ok(!charts.includes('RearPort'));
    assert.ok(!charts.includes('RearPortGain'));
    assert.deepEqual([...charts].sort(), [...engine.chartsFor('sealed'), 'FrontPort', 'FrontPortGain'].sort());
    // WinISD row order: the port chart sits after Zph, before the filter trio, gain right after it.
    assert.ok(charts.indexOf('FrontPort') > charts.indexOf('Zph'));
    assert.equal(charts.indexOf('FrontPortGain'), charts.indexOf('FrontPort') + 1);
    assert.ok(charts.indexOf('FrontPortGain') < charts.indexOf('FltMag'));
  });

  it('a passive-radiator box adds the three PR charts, no port chart', () => {
    const charts = engine.chartsFor('box-passive-radiator');
    assert.ok(charts.includes('PRTFMag') && charts.includes('PRTFPhase') && charts.includes('PRExcursion'));
    assert.ok(!charts.includes('RearPort') && !charts.includes('RearPortGain')
      && !charts.includes('FrontPort') && !charts.includes('FrontPortGain'));
    assert.deepEqual([...charts].sort(), [...engine.chartsFor('sealed'), 'PRTFMag', 'PRTFPhase', 'PRExcursion'].sort());
    // WinISD row order: TFMag, Phase, ... Zph, PRTFMag, PRTFPhase, PRExcursion, then the filter trio.
    assert.ok(charts.indexOf('PRTFMag') > charts.indexOf('Zph'));
    assert.ok(charts.indexOf('PRTFPhase') === charts.indexOf('PRTFMag') + 1);
    assert.ok(charts.indexOf('PRExcursion') === charts.indexOf('PRTFPhase') + 1);
    assert.ok(charts.indexOf('PRExcursion') < charts.indexOf('FltMag'));
  });

  it('a 6th-order bandpass box adds RearPort and FrontPort, no gain charts, no PR', () => {
    const charts = engine.chartsFor('bandpass6');
    assert.ok(charts.includes('RearPort'));
    assert.ok(charts.includes('FrontPort'));
    assert.ok(!charts.includes('RearPortGain'));
    assert.ok(!charts.includes('FrontPortGain'));
    assert.deepEqual([...charts].sort(), [...engine.chartsFor('sealed'), 'RearPort', 'FrontPort'].sort());
    // WinISD row order: the port charts sit after Zph, before the filter trio.
    assert.ok(charts.indexOf('RearPort') > charts.indexOf('Zph'));
    assert.ok(charts.indexOf('FrontPort') < charts.indexOf('FltMag'));
  });

  it('an ABC box adds RearPort, FrontPort and IntraPort (its own chart-21 row), no gain charts, no PR', () => {
    const charts = engine.chartsFor('abc');
    assert.ok(charts.includes('RearPort'));
    assert.ok(charts.includes('FrontPort'));
    assert.ok(charts.includes('IntraPort'));
    assert.ok(!charts.includes('RearPortGain'));
    assert.ok(!charts.includes('FrontPortGain'));
    assert.deepEqual([...charts].sort(), [...engine.chartsFor('sealed'), 'RearPort', 'FrontPort', 'IntraPort'].sort());
    // WinISD row order: the port charts sit after Zph, before the filter trio.
    assert.ok(charts.indexOf('RearPort') > charts.indexOf('Zph'));
    assert.ok(charts.indexOf('IntraPort') < charts.indexOf('FltMag'));
  });

  // `chartsFor` used to end in a `default` arm that threw on an unhandled box type, and this
  // test reached it by casting a nonsense string to `BoxType`. Two things retired that: the
  // switch-exhaustiveness lint rule fails the build when a topology is added without an arm, and
  // a cast is no longer permitted anywhere. What remains worth asserting is the boundary the
  // value actually crosses — a stored project cannot carry a box type the engine does not know.
  it('a stored project cannot carry a box type the engine does not know', () => {
    const boxType = openISDProjectJsonSchema.shape.box.shape.boxType;
    for (const known of ['sealed', 'vented', 'bandpass4', 'bandpass6', 'abc', 'box-passive-radiator']) {
      assert.equal(boxType.safeParse(known).success, true, known);
    }
    assert.equal(boxType.safeParse('nonsense').success, false);
  });
});
