/** The startup storage popup: asks the shared confirm dialog to show what the design layer says
 *  about the browser's storage, once the splash is out of the way. */
import {watch, type Ref} from 'vue';
import {storagePopup, storagePopupAfterSave, type StorageLevel, type StoragePopup, type StoredUse} from '@openisd/design/fields';
import type {BrowserStoragePort, PersistenceStatus, SaveSignal} from '@openisd/persistence';
import type {ConfirmPort} from './confirmPort.js';

export interface StoragePopupDeps {
  readonly persistence: PersistenceStatus;
  readonly browserStorage: BrowserStoragePort;
  /** What OpenISD holds now. */
  readonly readUse: () => StoredUse;
  readonly confirm: ConfirmPort;
  /** Tells that a write to storage happened. */
  readonly saves: Pick<SaveSignal, 'listen'>;
  /** True while the splash is on screen. */
  readonly splashOpen: Readonly<Ref<boolean>>;
}

function untilFalse(flag: Readonly<Ref<boolean>>): Promise<void> {
  if (!flag.value) return Promise.resolve();
  return new Promise(resolve => {
    const stop = watch(flag, open => { if (!open) { stop(); resolve(); } });
  });
}

async function show(deps: StoragePopupDeps, popup: StoragePopup): Promise<void> {
  switch (popup.kind) {
    case 'none':
      return;
    case 'risk':
      await deps.confirm.ask({title: popup.title, message: popup.message, confirmLabel: 'Close'});
      deps.persistence.acknowledgeRisk(popup.condition);
      return;
    case 'nearlyFull':
      await deps.confirm.ask({title: popup.title, message: popup.message, confirmLabel: 'Close'});
      return;
  }
}

/** Shows the popup when the app has a reason to at startup, and waits for the user to close it.
 *  From then on, each write to storage that takes it across the nearly-full line shows it again. */
export async function showStoragePopup(deps: StoragePopupDeps): Promise<void> {
  const outcome = await deps.persistence.ask();
  const estimate = await deps.browserStorage.estimate();
  await untilFalse(deps.splashOpen);
  const use = deps.readUse();
  const popup = storagePopup({
    outcome,
    browser: deps.browserStorage.browser(),
    use,
    estimate,
    acknowledgedRisk: deps.persistence.acknowledgedRisk(),
  });
  let level: StorageLevel = {use, estimate};
  deps.saves.listen(() => {
    const before = level;
    void (async () => {
      const now = deps.readUse();
      const nowEstimate = await deps.browserStorage.estimate();
      level = {use: now, estimate: nowEstimate};
      await show(deps, storagePopupAfterSave(before, {
        outcome: deps.persistence.outcome(),
        browser: deps.browserStorage.browser(),
        use: now,
        estimate: nowEstimate,
        acknowledgedRisk: deps.persistence.acknowledgedRisk(),
      }));
    })();
  });
  await show(deps, popup);
}
