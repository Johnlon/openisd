import {computed, inject, onUnmounted, provide, type App, type ComputedRef, type InjectionKey, type Ref} from 'vue';
import {cloudSyncIsOn, saveTooltip, unsavedSyncList, type UnsavedBar, type UnsavedSyncList} from '@openisd/design/cloud';
import {createUnsavedNudge, type UnsavedNudge} from '../logic/unsavedNudge.js';
import {createBrowserTimer} from '../logic/cloudSyncWiring.js';
import {useApp} from '../logic/app.js';
import {useCloudSync} from './CloudSync-hooks.js';

const UNSAVED_NUDGE: InjectionKey<UnsavedNudge> = Symbol('openisd.unsavedNudge');

/** One nudge for the whole app (App.vue makes it), so "once per project per session" survives a skin switch.
 *  `dialogOpen` says whether any dialog of the app is open: the bar waits for it to close. */
export function provideAppUnsavedNudge(dialogOpen: () => boolean): void {
  const {appState, designIO, logging} = useApp();
  const syncOn = useCloudSyncOn();
  const nudge = createUnsavedNudge({
    openProjects: () => appState.openProjects(),
    hasUnsaved: project => appState.projectHasUnsavedChanges(project),
    nameOf: project => appState.projectDisplayName(project),
    syncOn: () => syncOn.value,
    dialogOpen,
    now: () => Date.now(),
    timer: createBrowserTimer(),
    save: project => designIO.saveProjectRecord(project),
    flash: message => { logging.flash(message); },
  });
  onUnmounted(nudge.stop);
  provide(UNSAVED_NUDGE, nudge);
}

/** Whether Cloud sync is on, for a screen that only needs the Save tooltip. */
export function useCloudSyncOn(): ComputedRef<boolean> {
  const cloud = useCloudSync();
  return computed(() => cloud.sync !== null && cloudSyncIsOn(cloud.status.value));
}

/** Installs a nudge on an app that was not built by App.vue (a test of a shell's hook). */
export function provideUnsavedNudgeTo(app: App, nudge: UnsavedNudge): void {
  app.provide(UNSAVED_NUDGE, nudge);
}

export interface SaveForSyncApi {
  /** Cloud sync is on. */
  readonly syncOn: ComputedRef<boolean>;
  /** The Save button's tooltip: the sync one while sync is on, otherwise `usual`. */
  tooltip(usual: string): string;
  /** The Cloud sync dialog's list of projects with unsaved changes; null when sync is off or none. */
  readonly list: ComputedRef<UnsavedSyncList | null>;
  /** The bar asking to save; null when none is due or a dialog hides it. */
  readonly bar: ComputedRef<UnsavedBar | null>;
  /** Saves the project, then says so; the list and the bar lose it. */
  save(id: string): Promise<void>;
  later(): void;
}

/** What the screens show of "save so Cloud sync can send it"; `dialogOpen` is a dialog of the shell's own that hides the bar. */
export function useSaveForSync(dialogOpen: Readonly<Ref<boolean>>): SaveForSyncApi {
  const nudge = inject(UNSAVED_NUDGE);
  if (!nudge) throw new Error('useSaveForSync(): App.vue must call provideUnsavedNudge()');
  const {appState} = useApp();
  const syncOn = useCloudSyncOn();
  const list = computed(() => {
    void appState.projectChanged.value;
    return unsavedSyncList(syncOn.value, nudge.unsavedProjects());
  });
  const bar = computed(() => (dialogOpen.value || !syncOn.value ? null : nudge.bar.value));
  return {
    syncOn,
    tooltip: usual => saveTooltip(syncOn.value, usual),
    list,
    bar,
    save: async id => { await nudge.save(id); },
    later: () => { nudge.later(); },
  };
}
