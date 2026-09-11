import type { InjectionKey, Ref } from 'vue';
import { ref } from 'vue';
import { useApp } from '../logic/app.js';

export interface DriverBrowserWinisdAPI {
  readonly driverBrowsing: ReturnType<typeof useApp>['driverBrowsing'];
  readonly selection: ReturnType<typeof useApp>['selection'];
  readonly deleteChallengeArmed: Ref<boolean>;
  readonly brokenDeleteArmed: Ref<number | null>;
  readonly fileInputEl: Ref<HTMLInputElement | null>;
  requestDeleteAll(): void;
  requestRemoveBroken(key: number): void;
  triggerFileLoad(): void;
  handleItemClick(d: Parameters<ReturnType<typeof useApp>['driverBrowsing']['pickDriver']>[0]): void;
}

export const DriverBrowserWinisdKey: InjectionKey<DriverBrowserWinisdAPI> = Symbol('DriverBrowserWinisdAPI');

export function useDriverBrowserWinisd(): DriverBrowserWinisdAPI {
  const { driverBrowsing, selection } = useApp();
  const deleteChallengeArmed = ref(false);
  const brokenDeleteArmed = ref<number | null>(null);
  const fileInputEl = ref<HTMLInputElement | null>(null);

  function requestDeleteAll(): void {
    if (!driverBrowsing.exportedThisSession.value && !deleteChallengeArmed.value) {
      deleteChallengeArmed.value = true;
      return;
    }
    deleteChallengeArmed.value = false;
    driverBrowsing.deleteAllMyDrivers();
  }

  function requestRemoveBroken(key: number): void {
    if (!driverBrowsing.exportedThisSession.value && brokenDeleteArmed.value !== key) {
      brokenDeleteArmed.value = key;
      return;
    }
    brokenDeleteArmed.value = null;
    driverBrowsing.removeBrokenEntry(key);
  }

  function triggerFileLoad(): void {
    fileInputEl.value?.click();
  }

  function handleItemClick(d: Parameters<ReturnType<typeof useApp>['driverBrowsing']['pickDriver']>[0]): void {
    driverBrowsing.pickDriver(d);
  }

  return {
    driverBrowsing,
    selection,
    deleteChallengeArmed,
    brokenDeleteArmed,
    fileInputEl,
    requestDeleteAll,
    requestRemoveBroken,
    triggerFileLoad,
    handleItemClick,
  };
}
