import {computed, inject, provide, shallowRef, type ComputedRef, type InjectionKey, type Ref} from 'vue';

/**
 * Which number boxes of a view that keeps several tabs mounted hold an entry they refused, so the
 * view can say so where the person is looking (a mark on the tab) and when they leave (OK names
 * what was not applied). The Driver Editor provides one; a `UIField` under it reports its refusal
 * text here and clears it when it goes. BUG_20261117_driver-editor-tab-switch-drops-refused-entry.
 */
export interface Refusal {
  readonly owner: symbol;
  readonly tab: string;
  readonly text: string;
}

export interface RefusalLedger {
  /** A box's refusal text now; '' clears it. */
  report(owner: symbol, tab: string, text: string): void;
  clear(owner: symbol): void;
  readonly entries: Readonly<Ref<readonly Refusal[]>>;
  readonly refusedTabs: ComputedRef<ReadonlySet<string>>;
  /** What OK says when entries are standing: the first refusal, and how many more; '' when none. */
  summary(): string;
}

/** The tab a box sits in: the nearest ancestor marked `data-de-tab`; '' when it sits in none. */
/** What `tabOf` needs of a DOM element. */
export interface TabHost {
  closest(selector: string): {getAttribute(name: string): string | null} | null;
}

export function tabOf(el: TabHost | null): string {
  return el?.closest('[data-de-tab]')?.getAttribute('data-de-tab') ?? '';
}

export function createRefusalLedger(): RefusalLedger {
  const entries = shallowRef<readonly Refusal[]>([]);
  const without = (owner: symbol) => entries.value.filter(e => e.owner !== owner);
  return {
    entries,
    refusedTabs: computed(() => new Set(entries.value.map(e => e.tab))),
    report(owner, tab, text) {
      entries.value = text === '' ? without(owner) : [...without(owner), {owner, tab, text}];
    },
    clear(owner) {
      entries.value = without(owner);
    },
    summary() {
      const [first, ...rest] = entries.value;
      if (first === undefined) return '';
      const more = rest.length === 0 ? '' : ` (and ${rest.length} more refused ${rest.length === 1 ? 'entry' : 'entries'})`;
      return `Not applied: ${first.text}${more}`;
    },
  };
}

const REFUSAL_LEDGER: InjectionKey<RefusalLedger> = Symbol('RefusalLedger');

export function provideRefusalLedger(ledger: RefusalLedger): void {
  provide(REFUSAL_LEDGER, ledger);
}

/** The hosting view's ledger; null in a view that has none (its boxes unmount with the view). */
export function useRefusalLedger(): RefusalLedger | null {
  return inject(REFUSAL_LEDGER, null);
}
