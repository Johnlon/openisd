/** The Projects list and its Bin view, as both shells show them: the rows, and the Bin's actions. */
import {computed, ref, shallowRef, watch, type ComputedRef, type Ref} from 'vue';
import type {ProjectBin, ProjectRepo, StoredProjectListing} from '@openisd/persistence';
import {ProjectSummary, type OpenISDProject} from '@openisd/design';
import type {AppState} from '../logic/appState.js';
import type {ConfirmPort} from '../logic/confirmPort.js';
import {deleteForever, emptyBin, moveToBin} from '../logic/projectBinActions.js';
import {
  PROJECT_ROW_ORDER_LIST,
  PROJECT_SEARCH_FROM_ROWS,
  projectRow,
  projectRowsFooter,
  projectSyncMark,
  type ProjectOpenState,
  type ProjectRow,
  type ProjectRowOrder,
  viewProjectRows,
  scopeProjectRows,
  DEFAULT_PROJECT_LIST_SCOPE,
  type ProjectListScope,
} from '@openisd/design/fields';
import {binRows, binTotalSize, type BinRow} from './binRows.js';

/** What a Projects row stands for: a stored project, open or not. */
export type ProjectHandle =
  {readonly kind: 'saved'; readonly id: string; readonly name: string; readonly open: OpenISDProject | null};

export type ProjectListRow = ProjectRow<ProjectHandle>;

/** What cloud sync says about the saved projects. */
export interface ProjectCloudMarks {
  readonly cloudOn: boolean;
  /** A run is going. */
  readonly running: boolean;
  /** Saved projects Drive does not have as they are now. */
  readonly notOnDrive: ReadonlySet<string>;
  /** Saved projects that are kept conflict copies. */
  readonly conflictCopies: ReadonlySet<string>;
}

export interface ProjectBinView {
  /** Every stored project not in the Bin; the open ones say so. */
  readonly projectRows: ComputedRef<ProjectListRow[]>;
  /** `projectRows` as the sort order and search box leave them. */
  readonly shownProjects: ComputedRef<ProjectListRow[]>;
  /** "35 projects · 770 KB · 2 open". */
  readonly projectsFooter: ComputedRef<string>;
  /** Whether the list is long enough to offer the search box. */
  readonly searchOffered: ComputedRef<boolean>;
  /** What the search box holds. */
  readonly query: Ref<string>;
  readonly order: Ref<ProjectRowOrder>;
  /** Whether the list shows only the open projects or all of them. */
  readonly scope: Ref<ProjectListScope>;
  readonly orders: readonly ProjectRowOrder[];
  readonly binRows: Ref<BinRow[]>;
  /** The Bin's total size. */
  readonly binTotal: Ref<string>;
  /** Whether the list shows the Bin instead of the projects. */
  readonly binOpen: Ref<boolean>;
  /** "Bin (2)". */
  readonly binLabel: ComputedRef<string>;
  /** Reads both lists again from the store. */
  refresh(): void;
  moveToBin(row: ProjectListRow): Promise<void>;
  restoreFromBin(row: BinRow): void;
  deleteForever(row: BinRow): Promise<void>;
  emptyBin(): Promise<void>;
}

export interface ProjectBinViewDeps {
  readonly appState: Pick<AppState, 'openProjects' | 'removeProject' | 'projectHasUnsavedChanges' | 'focusedProject' | 'isTraceVisible' | 'traceVisibilityRevision' | 'projectDisplayName' | 'projectChanged'>;
  readonly projectRepo: ProjectRepo;
  /** Read inside a computed, so the rows follow cloud sync. */
  readonly cloudMarks: () => ProjectCloudMarks;
  readonly projectBin: ProjectBin;
  readonly confirm: ConfirmPort;
  readonly unitTokens: () => Readonly<Record<string, string>>;
  /** Tells the user an action could not be done. */
  readonly alert: (text: string) => void;
}

const NO_ROOM = 'there is no room in browser storage for the backup taken first.';

export function createProjectBinView(deps: ProjectBinViewDeps): ProjectBinView {
  const {projectBin} = deps;
  const listings = shallowRef<readonly StoredProjectListing[]>([]);
  const rows = ref<BinRow[]>([]);
  const binTotal = ref('');
  const binOpen = ref(false);
  const query = ref('');
  const order = shallowRef<ProjectRowOrder>(PROJECT_ROW_ORDER_LIST[0]);
  const scope = ref<ProjectListScope>(DEFAULT_PROJECT_LIST_SCOPE);
  function openState(project: OpenISDProject | null): ProjectOpenState {
    if (project === null) return {kind: 'closed'};
    return {
      kind: 'open',
      active: deps.appState.focusedProject() === project,
      shown: deps.appState.isTraceVisible(project),
      unsaved: deps.appState.projectHasUnsavedChanges(project),
      colour: project.traceColor.value,
    };
  }

  const projectRows = computed<ProjectListRow[]>(() => {
    void deps.appState.traceVisibilityRevision.value;
    void deps.appState.projectChanged.value;
    const units = deps.unitTokens();
    const marks = deps.cloudMarks();
    const open = deps.appState.openProjects();
    const openById = new Map<string, OpenISDProject>();
    for (const project of open) {
      const id = deps.projectRepo.storedIdOf(project);
      if (id !== null && !openById.has(id)) openById.set(id, project);
    }
    return listings.value.map(listing => {
      const project = openById.get(listing.id) ?? null;
      const summary = project !== null ? ProjectSummary.of(project) : listing.kind === 'readable' ? listing.summary : null;
      return projectRow({
        handle: {kind: 'saved', id: listing.id, name: listing.name, open: project},
        key: `saved-${listing.id}`,
        name: project !== null ? deps.appState.projectDisplayName(project) : listing.name,
        driver: summary?.driver ?? '',
        summary: summary?.line(units) ?? '',
        boxDetails: summary?.boxDetails(units),
        phoneSummary: summary?.phoneLine(units) ?? '',
        saved: {modifiedMs: new Date(listing.modified).getTime(), bytes: listing.bytes, readable: listing.kind === 'readable'},
        open: openState(project),
        sync: projectSyncMark({
          cloudOn: marks.cloudOn, running: marks.running,
          notOnDrive: marks.notOnDrive.has(listing.id), conflictCopy: marks.conflictCopies.has(listing.id),
        }),
      });
    });
  });

  function refresh(): void {
    listings.value = projectBin.activeProjects();
    const binned = projectBin.binned();
    rows.value = binRows(binned);
    binTotal.value = binTotalSize(binned);
  }

  refresh();
  // A project is stored when it opens, so the stored list changes with the open projects.
  watch(() => deps.appState.openProjects().length, refresh, {flush: 'post'});

  return {
    projectRows,
    // A word typed while the box was offered stops filtering once the box is gone.
    shownProjects: computed(() => viewProjectRows(scopeProjectRows(projectRows.value, scope.value), order.value, projectRows.value.length > PROJECT_SEARCH_FROM_ROWS ? query.value : '')),
    projectsFooter: computed(() => projectRowsFooter(projectRows.value)),
    searchOffered: computed(() => projectRows.value.length > PROJECT_SEARCH_FROM_ROWS),
    query,
    order,
    scope,
    orders: PROJECT_ROW_ORDER_LIST,
    binRows: rows,
    binTotal,
    binOpen,
    binLabel: computed(() => `Bin (${rows.value.length})`),
    refresh,
    async moveToBin(row) {
      const handle = row.handle;
      if (handle.kind !== 'saved') return;
      const result = await moveToBin(deps.appState, deps.projectRepo, projectBin, deps.confirm, handle.id, handle.name);
      if (result === 'refused') deps.alert(`Could not move "${handle.name}" to the Bin: ${NO_ROOM}`);
      refresh();
    },
    restoreFromBin(row) {
      if (projectBin.restore(row.id) === 'refused') deps.alert(`Could not restore "${row.name}": ${NO_ROOM}`);
      refresh();
    },
    async deleteForever(row) {
      const result = await deleteForever(projectBin, deps.confirm, row.id, row.name);
      if (result === 'refused') deps.alert(`Could not delete "${row.name}": ${NO_ROOM}`);
      refresh();
    },
    async emptyBin() {
      const result = await emptyBin(projectBin, deps.confirm, rows.value.length, binTotal.value);
      if (result === 'refused') deps.alert(`Could not empty the Bin: ${NO_ROOM}`);
      refresh();
    },
  };
}
