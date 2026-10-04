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
  /** The Favorites button: when on, both sections show only starred radiators. */
  readonly favoritesOnly: Readonly<Ref<boolean>>;
  isFavorite(id: string): boolean;
  /** Star or unstar a radiator by its row id; kept for the next session. */
  toggleFavorite(id: string): void;
  toggleFavoritesOnly(): void;
  remove(uuid: string): void;
  close(): void;
}

export const PRBrowserKey: InjectionKey<PRBrowserAPI> = Symbol('PRBrowserAPI');

export function usePRBrowser(emit: (event: 'close') => void): PRBrowserAPI {
  const { myPassiveRadiators, bundledPassiveRadiators, prefs } = useApp();
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

  const favorites = ref<string[]>(prefs.favoritePassiveRadiators());
  // On at the start when there are favourites to show; with none, on would open an empty list.
  const favoritesOnly = ref(favorites.value.length > 0);
  const isFavorite = (id: string): boolean => favorites.value.includes(id);
  function toggleFavorite(id: string): void {
    favorites.value = isFavorite(id) ? favorites.value.filter(k => k !== id) : [...favorites.value, id];
    prefs.setFavoritePassiveRadiators(favorites.value);
  }
  function toggleFavoritesOnly(): void {
    favoritesOnly.value = !favoritesOnly.value;
  }

  const matching = <T extends { id: string; name: string }>(rows: readonly T[], q: string): readonly T[] =>
    rows.filter(r => (!q || r.name.toLowerCase().includes(q)) && (!favoritesOnly.value || isFavorite(r.id)));

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
    favoritesOnly,
    isFavorite,
    toggleFavorite,
    toggleFavoritesOnly,
    remove,
    close,
  };
}
