import {describe, expect, it} from 'vitest';
import {sortKeysDeep} from '../../domain/openIsdDeviceJsonIo.js';

describe('sortKeysDeep — canonical A→Z key order, recursively', () => {
  it('sorts an object whose own keys arrive out of order, in both directions', () => {
    // Three keys, not already ascending and not fully reversed: sorting them exercises the
    // comparator's a<b, a>b AND a===b arms, not just one.
    const sorted = sortKeysDeep({ b: 1, a: 2, c: 3 });
    expect(sorted).toEqual({ a: 2, b: 1, c: 3 });
    if (typeof sorted !== 'object' || sorted === null) throw new Error('expected an object');
    expect(Object.keys(sorted)).toEqual(['a', 'b', 'c']);
  });

  it('sorts nested objects and the objects inside arrays, leaving non-objects untouched', () => {
    expect(sortKeysDeep({ z: [{ y: 1, x: 2 }], a: 1 })).toEqual({ a: 1, z: [{ x: 2, y: 1 }] });
    expect(sortKeysDeep(5)).toBe(5);
    expect(sortKeysDeep(null)).toBe(null);
  });
});
