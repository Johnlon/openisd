/** The Projects list: every saved project and every open one, as one list. Both skins show these
 *  rows; every text, mark, menu item, order, filter and total comes from here. */
import {formatByteSize, formatCountOf, formatDateTime, formatDay} from './format.js';

/** What a kept conflict copy's name ends in: ' (conflict, 14 Oct 2026, iPhone)'. */
export function conflictSuffix(device: string, at_ms: number): string {
  return ` (conflict, ${formatDay(new Date(at_ms))}, ${device})`;
}

const CONFLICT_NAME = /^(.*\S) \((conflict, [^()]+)\)$/;

/** A name split into the name it was copied from and its conflict tag ("conflict, 14 Oct 2026,
 *  iPhone"); `tag` is null for a name that is not a conflict copy's. */
export function splitConflictName(name: string): {readonly stem: string; readonly tag: string | null} {
  const match = CONFLICT_NAME.exec(name);
  return match === null || match[1] === undefined || match[2] === undefined
    ? {stem: name, tag: null}
    : {stem: match[1], tag: match[2]};
}

/** Where a project stands with cloud sync. `off`: no cloud sync here, so no mark. */
export type ProjectSyncMark = 'off' | 'synced' | 'waiting' | 'syncing' | 'conflict';

/** The mark for one project: a conflict copy is marked as one; a project not yet on Drive is
 *  syncing while a run is going, else waiting. */
export function projectSyncMark(on: {
  readonly cloudOn: boolean;
  readonly running: boolean;
  readonly notOnDrive: boolean;
  readonly conflictCopy: boolean;
}): ProjectSyncMark {
  if (!on.cloudOn) return 'off';
  if (on.conflictCopy) return 'conflict';
  if (on.notOnDrive) return on.running ? 'syncing' : 'waiting';
  return 'synced';
}

const SYNC_SHOWN: Readonly<Record<Exclude<ProjectSyncMark, 'off'>, {readonly glyph: string; readonly text: string}>> = {
  synced: {glyph: '☁✓', text: 'On Google Drive'},
  waiting: {glyph: '☁–', text: 'Not on Google Drive yet'},
  syncing: {glyph: '☁↻', text: 'Going to Google Drive'},
  conflict: {glyph: '☁!', text: 'Conflict copy: changed on two devices'},
};

/** Whether the project is open in the workspace, and how its trace is drawn. */
export type ProjectOpenState =
  | {readonly kind: 'closed'}
  | {
      readonly kind: 'open';
      /** The project the tabs edit. */
      readonly active: boolean;
      /** Its trace is drawn on the charts. */
      readonly shown: boolean;
      /** It has changes not saved yet. */
      readonly unsaved: boolean;
      /** Its trace colour, '#rrggbb'; null before one is given. */
      readonly colour: string | null;
    };

/** Whether the project is saved in this browser. */
export type ProjectSaved =
  | {readonly kind: 'saved'; readonly modifiedMs: number; readonly bytes: number; readonly readable: boolean}
  | {readonly kind: 'notSaved'};

/** One project as the list is told about it. `handle` is the caller's own and comes back on the
 *  row untouched. */
export interface ProjectRowSource<H> {
  readonly handle: H;
  /** Unique in the list, for the skins' row keys. */
  readonly key: string;
  readonly name: string;
  /** The driver's brand and model; '' when not known. */
  readonly driver: string;
  /** "Tang Band W5-1138SMF · Vented · 12.0 L"; '' for a project that would not read. */
  readonly summary: string;
  readonly saved: ProjectSaved;
  readonly open: ProjectOpenState;
  readonly sync: ProjectSyncMark;
}

/** A small label after the name. */
export interface ProjectRowTag {
  readonly kind: 'conflict' | 'hidden' | 'unreadable' | 'notSaved';
  readonly text: string;
}

/** What can be done to a row; the row lists only what applies. */
export type ProjectRowAction =
  | 'open' | 'makeActive' | 'close' | 'show' | 'hide' | 'colour'
  | 'rename' | 'duplicate' | 'export' | 'delete' | 'resolve';

const ACTION_LABELS: Readonly<Record<ProjectRowAction, string>> = {
  open: 'Open',
  makeActive: 'Make active',
  close: 'Close',
  show: 'Show trace',
  hide: 'Hide trace',
  colour: 'Colour…',
  rename: 'Rename…',
  duplicate: 'Duplicate',
  export: 'Export (.owpr)',
  delete: 'Move to Bin',
  resolve: 'Resolve…',
};

export interface ProjectRowMenuItem {
  readonly action: ProjectRowAction;
  readonly label: string;
}

export interface ProjectRow<H> {
  readonly handle: H;
  readonly key: string;
  /** The name without its conflict tag. */
  readonly name: string;
  readonly title: string;
  readonly tags: readonly ProjectRowTag[];
  readonly summary: string;
  /** "5 Oct 2026, 23:32", or "Not saved yet". */
  readonly edited: string;
  /** "22 KB"; '' when not saved. */
  readonly size: string;
  readonly open: ProjectOpenState;
  /** The sync mark; null when cloud sync is off. */
  readonly sync: {readonly mark: Exclude<ProjectSyncMark, 'off'>; readonly glyph: string; readonly text: string} | null;
  /** The row's menu, in the order it is shown. */
  readonly menu: readonly ProjectRowMenuItem[];
  /** For ordering and search. */
  readonly sortKeys: {readonly stem: string; readonly isCopy: boolean; readonly driver: string; readonly modifiedMs: number; readonly bytes: number; readonly text: string};
}

export const PROJECT_LIST_TEXT = {
  TITLE: 'Projects',
  EMPTY: 'No projects yet.',
  NO_MATCH: 'No project matches',
  NEW: 'New',
  NEW_PROJECT: 'New project',
  IMPORT: 'Import',
  EXPORT_ALL: 'Export all',
  SEARCH_PLACEHOLDER: 'Search…',
  SEARCH_ARIA: 'Search projects',
  SORT_ARIA: 'Sort projects',
  MORE_OPTIONS: 'More options',
  BIN_EMPTY: 'The Bin is empty',
  BACK_TO_PROJECTS: 'Back to projects',
  RESTORE: 'Restore',
  DELETE_FOREVER: 'Delete forever',
  UNSAVED_CHANGES: 'Unsaved changes',
  TRACE_CHECKBOX_TITLE: "Show/hide this project's trace on the graph",
  RENAME_ARIA: 'Rename project',
  EXPORTED_TITLE: 'Projects exported',
  EXPORTED_OK: 'OK',
} as const;

/** The popup sentence after Export all: "Exported 12 projects to openisd-projects-2026-10-17.json." */
export function projectsExportedText(count: number, fileName: string): string {
  return `Exported ${formatCountOf(count, 'project')} to ${fileName}.`;
}

function rowMenu(source: ProjectRowSource<unknown>, conflict: boolean): readonly ProjectRowAction[] {
  const saved = source.saved;
  if (saved.kind === 'saved' && !saved.readable) return ['export', 'delete'];
  const open = source.open;
  const actions: ProjectRowAction[] = [];
  if (open.kind === 'closed') {
    actions.push('open');
  } else {
    if (!open.active) actions.push('makeActive');
    actions.push('close', open.shown ? 'hide' : 'show', 'colour');
  }
  actions.push('rename', 'duplicate', 'export');
  if (saved.kind === 'saved') {
    actions.push('delete');
    if (conflict) actions.push('resolve');
  }
  return actions;
}

export function projectRow<H>(source: ProjectRowSource<H>): ProjectRow<H> {
  const {stem, tag} = splitConflictName(source.name);
  const tags: ProjectRowTag[] = [];
  if (tag !== null) tags.push({kind: 'conflict', text: tag});
  const saved = source.saved;
  if (saved.kind === 'saved' && !saved.readable) tags.push({kind: 'unreadable', text: 'Could not read'});
  if (saved.kind === 'notSaved') tags.push({kind: 'notSaved', text: 'Not saved'});
  if (source.open.kind === 'open' && !source.open.shown) tags.push({kind: 'hidden', text: 'Hidden'});
  const sync = source.sync === 'off' ? null : {mark: source.sync, ...SYNC_SHOWN[source.sync]};
  const active = source.open.kind === 'open' && source.open.active;
  return {
    handle: source.handle,
    key: source.key,
    name: stem,
    title: `Project — ${stem}${active ? ' (Active)' : ''}`,
    tags,
    summary: source.summary,
    edited: saved.kind === 'saved' ? formatDateTime(new Date(saved.modifiedMs)) : 'Not saved yet',
    size: saved.kind === 'saved' ? formatByteSize(saved.bytes) : '',
    open: source.open,
    sync,
    menu: rowMenu(source, tag !== null).map(action => ({action, label: ACTION_LABELS[action]})),
    sortKeys: {
      stem,
      isCopy: tag !== null,
      driver: source.driver,
      // A project never saved counts as edited now: it is the newest.
      modifiedMs: saved.kind === 'saved' ? saved.modifiedMs : Number.POSITIVE_INFINITY,
      bytes: saved.kind === 'saved' ? saved.bytes : 0,
      text: `${source.name} ${source.summary}`.toLowerCase(),
    },
  };
}

type SortKeys = ProjectRow<unknown>['sortKeys'];

/** One way to order the list. A conflict copy always sits right after the project it was copied
 *  from (same name), whatever the order. */
export interface ProjectRowOrder {
  readonly label: string;
  /** One short word, for the phone's row of sort tabs (five must fit at 360 px). */
  readonly short: string;
  /** Negative when `a` comes before `b`. */
  readonly compare: (a: SortKeys, b: SortKeys) => number;
}

const byText = (a: string, b: string): number => a.localeCompare(b, undefined, {sensitivity: 'base', numeric: true});
const byName = (a: SortKeys, b: SortKeys): number => byText(a.stem, b.stem);

export const PROJECT_ROW_ORDERS = {
  NEWEST: {label: 'Last edited', short: 'Newest', compare: (a, b) => b.modifiedMs - a.modifiedMs || byName(a, b)},
  OLDEST: {label: 'Oldest first', short: 'Oldest', compare: (a, b) => a.modifiedMs - b.modifiedMs || byName(a, b)},
  NAME: {label: 'Name A–Z', short: 'Name', compare: byName},
  DRIVER: {label: 'Driver', short: 'Driver', compare: (a, b) => byText(a.driver, b.driver) || byName(a, b)},
  SIZE: {label: 'Largest first', short: 'Size', compare: (a, b) => b.bytes - a.bytes || byName(a, b)},
} as const satisfies Record<string, ProjectRowOrder>;

/** The orders in the order the sort menu lists them. */
export const PROJECT_ROW_ORDER_LIST: readonly ProjectRowOrder[] = [
  PROJECT_ROW_ORDERS.NEWEST, PROJECT_ROW_ORDERS.OLDEST, PROJECT_ROW_ORDERS.NAME, PROJECT_ROW_ORDERS.DRIVER, PROJECT_ROW_ORDERS.SIZE,
];

/** The search box shows when the list is longer than this. */
export const PROJECT_SEARCH_FROM_ROWS = 8;

/** `rows` that match every word of `query` in their name or summary, in `order`, each conflict
 *  copy right after its original. A blank query keeps all. */
export function viewProjectRows<H>(rows: readonly ProjectRow<H>[], order: ProjectRowOrder, query: string): ProjectRow<H>[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w !== '');
  const shown = rows.filter(row => words.every(w => row.sortKeys.text.includes(w)));
  const groups = new Map<string, ProjectRow<H>[]>();
  for (const row of shown) {
    const stem = row.sortKeys.stem.toLowerCase();
    groups.set(stem, [...(groups.get(stem) ?? []), row]);
  }
  const inGroup = (a: ProjectRow<H>, b: ProjectRow<H>): number =>
    Number(a.sortKeys.isCopy) - Number(b.sortKeys.isCopy) || order.compare(a.sortKeys, b.sortKeys);
  const sorted = [...groups.values()].map(group => group.sort(inGroup));
  sorted.sort((a, b) => {
    const [first] = a;
    const [second] = b;
    return first === undefined || second === undefined ? 0 : order.compare(first.sortKeys, second.sortKeys);
  });
  return sorted.flat();
}

/** "35 projects · 770 KB · 2 open". */
export function projectRowsFooter(rows: readonly ProjectRow<unknown>[]): string {
  const bytes = rows.reduce((sum, row) => sum + row.sortKeys.bytes, 0);
  const open = rows.filter(row => row.open.kind === 'open').length;
  const count = `${rows.length} ${rows.length === 1 ? 'project' : 'projects'}`;
  return `${count} · ${formatByteSize(bytes)} · ${open} open`;
}

/** "Empty Bin (22 KB)". */
export function emptyBinLabel(total: string): string {
  return `Empty Bin (${total})`;
}

