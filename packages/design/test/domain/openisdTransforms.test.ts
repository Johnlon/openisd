import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {createEngine} from '../../engine/Engine.js';

describe('ProjectBuilder.vented().alignment — a driver with no design to give', () => {
  it('leaves the box volume as the builder had it', () => {
    const engine = createEngine();
    const named = new ProjectBuilder(OpenISDDriver.empty(engine), engine).vented().alignment('bb4').build();
    const plain = new ProjectBuilder(OpenISDDriver.empty(engine), engine).vented().build();
    expect(named.box.vented.volume_m3.value).toBe(plain.box.vented.volume_m3.value);
    expect(named.box.vented.tuning_goal_hz.value).toBe(plain.box.vented.tuning_goal_hz.value);
  });
});
