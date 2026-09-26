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
import {applyLoadedProject, applyState, applyViewSnapshot, focusedProject, markProjectSaved, restoreProjects} from './appState.js';
import {presentationState} from './presentationState.js';

/** The doors the boot reads through, and the one action it takes on the UI's behalf. */
export interface BootDeps {
  readonly projectRepo: Pick<ProjectRepo, 'loadFromHash' | 'loadOpenProjects' | 'loadFromStorage' | 'quarantineOpenSession'>;
  readonly viewStateRepo: {load(): ViewSnapshot | null};
  readonly logging: {flash(message: string): void};
  /** Opens the Driver Editor on the focused project — the shell's own action, injected so the
   *  boot does not reach into the selection service itself. */
  readonly editProjectDriver: () => void;
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
  applyState(fromUrl);
  return true;
}

/** Every project that was open at the last refresh. An entry that will not read costs its own
 *  project and no other; the record holding it is copied to quarantine first, so the next save
 *  cannot take the refused entries with it. */
function restoreSession(deps: BootDeps): boolean {
  const session: OpenProjectSession | string[] | null = deps.projectRepo.loadOpenProjects();
  if (session === null) return false;
  if (Array.isArray(session)) {
    deps.projectRepo.quarantineOpenSession();
    deps.logging.flash('Could not restore open projects: ' + session.join('; '));
    return false;
  }
  if (session.refused.length > 0) {
    deps.projectRepo.quarantineOpenSession();
    deps.logging.flash(`Could not restore ${session.refused.length} of your open projects: ` + session.refused.join('; '));
  }
  if (session.projects.length === 0) return false;
  restoreProjects(session.projects, session.focusedIndex);
  return true;
}

/** The single project older sessions saved, before the open-project session existed. */
function restoreLegacyProject(deps: BootDeps): void {
  const stored = deps.projectRepo.loadFromStorage();
  if (Array.isArray(stored)) {
    deps.logging.flash('Could not restore the saved project: ' + stored.join('; '));
    return;
  }
  if (stored) applyLoadedProject(stored);
}

/** Unit tokens, chart colours, open-panel flags — everything the view remembers. */
function restoreView(deps: BootDeps): void {
  const view = deps.viewStateRepo.load();
  if (view) applyViewSnapshot(view);
}

/** Panels the stored view left open. Both read the focused project, so this phase does nothing
 *  without one — the view outlives the project it was stored with. */
function restorePanels(deps: BootDeps): void {
  if (focusedProject() === null) return;
  if (presentationState.ui.originalTuneOpen === true) presentationState.editDriver = true;
  if (presentationState.ui.originalEditorOpen === true && !presentationState.editDriverInfo) deps.editProjectDriver();
}

/**
 * Restore the application, in order. Resolves once every phase has run; the caller arms
 * persistence after that, so nothing written during startup can overwrite what it was still
 * reading.
 */
export async function bootApplication(deps: BootDeps): Promise<void> {
  if (await restoreFromShareLink(deps)) {
    markProjectSaved();
    return;
  }
  if (!restoreSession(deps)) restoreLegacyProject(deps);
  restoreView(deps);
  restorePanels(deps);
  markProjectSaved();   // the just-restored design is the ground state (clean, not modified)
}
