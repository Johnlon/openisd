import {describe, expect, it} from 'vitest';
import {computed, ref, shallowRef} from 'vue';
import {Engine} from '@openisd/design/engine';
import {OpenISDProject} from '@openisd/design';
import {createOgFilters} from '../../src/hooks/OgFilters-hooks.js';

function setup() {
  const engine = new Engine();
  const project = OpenISDProject.empty(engine);
  const changed = ref(0);
  const api = createOgFilters({project: computed(() => shallowRef(project).value), changed, engine});
  return {engine, project, changed, api};
}

describe('createOgFilters', () => {
  it('quick-add appends the engine-owned default for that type, enabled, with a fresh id, and returns the id', () => {
    const {engine, project, api} = setup();
    const id = api.addFilter('peaking');
    const stored = project.filters.get();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual({...engine.defaultFilter('peaking'), id});
    expect(stored[0]?.enabled).toBe(true);

    const second = api.addFilter('peaking');
    expect(second).not.toBe(id);
    expect(project.filters.get()).toHaveLength(2);
  });

  it('the filters readout re-reads the project when the change signal fires', () => {
    const {project, changed, api} = setup();
    expect(api.filters.value).toHaveLength(0);
    project.filters.set([{id: 'x', type: 'highpass', enabled: true, fc: 30, Q: 0.7}]);
    changed.value++;
    expect(api.filters.value).toHaveLength(1);
  });

  it('remove drops exactly the named filter', () => {
    const {project, api} = setup();
    const a = api.addFilter('highpass');
    const b = api.addFilter('lowpass');
    api.removeFilter(a);
    expect(project.filters.get().map(f => f.id)).toEqual([b]);
  });

  it('patch changes one field of one filter and nothing else', () => {
    const {project, api} = setup();
    const a = api.addFilter('highpass');
    const b = api.addFilter('highpass');
    api.patchFilter(a, 'fc', 120);
    api.patchFilter(b, 'enabled', false);
    const [fa, fb] = project.filters.get();
    expect(fa).toMatchObject({id: a, fc: 120, enabled: true, Q: Math.SQRT1_2});
    expect(fb).toMatchObject({id: b, fc: 80, enabled: false});
  });
});
