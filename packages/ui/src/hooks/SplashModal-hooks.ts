import type {ComputedRef, InjectionKey} from 'vue';
import {computed, inject, provide, ref} from 'vue';

/** The persisted flag the splash reads and writes — a member of `presentationState.ui`, named
 *  here so the hook takes the narrow surface it uses rather than the whole presentation
 *  store. */
export interface SplashUi {
  splashSeen?: boolean;
}

/** What the splash needs from the presentation store. */
export interface SplashState {
  readonly ui: SplashUi;
}

export interface SplashModalAPI {
  readonly open: ComputedRef<boolean>;
  /** Close it and record that it was seen — it stays shut on every later visit. */
  dismiss(): void;
  /** Open it again: the Info menu's "About OpenISD". */
  show(): void;
}

export const SplashModalKey: InjectionKey<SplashModalAPI> = Symbol('SplashModalAPI');

/**
 * The splash — shown once, on a first visit, and on demand from the Info menu.
 *
 * "Seen" is a presentation fact, so it rides `presentationState.ui` with the unit tokens and
 * chart colours and persists with them. `open` is derived, not latched, because the stored
 * view arrives AFTER this hook is constructed (`App.vue` restores it on mount): a boolean
 * snapshotted at construction would show the splash to every returning visitor for the frame
 * before the restore, and never close on its own.
 */
export function useSplashModal(state: SplashState): SplashModalAPI {
  const forced = ref(false);
  const open = computed(() => forced.value || state.ui.splashSeen !== true);

  function dismiss(): void {
    forced.value = false;
    state.ui.splashSeen = true;
  }

  function show(): void {
    forced.value = true;
  }

  return {open, dismiss, show};
}

/** Build the one splash the app has and hand it to every descendant. Called by the composition
 *  root (`App.vue`); the shell's Info menu and the modal itself both read that one instance. */
export function provideSplashModal(state: SplashState): SplashModalAPI {
  const api = useSplashModal(state);
  provide(SplashModalKey, api);
  return api;
}

export function injectSplashModal(): SplashModalAPI {
  const api = inject(SplashModalKey);
  if (!api) throw new Error('SplashModal: no provider — App.vue must call provideSplashModal()');
  return api;
}
