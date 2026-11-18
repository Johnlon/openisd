import {shallowRef} from 'vue';
import type {UnsavedBar} from '@openisd/design/cloud';
import type {UnsavedNudge} from '../../src/logic/unsavedNudge.js';

/** A nudge that never asks and lists nothing: for a test of a shell's hook that is not about saving for sync. */
export function idleUnsavedNudge(): UnsavedNudge {
  return {
    bar: shallowRef<UnsavedBar | null>(null),
    unsavedProjects: () => [],
    save: async () => false,
    later: () => undefined,
    tick: () => undefined,
    stop: () => undefined,
  };
}
