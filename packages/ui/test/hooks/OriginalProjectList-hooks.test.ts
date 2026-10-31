import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRenderer, defineComponent} from 'vue';
import {ProjectBuilder} from '@openisd/design';
import {createProjectBinView} from '../../src/hooks/projectBinView.js';
import {useOriginalProjectList, type OriginalProjectListEmit, type OriginalProjectListProps} from '../../src/hooks/OriginalProjectList-hooks.js';
import {testAppLogic} from './testAppLogic.js';

type HostNode = {children: HostNode[]; parent: HostNode | null};

class ElementStub {
  value = '';
  style = {left: '', top: ''};
  focus = vi.fn();
  select: (() => void) | undefined = vi.fn();
  click = vi.fn();
  showPicker: (() => void) | undefined = vi.fn();
  getBoundingClientRect() { return {left: 20, top: 30, right: 60, bottom: 70}; }
}

class InputStub extends ElementStub {
  selectionStart = 0;
  checked = false;
}

class SelectStub extends ElementStub {}

class MouseEventStub {
  constructor(readonly clientX: number, readonly clientY: number, readonly detail = 1) {}
}

function isObject(candidate: unknown): candidate is object { return typeof candidate === 'object' && candidate !== null; }
function isElement(candidate: unknown): candidate is HTMLElement { return candidate instanceof ElementStub; }
function isInput(candidate: unknown): candidate is HTMLInputElement { return candidate instanceof InputStub; }
function isEvent(candidate: unknown): candidate is Event { return isObject(candidate) && 'target' in candidate; }
function isMouse(candidate: unknown): candidate is MouseEvent { return candidate instanceof MouseEventStub || (isObject(candidate) && 'currentTarget' in candidate); }
function isRect(candidate: unknown): candidate is DOMRect { return isObject(candidate) && 'bottom' in candidate; }

/** Each helper checks that the stub plays the DOM type, so the checker needs no assertion. */
function elementOf(stub: ElementStub): HTMLElement { const candidate: unknown = stub; if (!isElement(candidate)) throw new Error('not an element'); return candidate; }
function inputOf(stub: InputStub): HTMLInputElement { const candidate: unknown = stub; if (!isInput(candidate)) throw new Error('not an input'); return candidate; }
function eventOf(stub: object): Event { const candidate: unknown = stub; if (!isEvent(candidate)) throw new Error('not an event'); return candidate; }
function mouseOf(stub: object): MouseEvent { const candidate: unknown = stub; if (!isMouse(candidate)) throw new Error('not a mouse event'); return candidate; }
function rectOf(stub: object): DOMRect { const candidate: unknown = stub; if (!isRect(candidate)) throw new Error('not a rect'); return candidate; }

function setupList() {
  const logic = testAppLogic();
  const first = ProjectBuilder.empty(logic.engine);
  first.name.set('First project');
  logic.appState.addProject(first);
  logic.projectRepo.storeNew(first, logic.appState.openProjects());
  const second = ProjectBuilder.empty(logic.engine);
  second.name.set('Second project');
  logic.appState.addProject(second);
  logic.projectRepo.storeNew(second, logic.appState.openProjects());
  const closed = ProjectBuilder.empty(logic.engine);
  closed.name.set('Closed project');
  logic.projectRepo.storeNew(closed, []);
  const view = createProjectBinView({
    appState: logic.appState,
    projectRepo: logic.projectRepo,
    projectBin: logic.projectBin,
    confirm: logic.confirmPort.port,
    cloudMarks: () => ({cloudOn: false, running: false, notOnDrive: new Set(), conflictCopies: new Set()}),
    unitTokens: () => ({}),
    alert: () => undefined,
  });
  const rows = view.projectRows.value;
  const events: unknown[][] = [];
  const emit: OriginalProjectListEmit = (event: string, ...args: unknown[]) => { events.push([event, ...args]); };
  const props: OriginalProjectListProps = {
    projectRows: rows,
    shownProjects: rows,
    projectsFooter: view.projectsFooter.value,
    searchOffered: false,
    projectQuery: '',
    projectOrder: view.order.value,
    projectOrders: view.orders,
    binRows: [],
    binTotal: '0 B',
    binOpen: false,
    binLabel: 'Bin (0)',
    storeLabel: logic.projectRepo.storeLabel,
  };
  const listeners = new Map<string, EventListener>();
  vi.stubGlobal('window', {
    innerWidth: 640,
    innerHeight: 480,
    addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  });
  vi.stubGlobal('Element', ElementStub);
  vi.stubGlobal('HTMLElement', ElementStub);
  vi.stubGlobal('HTMLInputElement', InputStub);
  vi.stubGlobal('HTMLSelectElement', SelectStub);
  vi.stubGlobal('MouseEvent', MouseEventStub);
  let api!: ReturnType<typeof useOriginalProjectList>;
  const renderer = createRenderer<HostNode, HostNode>({
    patchProp: () => undefined,
    insert: (child, parent) => { child.parent = parent; parent.children.push(child); },
    remove: child => { child.parent = null; },
    createElement: () => ({children: [], parent: null}),
    createText: () => ({children: [], parent: null}),
    createComment: () => ({children: [], parent: null}),
    setText: () => undefined,
    setElementText: () => undefined,
    parentNode: node => node.parent,
    nextSibling: () => null,
  });
  const app = renderer.createApp(defineComponent({
    setup() { api = useOriginalProjectList(props, emit); return () => null; },
  }));
  app.mount({children: [], parent: null});
  return {api, app, events, rows, props, listeners};
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useOriginalProjectList', () => {
  it('renames trimmed values, cancels edits and focuses the list when search is unavailable', async () => {
    const {api, app, events, rows, props} = setupList();
    const input = new InputStub();
    api.setRenameInput(input);
    await api.startRename(rows[0]!);
    expect(api.editingRow.value).toBe(rows[0]);
    expect(input.focus).toHaveBeenCalledOnce();
    expect(input.select).toHaveBeenCalledOnce();
    api.editingName.value = '  Renamed  ';
    api.commitRename();
    expect(events.at(-1)).toEqual(['rename', rows[0], 'Renamed']);
    await api.startRename(rows[0]!);
    api.cancelRename();
    api.commitRename();
    api.commitRename();
    expect(events.filter(event => event[0] === 'rename')).toHaveLength(1);
    const list = new ElementStub();
    api.listRef.value = elementOf(list);
    await api.focusSearchOrList();
    expect(list.focus).toHaveBeenCalledOnce();
    props.searchOffered = true;
    const search = new InputStub();
    api.searchInputRef.value = inputOf(search);
    await api.focusSearchOrList();
    expect(search.focus).toHaveBeenCalledOnce();
    expect(search.select).toHaveBeenCalledOnce();
    search.select = undefined;
    await api.focusSearchOrList();
    api.searchInputRef.value = null;
    await api.focusSearchOrList();
    api.listRef.value = null;
    props.searchOffered = false;
    await api.focusSearchOrList();
    api.setRenameInput(null);
    await api.startRename(rows[1]!);
    expect(api.editingRow.value).toBe(rows[1]);
    api.editingName.value = rows[1]!.name;
    api.commitRename();
    await api.startRename(rows[1]!);
    api.editingName.value = '';
    api.commitRename();
    expect(events.filter(event => event[0] === 'rename')).toHaveLength(1);
    api.setRenameInput(new ElementStub());
    expect(api.editingRow.value).toBeNull();
    app.unmount();
  });

  it('routes sort, search, show, row click, menu actions and active-project chart copying', async () => {
    const {api, app, events, rows, props} = setupList();
    const openRow = rows.find(row => row.open.kind === 'open')!;
    const selectEvent = (value: string) => eventOf({target: Object.assign(new SelectStub(), {value})});
    const inputEvent = (value: string) => eventOf({target: Object.assign(new InputStub(), {value})});
    api.onSortChange(selectEvent(props.projectOrders.at(-1)!.label));
    api.onSortChange(selectEvent('unknown order'));
    api.onQueryInput(inputEvent('woofer'));
    api.onToggleShow(openRow, eventOf({target: Object.assign(new InputStub(), {checked: false})}));
    api.onRowClick(openRow);
    expect(events.slice(0, 3).map(event => event[0])).toEqual(['update:projectOrder', 'update:projectQuery', 'setTraceVisible']);
    expect(events.at(-1)).toEqual(['choose', openRow]);
    const activeRow = rows.find(row => row.open.kind === 'open' && row.open.active)!;
    const otherRow = rows.find(row => row !== activeRow)!;
    const closedRow = rows.find(row => row.open.kind === 'closed')!;
    const unreadableRow = {...closedRow, menu: []};
    expect(api.desktopMenuItems(otherRow).some(item => item.action === 'copyCharts')).toBe(true);
    expect(api.desktopMenuItems(activeRow)).toEqual(activeRow.menu);
    expect(api.desktopMenuItems(unreadableRow)).toEqual([]);
    props.projectRows = [];
    expect(api.desktopMenuItems(otherRow)).toEqual(otherRow.menu);
    props.projectRows = rows;
    api.handleMenuAction(openRow, 'copyCharts');
    api.handleMenuAction(openRow, 'duplicate');
    api.handleMenuAction(openRow, 'export');
    api.handleMenuAction(openRow, 'delete');
    api.handleMenuAction(openRow, 'resolve');
    api.handleMenuAction(openRow, 'open');
    api.handleMenuAction(activeRow, 'makeActive');
    api.handleMenuAction(activeRow, 'close');
    api.handleMenuAction(activeRow, 'show');
    api.handleMenuAction(activeRow, 'hide');
    api.handleMenuAction(closedRow, 'close');
    api.handleMenuAction(closedRow, 'show');
    api.handleMenuAction(closedRow, 'hide');
    api.onToggleShow(closedRow, inputEvent(''));
    expect(events.slice(4, 10).map(event => event[0])).toEqual(['copyCharts', 'duplicate', 'export', 'moveToBin', 'resolve', 'choose']);
    api.setRenameInput(new InputStub());
    api.handleMenuAction(openRow, 'rename');
    await Promise.resolve();
    expect(api.editingRow.value).toBe(openRow);
    app.unmount();
  });

  it('positions and dismisses menus and keeps window listeners paired with component lifetime', () => {
    const {api, app, rows, listeners} = setupList();
    const element = new ElementStub();
    api.openRowMenu(rows[0]!, mouseOf({currentTarget: element}));
    expect(api.menuOpen.value?.x).toBe(20);
    expect(api.menuOpen.value?.y).toBe(70);
    api.openRowContextMenu(rows[1]!, mouseOf(new MouseEventStub(400, 300)));
    expect(api.menuOpen.value?.x).toBe(400);
    expect(api.menuOpen.value?.y).toBe(280);
    const keydown = listeners.get('keydown');
    expect(keydown).toBeDefined();
    const escape = Object.assign(new Event('keydown'), {key: 'Escape', stopPropagation: vi.fn()});
    keydown?.(escape);
    expect(api.menuOpen.value).toBeNull();
    expect(escape.stopPropagation).toHaveBeenCalledOnce();
    keydown?.(Object.assign(new Event('keydown'), {key: 'x'}));
    keydown?.(Object.assign(new Event('keydown'), {key: 'Escape', stopPropagation: vi.fn()}));
    api.openRowMenu(rows[0]!, mouseOf({currentTarget: {}}));
    expect(api.menuOpen.value).toBeNull();
    app.unmount();
    expect(listeners.has('click')).toBe(false);
    expect(listeners.has('keydown')).toBe(false);
  });

  it('arbitrates colour clicks and opens the picker from a click, double-click or menu', async () => {
    vi.useFakeTimers();
    const {api, app, events, rows} = setupList();
    const openRow = rows.find(row => row.open.kind === 'open')!;
    const input = new InputStub();
    api.colourInput.value = inputOf(input);
    const project = openRow.handle.open!;
    api.onColourInput(eventOf({target: Object.assign(new InputStub(), {value: '#000000'})}));
    const closedRow = rows.find(row => row.open.kind === 'closed')!;
    api.onColourClick(closedRow, mouseOf(new MouseEventStub(0, 0, 1)));
    api.openColourPicker(closedRow);
    api.colourInput.value = null;
    api.openColourPicker(openRow);
    api.colourInput.value = inputOf(input);
    api.onColourClick(openRow, mouseOf(new MouseEventStub(0, 0, 2)));
    const before = project.traceColor.value;
    api.onColourClick(openRow, mouseOf(new MouseEventStub(80, 90, 1)));
    await vi.advanceTimersByTimeAsync(400);
    expect(events.at(-1)?.[0]).toBe('cycleColor');
    api.openColourPicker(openRow, true, mouseOf(new MouseEventStub(80, 90, 2)));
    expect(events.at(-1)).toEqual(['setColor', project, before]);
    expect(input.value).toBe(before);
    expect(input.style.left).toBe('80px');
    expect(input.style.top).toBe('90px');
    expect(input.showPicker).toHaveBeenCalledOnce();
    api.onColourInput(eventOf({target: Object.assign(new InputStub(), {value: '#123456'})}));
    expect(events.at(-1)).toEqual(['setColor', project, '#123456']);
    api.handleMenuAction(openRow, 'colour', mouseOf({currentTarget: input}));
    api.handleMenuAction(openRow, 'colour');
    app.unmount();
  });

  it('cycles a colour on keyboard activation and falls back to click when showPicker is unavailable', async () => {
    vi.useFakeTimers();
    const {api, app, events, rows} = setupList();
    const openRow = rows.find(row => row.open.kind === 'open')!;
    const project = openRow.handle.open!;
    const input = new InputStub();
    input.showPicker = undefined;
    api.colourInput.value = inputOf(input);
    api.onColourClick(openRow, mouseOf(new MouseEventStub(0, 0, 0)));
    expect(events.at(-1)?.[0]).toBe('cycleColor');
    api.openColourPicker(openRow);
    expect(input.click).toHaveBeenCalledOnce();
    api.openColourPicker(openRow, false, rectOf({left: 100, right: 140, top: 200, bottom: 240}));
    expect(input.style.left).toBe('120px');
    expect(input.style.top).toBe('220px');
    api.onColourClick(openRow, mouseOf(new MouseEventStub(0, 0, 1)));
    api.onColourClick(openRow, mouseOf(new MouseEventStub(0, 0, 1)));
    api.openColourPicker(openRow);
    project.traceColor.set(null);
    api.onColourClick(openRow, mouseOf(new MouseEventStub(0, 0, 1)));
    await vi.advanceTimersByTimeAsync(400);
    api.openColourPicker(openRow, true);
    expect(input.value).toBe('#c9c92e');
    api.onColourClick(openRow, mouseOf(new MouseEventStub(0, 0, 1)));
    const eventsBeforeUnmount = events.length;
    app.unmount();
    await vi.advanceTimersByTimeAsync(400);
    expect(events).toHaveLength(eventsBeforeUnmount);
  });
});
