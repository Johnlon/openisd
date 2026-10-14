/** How the Open project list is ordered and searched; both skins show the same choices. */

/** One way to order saved projects. */
export interface ProjectListOrder {
  readonly label: string;
  /** Negative when `a` comes before `b`. */
  readonly compare: (a: ProjectListItem, b: ProjectListItem) => number;
}

/** What the list needs to know about a saved project. */
export interface ProjectListItem {
  readonly name: string;
  /** The driver, box and volume line; empty for a project that would not read. */
  readonly summary: string;
  readonly modifiedMs: number;
}

const byName = (a: ProjectListItem, b: ProjectListItem): number =>
  a.name.localeCompare(b.name, undefined, {sensitivity: 'base', numeric: true});

export const PROJECT_LIST_ORDERS = {
  NEWEST: {label: 'Newest first', compare: (a, b) => b.modifiedMs - a.modifiedMs || byName(a, b)},
  OLDEST: {label: 'Oldest first', compare: (a, b) => a.modifiedMs - b.modifiedMs || byName(a, b)},
  NAME: {label: 'Name A–Z', compare: byName},
} as const satisfies Record<string, ProjectListOrder>;

/** The orders in the order the sort menu lists them. */
export const PROJECT_LIST_ORDER_LIST: readonly ProjectListOrder[] = [
  PROJECT_LIST_ORDERS.NEWEST, PROJECT_LIST_ORDERS.OLDEST, PROJECT_LIST_ORDERS.NAME,
];

/** `items` that match every word of `query` in their name or summary, in `order`. A blank query keeps all. */
export function viewProjects<T extends ProjectListItem>(items: readonly T[], order: ProjectListOrder, query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w !== '');
  const shown = items.filter(item => {
    const text = `${item.name} ${item.summary}`.toLowerCase();
    return words.every(w => text.includes(w));
  });
  return shown.sort(order.compare);
}
