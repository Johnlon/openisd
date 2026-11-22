import {describe, expect, it} from 'vitest';
import {shallowRef} from 'vue';
import {heldFocusedProject} from '../../src/logic/focusedProjectContext.js';

/** bugs/BUG_20261016_live-crash-no-project-is-focused.md: a gated panel being torn down after the
 *  last project closed reads the focused project; it gets the project it was showing, not a throw. */
describe('heldFocusedProject', () => {
  interface Shown { readonly name: string }
  const project = (name: string): Shown => ({name});

  it('follows the focused project, and keeps the last one once none is focused', () => {
    const a = project('a'), b = project('b');
    const focused = shallowRef<Shown | null>(a);
    const held = heldFocusedProject(() => focused.value, () => { throw new Error('no project is focused'); });
    expect(held.value).toBe(a);
    focused.value = b;
    expect(held.value).toBe(b);
    focused.value = null;
    expect(held.value).toBe(b);
    focused.value = a;
    expect(held.value).toBe(a);
  });

  it('asks `require` only when no project was ever focused', () => {
    const held = heldFocusedProject<Shown>(() => null, () => { throw new Error('no project is focused'); });
    expect(() => held.value).toThrow('no project is focused');
  });
});
