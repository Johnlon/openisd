import type {InjectionKey, Ref} from 'vue';
import {computed, ref} from 'vue';
import {useApp} from '../logic/app.js';
import {bundledPassiveRadiatorRows, type PassiveRadiatorRow, passiveRadiatorRows} from '../logic/driverDisplay.js';

export interface PRBrowserAPI {
  readonly filter: Ref<string>;
  readonly fSaved: Readonly<Ref<readonly ReturnType<typeof passiveRadiatorRows>[number][]>>;
  readonly fBundled: Readonly<Ref<readonly ReturnType<typeof passiveRadiatorRows>[number][]>>;
  /** Why the bundled section is empty when the index could not be fetched; '' otherwise. */
  readonly bundledStatus: Readonly<Ref<string>>;
  remove(uuid: string): void;
  close(emit: (event: 'close') => void): void;
}

export const PRBrowserKey: InjectionKey<PRBrowserAPI> = Symbol('PRBrowserAPI');

export function usePRBrowser(emit: (event: 'close') => void): PRBrowserAPI {
  const { myPassiveRadiators, bundledPassiveRadiators } = useApp();
  const filter = ref('');

  const savedRows = ref(passiveRadiatorRows(
    myPassiveRadiators.list().map(e => ({ id: e.uuid, radiator: e.passiveRadiator }))));
  // The bundled section lists the catalogue index — rows keyed by record uuid, fetched when this
  // browser opens (the repo holds them after the first time). A fetch that fails is shown in the
  // section instead of an empty list.
  const bundledRows = ref<readonly PassiveRadiatorRow[]>([]);
  const bundledStatus = ref('');
  void bundledPassiveRadiators.index().then(
    rows => { bundledRows.value = bundledPassiveRadiatorRows(rows); },
    (err: Error) => { bundledStatus.value = err.message; });

  const matching = <T extends { name: string }>(rows: readonly T[], q: string): readonly T[] =>
    q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows;

  const fSaved = computed(() => matching(savedRows.value, filter.value.trim().toLowerCase()));
  const fBundled = computed(() => matching(bundledRows.value, filter.value.trim().toLowerCase()));

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
    bundledStatus,
    remove,
    close,
  };
}
