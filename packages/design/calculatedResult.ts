/** The failure shared by engine result publishers and calculated fields. */
export interface NonFiniteResultIssue<Q extends string> {
  readonly kind: 'result-refused';
  readonly target: Q;
  readonly fields: readonly Q[];
  readonly cause: 'not-a-number' | 'infinite';
  readonly text: string;
}

export function nonFiniteResult<Q extends string>(target: Q, label: string, value: unknown): NonFiniteResultIssue<Q> | null {
  const cause = nonFiniteCause(value);
  if (cause === null) return null;
  const reason = cause === 'infinite' ? 'an infinite value' : 'an undefined numerical value (NaN)';
  return {kind: 'result-refused', target, fields: [target], cause, text: `${label} is unavailable because the calculation produced ${reason}.`};
}

function nonFiniteCause(value: unknown): NonFiniteResultIssue<string>['cause'] | null {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return null;
    return Number.isNaN(value) ? 'not-a-number' : 'infinite';
  }
  // Arrays include the sweep's complex pressure, whose real and imaginary parts are both outputs.
  if (value !== null && typeof value === 'object') {
    const members: readonly unknown[] = Array.isArray(value) ? value : Object.values(value);
    for (const member of members) {
      const cause = nonFiniteCause(member);
      if (cause !== null) return cause;
    }
  }
  return null;
}
