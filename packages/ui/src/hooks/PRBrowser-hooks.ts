import type { InjectionKey, Ref } from 'vue';
import { ref, computed } from 'vue';
import { useApp } from '../logic/app.js';
import { passiveRadiatorRows } from '../logic/driverDisplay.js';

export interface PRBrowserAPI {
  readonly filter: Ref<string>;
  readonly fSaved: Readonly<Ref<readonly ReturnType<typeof passiveRadiatorRows>[number][]>>;
  readonly fBundled: Readonly<Ref<readonly ReturnType<typeof passiveRadiatorRows>[number][]>>;
  remove(uuid: string): void;
  close(emit: (event: 'close') => void): void;
}

export const PRBrowserKey: InjectionKey<PRBrowserAPI> = Symbol('PRBrowserAPI');

export function usePRBrowser(emit: (event: 'close') => void): PRBrowserAPI {
  const { myPassiveRadiators, bundledPassiveRadiators } = useApp();
  const filter = ref('');

  const savedRows = ref(passiveRadiatorRows(
    myPassiveRadiators.list().map(e => ({ id: e.uuid, radiator: e.passiveRadiator }))));
  const bundledRows = passiveRadiatorRows(
    bundledPassiveRadiators.map((radiator, i) => ({ id: String(i), radiator })));

  const matching = <T extends { name: string }>(rows: readonly T[], q: string): readonly T[] =>
    q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows;

  const fSaved = computed(() => matching(savedRows.value, filter.value.trim().toLowerCase()));
  const fBundled = computed(() => matching(bundledRows, filter.value.trim().toLowerCase()));

  function remove(uuid: string): void {
    myPassiveRadiators.remove(uuid);
    savedRows.value = passiveRadiatorRows(
      myPassiveRadiators.list().map(e => ({ id: e.uuid, radiator: e.passiveRadiator })));
  }

  function close(): void {
    emit('close');
  }

  return {
    filter,
    fSaved,
    fBundled,
    remove,
    close,
  };
}
