import {describe, expect, it} from 'vitest';
import {createRefusalLedger, tabOf, type TabHost} from '../../src/logic/refusalLedger.js';

/** An element as far as the ledger looks: the nearest ancestor naming a tab. */
function inTab(name: string | null): TabHost {
  const holder = name === null ? null : {getAttribute: (attr: string) => attr === 'data-de-tab' ? name : null};
  return {closest: (selector: string) => selector === '[data-de-tab]' ? holder : null};
}

/** BUG_20261117_driver-editor-tab-switch-drops-refused-entry: the editor must know which boxes hold a refused entry. */
describe('refusal ledger', () => {
  it('names the tab a box sits on, and none for a box outside any tab', () => {
    expect(tabOf(inTab('Advanced'))).toBe('Advanced');
    expect(tabOf(inTab(null))).toBe('');
    expect(tabOf(null)).toBe('');
  });

  it('holds a reported refusal until it is cleared, and lists the tabs that hold one', () => {
    const ledger = createRefusalLedger();
    const qts = Symbol('Qts');
    const gloss = Symbol('Gloss');
    expect(ledger.entries.value).toEqual([]);
    ledger.report(qts, 'Parameters', 'Qts must be greater than 0 — enter a value above 0, up to 5.');
    ledger.report(gloss, 'Advanced', 'Gloss is above its maximum — enter a value between 0 and 1.');
    expect(ledger.refusedTabs.value).toEqual(new Set(['Parameters', 'Advanced']));
    ledger.report(qts, 'Parameters', '');
    expect(ledger.entries.value.map(e => e.tab)).toEqual(['Advanced']);
    ledger.clear(gloss);
    expect(ledger.entries.value).toEqual([]);
    expect(ledger.refusedTabs.value.size).toBe(0);
  });

  it('says what was refused and not applied, naming the first entry and counting the rest', () => {
    const ledger = createRefusalLedger();
    expect(ledger.summary()).toBe('');
    ledger.report(Symbol('a'), 'Parameters', 'Qts must be greater than 0 — enter a value above 0.');
    expect(ledger.summary()).toBe('Not applied: Qts must be greater than 0 — enter a value above 0.');
    ledger.report(Symbol('b'), 'Advanced', 'Gloss is above its maximum — enter 0 to 1.');
    expect(ledger.summary()).toBe('Not applied: Qts must be greater than 0 — enter a value above 0. (and 1 more refused entry)');
  });
});
