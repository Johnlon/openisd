import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {describe, expect, it} from 'vitest';
import type {DriverWiring} from '../../engine/array/driverWiring.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {createEngine} from '../../engine/Engine.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const engine = createEngine();
const converter = new WinIsdProjectConverter(engine);
const wpr = readFileSync(new URL('../winisd/fixtures/sealed-w5-isobarik.wpr', import.meta.url), 'utf8');
const grid: FrequencyGrid = {fmin: 30, fmax: 2000, N: 16};

function imported(text: string) {
  const result = converter.winIsdProjectToOpenIsdProject(text);
  assert.ok(result.value);
  return {project: result.value, notes: result.notes ?? []};
}

function atSameVoltage(project: OpenISDProject): OpenISDProject {
  project.Rs_ohm.set(0);
  project.driveVoltage_V.set(2.83);
  return project;
}

function sweep(project: OpenISDProject) {
  const result = project.sweep(grid);
  assert.ok(result.values);
  return result.values;
}

function reopen(text: string): OpenISDProject {
  const result = OpenISDProject.fromOwprText(text, engine);
  assert.ok(!Array.isArray(result));
  return result;
}

describe('R4, Iso-Barik pair in half the box at the same amplifier voltage', () => {
  it.each<{wiring: DriverWiring; winisd: boolean; spl: number; impedance: number; excursion: number; power: number}>([
    {wiring: 'parallel', winisd: false, spl: 0, impedance: 0.5, excursion: 1, power: 2},
    {wiring: 'series', winisd: false, spl: -6.0206, impedance: 2, excursion: 0.5, power: 0.5},
    {wiring: 'parallel', winisd: true, spl: -6.0206, impedance: 1, excursion: 0.5, power: 1},
    {wiring: 'series', winisd: true, spl: -6.0206, impedance: 1, excursion: 0.5, power: 1},
  ])('$wiring, WinISD numbers $winisd', ({wiring, winisd, spl, impedance, excursion, power}) => {
    const pair = atSameVoltage(imported(wpr).project);
    const single = atSameVoltage(imported(wpr.replace('Isobarik=1', 'Isobarik=0')).project);
    const volume = pair.box.sealed.volume_m3.value;
    assert.ok(volume);
    single.box.sealed.volume_m3.set(volume * 2);
    pair.driverWiring.set(wiring);
    pair.winisdIsobarik.set(winisd);
    const paired = sweep(pair);
    const reference = sweep(single);
    paired.fs.forEach((_, i) => {
      expect(paired.spl[i] - reference.spl[i]).toBeCloseTo(spl, 4);
      expect(paired.zmag[i] / reference.zmag[i]).toBeCloseTo(impedance, 8);
      expect(paired.exc[i] / reference.exc[i]).toBeCloseTo(excursion, 8);
    });
    expect(pair.powerDrive_W.value! / single.powerDrive_W.value!).toBeCloseTo(power, 8);
  });

  it.each<{wiring: DriverWiring; arrayGain: number; loadScale: number; excursion: number; power: number}>([
    {wiring: 'parallel', arrayGain: 6.0206, loadScale: 0.5, excursion: 1, power: 2},
    {wiring: 'series', arrayGain: 0, loadScale: 2, excursion: 0.5, power: 0.5},
  ])("wires two pairs in $wiring and charts the array's load", ({wiring, arrayGain, loadScale, excursion, power}) => {
    const onePair = atSameVoltage(imported(wpr).project);
    onePair.driverWiring.set(wiring);
    const twoPairs = atSameVoltage(imported(wpr).project);
    twoPairs.driverWiring.set(wiring);
    twoPairs.nDrivers.set(2);
    const volume = onePair.box.sealed.volume_m3.value;
    assert.ok(volume);
    twoPairs.box.sealed.volume_m3.set(volume * 2);
    const one = sweep(onePair);
    const two = sweep(twoPairs);
    two.fs.forEach((_, i) => {
      expect(two.spl[i] - one.spl[i]).toBeCloseTo(arrayGain, 4);
      expect(two.zmag[i]).toBeCloseTo(one.zmag[i] * loadScale, 8);
      expect(two.exc[i] / one.exc[i]).toBeCloseTo(excursion, 8);
    });
    expect(twoPairs.powerDrive_W.value! / onePair.powerDrive_W.value!).toBeCloseTo(power, 8);
  });

  it.each([
    {pairs: 4, oneDriverImpedance: false, impedanceRatio: 0.25},
    {pairs: 2, oneDriverImpedance: true, impedanceRatio: 1},
  ])('charts $pairs parallel pairs with "Impedance of one driver" $oneDriverImpedance', ({
    pairs, oneDriverImpedance, impedanceRatio,
  }) => {
    const project = atSameVoltage(imported(wpr).project);
    project.winisdIsobarik.set(false);
    project.driverWiring.set('parallel');
    project.winisdOneDriverImpedance.set(oneDriverImpedance);
    const volume = project.box.sealed.volume_m3.value;
    assert.ok(volume);
    const one = sweep(project);
    project.nDrivers.set(pairs);
    project.box.sealed.volume_m3.set(volume * pairs);
    const array = sweep(project);
    expect(array.zmag[0] / one.zmag[0]).toBeCloseTo(impedanceRatio, 8);
  });
});

describe('Iso-Barik project setting', () => {
  it('starts a new design unticked and wired in parallel', () => {
    const project = ProjectBuilder.empty(engine);
    expect(project.winisdIsobarik.value).toBe(false);
    expect(project.driverWiring.value).toBe('parallel');
  });

  it('opens a WinISD Iso-Barik project unticked, with a note about the WinISD numbers', () => {
    const {project, notes} = imported(wpr);
    expect(project.loading.value).toBe('isobaric');
    expect(project.driverWiring.value).toBe('parallel');
    expect(project.winisdIsobarik.value).toBe(false);
    expect(notes.some(note => note.includes("WinISD's Iso-Barik numbers") && note.includes('6 dB'))).toBe(true);
  });

  it('opens a pre-flag save ticked with the same SPL, excursion and impedance', () => {
    const project = imported(wpr).project;
    project.winisdIsobarik.set(true);
    project.save();
    const legacy = project.toOwprText().replace(/"winisdIsobarik": true,?\n\s*/, '');
    expect(legacy).not.toContain('winisdIsobarik');
    const restored = reopen(legacy);
    expect(restored.winisdIsobarik.value).toBe(true);
    expect(sweep(restored)).toEqual(sweep(project));
  });

  it('reopens an unticked save unticked', () => {
    const project = imported(wpr).project;
    project.winisdIsobarik.set(false);
    project.save();
    expect(reopen(project.toOwprText()).winisdIsobarik.value).toBe(false);
  });
});
