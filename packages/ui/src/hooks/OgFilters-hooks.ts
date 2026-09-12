import type { InjectionKey, Ref } from 'vue';
import { computed } from 'vue';
import { useFocusedProject } from '../logic/focusedProjectContext.js';
import type { Filter, FilterType } from '@openisd/design/engine';

export interface OgFiltersAPI {
  readonly filters: Readonly<Ref<readonly Filter[]>>;
  addFilter(type: FilterType): void;
  removeFilter(id: string): void;
  patchFilter(id: string, patch: Partial<Filter>): void;
}

export const OgFiltersKey: InjectionKey<OgFiltersAPI> = Symbol('OgFiltersAPI');

export function useOgFilters(): OgFiltersAPI {
  const project = useFocusedProject();
  const filters = computed<readonly Filter[]>(() => project.value.filters.get());

  function addFilter(type: FilterType): void {
    const defaults: Record<FilterType, Partial<Filter>> = {
      highpass: { fc: 80, Q: 0.7071 },
      lowpass: { fc: 200, Q: 0.7071 },
      linkwitz: { f0: 50, Q0: 0.7, fp: 20, Qp: 0.5 },
      peaking: { fc: 300, Q: 1.0, gain: -6 },
      lowshelf: { fc: 150, Q: 0.7071, gain: 6 },
      highshelf: { fc: 2000, Q: 0.7071, gain: 6 },
    };
    const filter: Filter = {
      id: String(Date.now()),
      type,
      enabled: true,
      ...defaults[type],
    };
    project.value.filters.set([...filters.value, filter]);
  }

  function removeFilter(id: string): void {
    project.value.filters.set(filters.value.filter(f => f.id !== id));
  }

  function patchFilter(id: string, patch: Partial<Filter>): void {
    project.value.filters.set(
      filters.value.map(f => (f.id === id ? { ...f, ...patch } : f)),
    );
  }

  return {
    filters,
    addFilter,
    removeFilter,
    patchFilter,
  };
}
