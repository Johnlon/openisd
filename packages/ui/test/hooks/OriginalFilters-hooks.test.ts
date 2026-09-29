import {describe, expect, it} from 'vitest';
import {computed, ref, shallowRef} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {OpenISDProject} from '@openisd/design';
import {OriginalFilters} from '../../src/hooks/OriginalFilters-hooks.js';

function setup() {
  const engine = createEngine();
  const project = OpenISDProject.empty(engine);
  const changed = ref(0);
  const api = new OriginalFilters(computed(() => shallowRef(project).value), changed, engine.filters);
  return {engine, project, changed, api};
}

describe('OriginalFilters', () => {
  it('quick-add appends the engine-owned default for that type, enabled, with a fresh id, and returns the id', () => {
    const {engine, project, api} = setup();
    const id = api.add('peaking');
    const stored = project.filters.value;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual({...engine.filters.default('peaking'), id});
    expect(stored[0]?.enabled).toBe(true);

    const second = api.add('peaking');
    expect(second).not.toBe(id);
    expect(project.filters.value).toHaveLength(2);
  });

  it('the filters readout re-reads the project when the change signal fires', () => {
    const {project, changed, api} = setup();
    expect(api.filters.value).toHaveLength(0);
    project.filters.set([{id: 'x', type: 'highpass', family: 'sos', order: 2, enabled: true, fc: 30, Q: 0.7}]);
    changed.value++;
    expect(api.filters.value).toHaveLength(1);
  });

  it('remove drops exactly the named filter', () => {
    const {project, api} = setup();
    const a = api.add('highpass');
    const b = api.add('lowpass');
    api.remove(a);
    expect(project.filters.value.map(f => f.id)).toEqual([b]);
  });

  it('an edit decides the new values through the engine and replaces exactly that filter', () => {
    const {project, api} = setup();
    const a = api.add('highpass');
    const b = api.add('highpass');
    const [fa0, fb0] = project.filters.value;
    if (fa0?.type !== 'highpass' || fb0?.type !== 'highpass') throw new Error('expected highpass');
    api.editPass(fa0, {fc: 120, order: 2.6});
    api.setEnabled(fb0, false);
    const [fa, fb] = project.filters.value;
    expect(fa).toMatchObject({id: a, fc: 120, order: 3, enabled: true, Q: 0.707});
    expect(fb).toMatchObject({id: b, fc: 20, enabled: false});
  });

  it('caption is the engine\'s wording', () => {
    const {api} = setup();
    api.add('staticGain');
    expect(api.caption(api.filters.value[0]!)).toBe('Static gain (Gain=0.00 dB)');
  });
});
