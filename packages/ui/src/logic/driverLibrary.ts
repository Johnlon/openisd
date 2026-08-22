import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { readMetaCell } from '@openisd/model';
import type { _OpenISDDriverJson } from '@openisd/model';
import { presentationState } from './presentationState.js';
import { readDriverFileText } from './driverFileText.js';
import { DriverFileFormat, sniff } from '../fileFormat.js';
import { DriverScope } from '../driverScope.js';
import { Chip } from '../driverType.js';
import { driverId, type MyDriverRepo } from '../db/myDrivers.js';
import type { PrefsStore } from '../db/prefs.js';
import type { Logging } from '../logging/flash.js';
import {
  driverKey as keyOf, myDriverEntry, myDriverName, matchesCriteria, previewOf,
  normaliseDate, fmtHz, shortSource, driverHasDqIssues, parseRepoInput,
  type DriverRepo, type FileEntry, type Preview,
} from '../db/driverRepo.js';
import { type DriverSelection } from './driverSelection.js';
import { driverFromFileText } from './managedDriver.js';

// The row and summary shapes the presentation layer is handed. `ui` may not import a
// service, so the type it needs to name arrives through the layer that gives it the value.
export type { FileEntry, Preview } from '../db/driverRepo.js';

// The driver library, as the picker experiences it — the ONE implementation of the picker's
// behaviour, shared by every component (ARCHITECTURE.md AD-7). The picker components own
// markup and CSS only.
//
// APPLICATION state, so it lives in `logic`: the search box, the chips, the scope, which row
// is being summarised and what a click does are all decisions about what the app is showing
// and what happens next. The RECORDS come from `driverRepo`, which answers questions and
// hands back rows; it is never asked what is on screen.

export const DISPLAY_LIMIT = 200;   // rows shown before "search to filter" kicks in

// The filter-bar chips, in render order. The set, its labels and its tooltips are
// declared on the Chip enum; which chips a canonical type answers to is carried by
// the DriverType member (`DriverType.Subwoofer.chips`). Nothing is duplicated here.
export const DRIVER_TYPES = Chip.ALL;

// The scope control's segments, in the order it renders them — which IS the click cycle,
// because `DriverScope.next` walks this same array. A template that hand-wrote the three
// labels could disagree with the rotation; reading them off the enum cannot.
export const DRIVER_SCOPES = DriverScope.ALL;

export interface DriverLibrary {
  DRIVER_TYPES: typeof DRIVER_TYPES;
  DRIVER_SCOPES: typeof DRIVER_SCOPES;
  DISPLAY_LIMIT: number;
  allFiles: Ref<FileEntry[]>;
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
  isFavorite(f: FileEntry): boolean;
  toggleFavorite(f: FileEntry): void;
  toggleFavoritesOnly(): void;
  driverKey(f: FileEntry): string;
  driverScope: ComputedRef<DriverScope>;
  cycleDriverScope(): void;
  filteredFiles: ComputedRef<FileEntry[]>;
  displayedFiles: ComputedRef<FileEntry[]>;
  listTruncated: ComputedRef<boolean>;
  listedCount: ComputedRef<number>;
  myDrivers: Ref<_OpenISDDriverJson[]>;
  filteredMyDrivers: ComputedRef<_OpenISDDriverJson[]>;
  myDriverName(d: _OpenISDDriverJson): string;
  myDriverEntry(d: _OpenISDDriverJson): FileEntry;
  driverId(d: _OpenISDDriverJson): string;
  editMyDriver(d: _OpenISDDriverJson): void;
  editOverviewDriver(f: FileEntry): Promise<{ ok: boolean; error?: string }>;
  reloadMyDrivers(): void;
  deleteMyDriver(id: string): void;
  clearMyDrivers(): void;
  customUrl: Ref<string>;
  loadCustom(): Promise<void>;
  previewFile: Ref<FileEntry | null>;
  previewData: ComputedRef<Preview | null>;
  pickFile(f: FileEntry | null): void;
  chooseDriver(f: FileEntry): Promise<void>;
  loadFromDisk(e: Event): void;
  cloneDriver(f: FileEntry): void;
  openedLibrary(): void;
  closeLibrary(): void;
  fmtHz: typeof fmtHz;
  shortSource: typeof shortSource;
  driverHasDqIssues: typeof driverHasDqIssues;
}

export interface DriverLibraryDeps {
  driverRepo: DriverRepo;
  myDriverRepo: MyDriverRepo;
  prefs: PrefsStore;
  logging: Logging;
  selection: DriverSelection;
  /** Asks the user to confirm a destructive action. The browser's `confirm` in the app. */
  confirmReset: (question: string) => boolean;
}

export function createDriverLibrary(deps: DriverLibraryDeps): DriverLibrary {
  const { driverRepo, myDriverRepo, prefs, logging, selection } = deps;

  const allFiles = ref<FileEntry[]>([]);
  const filterQ = ref('');
  const statusMsg = ref('');
  const statusErr = ref(false);
  const customUrl = ref('');
  const initialized = ref(false);
  const typeHelpOpen = ref(false);
  const typeStates = ref<Record<string, string>>({});   // id → 'include' | 'exclude'
  const fsMin = ref('');
  const fsMax = ref('');
  const sdMin = ref('');   // cm²
  const sdMax = ref('');   // cm²
  const selZ = ref<string[]>([]);   // '4', '8', '16'
  const displayLimit = ref(DISPLAY_LIMIT);
  const myDrivers = ref<_OpenISDDriverJson[]>([]);
  const previewFile = ref<FileEntry | null>(null);
  const favorites = ref<string[]>(prefs.favorites());
  const favoritesOnly = ref(false);   // the Favorites button: an on/off filter, like a type chip

  // The scope chip: which POOL is a candidate — bundled, the user's own, or both. It starts
  // at `All`, which is the whole library exactly as the picker listed it before the chip
  // existed. The ref carries `.value`, never the member: Vue's reactive proxy wraps an object
  // held in a `ref` and breaks `===` identity on a singleton (driverType.ts).
  //
  // Not persisted, deliberately — `favoritesOnly` is not either. Both are view state for the
  // session; what persists is the DATA the user created (db/prefs.ts, db/myDrivers.ts).
  const driverScopeValue = ref<string>(DriverScope.All.value);

  /** The scope in force, as a member. */
  const driverScope = computed<DriverScope>(() => {
    const scope = DriverScope.parse(driverScopeValue.value);
    // Only `cycleDriverScope` writes the ref, and it writes a member's own `.value`, so a
    // miss means the enum and its storage have been changed apart — loud, not defaulted.
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

  const driverKey = (f: FileEntry): string => keyOf(f, driverId);

  function isFavorite(f: FileEntry): boolean { return favorites.value.includes(driverKey(f)); }

  /** Star or un-star one driver. Written straight through to storage — a star that lived only
   *  in memory would vanish on the next reload, which reads as the button not having worked. */
  function toggleFavorite(f: FileEntry): void {
    const key = driverKey(f);
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

  /** The filter bar as one question, handed to the repository's predicate. */
  function matchesFilters(f: FileEntry): boolean {
    return matchesCriteria(f, {
      query: filterQ.value,
      typeStates: typeStates.value,
      fsMin: fsMin.value, fsMax: fsMax.value,
      sdMin: sdMin.value, sdMax: sdMax.value,
      selZ: selZ.value,
      favoritesOnly: favoritesOnly.value,
      favorites: favorites.value,
      keyOf: driverKey,
    });
  }

  const filteredFiles = computed<FileEntry[]>(() => {
    // The scope chip gates the whole pool: outside `Bundled`/`All` the library is not a
    // candidate at all, so nothing downstream can put one of its rows back on screen.
    const filtered = (driverScope.value.includesBundled ? allFiles.value : []).filter(matchesFilters);

    const sorted = [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );

    // Flag newer/older files of the same driver so the list can mark them.
    const latestDate: Record<string, string> = {};
    const nameCount: Record<string, number> = {};
    for (const f of sorted) {
      nameCount[f.name] = (nameCount[f.name] || 0) + 1;
      const nd = normaliseDate(f.date);
      if (nd > (latestDate[f.name] || '')) latestDate[f.name] = nd;
    }
    return sorted.map(f => {
      const nd = normaliseDate(f.date);
      const hasDups = nameCount[f.name] > 1;
      const isLatest = hasDups && nd !== '' && nd === latestDate[f.name];
      return { ...f, _nd: nd, _isLatest: isLatest, _isOlder: hasDups && !isLatest };
    });
  });

  const displayedFiles = computed<FileEntry[]>(() => filteredFiles.value.slice(0, displayLimit.value));
  const listTruncated = computed<boolean>(() => filteredFiles.value.length > displayLimit.value);

  // My Drivers answer EVERY control in the filter bar, through the same predicate the pool
  // uses — see matchesCriteria. A section that ignores half the filters is the bug this shape
  // exists to prevent.
  const filteredMyDrivers = computed<_OpenISDDriverJson[]>(() => {
    // The scope chip gates this section exactly as it gates the pool — the two halves of the
    // library are asked the same question, so `Mine` and `Bundled` are true opposites.
    const list = driverScope.value.includesMine ? myDrivers.value : [];
    return list.filter(d => matchesFilters(myDriverEntry(d)));
  });

  /**
   * How many drivers are listed RIGHT NOW, after every filter. Kept apart from `statusMsg`
   * on purpose: a count is not a message. While the pool total was written into `statusMsg`
   * it shadowed this number entirely, and clearing the message — which choosing a driver does
   * — silently switched the display from "the whole pool" to "the filtered list". One number
   * must not mean two things depending on what the user did earlier.
   *
   * BOTH sections count. The list the user is looking at is My Drivers plus the pool, so a
   * count of the pool alone reads as a lie the moment either section is the only one on
   * screen — which is exactly what the scope chip's `My Drivers` position does.
   */
  const listedCount = computed<number>(() => filteredFiles.value.length + filteredMyDrivers.value.length);

  function reloadMyDrivers(): void { myDrivers.value = myDriverRepo.list(); }

  /** Empty the user's saved-driver list, back to the built-in demo samples. */
  function clearMyDrivers(): void {
    if (!deps.confirmReset('Reset your custom drivers list back to the default demo samples?')) return;
    myDriverRepo.replaceAll([]);
    reloadMyDrivers();
  }

  /**
   * Delete one saved driver, by its `<brand>/<model>` identity. Keyed on identity rather
   * than on the displayed label so an entry carrying no `name` is still deletable — with a
   * label comparison, two unnamed drivers both read as the same empty string and the row's
   * ✕ removed the wrong one, or none at all.
   */
  function deleteMyDriver(id: string): void {
    if (!id) return;   // unidentifiable driver: refuse rather than delete an arbitrary row
    myDriverRepo.remove(id);
    reloadMyDrivers();
  }

  // ---- sources ---------------------------------------------------------------------------

  function absorb(fetched: { sourceName: string; entries: FileEntry[] | null; error: string | null }): void {
    if (fetched.error) { statusErr.value = true; statusMsg.value = fetched.error; return; }
    if (!fetched.entries) return;   // a source that will not list is reported by its absence
    allFiles.value = [
      ...allFiles.value.filter(f => f.sourceName !== fetched.sourceName),
      ...fetched.entries,
    ];
    statusMsg.value = '';
  }

  async function loadCustom(): Promise<void> {
    const src = parseRepoInput(customUrl.value);
    if (!src) { statusErr.value = true; statusMsg.value = 'Enter owner/repo or a github.com URL'; return; }
    statusErr.value = false; statusMsg.value = `Loading ${src.name}…`;
    absorb(await driverRepo.fetchSource(src));
    customUrl.value = '';
  }

  async function init(): Promise<void> {
    if (initialized.value) return;
    initialized.value = true;
    statusErr.value = false;

    // 1. Bundled sources load instantly from the pre-built JSON (no network). Every entry
    //    is an `openisd.yml` record, so its fields are read straight off `inputs`.
    allFiles.value = [...allFiles.value, ...driverRepo.bundledEntries()];

    statusMsg.value = '';   // a count is not a message — the pickers render `listedCount`

    // 2. Fetch any non-bundled source from GitHub in the background
    const live = driverRepo.liveSources();
    if (live.length) (await Promise.all(live.map(s => driverRepo.fetchSource(s)))).forEach(absorb);

    statusMsg.value = allFiles.value.length ? '' : 'No drivers loaded — check network';
  }

  // ---- preview ---------------------------------------------------------------------------

  const previewData = computed<Preview | null>(() =>
    previewFile.value ? previewOf(previewFile.value) : null);

  function pickFile(f: FileEntry | null): void { previewFile.value = f; }

  // ---- selection --------------------------------------------------------------------------
  // Choosing a driver COPIES it into the project and closes the picker (docs/design/STATE_MODEL.md) —
  // the user lands back in the project, not in an editor. Editing is a separate act, from
  // the Driver panel.

  async function chooseDriver(f: FileEntry): Promise<void> {
    statusErr.value = false;
    if (!f.content && !f.myDriverData) statusMsg.value = 'Loading ' + f.name + '…';
    const res = await selection.selectDriver(f);
    if (!res.ok) { statusErr.value = true; statusMsg.value = res.error!; return; }
    statusMsg.value = '';
  }

  /**
   * Load File… — a driver file off the user's own disk lands in MY DRIVERS, which is the one
   * destination for every user-created driver. It is not put into the project here: the picker
   * stays open on the new driver's summary, and "Use" embeds it exactly as it embeds any other
   * row. So saving a driver to disk and loading it back returns it to My Drivers, nowhere else.
   */
  function loadFromDisk(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    void readDriverFileText(file).then(({ text }) => {
      // Clear the input whatever happened, so picking the SAME file again still fires `change`.
      input.value = '';
      if (!text) { statusErr.value = true; statusMsg.value = `${file.name} is empty`; return; }
      // The one classifier (`fileFormat.ts`) decides what this file is — by name, falling back
      // to content — so this reader and `useDesignIO.ts`'s import never disagree about a file.
      const format = DriverFileFormat.ofFileName(file.name) ?? sniff(new TextEncoder().encode(text));
      if (!(format instanceof DriverFileFormat)) {
        statusErr.value = true;
        statusMsg.value = `${file.name} is not a driver file (expected .wdr or .owdr)`;
        return;
      }
      const res = driverFromFileText(text, format === DriverFileFormat.Wdr ? 'wdr' : 'owdr', file.name);
      if (!res.ok) { statusErr.value = true; statusMsg.value = res.error; return; }
      // The repositories still hold RECORDS; the driver is asked for its own serialisation at
      // the moment it is filed, rather than anyone upstream carrying the shape around.
      const record = res.driver.toJsonRecord();
      const overwrote = myDriverRepo.upsert(record);
      reloadMyDrivers();
      statusErr.value = false;
      statusMsg.value = '';
      logging.flash(overwrote ? 'Updated in My Drivers' : 'Loaded into My Drivers');
      previewFile.value = myDriverEntry(record);
    }, (err: Error) => {
      input.value = '';
      statusErr.value = true;
      statusMsg.value = err.message;
    });
  }

  /**
   * Clone — fork the driver being summarised into My Drivers under a NEW identity:
   * `brand` unchanged, `model = "Copy of " + <old model>`. That is already a distinct
   * `<brand>/<model>`, so the copy stands beside its source rather than replacing it, and the
   * user can rename it afterwards or leave it as it is.
   *
   * The copy is DISCONNECTED — a driver bag with no link back to the row it came from, whether
   * that row was a library record or another saved driver.
   */
  function cloneDriver(f: FileEntry): void {
    const src = f.myDriverData ?? f.record;
    if (!src) {
      statusErr.value = true;
      statusMsg.value = `Cannot clone ${f.name} — its parameters have not been loaded`;
      return;
    }
    // A deep copy: the clone must share no object with its source, or editing one would edit
    // the other through the record graph they had in common.
    const copy: _OpenISDDriverJson = structuredClone(src);
    // A clone is a DIFFERENT driver, so its model states so — written straight onto the record,
    // because a record in no project has no facade to go through.
    const sourceModel = readMetaCell(copy, 'model').value;
    copy.model = { ...copy.model, value: 'Copy of ' + sourceModel, origin: 'manual' };
    // `sku` and `name` are DerivedFields — the pipeline BUILT them for the source driver, and
    // they name that driver. A clone is a different driver, so it carries neither until
    // something derives them for it.
    // `sku` is required on the record, so it is BLANKED rather than removed: a clone has no
    // canonical identity code of its own until something derives one.
    copy.sku = { value: '', definition: 'canonical identity code', grounds: [] };
    delete copy.name;
    myDriverRepo.upsert(copy);
    reloadMyDrivers();
    statusErr.value = false;
    statusMsg.value = '';
    logging.flash('Cloned to My Drivers');
    previewFile.value = myDriverEntry(copy);
  }

  /** Closing the picker: the preview resets. Nothing is pending — choosing already committed. */
  function closeLibrary(): void {
    previewFile.value = null;
    presentationState.browseOpen = false;
  }

  /** Opening the picker: build the pool once, and refresh the user's saved drivers. */
  function openedLibrary(): void {
    void init();
    reloadMyDrivers();
  }

  // Editing a saved driver rewrites My Drivers while this picker is still open behind the
  // editor, so the list it is showing is stale the moment the editor closes. Re-read it then —
  // otherwise the row keeps its old name until the picker is closed and reopened.
  watch(() => presentationState.editDriverInfo, open => { if (!open && presentationState.browseOpen) reloadMyDrivers(); });

  return {
    // constants
    DRIVER_TYPES, DRIVER_SCOPES, DISPLAY_LIMIT,
    // pool + status
    allFiles, statusMsg, statusErr, initialized,
    // search + filters
    filterQ, typeHelpOpen, typeStates,
    fsMin, fsMax, sdMin, sdMax, selZ, displayLimit,
    toggleType, toggleZ, clearParamFilters,
    // favourites — `clearParamFilters` deliberately leaves favoritesOnly alone: that button
    // says "clear all type and parameter filters", and Favorites is neither. It turns itself off.
    favorites, favoritesOnly, isFavorite, toggleFavorite, toggleFavoritesOnly, driverKey,
    // scope — orthogonal to favourites and to the type/param filters, so `clearParamFilters`
    // leaves it alone for the same reason it leaves `favoritesOnly` alone.
    driverScope, cycleDriverScope,
    // list
    filteredFiles, displayedFiles, listTruncated, listedCount,
    // my drivers
    myDrivers, filteredMyDrivers, myDriverName, myDriverEntry, driverId,
    editMyDriver: selection.editMyDriver,
    editOverviewDriver: selection.editOverviewDriver,
    reloadMyDrivers, deleteMyDriver, clearMyDrivers,
    // custom sources
    customUrl, loadCustom,
    // preview + selection
    previewFile, previewData, pickFile, chooseDriver, loadFromDisk, cloneDriver,
    // lifecycle
    openedLibrary, closeLibrary,
    // formatting helpers used by the markup
    fmtHz, shortSource,
    // DQ
    driverHasDqIssues,
  };
}
