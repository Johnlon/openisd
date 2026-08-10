import { OpenISDProject, type ProjectContent } from './OpenISDProject.js';

/**
 * The workspace: which projects are open, which one is active, and the per-row view state
 * that belongs to the session rather than to any project (STATE_MODEL.md).
 *
 * Two separate persisted things, never one:
 *   documents   the projects, each an independent record with its own id.
 *   workspace   this — the list of open documents, the active one, and view state.
 *
 * Written under its own localStorage key, so a project's own file never contains the
 * workspace and the workspace never becomes part of a project.
 *
 * ONLY INPUTS ARE PERSISTED. Every curve the app draws is derived from
 * `driver + box + P` by the engine's sweep()/maxCurves() and is recomputed on load: for
 * one project the curves are ~58 KB of JSON against under 1 KB of inputs, and a stored
 * curve is a stored answer that can silently disagree with the question.
 */

export const WORKSPACE_KEY = 'openisd.workspace';
export const WORKSPACE_VERSION = 1;

/** One open project as the workspace records it: its content plus its row's view state. */
export interface WorkspaceEntry {
  id: string;
  visible: boolean;
  color?: string;
  /** Present when the project has been saved/loaded — restoring it restores "unmodified". */
  ground: ProjectContent | null;
  content: ProjectContent;
}

export interface WorkspaceSnapshot {
  v: number;
  activeId: string | null;
  projects: WorkspaceEntry[];
}

/** A project plus the session-level facts about its row. */
export interface OpenProject {
  project: OpenISDProject;
  visible: boolean;
  color?: string;
}

export function toSnapshot(open: OpenProject[], activeId: string | null): WorkspaceSnapshot {
  return {
    v: WORKSPACE_VERSION,
    activeId,
    projects: open.map(o => ({
      id: o.project.id,
      visible: o.visible,
      color: o.color,
      ground: o.project.groundContent(),
      content: o.project.content(),
    })),
  };
}

export function fromSnapshot(snap: WorkspaceSnapshot): { open: OpenProject[]; activeId: string | null } {
  if (!snap || snap.v !== WORKSPACE_VERSION || !Array.isArray(snap.projects)) {
    return { open: [], activeId: null };
  }
  const open = snap.projects.map(e => ({
    project: OpenISDProject.restore(e.content, e.ground, e.id),
    visible: e.visible !== false,
    color: e.color,
  }));
  const activeId = open.some(o => o.project.id === snap.activeId) ? snap.activeId : (open[0]?.project.id ?? null);
  return { open, activeId };
}

export function saveWorkspace(open: OpenProject[], activeId: string | null): void {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(toSnapshot(open, activeId)));
  } catch { /* storage disabled or full — the session is still usable, just not durable */ }
}

export function loadWorkspace(): { open: OpenProject[]; activeId: string | null } {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return { open: [], activeId: null };
    return fromSnapshot(JSON.parse(raw) as WorkspaceSnapshot);
  } catch {
    return { open: [], activeId: null };
  }
}

export function clearWorkspace(): void {
  try { localStorage.removeItem(WORKSPACE_KEY); } catch { /* nothing to clear */ }
}
