/** The Open project list and its Bin view, as both shells show them: the rows, and the Bin's actions. */
import {computed, ref, shallowRef, type ComputedRef, type Ref} from 'vue';
import type {ProjectBin, ProjectRepo} from '@openisd/persistence';
import type {AppState} from '../logic/appState.js';
import type {ConfirmPort} from '../logic/confirmPort.js';
import {deleteForever, emptyBin, moveToBin} from '../logic/projectBinActions.js';
import {PROJECT_LIST_ORDER_LIST, viewProjects, type ProjectListOrder} from '@openisd/design/fields';
import {binRows, binTotalSize, storedProjectRows, type BinRow, type StoredProjectRow} from './storedProjectRows.js';

export interface ProjectBinView {
  /** The saved projects not in the Bin. */
  readonly storedProjects: Ref<StoredProjectRow[]>;
  /** `storedProjects` as the sort order and search box leave them. */
  readonly shownProjects: ComputedRef<StoredProjectRow[]>;
  /** What the search box holds. */
  readonly query: Ref<string>;
  readonly order: Ref<ProjectListOrder>;
  readonly orders: readonly ProjectListOrder[];
  readonly binRows: Ref<BinRow[]>;
  /** The Bin's total size. */
  readonly binTotal: Ref<string>;
  /** Whether the list shows the Bin instead of the projects. */
  readonly binOpen: Ref<boolean>;
  /** "Bin (2)". */
  readonly binLabel: ComputedRef<string>;
  /** Reads both lists again from the store. */
  refresh(): void;
  moveToBin(row: StoredProjectRow): Promise<void>;
  restoreFromBin(row: BinRow): void;
  deleteForever(row: BinRow): Promise<void>;
  emptyBin(): Promise<void>;
}

export interface ProjectBinViewDeps {
  readonly appState: Pick<AppState, 'openProjects' | 'removeProject' | 'projectHasUnsavedChanges'>;
  readonly projectRepo: ProjectRepo;
  readonly projectBin: ProjectBin;
  readonly confirm: ConfirmPort;
  readonly unitTokens: () => Readonly<Record<string, string>>;
  /** Tells the user an action could not be done. */
  readonly alert: (text: string) => void;
}

const NO_ROOM = 'there is no room in browser storage for the backup taken first.';

export function createProjectBinView(deps: ProjectBinViewDeps): ProjectBinView {
  const {projectBin} = deps;
  const storedProjects = ref<StoredProjectRow[]>([]);
  const rows = ref<BinRow[]>([]);
  const binTotal = ref('');
  const binOpen = ref(false);
  const query = ref('');
  const order = shallowRef<ProjectListOrder>(PROJECT_LIST_ORDER_LIST[0]);

  function refresh(): void {
    storedProjects.value = storedProjectRows(projectBin.activeProjects(), deps.unitTokens());
    const binned = projectBin.binned();
    rows.value = binRows(binned);
    binTotal.value = binTotalSize(binned);
  }

  return {
    storedProjects,
    shownProjects: computed(() => viewProjects(storedProjects.value, order.value, query.value)),
    query,
    order,
    orders: PROJECT_LIST_ORDER_LIST,
    binRows: rows,
    binTotal,
    binOpen,
    binLabel: computed(() => `Bin (${rows.value.length})`),
    refresh,
    async moveToBin(row) {
      const result = await moveToBin(deps.appState, deps.projectRepo, projectBin, deps.confirm, row.id, row.name);
      if (result === 'refused') deps.alert(`Could not move "${row.name}" to the Bin: ${NO_ROOM}`);
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
