/**
 * `Engine.chartsFor` — which charts a project shows, by box type
 * (bugs/BUG_20260927_winisd-charts-missing.md): a design decision, not a UI one. A chart is
 * listed where it logically applies to a component the box has, never "when the data exists".
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {Engine} from '../../engine/index.js';
import type {BoxType} from '../../engine/index.js';

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

  it('a 4th-order bandpass box adds FrontPort instead, no RearPort, no RearPortGain, no PR', () => {
    const charts = engine.chartsFor('bandpass4');
    assert.ok(charts.includes('FrontPort'));
    assert.ok(!charts.includes('RearPort'));
    assert.ok(!charts.includes('RearPortGain'));
    assert.deepEqual([...charts].sort(), [...engine.chartsFor('sealed'), 'FrontPort'].sort());
  });

  it('a passive-radiator box adds the three PR charts, no port chart', () => {
    const charts = engine.chartsFor('box-passive-radiator');
    assert.ok(charts.includes('PRTFMag') && charts.includes('PRTFPhase') && charts.includes('PRExcursion'));
    assert.ok(!charts.includes('RearPort') && !charts.includes('RearPortGain') && !charts.includes('FrontPort'));
    assert.deepEqual([...charts].sort(), [...engine.chartsFor('sealed'), 'PRTFMag', 'PRTFPhase', 'PRExcursion'].sort());
    // WinISD row order: TFMag, Phase, ... Zph, PRTFMag, PRTFPhase, PRExcursion, then the filter trio.
    assert.ok(charts.indexOf('PRTFMag') > charts.indexOf('Zph'));
    assert.ok(charts.indexOf('PRTFPhase') === charts.indexOf('PRTFMag') + 1);
    assert.ok(charts.indexOf('PRExcursion') === charts.indexOf('PRTFPhase') + 1);
    assert.ok(charts.indexOf('PRExcursion') < charts.indexOf('FltMag'));
  });

  it('bandpass6 and abc (not simulated at all) fall back to the sealed set — never a throw', () => {
    assert.deepEqual(engine.chartsFor('bandpass6'), engine.chartsFor('sealed'));
    assert.deepEqual(engine.chartsFor('abc'), engine.chartsFor('sealed'));
  });

  it('every box type is handled — an unknown value throws rather than silently narrowing', () => {
    assert.throws(() => engine.chartsFor('nonsense' as BoxType), /Unhandled BoxType/);
  });
});
