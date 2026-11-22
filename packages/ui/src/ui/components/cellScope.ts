import {inject, provide, type InjectionKey, type Ref} from 'vue';

/**
 * How a view hosting `UIField`s tells them its cells changed, and hears that one was written.
 *
 * The domain's cells are plain objects behind a `shallowRef` (a project) or a draft (the driver
 * editor), so Vue cannot see a cell's value change. Each view already keeps a change counter
 * for its own computeds; it provides that counter here, and every `UIField` under it reads it,
 * so the fields re-render exactly when the view's other readouts do.
 */
export interface CellScope {
  /** Bumped whenever any cell in this view may have changed. */
  readonly revision: Readonly<Ref<number>>;
  /** Called after a `UIField` writes or clears its cell — a view whose cells do not announce
   *  their own writes (the driver editor's draft) bumps its counter here. */
  written(): void;
}

const CELL_SCOPE: InjectionKey<CellScope> = Symbol('CellScope');

/** Make `scope` the change signal for every `UIField` rendered under the calling component. */
export function provideCellScope(scope: CellScope): void {
  provide(CELL_SCOPE, scope);
}

/** The nearest hosting view's change signal. A `UIField` outside any scope is a wiring mistake
 *  that would render stale values, so it fails at mount rather than drifting silently. */
export function useCellScope(): CellScope {
  const scope = inject(CELL_SCOPE, null);
  if (scope === null) throw new Error('UIField rendered outside a CellScope: call provideCellScope in the hosting view');
  return scope;
}
