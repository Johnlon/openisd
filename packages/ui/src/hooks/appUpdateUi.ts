import {computed, inject, provide, type ComputedRef, type InjectionKey, type Ref} from 'vue';
import {UNSAVED_RELOAD_CONFIRM} from '@openisd/design/fields';
import type {UpdateState} from '../logic/appUpdate.js';
import type {ConfirmPort} from '../logic/confirmPort.js';

/** The part of `AppUpdate` a screen uses. */
export interface UpdateUiSource {
  readonly state: Readonly<Ref<UpdateState>>;
  acceptOffer(): void;
  dismiss(): void;
  forceRefresh(): Promise<void>;
}

export interface AppUpdateUi {
  /** The "New version available" prompt is showing. */
  readonly offered: ComputedRef<boolean>;
  /** Reload onto the new build, after the unsaved-changes question when edits would be lost. */
  reload(): Promise<void>;
  /** Not now. */
  dismiss(): void;
  /** Force refresh, after the same question. */
  forceRefresh(): Promise<void>;
}

/** What the update prompt and About's Force refresh do for a screen. Any reload asks first when an open
 *  project has unsaved edits. */
export function createAppUpdateUi(source: UpdateUiSource, anyUnsaved: () => boolean, confirm: ConfirmPort): AppUpdateUi {
  async function mayReload(): Promise<boolean> {
    return !anyUnsaved() || confirm.ask({...UNSAVED_RELOAD_CONFIRM});
  }
  return {
    offered: computed(() => source.state.value.kind === 'offered'),
    reload: async () => { if (await mayReload()) source.acceptOffer(); },
    dismiss: () => source.dismiss(),
    forceRefresh: async () => { if (await mayReload()) await source.forceRefresh(); },
  };
}

const AppUpdateUiKey: InjectionKey<AppUpdateUi> = Symbol('AppUpdateUi');

/** App.vue hands the one update surface to every descendant (About's Force refresh reads it). */
export function provideAppUpdateUi(ui: AppUpdateUi): void {
  provide(AppUpdateUiKey, ui);
}

export function injectAppUpdateUi(): AppUpdateUi {
  const ui = inject(AppUpdateUiKey);
  if (!ui) throw new Error('AppUpdateUi: no provider — App.vue must call provideAppUpdateUi()');
  return ui;
}
