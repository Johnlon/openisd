// @vitest-environment jsdom
/* global document, PointerEvent, KeyboardEvent, FocusEvent */
import {afterEach, describe, expect, it} from 'vitest';
import {createApp, defineComponent, h, nextTick, ref, type Ref} from 'vue';
import {useDismissOnOutside} from '../../src/hooks/dismissOnOutside.js';

// John, 18 Nov 2026 (QO946.c253): "the drop down menu on the chart needs to dismiss if it lose focus".
interface Mounted { open: Ref<boolean>; closes: {n: number}; trigger: HTMLElement; list: HTMLElement; outside: HTMLElement; unmount: () => void }

function mount(): Mounted {
  const host = document.body.appendChild(document.createElement('div'));
  const open = ref(true);
  const closes = {n: 0};
  const triggerRef = ref<HTMLElement | null>(null);
  const listRef = ref<HTMLElement | null>(null);
  const Menu = defineComponent({
    setup() {
      useDismissOnOutside(open, [triggerRef, listRef], () => { closes.n += 1; open.value = false; });
      return () => h('div', [
        h('button', {ref: triggerRef, id: 'trigger'}),
        h('ul', {ref: listRef, id: 'list'}, [h('li', {id: 'item', tabindex: 0})]),
        h('p', {id: 'outside', tabindex: 0}),
      ]);
    },
  });
  const app = createApp(Menu);
  app.mount(host);
  return {
    open, closes,
    trigger: host.querySelector<HTMLElement>('#trigger')!,
    list: host.querySelector<HTMLElement>('#item')!,
    outside: host.querySelector<HTMLElement>('#outside')!,
    unmount: () => { app.unmount(); host.remove(); },
  };
}

const press = (el: Element): void => { el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})); };
const key = (k: string): void => { document.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true})); };
const focusIn = (el: Element): void => { el.dispatchEvent(new FocusEvent('focusin', {bubbles: true})); };

let current: Mounted | null = null;
afterEach(() => { current?.unmount(); current = null; });

describe('useDismissOnOutside', () => {
  it('closes on a press outside the menu', () => {
    current = mount();
    press(current.outside);
    expect(current.closes.n).toBe(1);
  });
  it('stays open on a press on the trigger or on the list', () => {
    current = mount();
    press(current.trigger);
    press(current.list);
    expect(current.closes.n).toBe(0);
  });
  it('closes on Escape', () => {
    current = mount();
    key('Escape');
    expect(current.closes.n).toBe(1);
  });
  it('ignores other keys', () => {
    current = mount();
    key('a');
    expect(current.closes.n).toBe(0);
  });
  it('closes when focus moves outside, not when it moves inside', () => {
    current = mount();
    focusIn(current.list);
    expect(current.closes.n).toBe(0);
    focusIn(current.outside);
    expect(current.closes.n).toBe(1);
  });
  it('listens to nothing while closed, and again once reopened', async () => {
    current = mount();
    current.open.value = false;
    await nextTick();
    press(current.outside); key('Escape'); focusIn(current.outside);
    expect(current.closes.n).toBe(0);
    current.open.value = true;
    await nextTick();
    key('Escape');
    expect(current.closes.n).toBe(1);
  });
  it('listens to nothing after unmount', () => {
    current = mount();
    const {closes, outside} = current;
    current.unmount();
    current = null;
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    outside.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    expect(closes.n).toBe(0);
  });
});
