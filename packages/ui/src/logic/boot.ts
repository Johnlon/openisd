/**
 * The application's startup sequence — the one place that states what is restored, and in what
 * order.
 *
 * Each phase runs only once the phase it depends on has returned: a share link ends the
 * restore on its own, the session is restored before the view that describes it, and the view
 * is restored before any panel it asks to reopen. Persistence is armed by the caller after
 * this resolves, never during it.
 *
 * Both faults reported on 2026-09-25 were ordering faults — a panel restored from the stored
 * view mounted while no project existed, and a boot that had failed to restore saved its empty
 * state over the record. Nothing here can fire early, so neither is reachable by construction
 * rather than by a guard at each site.
 */
import type {OpenProjectSession, ProjectRepo, ViewSnapshot} from '@openisd/persistence';
import {isOAuthFragment} from '@openisd/design/cloud';
import type {AppState} from './appState.js';
import type {PresentationState} from './presentationState.js';

/** The doors the boot reads through, and the one action it takes on the UI's behalf. */
export interface BootDeps {
  readonly projectRepo: Pick<ProjectRepo, 'loadFromHash' | 'loadOpenProjects' | 'loadFromStorage' | 'keepRefusedEntries'>;
  readonly viewStateRepo: {load(): ViewSnapshot | null};
  readonly logging: {flash(message: string): void};
  /** Opens the Driver Editor on the focused project — the shell's own action, injected so the
   *  boot does not reach into the selection service itself. */
  readonly editProjectDriver: () => void;
  readonly appState: AppState;
  readonly presentation: PresentationState;
  readonly recordedProjectId: () => string | null;
}

/** A share link carries the WHOLE session, project and view together (human ruling
 *  2026-08-14), so it replaces every other restore rather than adding to it. */
async function restoreFromShareLink(deps: BootDeps): Promise<boolean> {
  const fromUrl = await deps.projectRepo.loadFromHash();
  if (Array.isArray(fromUrl)) {
    deps.logging.flash('Could not load shared link: ' + fromUrl.join('; '));
    return false;
  }
  if (!fromUrl) return false;
  deps.appState.applyState(fromUrl);
  return true;
}

/** What the open-project session record said about which projects to open. */
type SessionRestore =
  /** No record, or one that will not read: the session says nothing. */
  | 'none'
  /** A readable record listing no project: the user closed them all, so nothing opens. */
  | 'empty'
  /** The record's projects are open again. */
  | 'restored';

/** Every project that was open at the last refresh. An entry that will not read costs its own
 *  project and no other; each is kept whole as a refused copy first, so the next save
 *  cannot take the refused entries with it. */
function restoreSession(deps: BootDeps): SessionRestore {
  const session: OpenProjectSession | string[] | null = deps.projectRepo.loadOpenProjects();
  if (session === null) return 'none';
  if (Array.isArray(session)) {
    deps.logging.flash('Could not restore open projects: ' + session.join('; '));
    return 'none';
  }
  if (session.refused.length > 0) {
    const notKept = deps.projectRepo.keepRefusedEntries(session.refusedEntries);
    deps.logging.flash(`Could not restore ${session.refused.length} of your open projects: ` + session.refused.join('; ')
      + (notKept === 0 ? '. They are kept in this browser.' : `. ${notKept} could not be kept: there is no room.`));
  }
  // Every entry refused: the record could not say what was open, so it says nothing.
  if (session.projects.length === 0) return session.refused.length > 0 ? 'none' : 'empty';
  deps.appState.restoreProjects(session.projects, session.focusedIndex, session.traceHidden);
  return 'restored';
}

/** The single project older sessions saved, before the open-project session existed. Read only
 *  when there is no session record: a session that lists no project is the user's own choice. */
function restoreLegacyProject(deps: BootDeps): void {
  const stored = deps.projectRepo.loadFromStorage();
  if (Array.isArray(stored)) {
    deps.logging.flash('Could not restore the saved project: ' + stored.join('; '));
    return;
  }
  if (stored) deps.appState.applyLoadedProject(stored);
}

/** Unit tokens, chart colours, open-panel flags — everything the view remembers. */
function restoreView(deps: BootDeps): void {
  const view = deps.viewStateRepo.load();
  if (view) deps.appState.applyViewSnapshot(view);
}

/** Panels the stored view left open. Both read the focused project, so this phase does nothing
 *  without one — the view outlives the project it was stored with. */
function restorePanels(deps: BootDeps): void {
  if (deps.appState.focusedProject() === null) return;
  const presentation = deps.presentation;
  if (presentation.ui.originalWhatIfOpen === true) presentation.editDriver = true;
  if (presentation.ui.originalEditorOpen === true && !presentation.editDriverInfo) deps.editProjectDriver();
}

export interface OAuthBootLocation {
  readonly search: string;
  readonly hash: string;
}

export interface OAuthBootSession {
  onBoot(loc: OAuthBootLocation): Promise<unknown>;
}

/**
 * If the location hash carries an OAuth reply, hand it to the session before the store gate opens.
 * Returns true if handled, false for a plain load (which never redirects).
 */
export async function handleOAuthBoot(
  session: OAuthBootSession,
  location: OAuthBootLocation,
): Promise<boolean> {
  if (!isOAuthFragment(location.hash)) {
    return false;
  }
  await session.onBoot(location);
  return true;
}

/**
 * Restore the application, in order. Resolves once every phase has run; the caller arms
 * persistence after that, so nothing written during startup can overwrite what it was still
 * reading.
 */
export async function bootApplication(deps: BootDeps): Promise<void> {
  if (await restoreFromShareLink(deps)) {
    deps.appState.markProjectSaved();
    return;
  }
  const session = restoreSession(deps);
  if (session === 'none') restoreLegacyProject(deps);
  restoreView(deps);
  restorePanels(deps);
  const recordedId = deps.recordedProjectId();
  if (recordedId !== null) {
    const projects = deps.appState.openProjects();
    const idx = projects.findIndex(p => p.uuid() === recordedId);
    if (idx >= 0) {
      deps.appState.focusProject(idx);
    }
  }
  // A restored session carries each project's own saved and edited layers, so its unsaved edits
  // stay unsaved. Only the single legacy project has no such layers: it is the ground state.
  if (session !== 'restored') deps.appState.markProjectSaved();
}


