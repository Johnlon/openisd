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
  /** Replaces exactly the filter with this id with `next`; every other filter is untouched.
   *  Whole-filter, not a per-field patch: `Filter` is a sum type, so `keyof Filter` is only its
   *  common keys and cannot name a family-specific field — the caller builds the new filter
   *  (typically `{...current, someField: value}` inside its own narrowed branch) and hands it
   *  over complete. */
  replaceFilter(id: string, next: Filter): void;
  /** WinISD's Filters-list caption for one filter, exact wording (`Engine.filterCaption`). */
  caption(f: Filter): string;
}

/**
 * The Filters tab's logic: the project's filter chain read fresh on every change signal, and
 * per-filter mutators straight through to it — no local mirror, no deep watch (the
 * delegate-free pattern `docs/design/REACTIVITY.md` specifies). The starting values of a new
 * filter and its row caption are both the engine's (`Engine.defaultFilter`, `Engine.filterCaption`);
 * the id is this list's row key only.
 */
export function createOgFilters({project, changed, engine}: OgFiltersDeps): OgFiltersAPI {
  // Raw reads (`filters.value`) are not Vue-tracked; `project` re-fires only on focus swap, so
  // the change signal must be read too, or a quick-add never re-renders the list.
  const filters = computed<readonly Filter[]>(() => {
    void changed.value;
    return project.value.filters.value;
  });

  function addFilter(type: FilterType): string {
    const id = crypto.randomUUID();
    project.value.filters.set([...project.value.filters.value, {...engine.defaultFilter(type), id}]);
    return id;
  }

  function removeFilter(id: string): void {
    project.value.filters.set(project.value.filters.value.filter(f => f.id !== id));
  }

  function replaceFilter(id: string, next: Filter): void {
    project.value.filters.set(
      project.value.filters.value.map(f => (f.id === id ? next : f)),
    );
  }

  function caption(f: Filter): string { return engine.filterCaption(f); }

  return {filters, addFilter, removeFilter, replaceFilter, caption};
}
