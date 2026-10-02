/**
 * Whether each open project's trace is drawn on the graphs — the Projects list's show/hide
 * checkbox, shared by both skins. UI-only state, never saved with a project. `revision` is the
 * dependency computeds read: a reactive WeakMap's key operations are not reliably trackable
 * inside a computed, while a plain ref always fires.
 */
import {reactive, ref} from 'vue';
import type {OpenISDProject} from '@openisd/design';

const visibleOf = reactive(new WeakMap<OpenISDProject, boolean>());
export const traceVisibilityRevision = ref(0);

export function isTraceVisible(p: OpenISDProject): boolean {
  return visibleOf.get(p) ?? true;
}

export function setTraceVisible(p: OpenISDProject, visible: boolean): void {
  visibleOf.set(p, visible);
  traceVisibilityRevision.value++;
}
