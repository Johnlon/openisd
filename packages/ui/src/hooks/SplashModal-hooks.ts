import type {ComputedRef, InjectionKey, Ref} from 'vue';
import {computed, inject, provide, ref, watch} from 'vue';
import type {VersionsView} from '../logic/versionIndex.js';

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

/** How many devices the bundled catalogue holds. Asked only when the splash is on screen —
 *  the indexes are hundreds of kilobytes, and a visitor who never sees the splash must not pay
 *  for them. */
export interface SplashCatalogue {
  driverCount(): Promise<number>;
  passiveRadiatorCount(): Promise<number>;
}

/** The hosted builds, for the Versions list. Asked only when the splash is on screen. */
export interface SplashVersions {
  view(): Promise<VersionsView>;
}

export interface SplashModalAPI {
  readonly open: ComputedRef<boolean>;
  /** Bundled drivers, or null until the catalogue answers — and if it never does. A count the
   *  splash cannot state is a sentence it does not print, not a fault. */
  readonly driverCount: Ref<number | null>;
  /** Bundled passive radiators, on the same terms as `driverCount`. */
  readonly passiveRadiatorCount: Ref<number | null>;
  /** The Versions list; null until the list of hosted builds has been read. */
  readonly versions: Ref<VersionsView | null>;
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
export function useSplashModal(state: SplashState, catalogue?: SplashCatalogue, builds?: SplashVersions): SplashModalAPI {
  const forced = ref(false);
  const open = computed(() => forced.value || state.ui.splashSeen !== true);
  const driverCount = ref<number | null>(null);
  const passiveRadiatorCount = ref<number | null>(null);
  const versions = ref<VersionsView | null>(null);

  let asked = false;
  watch(open, isOpen => {
    if (!isOpen || asked) return;
    asked = true;
    if (builds !== undefined) void builds.view().then(v => { versions.value = v; }, () => { /* no list, no section */ });
    if (catalogue === undefined) return;
    void catalogue.driverCount().then(n => { driverCount.value = n; }, () => { /* no count, no sentence */ });
    void catalogue.passiveRadiatorCount().then(n => { passiveRadiatorCount.value = n; }, () => { /* as above */ });
  }, {immediate: true});

  function dismiss(): void {
    forced.value = false;
    state.ui.splashSeen = true;
  }

  function show(): void {
    forced.value = true;
  }

  return {open, driverCount, passiveRadiatorCount, versions, dismiss, show};
}

/** Build the one splash the app has and hand it to every descendant. Called by the composition
 *  root (`App.vue`); the shell's Info menu and the modal itself both read that one instance. */
export function provideSplashModal(state: SplashState, catalogue: SplashCatalogue, builds: SplashVersions): SplashModalAPI {
  const api = useSplashModal(state, catalogue, builds);
  provide(SplashModalKey, api);
  return api;
}

export function injectSplashModal(): SplashModalAPI {
  const api = inject(SplashModalKey);
  if (!api) throw new Error('SplashModal: no provider — App.vue must call provideSplashModal()');
  return api;
}
