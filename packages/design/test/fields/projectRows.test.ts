import {describe, expect, it} from 'vitest';
import {
  conflictSuffix,
  emptyBinLabel,
  PROJECT_ROW_ORDERS,
  type ProjectRowOrder,
  type ProjectRowSource,
  projectRow,
  projectRowsFooter,
  saveButtonState,
  savedMessage,
  projectSyncMark,
  splitConflictName,
  viewProjectRows,
} from '../../fields/projectRows.js';

const DAY_MS = new Date(2026, 9, 14, 11, 5).getTime();
const CLOSED = {kind: 'closed'} as const;

function source(name: string, over: Partial<ProjectRowSource<string>> = {}): ProjectRowSource<string> {
  return {
    handle: name,
    key: name,
    name,
    driver: 'Tang Band W5-1138SMF',
    summary: 'Tang Band W5-1138SMF · Vented · 12.0 L',
    phoneSummary: 'W5-1138SMF · Vented · 12.0 L',
    saved: {modifiedMs: DAY_MS, bytes: 22_000, readable: true},
    open: CLOSED,
    sync: 'off',
    ...over,
  };
}

const saved = (modifiedMs: number, bytes = 22_000) => ({modifiedMs, bytes, readable: true});
const open = (over: Partial<{active: boolean; shown: boolean; unsaved: boolean}> = {}) =>
  ({kind: 'open', active: false, shown: true, unsaved: false, colour: '#3366cc', ...over} as const);

describe('splitConflictName', () => {
  it('splits off the tag a conflict copy was named with, and leaves other names whole', () => {
    const copy = `Sub 12${conflictSuffix('iPhone', DAY_MS)}`;
    expect(copy).toBe('Sub 12 (conflict, 14 Oct 2026, iPhone)');
    expect(splitConflictName(copy)).toEqual({stem: 'Sub 12', tag: 'conflict, 14 Oct 2026, iPhone'});
    expect(splitConflictName('Sub 12 (sealed)')).toEqual({stem: 'Sub 12 (sealed)', tag: null});
  });
});

describe('projectRow', () => {
  it('shows a saved project with its date, size, summary and the tag apart from the name', () => {
    const row = projectRow(source('Sub 12 (conflict, 14 Oct 2026, iPhone)', {sync: 'conflict'}));
    expect(row.name).toBe('Sub 12');
    expect(row.title).toBe('Project — Sub 12');
    expect(row.tags).toEqual([{kind: 'conflict', text: 'conflict, 14 Oct 2026, iPhone'}]);
    expect(row.edited).toBe('14 Oct 2026, 11:05');
    expect(row.size).toBe('21.5 KB');
    expect(row.sync).toEqual({mark: 'conflict', glyph: '☁!', text: 'Conflict copy: changed on two devices'});
    expect(row.menu.map(m => m.label)).toEqual(['Open', 'Rename…', 'Duplicate', 'Export (.owpr)', 'Move to Bin', 'Resolve…']);
  });

  it('an open project that is not active offers Make active, Close, Hide and Colour; a hidden one is tagged', () => {
    const inactive = projectRow(source('A', {open: open()}));
    expect(inactive.title).toBe('Project — A');
    expect(inactive.menu.map(m => m.action))
      .toEqual(['makeActive', 'close', 'hide', 'colour', 'rename', 'duplicate', 'export', 'delete']);
    const hidden = projectRow(source('A', {open: open({active: true, shown: false})}));
    expect(hidden.title).toBe('Project — A (Active)');
    expect(hidden.menu.map(m => m.action)).toEqual(['close', 'show', 'colour', 'rename', 'duplicate', 'export', 'delete']);
    expect(hidden.tags).toEqual([{kind: 'hidden', text: 'Hidden'}]);
  });

  it('a project that would not read can only be exported or binned', () => {
    const broken = projectRow(source('Broken', {summary: '', saved: {modifiedMs: DAY_MS, bytes: 10, readable: false}}));
    expect(broken.tags).toEqual([{kind: 'unreadable', text: 'Could not read'}]);
    expect(broken.menu.map(m => m.action)).toEqual(['export', 'delete']);
  });

  it('has no sync mark when cloud sync is off', () => {
    expect(projectRow(source('A')).sync).toBeNull();
  });
});

describe('projectSyncMark', () => {
  it('marks a conflict copy, a project not on Drive yet (syncing while a run goes), and one on Drive', () => {
    const base = {cloudOn: true, running: false, notOnDrive: false, conflictCopy: false};
    expect(projectSyncMark({...base, cloudOn: false})).toBe('off');
    expect(projectSyncMark({...base, conflictCopy: true, notOnDrive: true})).toBe('conflict');
    expect(projectSyncMark({...base, notOnDrive: true})).toBe('waiting');
    expect(projectSyncMark({...base, notOnDrive: true, running: true})).toBe('syncing');
    expect(projectSyncMark(base)).toBe('synced');
  });
});

describe('viewProjectRows', () => {
  const rows = [
    projectRow(source('Sealed try', {saved: saved(200, 30_000), driver: 'Tang Band', summary: 'Tang Band · Sealed · 8.0 L'})),
    projectRow(source('Sub 12 (conflict, 14 Oct 2026, iPhone)', {saved: saved(400), driver: 'Dayton RSS'})),
    projectRow(source('Sub 12', {saved: saved(100, 50_000), driver: 'Dayton RSS', summary: 'Dayton RSS · Vented · 60.0 L'})),
    projectRow(source('New', {saved: saved(500, 0), open: open({active: true}), driver: 'Audax'})),
  ];
  const names = (order: ProjectRowOrder, query = '') => viewProjectRows(rows, order, query).map(r => r.key);

  it('orders by last edited, each conflict copy right after its original', () => {
    expect(names(PROJECT_ROW_ORDERS.NEWEST)).toEqual(['New', 'Sealed try', 'Sub 12', 'Sub 12 (conflict, 14 Oct 2026, iPhone)']);
  });

  it('orders by name, driver and size', () => {
    expect(names(PROJECT_ROW_ORDERS.NAME)).toEqual(['New', 'Sealed try', 'Sub 12', 'Sub 12 (conflict, 14 Oct 2026, iPhone)']);
    expect(names(PROJECT_ROW_ORDERS.DRIVER)).toEqual(['New', 'Sub 12', 'Sub 12 (conflict, 14 Oct 2026, iPhone)', 'Sealed try']);
    expect(names(PROJECT_ROW_ORDERS.SIZE)).toEqual(['Sub 12', 'Sub 12 (conflict, 14 Oct 2026, iPhone)', 'Sealed try', 'New']);
  });

  it('keeps rows matching every word in the name or summary', () => {
    expect(names(PROJECT_ROW_ORDERS.NAME, 'dayton vented')).toEqual(['Sub 12']);
    expect(names(PROJECT_ROW_ORDERS.NAME, '  SEALED ')).toEqual(['Sealed try']);
    expect(names(PROJECT_ROW_ORDERS.NAME, 'iphone')).toEqual(['Sub 12 (conflict, 14 Oct 2026, iPhone)']);
  });

  it('totals the list: count, size and how many are open', () => {
    expect(projectRowsFooter(rows)).toBe('4 projects · 99.6 KB · 1 open');
    expect(projectRowsFooter(rows.slice(0, 1))).toBe('1 project · 29.3 KB · 0 open');
  });

  it('formats the empty bin button label', () => {
    expect(emptyBinLabel('22 KB')).toBe('Empty Bin (22 KB)');
  });
});

describe('the phone Save button', () => {
  it('is lit when the project has unsaved changes and quiet when it is saved', () => {
    expect(saveButtonState(true).lit).toBe(true);
    expect(saveButtonState(false).lit).toBe(false);
  });

  it('says what a tap does, by state', () => {
    expect(saveButtonState(true).title).toBe('Save changes');
    expect(saveButtonState(false).title).toBe('Saved');
  });

  it('confirms a save with the project name', () => {
    expect(savedMessage('Sub 12')).toBe('Saved Sub 12');
  });
});
