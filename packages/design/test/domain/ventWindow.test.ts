import {describe, expect, it} from 'vitest';
import {simpleField} from '../../domain/cell.js';
import {VentWindow} from '../../domain/box/ventWindow.js';
import type {VentJson} from '../../domain/openisdSchema.js';
import {createEngine} from '../../engine/Engine.js';

const engine = createEngine();

function windowOver(vent: VentJson): {window: VentWindow; record: () => VentJson} {
  let current = vent;
  const lens = simpleField(() => current, next => { current = next; });
  const window = new VentWindow(lens, engine.vent, () => ({kind: 'notAvailable', issues: []}));
  return {window, record: () => current};
}

const round: VentJson = {shape: 'round', width_m: null, endCorrection_m: 0.732};
const slotted: VentJson = {shape: 'slotted', width_m: 0.2, endCorrection_m: 0.732};

describe('VentWindow without a starting port', () => {
  it('clearing the width leaves it blank', () => {
    const {window, record} = windowOver(slotted);
    window.width_m.clear();
    expect(window.width_m.value).toBeNull();
    expect(record().width_m).toBeNull();
  });

  it('a port with no area has no end-correction length', () => {
    expect(windowOver(round).window.endCorrectionLength_m()).toBeNull();
  });

  it('a port with an area has an end-correction length', () => {
    const {window} = windowOver({...round, area_m2: {state: 'E', value: 0.008}});
    const length = window.endCorrectionLength_m();
    expect(length).not.toBeNull();
    expect(length).toBeGreaterThan(0);
  });

  it('retracting an entered area on a slotted port leaves the height unstated', () => {
    const {window} = windowOver({...slotted, area_m2: {state: 'E', value: 0.01}});
    expect(window.area_m2.entered).toBe(true);
    window.area_m2.clear();
    expect(window.area_m2.value).toBeNull();
    expect(window.height_m.value).toBeNull();
  });

  it('retracting an entered area on a round port leaves the diameter unstated', () => {
    const {window} = windowOver({...round, area_m2: {state: 'E', value: 0.01}});
    window.area_m2.clear();
    expect(window.diameter_m.value).toBeNull();
  });
});
