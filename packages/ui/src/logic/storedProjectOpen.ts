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
import type {AppState, StoredProjectIdentity} from './appState.js';

/** What opening a stored project did: the focused project, or the store's refusal to read it. */
export type StoredOpenResult =
  | { readonly kind: 'opened'; readonly project: OpenISDProject }
  | { readonly kind: 'refused'; readonly errors: readonly string[] };

export function openStoredProject(appState: AppState, repo: ProjectRepo, id: string): StoredOpenResult {
  const {openProjectByIdentity, openProjectOnce} = appState;
  const identity: StoredProjectIdentity = {kind: 'stored', id};
  const existing = openProjectByIdentity(identity);
  if (existing) return {kind: 'opened', project: openProjectOnce(existing, identity)};
  // A project opened from a file holds the store's id too once it is stored (it is stored the
  // moment it opens): it is open already, and is never loaded a second time.
  const stored = appState.openProjects().find(project => repo.storedIdOf(project) === id);
  if (stored) {
    appState.focusProject(appState.openProjects().indexOf(stored));
    return {kind: 'opened', project: stored};
  }
  const loaded = repo.loadStoredProject(id);
  if (Array.isArray(loaded)) return {kind: 'refused', errors: loaded};
  return {kind: 'opened', project: openProjectOnce(loaded, identity)};
}
