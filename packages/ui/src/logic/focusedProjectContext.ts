import { inject, provide, type InjectionKey, type ComputedRef } from 'vue';
import type { ManagedProject } from './managedProject.js';

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
const FOCUSED_PROJECT: InjectionKey<ComputedRef<ManagedProject>> = Symbol('openisd.focusedProject');

/** Provide the guaranteed-non-null focused project to this component's whole subtree. Called
 *  once, by the gate, inside its non-null branch. */
export function provideFocusedProject(project: ComputedRef<ManagedProject>): void {
  provide(FOCUSED_PROJECT, project);
}

/** How a gated component reaches the focused project. Throws rather than defaulting: a
 *  component rendered outside the gate is a wiring bug, and a silent fallback would hide it. */
export function useFocusedProject(): ComputedRef<ManagedProject> {
  const project = inject(FOCUSED_PROJECT);
  if (!project) throw new Error('useFocusedProject(): no focused project provided — rendered outside the top-level gate');
  return project;
}
