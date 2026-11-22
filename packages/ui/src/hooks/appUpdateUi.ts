import {computed, inject, provide, type ComputedRef, type InjectionKey, type Ref} from 'vue';
import {reloadLossConfirm, type ReloadLoss} from '@openisd/design/fields';
import type {UpdateState} from '../logic/appUpdate.js';
import type {ConfirmPort} from '../logic/confirmPort.js';

/** The part of `AppUpdate` a screen uses. */
export interface UpdateUiSource {
  readonly state: Readonly<Ref<UpdateState>>;
  /** What a reload would lose right now (unsaved edits are kept by the session and are not here). */
  losses(): readonly ReloadLoss[];
  acceptOffer(): void;
  dismiss(): void;
  forceRefresh(): Promise<void>;
}

export interface AppUpdateUi {
  /** The "New version available" prompt is showing. */
  readonly offered: ComputedRef<boolean>;
  /** Reload onto the new build, after a question naming what would be lost, when something would. */
  reload(): Promise<void>;
  /** Not now. */
  dismiss(): void;
  /** Force refresh, after the same question. */
  forceRefresh(): Promise<void>;
}

/** What the update prompt and About's Force refresh do for a screen. A reload asks first only when it would
 *  lose something, and the question says what. Unsaved edits of an open project do not count: the stored
 *  session brings them back, still unsaved (T829). */
export function createAppUpdateUi(source: UpdateUiSource, confirm: ConfirmPort): AppUpdateUi {
  async function mayReload(): Promise<boolean> {
    const losses = source.losses();
    return losses.length === 0 || confirm.ask({...reloadLossConfirm(losses)});
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
