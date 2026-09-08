import { ref, shallowRef, computed, watch, type Ref, type ComputedRef } from 'vue';
import type { OpenISDDriver } from '@openisd/design';
import { Chip } from '@openisd/design/filter';
import { presentationState } from './presentationState.js';
import { readDriverFileText } from './driverFileText.js';
import { DriverFileFormat, sniff } from '../fileFormat.js';
import { DriverScope } from '../driverScope.js';
import type { Logging } from '../logging/flash.js';
import type {
  DriverRepo, MyDriverRepo, MyDriversRead, BrokenEntry, PrefsRepo,
} from '@openisd/persistence';
import {
  displayNameOf, matchesCriteria, previewSpecsOf, previewTextOf,
  type PreviewSpec, type SearchCriteria,
} from './driverDisplay.js';
import { type DriverSelection, driverFromFileText } from './driverSelection.js';
import { inputFrom } from './domEvents.js';

/** A My Drivers row: the storage uuid this repo minted (the delete/edit handle) plus the driver
 *  itself. The uuid is NOT on the driver — it is the key into the saved-driver map, assigned only
 *  when a driver is in that list. */
export interface MyDriverRow { uuid: string; driver: OpenISDDriver }

/** The preview pane's view of one driver. Built from the driver's own accessors — no record
 *  data, no `FileEntry` wrapper. */
export interface PreviewVM {
  name: string;
  specs: PreviewSpec[];
  links: Array<{ href: string; label: string }>;
  brand: string | null;
  model: string | null;
  series: string | null;
  sku: string | null;
  manufacturer: string | null;
  providedBy: string | null;
  added: string | null;
  description: string | null;
  comment: string | null;
}

/** A driver's identity for the favourites set and the list `v-for` key: `<brand>/<model>`,
 *  lower-cased. Editing brand or model produces a DIFFERENT driver by design — Clone
 *  ("Copy of …") is the deliberate fork — so a star follows this identity, not the row. */
function driverId(d: OpenISDDriver): string {
  return displayNameOf(d).toLowerCase();
}

function previewVMOf(d: OpenISDDriver): PreviewVM {
  const links: Array<{ href: string; label: string }> = [];
  const ds = d.dataSource('manufacturer_datasheet');
  const pp = d.dataSource('manufacturer_product_page');
  const lp = d.dataSource('manufacturer_listing_page');
  if (ds) links.push({ href: ds, label: 'Datasheet (PDF)' });
  if (pp) links.push({ href: pp, label: 'Manufacturer page' });
  if (lp && lp !== pp) links.push({ href: lp, label: 'Listing page' });
  return {
    name: displayNameOf(d),
    specs: previewSpecsOf(d),
    links,
    ...previewTextOf(d),
  };
}

function driverHasDqIssues(d: OpenISDDriver): boolean {
  return d.checkConsistency().length > 0;
}

// The driver library, as the picker experiences it — the ONE implementation of the picker's
// behaviour, shared by every component (ARCHITECTURE.md AD-7). The picker components own
// markup and CSS only.
//
// APPLICATION state, so it lives in `logic`: the search box, the chips, the scope, which row
// is being summarised and what a click does are all decisions about what the app is showing
// and what happens next. The DRIVERS come from `driverRepo`, which answers questions and
// hands back domain objects; it is never asked what is on screen.

export const DISPLAY_LIMIT = 200;   // rows shown before "search to filter" kicks in

// The filter-bar chips, in render order. The set, its labels and its tooltips are
// declared on the Chip enum; which chips a canonical type answers to is carried by
// the DriverType member (`DriverType.Subwoofer.chips`). Nothing is duplicated here.
export const DRIVER_TYPES = Chip.ALL;

// The scope control's segments, in the order it renders them — which IS the click cycle,
// because `DriverScope.next` walks this same array.
export const DRIVER_SCOPES = DriverScope.ALL;

export interface DriverBrowsingState {
  DRIVER_TYPES: typeof DRIVER_TYPES;
  DRIVER_SCOPES: typeof DRIVER_SCOPES;
  DISPLAY_LIMIT: number;
  allDrivers: Ref<OpenISDDriver[]>;
  statusMsg: Ref<string>;
  statusErr: Ref<boolean>;
  initialized: Ref<boolean>;
  filterQ: Ref<string>;
  typeHelpOpen: Ref<boolean>;
  typeStates: Ref<Record<string, string>>;
  fsMin: Ref<string>; fsMax: Ref<string>;
  sdMin: Ref<string>; sdMax: Ref<string>;
  selZ: Ref<string[]>;
  displayLimit: Ref<number>;
  toggleType(id: string): void;
  toggleZ(z: string): void;
  clearParamFilters(): void;
  favorites: Ref<string[]>;
  favoritesOnly: Ref<boolean>;
  isFavorite(d: OpenISDDriver): boolean;
  toggleFavorite(d: OpenISDDriver): void;
  toggleFavoritesOnly(): void;
  driverId(d: OpenISDDriver): string;
  driverScope: ComputedRef<DriverScope>;
  cycleDriverScope(): void;
  filteredDrivers: ComputedRef<OpenISDDriver[]>;
  displayedDrivers: ComputedRef<OpenISDDriver[]>;
  listTruncated: ComputedRef<boolean>;
  listedCount: ComputedRef<number>;
  myDrivers: Ref<MyDriverRow[]>;
  myDriversRead: Ref<MyDriversRead>;
  exportedThisSession: Ref<boolean>;
  exportMyDriversRaw(): void;
  exportBrokenEntry(entry: BrokenEntry): void;
  deleteAllMyDrivers(): void;
  removeBrokenEntry(key: number): void;
  filteredMyDrivers: ComputedRef<MyDriverRow[]>;
  displayNameOf(d: OpenISDDriver): string;
  editMyDriver(d: OpenISDDriver): void;
  editOverviewDriver(d: OpenISDDriver): Promise<{ ok: boolean; error?: string }>;
  reloadMyDrivers(): void;
  deleteMyDriver(uuid: string): void;
  clearMyDrivers(): void;
  previewDriver: Ref<OpenISDDriver | null>;
  previewData: ComputedRef<PreviewVM | null>;
  pickDriver(d: OpenISDDriver | null): void;
  chooseDriver(d: OpenISDDriver): Promise<void>;
  loadFromDisk(e: Event): void;
  cloneDriver(d: OpenISDDriver): void;
  openedLibrary(): void;
  closeLibrary(): void;
  driverHasDqIssues: (d: OpenISDDriver) => boolean;
}

export interface DriverBrowsingStateDeps {
  driverRepo: DriverRepo;
  myDriverRepo: MyDriverRepo;
  prefs: PrefsRepo;
  logging: Logging;
  selection: DriverSelection;
  /** Asks the user to confirm a destructive action. The browser's `confirm` in the app. */
  confirmReset: (question: string) => boolean;
}

export function createDriverBrowsingState(deps: DriverBrowsingStateDeps): DriverBrowsingState {
  const { driverRepo, myDriverRepo, prefs, logging, selection } = deps;

  // `shallowRef`, not `ref`: the arrays hold `OpenISDDriver` — a class with `#private` fields —
  // and Vue's deep `UnwrapRef` mapped type loses that field's nominal branding while unwrapping.
  // Every write here replaces the WHOLE array (never mutates a nested field in place), so shallow
  // reactivity loses nothing.
  const allDrivers = shallowRef<OpenISDDriver[]>([]);
  const filterQ = ref('');
  const statusMsg = ref('');
  const statusErr = ref(false);
  const initialized = ref(false);
  const typeHelpOpen = ref(false);
  const typeStates = ref<Record<string, string>>({});   // id → 'include' | 'exclude'
  const fsMin = ref('');
  const fsMax = ref('');
  const sdMin = ref('');   // cm²
  const sdMax = ref('');   // cm²
  const selZ = ref<string[]>([]);   // '4', '8', '16'
  const displayLimit = ref(DISPLAY_LIMIT);
  const myDrivers = shallowRef<MyDriverRow[]>([]);
  /** The bucket's full read — the My Drivers surface reacts to 'unavailable'/'unreadable'
   *  and to broken rows, which are PRESERVED and surfaced, never hidden (QO81). */
  const myDriversRead = shallowRef<MyDriversRead>({ kind: 'ok', drivers: [], broken: [] });
  /** True once the user has exported the raw bucket this session — the Delete challenge. */
  const exportedThisSession = ref(false);
  const previewDriver = shallowRef<OpenISDDriver | null>(null);
  const favorites = ref<string[]>(prefs.favorites());
  const favoritesOnly = ref(false);   // the Favorites button: an on/off filter, like a type chip

  // The scope chip: which POOL is a candidate — bundled, the user's own, or both. It starts
  // at `All`. The ref carries `.value`, never the member: Vue's reactive proxy wraps an object
  // held in a `ref` and breaks `===` identity on a singleton (driverType.ts).
  const driverScopeValue = ref<string>(DriverScope.All.value);

  /** The scope in force, as a member. */
  const driverScope = computed<DriverScope>(() => {
    const scope = DriverScope.parse(driverScopeValue.value);
    if (scope === null) throw new Error(`unknown driver scope "${driverScopeValue.value}"`);
    return scope;
  });

  /** One click of the chip: Bundled → My Drivers → All → Bundled. */
  function cycleDriverScope(): void {
    driverScopeValue.value = driverScope.value.next.value;
    displayLimit.value = DISPLAY_LIMIT;
  }

  watch(filterQ, () => { displayLimit.value = DISPLAY_LIMIT; });

  function toggleType(id: string): void {
    const cur = typeStates.value[id];
    if (!cur) typeStates.value = { ...typeStates.value, [id]: 'include' };
    else { const s = { ...typeStates.value }; delete s[id]; typeStates.value = s; }
    displayLimit.value = DISPLAY_LIMIT;
  }

  function isFavorite(d: OpenISDDriver): boolean { return favorites.value.includes(driverId(d)); }

  /** Star or un-star one driver. Written straight through to storage — a star that lived only
   *  in memory would vanish on the next reload, which reads as the button not having worked. */
  function toggleFavorite(d: OpenISDDriver): void {
    const key = driverId(d);
    const next = favorites.value.includes(key)
      ? favorites.value.filter(k => k !== key)
      : [...favorites.value, key];
    favorites.value = next;
    prefs.setFavorites(next);
  }

  function toggleFavoritesOnly(): void {
    favoritesOnly.value = !favoritesOnly.value;
    displayLimit.value = DISPLAY_LIMIT;
  }

  function toggleZ(z: string): void {
    const idx = selZ.value.indexOf(z);
    if (idx >= 0) selZ.value.splice(idx, 1); else selZ.value.push(z);
    displayLimit.value = DISPLAY_LIMIT;
  }

  function clearParamFilters(): void {
    typeStates.value = {}; fsMin.value = ''; fsMax.value = '';
    sdMin.value = ''; sdMax.value = ''; selZ.value = [];
    displayLimit.value = DISPLAY_LIMIT;
  }

  /** The filter bar as one question, over a driver. */
  function criteria(): SearchCriteria {
    return {
      query: filterQ.value,
      typeStates: typeStates.value,
      fsMin: fsMin.value, fsMax: fsMax.value,
      sdMin: sdMin.value, sdMax: sdMax.value,
      selZ: selZ.value,
      favoritesOnly: favoritesOnly.value,
      favorites: favorites.value,
      idOf: driverId,
    };
  }

  function matchesFilters(d: OpenISDDriver): boolean {
    return matchesCriteria(d, criteria());
  }

  const filteredDrivers = computed<OpenISDDriver[]>(() => {
    // The scope chip gates the whole pool: outside `Bundled`/`All` the library is not a
    // candidate at all.
    const pool: OpenISDDriver[] = driverScope.value.includesBundled ? allDrivers.value : [];
    return [...pool.filter(matchesFilters)].sort((a, b) =>
      displayNameOf(a).localeCompare(displayNameOf(b), undefined, { sensitivity: 'base' }),
    );
  });

  const displayedDrivers = computed<OpenISDDriver[]>(() => filteredDrivers.value.slice(0, displayLimit.value));
  const listTruncated = computed<boolean>(() => filteredDrivers.value.length > displayLimit.value);

  // My Drivers answer EVERY control in the filter bar, through the same predicate the pool
  // uses. A section that ignores half the filters is the bug this shape exists to prevent.
  const filteredMyDrivers = computed<MyDriverRow[]>(() => {
    const list: MyDriverRow[] = driverScope.value.includesMine ? myDrivers.value : [];
    return list.filter(row => matchesFilters(row.driver));
  });

  /**
   * How many drivers are listed RIGHT NOW, after every filter. BOTH sections count — the list
   * the user is looking at is My Drivers plus the pool, so a count of the pool alone reads as a
   * lie the moment either section is the only one on screen.
   */
  const listedCount = computed<number>(() => filteredDrivers.value.length + filteredMyDrivers.value.length);

  function reloadMyDrivers(): void {
    const read = myDriverRepo.read();
    myDriversRead.value = read;
    myDrivers.value = read.kind === 'ok' ? read.drivers.map(x => ({ uuid: x.uuid, driver: x.driver })) : [];
  }

  /** Download text as a file — the Export the corruption surfaces offer BEFORE any
   *  destructive choice. Marks the session exported, which is what disarms the challenge. */
  function exportMyDriversRaw(): void {
    const raw = myDriverRepo.exportRaw();
    if (raw == null) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    a.download = 'my-drivers-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
    exportedThisSession.value = true;
  }

  function exportBrokenEntry(entry: BrokenEntry): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([entry.raw], { type: 'application/json' }));
    a.download = `my-driver-${entry.key}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    exportedThisSession.value = true;
  }

  function deleteAllMyDrivers(): void {
    myDriverRepo.deleteAll();
    exportedThisSession.value = false;
    reloadMyDrivers();
  }

  function removeBrokenEntry(key: number): void {
    myDriverRepo.removeBroken(key);
    reloadMyDrivers();
  }

  /** Empty the user's saved-driver list, back to the built-in demo samples. */
  function clearMyDrivers(): void {
    if (!deps.confirmReset('Reset your custom drivers list back to the default demo samples?')) return;
    myDriverRepo.replaceAll([]);
    reloadMyDrivers();
  }

  /** Delete one saved driver by its storage uuid — the key the repo minted, never the display
   *  label (two unnamed drivers would both read as the same empty string). */
  function deleteMyDriver(uuid: string): void {
    if (!uuid) return;
    myDriverRepo.remove(uuid);
    reloadMyDrivers();
  }

  // ---- sources ---------------------------------------------------------------------------

  async function init(): Promise<void> {
    if (initialized.value) return;
    initialized.value = true;
    statusErr.value = false;

    // Bundled drivers load instantly from the pre-built JSON (no network). Every entry is an
    // `openisd.yml` record, already constructed into an `OpenISDDriver` by the repo.
    allDrivers.value = [...allDrivers.value, ...driverRepo.bundledDrivers()];

    statusMsg.value = '';   // a count is not a message — the pickers render `listedCount`
  }

  // ---- preview ---------------------------------------------------------------------------

  const previewData = computed<PreviewVM | null>(() =>
    previewDriver.value ? previewVMOf(previewDriver.value) : null);

  function pickDriver(d: OpenISDDriver | null): void { previewDriver.value = d; }

  // ---- selection --------------------------------------------------------------------------
  // Choosing a driver COPIES it into the project and closes the picker (docs/design/STATE_MODEL.md) —
  // the user lands back in the project, not in an editor.

  async function chooseDriver(d: OpenISDDriver): Promise<void> {
    statusErr.value = false;
    const res = await selection.selectDriver(d);
    if (!res.ok) { statusErr.value = true; statusMsg.value = res.error!; return; }
    statusMsg.value = '';
  }

  /**
   * Load File… — a driver file off the user's own disk lands in MY DRIVERS, the one destination
   * for every user-created driver. It is not put into the project here: the picker stays open on
   * the new driver's summary, and "Use" embeds it exactly as it embeds any other row.
   */
  function loadFromDisk(e: Event): void {
    const input = inputFrom(e);
    if (input === null) return;
    const file = input.files?.[0];
    if (!file) return;
    void readDriverFileText(file).then(({ text }) => {
      // Clear the input whatever happened, so picking the SAME file again still fires `change`.
      input.value = '';
      if (!text) { statusErr.value = true; statusMsg.value = `${file.name} is empty`; return; }
      const format = DriverFileFormat.ofFileName(file.name) ?? sniff(new TextEncoder().encode(text));
      if (!(format instanceof DriverFileFormat)) {
        statusErr.value = true;
        statusMsg.value = `${file.name} is not a driver file (expected .wdr or .owdr)`;
        return;
      }
      const res = driverFromFileText(text, format === DriverFileFormat.Wdr ? 'wdr' : 'owdr', file.name);
      if (!res.ok) { statusErr.value = true; statusMsg.value = res.error; return; }
      // A FILE IMPORT always mints a fresh identity (QO81): the file's own uuid is provenance,
      // never the store key — importing twice yields two entries.
      const saved = myDriverRepo.upsert(res.driver);
      reloadMyDrivers();
      if (!saved) { statusErr.value = true; statusMsg.value = 'Saved drivers are read-only until the storage problem is resolved'; return; }
      statusErr.value = false;
      statusMsg.value = '';
      logging.flash('Loaded into My Drivers');
      previewDriver.value = res.driver;
    }, (err: Error) => {
      input.value = '';
      statusErr.value = true;
      statusMsg.value = err.message;
    });
  }

  /**
   * Clone — fork the driver being summarised into My Drivers: `brand` unchanged,
   * `model = "Copy of " + <old model>`. That is already a distinct `<brand>/<model>`, so the
   * copy stands beside its source rather than replacing it. The copy is DETACHED — it shares
   * no state with the driver it came from.
   */
  function cloneDriver(d: OpenISDDriver): void {
    const copy = d.detach();
    copy.renameToCopy();
    const saved = myDriverRepo.upsert(copy);
    reloadMyDrivers();
    if (!saved) {
      statusErr.value = true;
      statusMsg.value = 'Saved drivers are read-only until the storage problem is resolved';
      return;
    }
    statusErr.value = false;
    statusMsg.value = '';
    logging.flash('Cloned to My Drivers');
    previewDriver.value = copy;
  }

  /** Closing the picker: the preview resets. Nothing is pending — choosing already committed. */
  function closeLibrary(): void {
    previewDriver.value = null;
    presentationState.browseOpen = false;
  }

  /** Opening the picker: build the pool once, and refresh the user's saved drivers. */
  function openedLibrary(): void {
    void init();
    reloadMyDrivers();
  }

  // Editing a saved driver rewrites My Drivers while this picker is still open behind the
  // editor, so re-read it when the editor closes — otherwise the row keeps its old name.
  watch(() => presentationState.editDriverInfo, open => { if (!open && presentationState.browseOpen) reloadMyDrivers(); });

  return {
    DRIVER_TYPES, DRIVER_SCOPES, DISPLAY_LIMIT,
    allDrivers, statusMsg, statusErr, initialized,
    filterQ, typeHelpOpen, typeStates,
    fsMin, fsMax, sdMin, sdMax, selZ, displayLimit,
    toggleType, toggleZ, clearParamFilters,
    // favourites — `clearParamFilters` deliberately leaves favoritesOnly alone: that button
    // says "clear all type and parameter filters", and Favorites is neither.
    favorites, favoritesOnly, isFavorite, toggleFavorite, toggleFavoritesOnly, driverId,
    // scope — orthogonal to favourites and to the type/param filters.
    driverScope, cycleDriverScope,
    // list
    filteredDrivers, displayedDrivers, listTruncated, listedCount,
    // my drivers
    myDrivers, filteredMyDrivers, displayNameOf,
    myDriversRead, exportedThisSession, exportMyDriversRaw, exportBrokenEntry,
    deleteAllMyDrivers, removeBrokenEntry,
    editMyDriver: selection.editMyDriver,
    editOverviewDriver: selection.editOverviewDriver,
    reloadMyDrivers, deleteMyDriver, clearMyDrivers,
    // preview + selection
    previewDriver, previewData, pickDriver, chooseDriver, loadFromDisk, cloneDriver,
    // lifecycle
    openedLibrary, closeLibrary,
    // DQ
    driverHasDqIssues,
  };
}
