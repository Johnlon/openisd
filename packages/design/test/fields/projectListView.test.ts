import {describe, expect, it} from 'vitest';
import {PROJECT_LIST_ORDERS, viewProjects} from '../../fields/projectListView.js';

const ITEMS = [
  {name: 'Sealed try', summary: 'Tang Band W5 · Sealed · 8.0 L', modifiedMs: 200},
  {name: 'ND140-PR', summary: 'Dayton ND140 · Passive radiator · 5.0 L', modifiedMs: 300},
  {name: 'Sub 10', summary: '', modifiedMs: 100},
  {name: 'Sub 2', summary: 'Dayton RSS · Vented · 60.0 L', modifiedMs: 100},
];
const names = (order: Parameters<typeof viewProjects>[1], query = '') => viewProjects(ITEMS, order, query).map(i => i.name);

describe('viewProjects', () => {
  it('lists newest first, ties by name', () => {
    expect(names(PROJECT_LIST_ORDERS.NEWEST)).toEqual(['ND140-PR', 'Sealed try', 'Sub 2', 'Sub 10']);
  });
  it('lists oldest first, ties by name', () => {
    expect(names(PROJECT_LIST_ORDERS.OLDEST)).toEqual(['Sub 2', 'Sub 10', 'Sealed try', 'ND140-PR']);
  });
  it('lists by name with numbers in order and case ignored', () => {
    expect(names(PROJECT_LIST_ORDERS.NAME)).toEqual(['ND140-PR', 'Sealed try', 'Sub 2', 'Sub 10']);
  });
  it('keeps projects matching every word in the name or the summary', () => {
    expect(names(PROJECT_LIST_ORDERS.NAME, 'dayton vented')).toEqual(['Sub 2']);
    expect(names(PROJECT_LIST_ORDERS.NAME, '  SEALED ')).toEqual(['Sealed try']);
    expect(names(PROJECT_LIST_ORDERS.NAME, 'nothing')).toEqual([]);
  });
  it('does not change the list it was given', () => {
    const before = ITEMS.map(i => i.name);
    viewProjects(ITEMS, PROJECT_LIST_ORDERS.NAME, '');
    expect(ITEMS.map(i => i.name)).toEqual(before);
  });
});
