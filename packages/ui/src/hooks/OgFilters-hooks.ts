import {computed, type ComputedRef, type Ref} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import type {Engine, Filter, FilterType} from '@openisd/design/engine';

export interface OgFiltersDeps {
  readonly project: ComputedRef<OpenISDProject>;
  readonly changed: Ref<number>;
  readonly engine: Engine;
}

export interface OgFiltersAPI {
  readonly filters: ComputedRef<readonly Filter[]>;
  /** Appends the engine's default filter of `type` under a fresh list id; returns that id. */
  addFilter(type: FilterType): string;
  removeFilter(id: string): void;
  /** Patches exactly this filter's named field; every other filter and field is untouched. */
  patchFilter(id: string, field: keyof Filter, value: number | boolean): void;
}

/**
 * The Filters tab's logic: the project's filter chain read fresh on every change signal, and
 * per-filter mutators straight through to it — no local mirror, no deep watch (the
 * delegate-free pattern `docs/design/REACTIVITY.md` specifies). The starting values of a new
 * filter are the engine's (`Engine.defaultFilter`); the id is this list's row key only.
 */
export function createOgFilters({project, changed, engine}: OgFiltersDeps): OgFiltersAPI {
  // Raw reads (`filters.get()`) are not Vue-tracked; `project` re-fires only on focus swap, so
  // the change signal must be read too, or a quick-add never re-renders the list.
  const filters = computed<readonly Filter[]>(() => {
    void changed.value;
    return project.value.filters.get();
  });

  function addFilter(type: FilterType): string {
    const id = crypto.randomUUID();
    project.value.filters.set([...project.value.filters.get(), {...engine.defaultFilter(type), id}]);
    return id;
  }

  function removeFilter(id: string): void {
    project.value.filters.set(project.value.filters.get().filter(f => f.id !== id));
  }

  function patchFilter(id: string, field: keyof Filter, value: number | boolean): void {
    project.value.filters.set(
      project.value.filters.get().map(f => (f.id === id ? {...f, [field]: value} : f)),
    );
  }

  return {filters, addFilter, removeFilter, patchFilter};
}
