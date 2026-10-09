/**
 * Opening one of the browser-stored projects, ONCE. The shared door both shells' "Open project"
 * lists call — desktop and mobile had byte-identical copies of this before
 * (BUG_20261009_same-project-opens-many-times).
 *
 * Loading is `@openisd/persistence`'s job; deciding whether that project is already open is the
 * registry's (`appState.ts`). This module only sequences the two: look the store id up in the
 * registry FIRST, so a project that is already open is focused in place and never loaded a
 * second time.
 */
import type {OpenISDProject} from '@openisd/design';
import type {ProjectRepo} from '@openisd/persistence';
import {openProjectByIdentity, openProjectOnce, type StoredProjectIdentity} from './appState.js';

/** What opening a stored project did: the focused project, or the store's refusal to read it. */
export type StoredOpenResult =
  | { readonly kind: 'opened'; readonly project: OpenISDProject }
  | { readonly kind: 'refused'; readonly errors: readonly string[] };

export function openStoredProject(repo: ProjectRepo, id: string): StoredOpenResult {
  const identity: StoredProjectIdentity = {kind: 'stored', id};
  const existing = openProjectByIdentity(identity);
  if (existing) return {kind: 'opened', project: openProjectOnce(existing, identity)};
  const loaded = repo.loadStoredProject(id);
  if (Array.isArray(loaded)) return {kind: 'refused', errors: loaded};
  return {kind: 'opened', project: openProjectOnce(loaded, identity)};
}
