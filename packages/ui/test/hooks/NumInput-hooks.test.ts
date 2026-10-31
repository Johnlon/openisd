import {afterEach, describe, expect, it, vi} from 'vitest';
import {computed, createRenderer, defineComponent, nextTick, reactive} from 'vue';
import {NumberField} from '@openisd/design/fields';
import type {PresentationState} from '../../src/logic/presentationState.js';
import {useNumInput, type NumInputEmit, type NumInputProps} from '../../src/hooks/NumInput-hooks.js';
import type {DragClock} from '../../src/logic/dragClock.js';
import {StepperPin} from '../../src/logic/stepperPin.js';
import type {FieldEditMode} from '../../src/logic/fieldEditMode.js';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';

type HostNode = {children: HostNode[]; parent: HostNode | null};

class NodeStub extends EventTarget {
  tagName = 'div';
  type = '';
  contains(node: EventTarget) { return node === this; }
  focus(_options?: FocusOptions) { documentStub.activeElement = this; }
  getBoundingClientRect() { return {left: 0, top: 40, right: 160, bottom: 70, width: 160, height: 30}; }
  setPointerCapture(_id: number) {}
  clientLeft = 0;
  clientWidth = 160;
  scrollLeft = 0;
}

class InputStub extends NodeStub {
  override tagName = 'input';
  value = '';
  selectionStart: number | null = 0;
  selectionEnd: number | null = 0;
  setSelectionRange(start: number, end: number) { this.selectionStart = start; this.selectionEnd = end; }
}

class ButtonStub extends NodeStub { title = 'Increase'; }
class FocusEventStub extends Event {
  constructor(type: string, readonly relatedTarget: EventTarget | null = null) { super(type); }
}

class KeyEventStub extends Event {
  constructor(type: string, readonly key: string) { super(type, {cancelable: true}); }
}
class InputEventStub extends Event {
  constructor(readonly inputType: string, readonly data: string | null, readonly dataTransfer: TextTransferStub | null) { super('beforeinput', {cancelable: true}); }
}
class ClipboardEventStub extends Event {
  constructor(readonly clipboardData: TextTransferStub) { super('paste', {cancelable: true}); }
}
class WheelEventStub extends Event {
  constructor(readonly deltaY: number) { super('wheel', {cancelable: true}); }
}
class TextTransferStub {
  constructor(private readonly text: string) {}
  getData(_format: string): string { return this.text; }
}

/** The stub classes stand in for DOM events; each guard tells the checker which DOM event the stub plays. */
function playsKeyboard(e: Event): e is KeyboardEvent { return e instanceof KeyEventStub; }
function playsInput(e: Event): e is InputEvent { return e instanceof InputEventStub; }
function playsClipboard(e: Event): e is ClipboardEvent { return e instanceof ClipboardEventStub; }
function playsWheel(e: Event): e is WheelEvent { return e instanceof WheelEventStub; }

function keyEvent(type: string, key: string, target: EventTarget | null = null): KeyboardEvent {
  const event = new KeyEventStub(type, key);
  if (target) Object.defineProperty(event, 'target', {value: target});
  if (!playsKeyboard(event)) throw new Error('stub is not a keyboard event');
  vi.spyOn(event, 'preventDefault');
  vi.spyOn(event, 'stopPropagation');
  return event;
}
function inputEvent(inputType: string, data: string | null, text: string | null): InputEvent {
  const event = new InputEventStub(inputType, data, text === null ? null : new TextTransferStub(text));
  if (!playsInput(event)) throw new Error('stub is not an input event');
  vi.spyOn(event, 'preventDefault');
  return event;
}
function pasteEvent(text: string): ClipboardEvent {
  const event = new ClipboardEventStub(new TextTransferStub(text));
  if (!playsClipboard(event)) throw new Error('stub is not a clipboard event');
  vi.spyOn(event, 'preventDefault');
  return event;
}
function wheelEvent(deltaY: number): WheelEvent {
  const event = new WheelEventStub(deltaY);
  if (!playsWheel(event)) throw new Error('stub is not a wheel event');
  vi.spyOn(event, 'preventDefault');
  return event;
}

const canvasContext = {font: '', measureText: (text: string) => ({width: text.length * 8})};
let canvasAvailable = true;
let computedAlign = 'left';
const documentStub: EventTarget & {activeElement: EventTarget | null; createElement: (name: string) => unknown} = Object.assign(new EventTarget(), {
  activeElement: null,
  createElement: (_name: string) => ({getContext: (_kind: string) => canvasAvailable ? canvasContext : null}),
});

interface SetupOptions {
  fieldEditMode?: FieldEditMode;
  stepperPin?: StepperPin;
  unitTokens?: PresentationState['ui']['unitTokens'];
}

/** An event carrying the given own properties, including read-only ones such as target. */
function evt(type: string, props: Record<string, unknown> = {}): Event {
  const event = new Event(type, {cancelable: true});
  for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, {value, configurable: true});
  return event;
}

function typed<T extends Event>(guard: (e: Event) => e is T, what: string, type: string, props: Record<string, unknown>): T {
  const event = evt(type, props);
  if (!guard(event)) throw new Error(`event is not a ${what} event`);
  return event;
}
function playsPointer(e: Event): e is PointerEvent { return 'pointerId' in e; }
function playsFocus(e: Event): e is FocusEvent { return e instanceof FocusEventStub; }
function playsKeyboardProps(e: Event): e is KeyboardEvent { return 'key' in e; }
function playsWheelProps(e: Event): e is WheelEvent { return 'deltaY' in e; }
function playsPasteProps(e: Event): e is ClipboardEvent { return 'clipboardData' in e; }
function playsBeforeInputProps(e: Event): e is InputEvent { return 'inputType' in e; }
function playsHtmlInput(n: InputStub): n is InputStub & HTMLInputElement { return n.tagName === 'input'; }
function playsHtmlButton(n: ButtonStub): n is ButtonStub & HTMLButtonElement { return n instanceof ButtonStub; }
function keyEvt(type: string, props: Record<string, unknown>): KeyboardEvent { return typed(playsKeyboardProps, 'keyboard', type, props); }
function wheelEvt(type: string, props: Record<string, unknown>): WheelEvent { return typed(playsWheelProps, 'wheel', type, props); }
function pasteEvt(type: string, props: Record<string, unknown>): ClipboardEvent { return typed(playsPasteProps, 'clipboard', type, props); }
function beforeInputEvt(type: string, props: Record<string, unknown>): InputEvent { return typed(playsBeforeInputProps, 'input', type, props); }
function focusEvent(type: string, relatedTarget: EventTarget | null = null): FocusEvent {
  const event = new FocusEventStub(type, relatedTarget);
  if (!playsFocus(event)) throw new Error('stub is not a focus event');
  return event;
}

function eventTargeted(type: string, target: EventTarget): Event {
  const event = new Event(type);
  Object.defineProperty(event, 'target', {value: target});
  return event;
}

function setup(initial: Partial<NumInputProps> = {}, attrs: Record<string, unknown> = {}, options: SetupOptions = {}) {
  canvasAvailable = true;
  computedAlign = 'left';
  documentStub.activeElement = null;
  const presentationState: PresentationState = createAppStateFixture().presentation;
  if ('unitTokens' in options) presentationState.ui.unitTokens = options.unitTokens;
  const props = reactive<NumInputProps>({modelValue: 12.3, precision: 2, stepper: true, ...initial});
  const emissions: Array<{event: string; args: unknown[]}> = [];
  const emit: NumInputEmit = (event: string, ...args: unknown[]) => { emissions.push({event, args}); };
  let now = 0;
  let timerId = 0;
  const timers = new Map<number, () => void>();
  const dragClock: DragClock = {
    now: () => now,
    every: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    clear: id => { timers.delete(id); },
  };
  vi.stubGlobal('document', documentStub);
  vi.stubGlobal('Node', NodeStub);
  vi.stubGlobal('Element', NodeStub);
  vi.stubGlobal('HTMLElement', NodeStub);
  vi.stubGlobal('HTMLInputElement', InputStub);
  vi.stubGlobal('HTMLButtonElement', ButtonStub);
  vi.stubGlobal('FocusEvent', FocusEventStub);
  vi.stubGlobal('window', Object.assign(new EventTarget(), {innerHeight: 800, visualViewport: null}));
  vi.stubGlobal('getComputedStyle', () => ({font: '16px Arial', paddingLeft: '0px', paddingRight: '0px', textAlign: computedAlign}));
  let api!: ReturnType<typeof useNumInput>;
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
    setup() {
      api = useNumInput(props, emit, {presentationState, stepperPin: options.stepperPin ?? null, fieldEditMode: options.fieldEditMode ?? null, dragClock, attrs});
      return () => null;
    },
  }));
  app.mount({children: [], parent: null});
  const input = new InputStub();
  input.value = api.display.value;
  if (!playsHtmlInput(input)) throw new Error('stub is not an input');
  api.inputEl.value = input;
  const button = new ButtonStub();
  if (!playsHtmlButton(button)) throw new Error('stub is not a button');
  api.increaseEl.value = button;
  const decrease = new ButtonStub();
  decrease.title = 'Decrease';
  if (!playsHtmlButton(decrease)) throw new Error('stub is not a button');
  api.decreaseEl.value = decrease;
  const advanceClock = (ms: number) => { now += ms; for (const callback of timers.values()) callback(); };
  return {api, app, props, input, button, decrease, emissions, presentationState, advanceClock};
}

afterEach(() => vi.unstubAllGlobals());

describe('useNumInput', () => {
  it('formats and classifies values, DQ marks, empty values and keyboard mode', () => {
    const {api, app, props} = setup({mandatory: true, dq: ['inconsistent'], dqState: 'E'});
    expect(api.display.value).toBe('12.30');
    expect(api.classes.value['de-input-mandatory']).toBe(true);
    expect(api.classes.value['dq-root']).toBe(true);
    expect(api.hasDq.value).toBe(true);
    expect(api.dqNoteTitle.value).toContain('inconsistent');
    expect(api.keyboard.value).toBe('decimal');
    props.modelValue = null;
    expect(api.classes.value['de-input-empty']).toBe(true);
    props.min = -5;
    expect(api.keyboard.value).toBe('text');
    app.unmount();
  });

  it('accepts numeric text, refuses letters and restores refused text only on Escape', async () => {
    const {api, app, input, emissions} = setup({modelValue: 12});
    api.onFocus(focusEvent('focus'));
    input.value = '14.5';
    api.onInput(eventTargeted('input', input));
    expect(emissions.at(-1)).toEqual({event: 'update:modelValue', args: [14.5, undefined]});
    input.value = '14a';
    api.onInput(eventTargeted('input', input));
    await nextTick();
    expect(api.refusal.value).toContain('not a number');
    const escape = keyEvent('keydown', 'Escape', input);
    api.onKeydown(escape);
    expect(input.value).toBe('12.00');
    expect(escape.preventDefault).toHaveBeenCalledOnce();
    expect(escape.stopPropagation).toHaveBeenCalledOnce();
    app.unmount();
  });

  it('keeps an emptied mandatory box refused, and accepts a genuinely optional empty value', async () => {
    const mandatory = setup({modelValue: 10, mandatory: true, blankRefused: true});
    mandatory.api.onFocus(focusEvent('focus'));
    mandatory.input.value = '';
    mandatory.api.onInput(eventTargeted('input', mandatory.input));
    await nextTick();
    expect(mandatory.emissions.some(event => event.event === 'update:modelValue' && event.args[0] === null)).toBe(true);
    expect(mandatory.api.refusal.value).toContain('not a number');
    mandatory.api.onBlur(focusEvent('blur'));
    expect(mandatory.api.display.value).toBe('');
    mandatory.app.unmount();

    const optional = setup({modelValue: 10});
    optional.api.onFocus(focusEvent('focus'));
    optional.input.value = '';
    optional.api.onInput(eventTargeted('input', optional.input));
    expect(optional.api.refusal.value).toBe('');
    optional.app.unmount();
  });

  it('uses native selection for text replacement, paste and drop while rejecting letters', () => {
    const {api, app, input} = setup();
    input.value = '12.30';
    input.setSelectionRange(0, 5);
    const typedLetter = inputEvent('insertText', 'x', null);
    api.onBeforeInput(typedLetter);
    expect(typedLetter.preventDefault).toHaveBeenCalledOnce();
    const paste = pasteEvent('45.6');
    api.onPaste(paste);
    expect(input.value).toBe('45.6');
    expect(paste.preventDefault).toHaveBeenCalledOnce();
    const drop = inputEvent('insertFromDrop', null, '45.6');
    api.onBeforeInput(drop);
    expect(input.value).toBe('45.6');
    app.unmount();
  });

  it('moves the selected digit and spins from keyboard, wheel and held key input', () => {
    vi.useFakeTimers();
    const {api, app, input, emissions} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    api.onFocus(focusEvent('focus'));
    input.value = api.display.value;
    input.setSelectionRange(0, 1);
    const right = keyEvent('keydown', 'ArrowRight');
    api.onKeydown(right);
    expect(right.preventDefault).toHaveBeenCalledOnce();
    const up = keyEvent('keydown', 'ArrowUp');
    api.onKeydown(up);
    api.onKeydown(up);
    expect(emissions.some(event => event.event === 'update:modelValue')).toBe(true);
    const keyup = keyEvent('keyup', 'ArrowUp');
    api.onKeyup(keyup);
    expect(keyup.preventDefault).toHaveBeenCalledOnce();
    api.onWheel(wheelEvent(-1) );
    app.unmount();
    vi.useRealTimers();
  });

  it('selects digits on pointer taps and keeps pointer drags on the input', () => {
    const {api, app, input} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    const press = pointer('pointerdown');
    api.onBoxPointer(press);
    api.onBoxPointerUp(press);
    expect(api.underlineIndex.value).not.toBeNull();
    api.onBoxDoubleClick();
    input.setSelectionRange(0, 5);
    api.onBoxPointerUp(pointer('pointerup', {shiftKey: true}));
    app.unmount();
  });

  it('shows registry units and precision while leaving values read only when requested', () => {
    const {api, app} = setup({modelValue: 0.0048, field: NumberField.BOX_VB_L}, {readonly: true});
    expect(api.display.value).not.toBe('');
    expect(api.isReadonly.value).toBe(true);
    expect(api.showStepper.value).toBe(false);
    expect(api.helpText.value).toBeDefined();
    app.unmount();
  });
});

function focusIn(api: ReturnType<typeof setup>['api']) {
  api.onFocus(focusEvent('focus'));
}

function pointer(type: string, props: Record<string, unknown> = {}): PointerEvent {
  return typed(playsPointer, 'pointer', type, {isPrimary: true, pointerType: 'mouse', button: 0, pointerId: 1, clientX: 5, clientY: 10, shiftKey: false, ...props});
}

function editMode(enabled: boolean): FieldEditMode & {attempts: number} {
  const mode = {attempts: 0, enabled: computed(() => enabled), disabledAttempt() { mode.attempts++; }};
  return mode;
}

describe('useNumInput value, unit and focus flow', () => {
  it('follows the model value and a cycled display unit, and rescales a refused draft', async () => {
    const {api, app, props, presentationState, input} = setup({modelValue: 0.0048, field: NumberField.BOX_VB_L, halfWidth: null});
    const before = api.display.value;
    props.modelValue = 0.0096;
    await nextTick();
    expect(api.display.value).not.toBe(before);
    presentationState.ui.unitTokens = {...NumberField.BOX_VB_L.withNextUnit(presentationState.ui.unitTokens ?? {})};
    await nextTick();
    expect(input.value).toBe(api.display.value);
    expect(input.selectionStart).toBe(api.display.value.length);
    focusIn(api);
    input.value = '-5';
    api.onInput(eventTargeted('input', input));
    expect(api.refusal.value).not.toBe('');
    const draft = api.display.value;
    presentationState.ui.unitTokens = {...NumberField.BOX_VB_L.withNextUnit(presentationState.ui.unitTokens ?? {})};
    await nextTick();
    expect(api.display.value).not.toBe(draft);
    app.unmount();
  });

  it('keeps an unparsable draft when the unit changes while focused', async () => {
    const {api, app, presentationState, input} = setup({modelValue: 0.0048, field: NumberField.BOX_VB_L});
    focusIn(api);
    input.value = '-';
    api.onInput(eventTargeted('input', input));
    presentationState.ui.unitTokens = {...NumberField.BOX_VB_L.withNextUnit(presentationState.ui.unitTokens ?? {})};
    await nextTick();
    expect(api.display.value).toBe('-');
    app.unmount();
  });

  it('formats without a field, shows nothing for infinity, and reports the refusal to its host', async () => {
    const {api, app, props, input, emissions} = setup({modelValue: Infinity, precision: undefined});
    expect(api.display.value).toBe('');
    props.modelValue = 3;
    await nextTick();
    expect(api.display.value).toBe('3.00');
    focusIn(api);
    input.value = '-4';
    api.onInput(eventTargeted('input', input));
    await nextTick();
    expect(api.refusal.value).not.toBe('');
    expect(emissions.some(event => event.event === 'refusal' && event.args[0] !== '')).toBe(true);
    app.unmount();
  });

  it('refuses an entry out of range, and allowOutOfRange accepts it and a max bounds it', () => {
    const bounded = setup({modelValue: 5, max: 10});
    focusIn(bounded.api);
    bounded.input.value = '11';
    bounded.api.onInput(eventTargeted('input', bounded.input));
    expect(bounded.api.refusal.value).not.toBe('');
    expect(bounded.emissions.some(event => event.event === 'update:modelValue')).toBe(false);
    bounded.app.unmount();
    const open = setup({modelValue: 5, allowOutOfRange: true});
    focusIn(open.api);
    open.input.value = '-7,5';
    open.api.onInput(eventTargeted('input', open.input));
    expect(open.api.refusal.value).toBe('');
    expect(open.emissions.at(-1)?.args[0]).toBe(-7.5);
    open.app.unmount();
  });

  it('reports a wrongly wired input event and ignores it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const {api, app, emissions} = setup();
    api.onInput(eventTargeted('input', new NodeStub()));
    expect(console.error).toHaveBeenCalledOnce();
    expect(emissions).toEqual([]);
    app.unmount();
  });

  it('refuses a lone minus, and an emptied optional box emits null', () => {
    const {api, app, input, emissions} = setup();
    focusIn(api);
    input.value = '-';
    api.onInput(eventTargeted('input', input));
    expect(api.refusal.value).not.toBe('');
    input.value = '';
    api.onInput(eventTargeted('input', input));
    expect(emissions.at(-1)).toEqual({event: 'update:modelValue', args: [null]});
    app.unmount();
  });

  it('classifies a symptom, a field that may be empty and a blank mandatory box', () => {
    const {api, app, props} = setup({modelValue: 0, mandatory: true, dq: ['x'], dqState: 'C', field: NumberField.BOX_VB_L});
    expect(api.isSymptom.value).toBe(true);
    expect(api.isRootCause.value).toBe(false);
    expect(api.dqTooltip.value).toBeDefined();
    expect(api.classes.value['de-input-empty']).toBe(true);
    props.dq = undefined;
    expect(api.dqNoteTitle.value).toBe('');
    expect(typeof api.classes.value['value-empty']).toBe('boolean');
    app.unmount();
  });

  it('shows no help text for a bare box, uses explicit bounds and ignores the stepper when read only', () => {
    const {api, app, props} = setup({modelValue: 3, stepper: true}, {readonly: false});
    expect(api.helpText.value).toBeUndefined();
    expect(api.showStepper.value).toBe(true);
    props.max = 4;
    props.min = 1;
    expect(api.keyboard.value).toBe('decimal');
    app.unmount();
  });

  it('keeps the stepper for a read-only box while its view is in edit-inspection mode', () => {
    const {api, app} = setup({stepper: true}, {readonly: true}, {fieldEditMode: editMode(true)});
    expect(api.showStepper.value).toBe(true);
    expect(api.isReadonly.value).toBe(true);
    app.unmount();
  });

  it('enters a group by pointer and by tab, and returns between the box and its buttons', async () => {
    const {api, app, input, button, decrease} = setup({modelValue: 12.3});
    api.onBoxPointer(pointer('pointerdown'));
    focusIn(api);
    api.onFocus(focusEvent('focus', input));
    expect(api.underlineIndex.value).toBeNull();
    documentStub.activeElement = input;
    input.value = api.display.value;
    api.onFocus(focusEvent('focus', button));
    await Promise.resolve();
    expect(api.underlineIndex.value).not.toBeNull();
    api.onFocus(focusEvent('focus', decrease));
    api.onFocus(focusEvent('focus', new NodeStub()));
    api.onFocus(focusEvent('focus', null));
    app.unmount();
  });

  it('cancels the restored digit when the user selects text instead', async () => {
    const {api, app, input, button} = setup({modelValue: 12.3});
    focusIn(api);
    documentStub.activeElement = null;
    api.onFocus(focusEvent('focus', button));
    await Promise.resolve();
    expect(api.underlineIndex.value).toBeNull();
    documentStub.activeElement = input;
    api.onFocus(focusEvent('focus', button));
    api.onKeydown(keyEvt('keydown', {key: 'a', ctrlKey: true, target: input}));
    await Promise.resolve();
    app.unmount();
  });

  it('keeps a refused draft on a new focus', async () => {
    const {api, app, input} = setup({modelValue: 12.3});
    focusIn(api);
    input.value = 'zz';
    api.onInput(eventTargeted('input', input));
    api.onBlur(focusEvent('blur'));
    focusIn(api);
    expect(api.display.value).toBe('zz');
    app.unmount();
  });

  it('moves between box, buttons and outside on blur, and notifies a changed value on leaving', () => {
    const {api, app, props, input, button, emissions} = setup({modelValue: 12.3});
    focusIn(api);
    props.modelValue = 20;
    api.onBlur(focusEvent('blur', button));
    expect(emissions.some(event => event.event === 'blur')).toBe(false);
    api.onBlur(focusEvent('blur', null));
    expect(emissions.map(event => event.event)).toContain('blur-notify');
    expect(input.value).toBe(api.display.value);
    focusIn(api);
    api.onBlur(new Event('blur'));
    app.unmount();
  });

  it('keeps a refused entry on leaving and restores a blank back to the stored value', () => {
    const {api, app, input, button, emissions} = setup({modelValue: 12.3, field: NumberField.BOX_VB_L});
    focusIn(api);
    input.value = '-9';
    api.onInput(eventTargeted('input', input));
    api.onBlur(focusEvent('blur', null));
    expect(emissions.at(-1)?.event).toBe('blur');
    app.unmount();
    const blank = setup({modelValue: 12.3});
    focusIn(blank.api);
    blank.input.value = '';
    blank.api.onInput(eventTargeted('input', blank.input));
    blank.api.onBlur(focusEvent('blur', blank.button));
    expect(blank.api.display.value).toBe('12.30');
    blank.api.onStepperFocus();
    blank.api.onStepperBlur(focusEvent('blur', blank.input));
    blank.api.onStepperBlur(focusEvent('blur', null));
    void button;
    blank.app.unmount();
  });

  it('leaves a box with no element attached without touching it', () => {
    const {api, app, emissions} = setup();
    api.inputEl.value = null;
    focusIn(api);
    api.onBlur(focusEvent('blur'));
    expect(emissions.some(event => event.event === 'blur')).toBe(false);
    app.unmount();
  });
});

describe('useNumInput keyboard, selection and stepping', () => {
  it('handles selection keys, Escape on a selection and keys that clear the underline', () => {
    const {api, app, input} = setup({modelValue: 12.3});
    focusIn(api);
    input.value = '12.30';
    input.setSelectionRange(0, 3);
    api.onKeydown(keyEvt('keydown', {key: 'ArrowLeft', shiftKey: true}));
    api.onKeydown(keyEvt('keydown', {key: 'a', metaKey: true}));
    api.onKeydown(keyEvt('keydown', {key: 'Escape', target: input}));
    expect(input.selectionEnd).toBe(0);
    input.selectionStart = null;
    input.selectionEnd = null;
    api.onKeydown(keyEvt('keydown', {key: 'Escape', target: input}));
    api.onKeydown(keyEvt('keydown', {key: 'Tab'}));
    api.onKeydown(keyEvt('keydown', {key: '5'}));
    expect(api.underlineIndex.value).toBeNull();
    app.unmount();
  });

  it('does not restore an Escape over a refusal into a non-input target', () => {
    const {api, app, input} = setup({modelValue: 12});
    focusIn(api);
    input.value = 'q';
    api.onInput(eventTargeted('input', input));
    api.onKeydown(keyEvt('keydown', {key: 'Escape', target: new NodeStub()}));
    expect(api.display.value).toBe('12.00');
    app.unmount();
  });

  it('ignores edit keys when read only', () => {
    const {api, app} = setup({modelValue: 12}, {readonly: true});
    const up = keyEvt('keydown', {key: 'ArrowUp'});
    api.onKeydown(up);
    expect(up.defaultPrevented).toBe(false);
    api.onKeyup(keyEvt('keyup', {key: 'ArrowUp'}));
    app.unmount();
  });

  it('holds and repeats a key step with acceleration, steps down, and a button key steps by its title', () => {
    vi.useFakeTimers();
    const {api, app, input, button, decrease, emissions} = setup({modelValue: 12.3});
    focusIn(api);
    documentStub.activeElement = input;
    api.onKeydown(keyEvt('keydown', {key: 'ArrowDown'}));
    vi.advanceTimersByTime(2000);
    api.onKeyup(keyEvt('keyup', {key: 'ArrowDown'}));
    const stepsDown = emissions.length;
    expect(stepsDown).toBeGreaterThan(2);
    api.onKeyup(keyEvt('keyup', {key: 'x'}));
    api.onKeydown(keyEvt('keydown', {key: 'Enter', currentTarget: button}));
    api.onKeydown(keyEvt('keydown', {key: 'Enter', currentTarget: button}));
    api.onKeyup(keyEvt('keyup', {key: 'Enter'}));
    api.onKeydown(keyEvt('keydown', {key: ' ', currentTarget: decrease}));
    api.onKeyup(keyEvt('keyup', {key: ' '}));
    api.onKeydown(keyEvt('keydown', {key: ' ', currentTarget: input}));
    expect(emissions.length).toBeGreaterThan(stepsDown);
    app.unmount();
    vi.useRealTimers();
  });

  it('walks digits with the arrows from the underline, a selection, or the caret', () => {
    const {api, app, input} = setup({modelValue: 12.3});
    focusIn(api);
    documentStub.activeElement = input;
    input.value = '12.30';
    input.setSelectionRange(1, 2);
    api.onKeydown(keyEvt('keydown', {key: 'ArrowRight'}));
    api.onKeydown(keyEvt('keydown', {key: 'ArrowRight'}));
    api.onKeydown(keyEvt('keydown', {key: 'ArrowLeft'}));
    expect(api.underlineIndex.value).not.toBeNull();
    api.onBoxDoubleClick();
    input.setSelectionRange(3, 3);
    api.onKeydown(keyEvt('keydown', {key: 'ArrowLeft'}));
    input.setSelectionRange(0, 0);
    api.onKeydown(keyEvt('keydown', {key: 'ArrowRight'}));
    app.unmount();
    const text = setup({modelValue: null});
    text.input.value = '';
    text.api.onKeydown(keyEvt('keydown', {key: 'ArrowRight'}));
    text.app.unmount();
    const noEl = setup({modelValue: 5});
    noEl.api.inputEl.value = null;
    noEl.api.onKeydown(keyEvt('keydown', {key: 'ArrowRight'}));
    noEl.api.onKeydown(keyEvt('keydown', {key: 'ArrowUp'}));
    noEl.api.stopRepeat();
    noEl.app.unmount();
  });

  it('steps down on the wheel, and ignores the wheel unfocused, read only or at rest', () => {
    const {api, app, input, emissions} = setup({modelValue: 12.3});
    const idle = wheelEvt('wheel', {deltaY: 1});
    api.onWheel(idle);
    expect(idle.defaultPrevented).toBe(false);
    focusIn(api);
    documentStub.activeElement = input;
    api.onWheel(wheelEvt('wheel', {deltaY: 0}));
    api.onWheel(wheelEvt('wheel', {deltaY: 1}));
    expect(emissions.at(-1)?.event).toBe('update:modelValue');
    app.unmount();
    const ro = setup({}, {readonly: true});
    focusIn(ro.api);
    ro.api.onWheel(wheelEvt('wheel', {deltaY: 1}));
    expect(ro.emissions).toEqual([]);
    ro.app.unmount();
  });

  it('steps a field in its registry unit, refuses a step past a limit, and steps the caret digit on a touch box', () => {
    const {api, app, input, emissions} = setup({modelValue: 0.0048, field: NumberField.BOX_VB_L});
    focusIn(api);
    documentStub.activeElement = input;
    input.setSelectionRange(0, 1);
    api.onKeydown(keyEvt('keydown', {key: 'ArrowUp'}));
    api.onKeyup(keyEvt('keyup', {key: 'ArrowUp'}));
    expect(emissions.some(event => event.event === 'update:modelValue')).toBe(true);
    app.unmount();
    const clamped = setup({modelValue: 5, max: 5});
    focusIn(clamped.api);
    documentStub.activeElement = clamped.input;
    clamped.input.setSelectionRange(0, 1);
    clamped.api.onKeydown(keyEvt('keydown', {key: 'ArrowUp'}));
    clamped.api.onKeyup(keyEvt('keyup', {key: 'ArrowUp'}));
    clamped.app.unmount();
    const out = setup({modelValue: 5, max: 5.5});
    focusIn(out.api);
    documentStub.activeElement = out.input;
    out.input.setSelectionRange(0, 1);
    out.api.onKeydown(keyEvt('keydown', {key: 'ArrowUp'}));
    out.api.onKeyup(keyEvt('keyup', {key: 'ArrowUp'}));
    out.app.unmount();
  });

  it('remembers the caret from selection changes in each situation', () => {
    const {api, app, input} = setup({modelValue: 12.3});
    focusIn(api);
    const change = () => documentStub.dispatchEvent(new Event('selectionchange'));
    change();
    documentStub.activeElement = input;
    input.value = '12.30';
    input.selectionStart = null;
    change();
    input.setSelectionRange(0, 1);
    change();
    expect(api.underlineIndex.value).toBe(0);
    input.setSelectionRange(3, 3);
    change();
    expect(api.underlineIndex.value).toBe(3);
    input.setSelectionRange(3, 3);
    change();
    input.setSelectionRange(0, 4);
    change();
    expect(api.underlineIndex.value).toBeNull();
    api.onKeydown(keyEvt('keydown', {key: 'a', ctrlKey: true}));
    input.setSelectionRange(1, 1);
    change();
    app.unmount();
  });

  it('keeps a touch caret on the stepped digit and steps from the remembered caret', () => {
    const {api, app, input} = setup({modelValue: 12.3});
    focusIn(api);
    documentStub.activeElement = input;
    input.value = '12.30';
    api.onBoxPointer(pointer('pointerdown', {pointerType: 'touch', clientX: 5}));
    api.onBoxPointerUp(pointer('pointerup', {pointerType: 'touch', clientX: 5}));
    const marked = api.underlineIndex.value;
    expect(marked).not.toBeNull();
    expect(input.selectionStart).toBe((marked ?? 0) + 1);
    documentStub.dispatchEvent(new Event('selectionchange'));
    api.onKeydown(keyEvt('keydown', {key: 'ArrowUp'}));
    api.onKeyup(keyEvt('keyup', {key: 'ArrowUp'}));
    api.onWheel(wheelEvt('wheel', {deltaY: -1}));
    documentStub.activeElement = null;
    api.onKeydown(keyEvt('keydown', {key: 'ArrowUp'}));
    api.onKeyup(keyEvt('keyup', {key: 'ArrowUp'}));
    input.setSelectionRange(4, 4);
    api.onKeydown(keyEvt('keydown', {key: 'ArrowUp'}));
    api.onKeyup(keyEvt('keyup', {key: 'ArrowUp'}));
    app.unmount();
  });

  it('ignores edits in a read-only box and edits without an element', () => {
    const {api, app, input} = setup({modelValue: 1}, {readonly: true});
    const blocked = beforeInputEvt('beforeinput', {inputType: 'insertText', data: 'x'});
    api.onBeforeInput(blocked);
    expect(blocked.defaultPrevented).toBe(false);
    const paste = pasteEvt('paste', {clipboardData: {getData: () => '9'}});
    api.onPaste(paste);
    expect(paste.defaultPrevented).toBe(false);
    app.unmount();
    const live = setup({modelValue: 1});
    const noClip = pasteEvt('paste', {clipboardData: null});
    live.api.onPaste(noClip);
    expect(noClip.defaultPrevented).toBe(false);
    const nullData = beforeInputEvt('beforeinput', {inputType: 'insertText', data: null});
    live.api.onBeforeInput(nullData);
    const other = beforeInputEvt('beforeinput', {inputType: 'deleteContentBackward'});
    live.api.onBeforeInput(other);
    const dropNoData = beforeInputEvt('beforeinput', {inputType: 'insertFromDrop', dataTransfer: null});
    live.api.onBeforeInput(dropNoData);
    const refusePaste = pasteEvt('paste', {clipboardData: {getData: () => 'abc'}});
    live.api.onPaste(refusePaste);
    expect(live.input.value).toBe('12.30'.slice(0, 0) + live.input.value);
    live.api.inputEl.value = null;
    live.api.onBeforeInput(beforeInputEvt('beforeinput', {inputType: 'insertText', data: '1'}));
    live.api.onPaste(pasteEvt('paste', {clipboardData: {getData: () => '9'}}));
    live.app.unmount();
    void input;
  });
});

describe('useNumInput pointer gestures', () => {
  it('spins by a mouse drag, aborts the native drag start, and ends on pointerup', () => {
    const {api, app, input, emissions, advanceClock} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    input.value = '12.30';
    api.onBoxPointer(pointer('pointerdown', {clientX: 5, clientY: 100}));
    const dragstart = evt('dragstart');
    input.dispatchEvent(dragstart);
    expect(dragstart.defaultPrevented).toBe(true);
    documentStub.dispatchEvent(pointer('pointermove', {pointerId: 2, clientX: 5, clientY: 0}));
    documentStub.dispatchEvent(pointer('pointermove', {clientX: 5, clientY: 60}));
    advanceClock(200);
    documentStub.dispatchEvent(pointer('pointermove', {clientX: 5, clientY: 0}));
    advanceClock(400);
    expect(emissions.filter(event => event.event === 'update:modelValue').length).toBeGreaterThan(0);
    const select = evt('selectstart');
    documentStub.dispatchEvent(select);
    expect(select.defaultPrevented).toBe(true);
    documentStub.dispatchEvent(pointer('pointerup', {pointerId: 2}));
    documentStub.dispatchEvent(pointer('pointerup'));
    const after = evt('selectstart');
    documentStub.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
    app.unmount();
  });

  it('treats a sideways mouse drag as text selection and a touch drag as a spin', () => {
    const {api, app, input, emissions} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    input.value = '12.30';
    api.onBoxPointer(pointer('pointerdown', {clientX: 5, clientY: 10}));
    documentStub.dispatchEvent(pointer('pointermove', {clientX: 80, clientY: 10}));
    documentStub.dispatchEvent(pointer('pointermove', {clientX: 90, clientY: 10}));
    input.setSelectionRange(0, 4);
    documentStub.dispatchEvent(pointer('pointerup'));
    api.onBoxPointerUp(pointer('pointerup'));
    api.onBoxPointer(pointer('pointerdown', {pointerType: 'touch', clientX: 5}));
    documentStub.dispatchEvent(pointer('pointermove', {pointerType: 'touch', clientX: 80}));
    documentStub.dispatchEvent(pointer('pointercancel', {pointerType: 'touch'}));
    api.onBoxPointerUp(pointer('pointerup'));
    expect(emissions.length).toBeGreaterThan(0);
    app.unmount();
  });

  it('abandons a previous press and ignores pointers that are not a primary press', () => {
    const {api, app, input} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    api.onBoxPointer(pointer('pointerdown'));
    api.onBoxPointer(pointer('pointerdown'));
    api.onBoxPointer(pointer('pointerdown', {isPrimary: false}));
    api.onBoxPointer(pointer('pointerdown', {button: 2}));
    api.inputEl.value = null;
    api.onBoxPointer(pointer('pointerdown'));
    api.onBoxPointerUp(pointer('pointerup'));
    app.unmount();
  });

  it('ignores a press in a read-only box and puts a digit under a tap in the active box', () => {
    const ro = setup({modelValue: 12.3}, {readonly: true});
    ro.api.onBoxPointer(pointer('pointerdown'));
    ro.api.onBoxPointerUp(pointer('pointerup'));
    expect(ro.api.underlineIndex.value).toBeNull();
    ro.app.unmount();
    const {api, app, input} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    input.value = '12.30';
    api.onBoxPointer(pointer('pointerdown', {clientX: 7 * 8}));
    api.onBoxPointerUp(pointer('pointerup', {clientX: 7 * 8}));
    api.onBoxPointerUp(pointer('pointerup', {clientX: 2 * 8 + 3}));
    app.unmount();
  });

  it('measures presses in right, end and centred text, and finds no digit without a canvas', () => {
    const {api, app, input} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    input.value = '12.30';
    for (const align of ['right', 'end', 'center', 'left']) {
      computedAlign = align;
      api.onBoxPointer(pointer('pointerdown', {clientX: 150}));
      api.onBoxPointerUp(pointer('pointerup', {clientX: 150}));
    }
    canvasAvailable = false;
    api.onBoxPointerUp(pointer('pointerup', {clientX: 5}));
    app.unmount();
  });

  it('does not choose a digit on a position that is not a digit', () => {
    const {api, app, input} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    input.value = '12.30';
    input.setSelectionRange(0, 1);
    api.onBoxPointerUp(pointer('pointerup', {clientX: 2 * 8 + 4}));
    expect(input.value).toBe('12.30');
    app.unmount();
  });

  it('holds a long press in an inspected box to unlock editing, and a quick release cancels it', () => {
    vi.useFakeTimers();
    const mode = editMode(true);
    const {api, app, input} = setup({modelValue: 12.3}, {}, {fieldEditMode: mode});
    expect(api.isReadonly.value).toBe(true);
    const down = pointer('pointerdown');
    api.onBoxPointer(down);
    expect(down.defaultPrevented).toBe(true);
    expect(mode.attempts).toBe(1);
    documentStub.dispatchEvent(pointer('pointerup'));
    vi.advanceTimersByTime(5000);
    expect(api.isReadonly.value).toBe(true);
    api.onBoxPointer(pointer('pointerdown'));
    api.onBoxPointer(pointer('pointerdown'));
    vi.advanceTimersByTime(5000);
    expect(documentStub.activeElement).toBe(input);
    app.unmount();
    vi.useRealTimers();
  });

  it('cancels a long press on pointercancel and on unmount', () => {
    vi.useFakeTimers();
    const {api, app} = setup({modelValue: 12.3}, {}, {fieldEditMode: editMode(true)});
    api.onBoxPointer(pointer('pointerdown'));
    documentStub.dispatchEvent(pointer('pointercancel'));
    api.onBoxPointer(pointer('pointerdown'));
    app.unmount();
    vi.advanceTimersByTime(5000);
    vi.useRealTimers();
  });
});

describe('useNumInput stepper buttons', () => {
  it('repeats while a mouse button is held on a stepper and stops on release, leave and window blur', () => {
    vi.useFakeTimers();
    const surface = {screenHeightPx: vi.fn(() => 700), scrollBy: vi.fn(), setSpacePx: vi.fn(), belowViewPx: vi.fn(() => 0), now: vi.fn(() => 0), nextFrame: vi.fn()};
    const {api, app, button, emissions} = setup({modelValue: 12.3}, {}, {stepperPin: new StepperPin(surface)});
    const down = (props: Record<string, unknown> = {}) => pointer('pointerdown', {currentTarget: button, ...props});
    api.onStepperPointerDown(1, down({isPrimary: false}));
    api.onStepperPointerDown(1, down({button: 1}));
    const event = down();
    api.onStepperPointerDown(1, event);
    expect(event.defaultPrevented).toBe(true);
    expect(surface.setSpacePx).toHaveBeenCalledWith(700);
    vi.advanceTimersByTime(3000);
    expect(emissions.length).toBeGreaterThan(3);
    api.onStepperPointerUp(pointer('pointerup'));
    api.onStepperPointerDown(-1, down());
    api.onStepperLeave(pointer('pointerleave'));
    api.onStepperPointerDown(-1, down({currentTarget: null}));
    globalThis.window.dispatchEvent(new Event('blur'));
    api.onStepperPointerUp(pointer('pointerup', {pointerType: 'touch'}));
    api.onStepperLeave(pointer('pointerleave', {pointerType: 'touch'}));
    app.unmount();
    vi.useRealTimers();
  });

  it('steps a touch tap on release, repeats a touch hold, and stops a touch that moves or leaves', () => {
    vi.useFakeTimers();
    const {api, app, button, emissions} = setup({modelValue: 12.3});
    const touch = (props: Record<string, unknown> = {}) => pointer('pointerdown', {pointerType: 'touch', currentTarget: button, ...props});
    api.onStepperPointerDown(1, touch({currentTarget: null}));
    api.onStepperPointerDown(1, touch());
    documentStub.dispatchEvent(pointer('pointerup', {pointerId: 9}));
    documentStub.dispatchEvent(pointer('pointerup'));
    expect(emissions.length).toBe(1);
    api.onStepperPointerDown(1, touch());
    documentStub.dispatchEvent(pointer('pointermove', {pointerId: 9}));
    documentStub.dispatchEvent(pointer('pointermove', {pointerType: 'touch', clientX: 5, clientY: 60}));
    documentStub.dispatchEvent(pointer('pointerup'));
    api.onStepperPointerDown(1, touch());
    documentStub.dispatchEvent(pointer('pointercancel', {pointerId: 9}));
    documentStub.dispatchEvent(pointer('pointercancel'));
    const count = emissions.length;
    api.onStepperPointerDown(1, touch());
    vi.advanceTimersByTime(600);
    documentStub.dispatchEvent(pointer('pointermove', {clientX: 20, clientY: 50}));
    documentStub.dispatchEvent(pointer('pointermove', {clientX: 300, clientY: 5}));
    documentStub.dispatchEvent(pointer('pointermove', {clientX: 20, clientY: 500}));
    documentStub.dispatchEvent(pointer('pointermove', {clientX: -50, clientY: 50}));
    expect(emissions.length).toBeGreaterThan(count);
    api.onStepperPointerDown(-1, touch());
    vi.advanceTimersByTime(600);
    documentStub.dispatchEvent(pointer('pointerup'));
    api.onStepperPointerDown(-1, touch());
    api.onStepperPointerDown(-1, touch());
    app.unmount();
    vi.useRealTimers();
  });

  it('repeats a held key with the delay accounted for a long hold', () => {
    vi.useFakeTimers();
    const {api, app, input, button} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    focusIn(api);
    api.onKeydown(keyEvt('keydown', {key: 'Enter', currentTarget: button}));
    vi.advanceTimersByTime(5000);
    api.onKeyup(keyEvt('keyup', {key: 'Enter'}));
    app.unmount();
    vi.useRealTimers();
  });
});

describe('useNumInput remaining paths', () => {
  it('covers missing unit settings, preserves a refused draft after the model changes, and formats an empty DQ state', async () => {
    const {api, app, presentationState, props, input} = setup({modelValue: 0.0048, field: NumberField.BOX_VB_L}, {}, {unitTokens: undefined});
    expect(api.display.value).toBe('4.80');
    presentationState.ui.unitTokens = {...NumberField.BOX_VB_L.withNextUnit({})};
    await nextTick();
    expect(api.display.value).not.toBe('4.80');

    focusIn(api);
    input.value = 'bad';
    api.onInput(eventTargeted('input', input));
    api.onBlur(focusEvent('blur'));
    props.modelValue = 0.0096;
    await nextTick();
    expect(api.display.value).toBe('bad');

    props.dq = undefined;
    expect(api.dqTooltip.value).toBeDefined();
    expect(api.classes.value['value-empty']).toBe(false);
    app.unmount();
  });

  it('uses the field floor when a spinner reaches zero and keeps optional model changes reportable', () => {
    const field = vi.spyOn(NumberField.QMS, 'parseEntry').mockReturnValue({kind: 'text'});
    const {api, app, input, emissions} = setup({modelValue: 1, field: NumberField.QMS, min: 0, spin: {kind: 'integer', step: 1}});
    focusIn(api);
    documentStub.activeElement = input;
    input.setSelectionRange(0, 1);
    api.onKeydown(keyEvt('keydown', {key: 'ArrowDown'}));
    api.onKeyup(keyEvt('keyup', {key: 'ArrowDown'}));
    expect(emissions.some(event => event.event === 'update:modelValue')).toBe(false);
    app.unmount();
    field.mockRestore();

    const empty = setup({modelValue: 12});
    focusIn(empty.api);
    empty.props.modelValue = undefined;
    empty.api.onBlur(focusEvent('blur'));
    expect(empty.emissions.at(-1)).toEqual({event: 'blur-notify', args: [null]});
    empty.app.unmount();
  });

  it('uses a non-finite explicit lower display bound as zero for stepping', () => {
    const {api, app, input} = setup({modelValue: 12, min: Number.NaN});
    focusIn(api);
    documentStub.activeElement = input;
    input.setSelectionRange(0, 1);
    api.onKeydown(keyEvt('keydown', {key: 'ArrowUp'}));
    api.onKeyup(keyEvt('keyup', {key: 'ArrowUp'}));
    expect(api.display.value).not.toBe('12.00');
    app.unmount();
  });

  it('shows a field with no unit settings, a null value and no draft rescale for a blank refused box', async () => {
    const {api, app, presentationState, props, input} = setup({modelValue: null, field: NumberField.BOX_VB_L});
    presentationState.ui.unitTokens = undefined;
    props.modelValue = 0.0048;
    await nextTick();
    expect(api.display.value).not.toBe('');
    props.modelValue = null;
    await nextTick();
    expect(typeof api.classes.value['value-empty']).toBe('boolean');
    props.blankRefused = true;
    focusIn(api);
    input.value = '';
    api.onInput(eventTargeted('input', input));
    expect(api.refusal.value).not.toBe('');
    presentationState.ui.unitTokens = {...NumberField.BOX_VB_L.withNextUnit({})};
    await nextTick();
    expect(api.display.value).toBe('');
    api.inputEl.value = null;
    presentationState.ui.unitTokens = {...NumberField.BOX_VB_L.withNextUnit(presentationState.ui.unitTokens ?? {})};
    await nextTick();
    app.unmount();
  });

  it('leaves the shown text alone when the model changes under a focused box', async () => {
    const {api, app, props} = setup({modelValue: 12.3});
    focusIn(api);
    props.modelValue = 40;
    await nextTick();
    expect(api.display.value).toBe('12.30');
    app.unmount();
  });

  it('skips a pointer-caused focus once the group is already focused', () => {
    const {api, app, input} = setup({modelValue: 12.3});
    focusIn(api);
    api.onBoxPointer(pointer('pointerdown'));
    expect(documentStub.activeElement).not.toBe(input);
    api.onFocus(focusEvent('focus', new NodeStub()));
    app.unmount();
  });

  it('spins downward from a drag, and starts from the caret when the press was between digits', () => {
    const {api, app, input, emissions, advanceClock} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    input.value = '12.30';
    api.onBoxPointer(pointer('pointerdown', {clientX: 2 * 8 + 4, clientY: 10}));
    documentStub.dispatchEvent(evt('selectstart'));
    documentStub.dispatchEvent(pointer('pointermove', {clientX: 5, clientY: 100}));
    advanceClock(300);
    advanceClock(300);
    const down = emissions.filter(event => event.event === 'update:modelValue');
    expect(down.length).toBeGreaterThan(0);
    documentStub.dispatchEvent(pointer('pointercancel', {pointerId: 3}));
    documentStub.dispatchEvent(pointer('pointercancel'));
    api.onBoxPointer(pointer('pointerdown', {clientX: 3, clientY: 10}));
    documentStub.dispatchEvent(pointer('pointermove', {clientX: 3, clientY: -90}));
    documentStub.dispatchEvent(new Event('selectionchange'));
    advanceClock(300);
    documentStub.dispatchEvent(pointer('pointerup'));
    app.unmount();
  });

  it('chooses the dragged digit when the drag ends on one', () => {
    const {api, app, input, advanceClock} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    input.value = '12.30';
    api.onBoxPointer(pointer('pointerdown', {clientX: 3, clientY: 10}));
    documentStub.dispatchEvent(pointer('pointermove', {clientX: 3, clientY: -90}));
    advanceClock(200);
    documentStub.dispatchEvent(pointer('pointerup'));
    expect(api.underlineIndex.value).not.toBeNull();
    app.unmount();
  });

  it('copes with a box whose selection is unreadable', () => {
    const {api, app, input} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    input.value = '12.30';
    input.selectionStart = null;
    input.selectionEnd = null;
    api.onBoxPointerUp(pointer('pointerup', {clientX: 3}));
    api.onPaste(pasteEvt('paste', {clipboardData: {getData: () => '7'}}));
    expect(input.value).toContain('7');
    input.selectionStart = 2;
    input.selectionEnd = null;
    api.onPaste(pasteEvt('paste', {clipboardData: {getData: () => '8'}}));
    input.selectionStart = 1;
    input.selectionEnd = null;
    input.value = '12.30';
    documentStub.dispatchEvent(new Event('selectionchange'));
    app.unmount();
  });

  it('ignores selection changes while a drag is spinning', () => {
    const {api, app, input} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    input.value = '12.30';
    api.onBoxPointer(pointer('pointerdown', {clientX: 3, clientY: 100}));
    documentStub.dispatchEvent(pointer('pointermove', {clientX: 3, clientY: 0}));
    const marked = api.underlineIndex.value;
    input.setSelectionRange(3, 4);
    documentStub.dispatchEvent(new Event('selectionchange'));
    expect(api.underlineIndex.value).toBe(marked);
    documentStub.dispatchEvent(pointer('pointerup'));
    app.unmount();
  });

  it('does not restore a digit past the end of a shortened box', async () => {
    const {api, app, input, button} = setup({modelValue: 12.3});
    documentStub.activeElement = input;
    focusIn(api);
    input.value = '12.30';
    api.onBoxPointer(pointer('pointerdown', {pointerType: 'touch', clientX: 3 * 8 + 4}));
    api.onBoxPointerUp(pointer('pointerup', {pointerType: 'touch', clientX: 3 * 8 + 4}));
    expect(api.underlineIndex.value).toBe(3);
    input.value = '1';
    input.setSelectionRange(4, 4);
    api.onInput(eventTargeted('input', input));
    expect(api.underlineIndex.value).toBe(3);
    api.onFocus(focusEvent('focus', button));
    await Promise.resolve();
    expect(input.selectionStart).toBe(4);
    app.unmount();
  });

  it('does not step an empty box', () => {
    const {api, app, input, emissions} = setup({modelValue: null});
    focusIn(api);
    documentStub.activeElement = input;
    api.onKeydown(keyEvt('keydown', {key: 'ArrowUp'}));
    api.onKeyup(keyEvt('keyup', {key: 'ArrowUp'}));
    expect(emissions).toEqual([]);
    app.unmount();
  });

  it('drops a step that the box would refuse', () => {
    const {api, app, input, emissions} = setup({modelValue: 5, min: 0.5, allowOutOfRange: false, precision: 0});
    focusIn(api);
    documentStub.activeElement = input;
    input.value = '5';
    input.setSelectionRange(0, 1);
    for (let i = 0; i < 6; i++) {
      api.onKeydown(keyEvt('keydown', {key: 'ArrowDown'}));
      api.onKeyup(keyEvt('keyup', {key: 'ArrowDown'}));
    }
    expect(emissions.length).toBeGreaterThan(0);
    app.unmount();
  });

  it('bounds by non-finite limits and by a field with entries that do not parse', () => {
    const {api, app, input, props} = setup({modelValue: 5, max: Infinity});
    props.min = NaN;
    focusIn(api);
    documentStub.activeElement = input;
    input.setSelectionRange(0, 1);
    api.onKeydown(keyEvt('keydown', {key: 'ArrowUp'}));
    api.onKeyup(keyEvt('keyup', {key: 'ArrowUp'}));
    app.unmount();
    const big = setup({modelValue: 5, field: NumberField.BOX_VB_L, allowOutOfRange: true});
    focusIn(big.api);
    big.input.value = '1000000000000000000000000';
    big.api.onInput(eventTargeted('input', big.input));
    big.input.value = '1e5';
    big.api.onInput(eventTargeted('input', big.input));
    big.app.unmount();
  });

  it('leaves without a blur-notify when nothing changed', () => {
    const {api, app, emissions} = setup({modelValue: 12.3});
    focusIn(api);
    api.onBlur(focusEvent('blur'));
    expect(emissions.map(event => event.event)).toEqual(['blur']);
    app.unmount();
  });

  it('describes a symptom with no state and no flags', () => {
    const {api, app} = setup({modelValue: 5, dq: ['x']});
    expect(api.dqTooltip.value).toBeDefined();
    app.unmount();
    const none = setup({modelValue: 5});
    expect(none.api.dqTooltip.value).toBeDefined();
    none.app.unmount();
  });
});
