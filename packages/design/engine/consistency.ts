export interface ConsistencyIssue {
  readonly formula: string;
  readonly fields: readonly string[];
  readonly target: string;
  readonly expected: number;
  readonly actual: number;
  readonly relative: number;
}

export const Q_GROUP_FIELDS: readonly string[] = ['Qts', 'Qes', 'Qms'] as const;

export function isQGroupField(field: string): boolean {
  return Q_GROUP_FIELDS.includes(field);
}

export function qGroupIsIncomplete(usable: (field: string) => boolean): boolean {
  return Q_GROUP_FIELDS.filter(usable).length < 2;
}