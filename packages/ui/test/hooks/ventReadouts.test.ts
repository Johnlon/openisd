import {describe, expect, it} from 'vitest';
import {computed, ref, shallowRef} from 'vue';
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import type {BoxType} from '@openisd/design/engine';
import {createVentReadouts} from '../../src/hooks/ventReadouts.js';

function readoutsFor(type: 'bandpass6' | 'abc') {
  const engine = createEngine();
  const builder = new ProjectBuilder(OpenISDDriver.empty(engine), engine);
  const project = type === 'bandpass6' ? builder.bandpass6().build() : builder.abc().build();
  const projectRef = shallowRef(project);
  const readouts = createVentReadouts({
    project: computed(() => projectRef.value),
    projectChanged: ref(0),
    selectedBox: ref<BoxType>(type),
    air: computed(() => engine.environment.solve({}).values),
    vent: engine.vent,
  });
  return {project, readouts};
}

describe('createVentReadouts on a two-chamber box with a ported front', () => {
  for (const type of ['bandpass6', 'abc'] as const) {
    it(`${type}: the active tuning and vent are the front chamber's, not the vented box's`, () => {
      const {project, readouts} = readoutsFor(type);
      readouts.activeTuning.value.set(31.3131);
      readouts.activeVent.value.diameter_m.set(0.0777);
      const chambers = type === 'bandpass6' ? project.box.bandpass6.chambers : project.box.abc.chambers;
      const vents = type === 'bandpass6' ? project.box.bandpass6.vents : project.box.abc.vents;
      expect(chambers.front.tuning_goal_hz.value).toBe(31.3131);
      expect(vents.front.diameter_m.value).toBe(0.0777);
      expect(project.box.vented.tuning_goal_hz.value).not.toBe(31.3131);
    });
  }
});
