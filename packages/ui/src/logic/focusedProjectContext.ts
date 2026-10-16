import {computed, type ComputedRef, inject, type InjectionKey, provide} from 'vue';
import type {OpenISDProject} from '@openisd/design';

/**
 * The one place a gated component tree receives WHICH project is focused, reactively.
 *
 * `ui/App.vue` is the ONE top-level null gate (PROMPT_RELEASE_HARDENING plan): it calls
 * `focusedProject()` once, renders the explicit empty state when it is null, and otherwise
 * provides the guaranteed-non-null project here for its whole subtree. A component below the
 * gate reads it through `useFocusedProject()` — never by re-importing `focusedProject()`/
 * `appState.ts` and re-checking null itself, mirroring the existing `logic/app.ts`
 * `useApp()`/`provideApp()` convention this codebase already uses for the composition root's
 * `AppLogic` facade.
 */
export const FOCUSED_PROJECT: InjectionKey<ComputedRef<OpenISDProject>> = Symbol('openisd.focusedProject');

/** Provide the guaranteed-non-null focused project to this component's whole subtree. Called
 *  once, by the gate, inside its non-null branch. */
export function provideFocusedProject(project: ComputedRef<OpenISDProject>): void {
  provide(FOCUSED_PROJECT, project);
}

/** How a gated component reaches the focused project. Throws rather than defaulting: a
 *  component rendered outside the gate is a wiring bug, and a silent fallback would hide it. */
export function useFocusedProject(): ComputedRef<OpenISDProject> {
  const project = inject(FOCUSED_PROJECT);
  if (!project) throw new Error('useFocusedProject(): no focused project provided — rendered outside the top-level gate');
  return project;
}

/** The project the gated panels show: the focused one, or, once none is focused, the last one that
 *  was. Closing the last project removes the gated panels in the same update, but Vue runs their
 *  cleanups and watchers first, and those read the project (16 Oct 2026: the live release crashed
 *  "no project is focused" in such a read; on main, closing the only project with the Enclosure tab
 *  open did the same through the Tune sheet's close). A panel keeps the project it was showing until
 *  it is removed. `require` throws only when no project was ever focused, which the gate rules out. */
export function heldFocusedProject<P>(focused: () => P | null, require: () => P): ComputedRef<P> {
  let last: P | null = null;
  return computed(() => {
    const project = focused();
    if (project !== null) last = project;
    return last ?? require();
  });
}
