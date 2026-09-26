/** REPO: the open design as a persisted payload — localStorage autosave, the share-link
 *  hash, and the project file on disk (`.owpr`). Takes the domain object, returns the domain
 *  object; every door carries the SAME bytes, `OpenISDProject.toOwprText()`'s `.owpr` text, and
 *  validation and reconstruction are entirely `@openisd/design`'s
 *  (`OpenISDProject.fromOwprText()` — QO116: one whole-record `.safeParse()` at the load
 *  boundary). This file supplies no shape of its own and never holds the project's record. */
import {OpenISDProject} from '@openisd/design';
import type {Engine} from '@openisd/design/engine';
import type {FileStorage, SaveResult} from '../storage/fileStorage.js';
import type {KeyValueStorage} from '../storage/keyValueStorage.js';
import {OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY, OPENISD_QUARANTINE_SESSION_KEY, OPENISD_STATE_KEY,} from './storageKeys.js';
import {createProjectSchemaUpgrade} from './projectSchemaUpgrade.js';

export interface FileNaming { suggestedName: string; mime: string; label: string; ext: string }

/** View/UI preferences a share link carries ALONGSIDE the project (human ruling 2026-08-14:
 *  a link is a complete description of the session, stripped of nothing) — panel/unit
 *  preferences and layout, nothing project-shaped. Not part of `openISDProjectJsonSchema`
 *  (QO90: a saved `.owpr`/autosave carries only the project; view state persists under its own
 *  storage key, independent of the project) so it travels as a sibling field in the share-link
 *  payload, never inside the project record itself.
 *
 *  Loss-model choice and open charts used to live here too, but QO130 made both PROJECT data
 *  (`OpenISDProject.lossMode`/`.graphs`) — the project text a share link already carries has
 *  them, so repeating them here would be a second, driftable copy. The graph cursor
 *  (crosshair/pinned/locked/drag-band) went further still: QO168 (2026-09-21) keeps it out of
 *  EVERY saved record, `ViewSnapshot` included — it is `OpenISDProject`'s own in-memory-only
 *  state, reset on every (re)wrap, never serialized anywhere. */
export interface ViewSnapshot {
  ui: Record<string, unknown>;
  /** The chart view: app-level, shared across every open project. Absent in a view saved
   *  before it was persisted. */
  chart?: ChartView;
}

/** A frequency or value range, `min` below `max`. */
export interface ViewRange {
  min: number;
  max: number;
}

/** The swept frequency range every chart draws over, and each chart's Y-axis override keyed by
 *  chart id (absent = auto-scale). */
export interface ChartView {
  sweepRange: ViewRange;
  yRanges: Record<string, ViewRange>;
}

export interface ProjectRepo {
  /** A URL carrying the whole session — project and view together (human ruling 2026-08-14). */
  stateToUrl(project: OpenISDProject, view: ViewSnapshot): Promise<string>;
  /** The session in the current location hash, or null when the hash carries none, or the
   *  problems the project record failed validation with. */
  loadFromHash(): Promise<{ project: OpenISDProject; view: ViewSnapshot } | string[] | null>;
  /** A design parsed from opened file TEXT — File → Open's JSON branch. Project only (QO90);
   *  same validator every other door uses, so a payload another door wrote loads identically. */
  readProjectText(text: string): OpenISDProject | string[];
  /** Write to the previously-picked file (first save prompts). `naming` carries the
   *  suggested filename and the picker's format bits. */
  saveToFile(project: OpenISDProject, naming: FileNaming): Promise<SaveResult>;
  /** Always prompt for a new location. */
  saveToNewFile(project: OpenISDProject, naming: FileNaming): Promise<SaveResult>;
  /** Save the committed project to browser storage. View state has its own repository/key. */
  saveToStorage(project: OpenISDProject): void;
  /** Restore the committed project from browser storage, or return null when none exists. */
  loadFromStorage(): OpenISDProject | string[] | null;
  /** List all projects saved in browser storage, newest save first. */
  listStoredProjects(): StoredProjectListing[];
  /** Load one project selected from the browser-storage picker. */
  loadStoredProject(id: string): OpenISDProject | string[];
  /** Persist the current open-project session for refresh recovery. */
  saveOpenProjects(projects: readonly OpenISDProject[], focused: OpenISDProject | null): void;
  /** Restore the open-project session, or null when no refresh session exists. A `string[]`
   *  means the record itself is unusable — bad JSON, or not the shape of a session — so there
   *  is nothing to restore from it. An entry that will not read is reported in the session's
   *  own `refused`, not here. */
  loadOpenProjects(): OpenProjectSession | string[] | null;
  /** Call `onChange` whenever another tab saves its open projects. Returns the call that stops it. */
  watchOpenProjects(onChange: () => void): () => void;
  /** Copy the stored session record to the quarantine key, leaving the original in place.
   *  Called when a record holds entries that would not read, so the next save cannot take
   *  them with it. A no-op when there is no stored record. */
  quarantineOpenSession(): void;
}

export interface StoredProjectListing {
  readonly id: string;
  readonly name: string;
  readonly modified: string;
}

export interface OpenProjectSession {
  readonly projects: OpenISDProject[];
  readonly focusedIndex: number;
  /** One message per entry the record held that could not be read. The entries that did read
   *  are in `projects` — a refusal costs its own project, never the others. The record itself
   *  is untouched; `quarantineOpenSession()` copies it aside before anything overwrites it. */
  readonly refused: readonly string[];
}

const PROJECT_STORAGE_KEY = OPENISD_STATE_KEY;
const PROJECTS_STORAGE_KEY = OPENISD_PROJECTS_KEY;
const OPEN_SESSION_STORAGE_KEY = OPENISD_OPEN_SESSIONS_KEY;
const QUARANTINE_SESSION_STORAGE_KEY = OPENISD_QUARANTINE_SESSION_KEY;
const LEGACY_PROJECT_STORAGE_KEY = 'openisd.project';
const LEGACY_PROJECTS_STORAGE_KEY = 'openisd.projects';

interface StoredProjectEntry {
  id: string;
  text: string;
  modified: string;
}

interface StoredProjectsPayload {
  version: 1;
  entries: StoredProjectEntry[];
}

interface OpenSessionPayload {
  entries: StoredProjectEntry[];
  focusedId: string | null;
}

function storedProjectsPayload(value: unknown): StoredProjectsPayload | null {
  if (!value || typeof value !== 'object' || !('entries' in value) || !Array.isArray(value.entries)) return null;
  const entries: StoredProjectEntry[] = [];
  for (const entry of value.entries) {
    if (!entry || typeof entry !== 'object') return null;
    if (!('id' in entry) || typeof entry.id !== 'string') return null;
    if (!('text' in entry) || typeof entry.text !== 'string') return null;
    if (!('modified' in entry) || typeof entry.modified !== 'string') return null;
    entries.push({ id: entry.id, text: entry.text, modified: entry.modified });
  }
  return { version: 1, entries };
}

function openSessionPayload(value: unknown): OpenSessionPayload | null {
  if (!value || typeof value !== 'object' || !('entries' in value) || !Array.isArray(value.entries)) return null;
  if (!('focusedId' in value) || (value.focusedId !== null && typeof value.focusedId !== 'string')) return null;
  const entries: StoredProjectEntry[] = [];
  for (const entry of value.entries) {
    if (!entry || typeof entry !== 'object') return null;
    if (!('id' in entry) || typeof entry.id !== 'string') return null;
    if (!('text' in entry) || typeof entry.text !== 'string') return null;
    entries.push({ id: entry.id, text: entry.text, modified: '' });
  }
  return { entries, focusedId: value.focusedId };
}

// Share-link payload: gzip (native CompressionStream — Baseline widely available since May
// 2023, no library needed) then base64url. JSON compresses well (repetitive key names), so
// this typically shrinks the link by more than base64's own ~33% inflation costs — net
// smaller than the old plain-base64 encoding, not just "smaller than uncompressed JSON".
async function gzipEncodeBase64Url(json: string): Promise<string> {
  const bytes = new TextEncoder().encode(json);
  const compressed = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(compressed).arrayBuffer();
  let binary = '';
  for (const b of new Uint8Array(buf)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function gzipDecodeBase64Url(encoded: string): Promise<string> {
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const decompressed = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(decompressed).arrayBuffer();
  return new TextDecoder().decode(buf);
}

export function createProjectRepo(
  engine: Engine, fileStorage: FileStorage,
  storage: KeyValueStorage,
): ProjectRepo {
  const upgrade = createProjectSchemaUpgrade(engine);
  let lastSavedAt = 0;
  const storedIdentity = new WeakMap<OpenISDProject, string>();

  function readStoredEntries(): StoredProjectEntry[] {
    for (const key of [PROJECTS_STORAGE_KEY, LEGACY_PROJECTS_STORAGE_KEY]) {
      const collectionText = storage.get(key);
      if (collectionText === null) continue;
      try {
        const parsed: unknown = JSON.parse(collectionText);
        const payload = storedProjectsPayload(parsed);
        if (payload && payload.entries.length > 0) return payload.entries;
      } catch { /* fall through to the legacy single-project key */ }
    }
    for (const key of [PROJECT_STORAGE_KEY, LEGACY_PROJECT_STORAGE_KEY]) {
      const text = storage.get(key);
      if (text !== null) return [{ id: 'legacy', text, modified: new Date(0).toISOString() }];
    }
    return [];
  }

  function writeStoredEntries(entries: StoredProjectEntry[]): void {
    const payload: StoredProjectsPayload = { version: 1, entries };
    storage.set(PROJECTS_STORAGE_KEY, JSON.stringify(payload));
  }

  return {
    async stateToUrl(project: OpenISDProject, view: ViewSnapshot): Promise<string> {
      // The project travels as `.owpr` TEXT, exactly as it does to a file — one serialised form
      // for every door, so a share link and a saved file hold the same bytes for the same design.
      const payload: SharePayload = { project: project.toOwprText(), view };
      const encoded = await gzipEncodeBase64Url(JSON.stringify(payload));
      return location.origin + location.pathname + '#s=' + encoded;
    },

    async loadFromHash(): Promise<{ project: OpenISDProject; view: ViewSnapshot } | string[] | null> {
      const m = (location.hash || '').match(/[#&]s=([^&]+)/);
      if (!m) return null;
      let parsed: unknown;
      try { parsed = JSON.parse(await gzipDecodeBase64Url(m[1])); } catch { return null; }
      // Every reader upgrades (bugs/BUG_20260822_share_links_and_file_imports_bypass_the_
      // schema_upgrade.md). A payload already at the current schema passes through unchanged,
      // so `sharePayload()` below stays the one validator for the current shape.
      const current = upgrade.sharePayload(parsed);
      if (Array.isArray(current)) return current;

      const payload = sharePayload(current);
      if (!payload) return ['share link is not a recognised session payload'];

      const result = OpenISDProject.fromOwprText(payload.project, engine);
      return Array.isArray(result) ? result : { project: result, view: payload.view };
    },

    readProjectText(text: string): OpenISDProject | string[] {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { return ['not valid JSON']; }
      // The same upgrade the hash path applies — File → Open and a share link accept the same
      // set of payloads, or a design saved by an older build opens through one door only.
      const current = upgrade.projectPayload(parsed);
      if (Array.isArray(current)) return current;
      return OpenISDProject.fromOwprText(current, engine);
    },

    saveToFile(project: OpenISDProject, naming: FileNaming): Promise<SaveResult> {
      return fileStorage.save(project.toOwprText(),
        naming.suggestedName, naming.mime, naming.label, naming.ext);
    },

    saveToNewFile(project: OpenISDProject, naming: FileNaming): Promise<SaveResult> {
      return fileStorage.saveAs(project.toOwprText(),
        naming.suggestedName, naming.mime, naming.label, naming.ext);
    },

    saveToStorage(project: OpenISDProject): void {
      const entries = readStoredEntries();
      const id = storedIdentity.get(project) ?? project.uuid();
      const now = Math.max(Date.now(), lastSavedAt + 1);
      lastSavedAt = now;
      const entry: StoredProjectEntry = { id, text: project.toOwprText(), modified: new Date(now).toISOString() };
      writeStoredEntries([entry, ...entries.filter(existing => existing.id !== id)]);
      storage.set(PROJECT_STORAGE_KEY, entry.text);
      storedIdentity.set(project, id);
    },

    loadFromStorage(): OpenISDProject | string[] | null {
      const text = storage.get(PROJECT_STORAGE_KEY) ?? storage.get(LEGACY_PROJECT_STORAGE_KEY);
      if (text === null) return null;
      const project = this.readProjectText(text);
      if (Array.isArray(project)) return project;
      const entry = readStoredEntries().find(candidate => candidate.text === text);
      storedIdentity.set(project, entry?.id ?? 'legacy');
      return project;
    },
    listStoredProjects(): StoredProjectListing[] {
      return readStoredEntries().map(entry => {
        const project = this.readProjectText(entry.text);
        return Array.isArray(project)
          ? { id: entry.id, name: 'Unreadable project', modified: entry.modified }
          : { id: entry.id, name: project.name.value, modified: entry.modified };
      }).sort((a, b) => b.modified.localeCompare(a.modified));
    },
    loadStoredProject(id: string): OpenISDProject | string[] {
      const entry = readStoredEntries().find(candidate => candidate.id === id);
      if (entry === undefined) return ['saved project not found'];
      const project = this.readProjectText(entry.text);
      if (!Array.isArray(project)) storedIdentity.set(project, id);
      return project;
    },
    saveOpenProjects(projects: readonly OpenISDProject[], focused: OpenISDProject | null): void {
      const entries = projects.map(project => {
        const id = storedIdentity.get(project) ?? project.uuid();
        storedIdentity.set(project, id);
        return { id, text: project.toOwprText(), modified: '' };
      });
      const focusedId = focused === null ? null : storedIdentity.get(focused) ?? focused.uuid();
      storage.set(OPEN_SESSION_STORAGE_KEY, JSON.stringify({ entries, focusedId } satisfies OpenSessionPayload));
    },
    loadOpenProjects(): OpenProjectSession | string[] | null {
      const text = storage.get(OPEN_SESSION_STORAGE_KEY);
      if (text === null) return null;
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { return ['open project session is not valid JSON']; }
      const payload = openSessionPayload(parsed);
      if (!payload) return ['open project session has an invalid shape'];
      const projects: OpenISDProject[] = [];
      const refused: string[] = [];
      let focusedIndex = 0;
      for (const entry of payload.entries) {
        const project = this.readProjectText(entry.text);
        if (Array.isArray(project)) {
          refused.push(`entry ${entry.id}: ${project.join('; ')}`);
          continue;
        }
        storedIdentity.set(project, entry.id);
        if (entry.id === payload.focusedId) focusedIndex = projects.length;
        projects.push(project);
      }
      return { projects, focusedIndex, refused };
    },
    watchOpenProjects(onChange: () => void): () => void {
      return storage.watch(OPEN_SESSION_STORAGE_KEY, onChange);
    },
    quarantineOpenSession(): void {
      const text = storage.get(OPEN_SESSION_STORAGE_KEY);
      if (text !== null) storage.set(QUARANTINE_SESSION_STORAGE_KEY, text);
    },
  };
}

/** What a share link carries: the project as `.owpr` text, plus the chart view it was shared
 *  showing. The view is this package's own concern — the domain has no opinion on it — which is
 *  why the link is a wrapper around the project text rather than the project text itself. */
interface SharePayload { project: string; view: ViewSnapshot }

/** `value` as a `SharePayload`, or null when it is not one. A narrowing GUARD rather than a
 *  cast: the link's bytes came off a URL a stranger may have written, so every field is checked
 *  before any is read, and each is rebuilt at its own declared type rather than asserted. */
function sharePayload(value: unknown): SharePayload | null {
  if (!value || typeof value !== 'object') return null;
  if (!('project' in value) || typeof value.project !== 'string') return null;
  if (!('view' in value)) return null;
  const view = viewSnapshot(value.view);
  if (!view) return null;
  return { project: value.project, view };
}

/** `value` as a `ViewSnapshot`, or null when it is not one. */
function viewSnapshot(value: unknown): ViewSnapshot | null {
  if (!value || typeof value !== 'object') return null;

  const ui = 'ui' in value ? value.ui : null;
  if (!ui || typeof ui !== 'object') return null;

  return { ui: {...ui} };
}

/**
 * Project name ↔ file name.
 *
 * The FILE NAME is the source of truth for a project's name: the name is the filename minus
 * `.owpr`, and saving writes the name back unchanged. The two are one string, so a user
 * reading their file list is reading their project list.
 *
 * The only transformation on the way to disk is dropping characters a filename genuinely
 * cannot hold — `<>:"/\|?*`, control characters, and a leading/trailing dot or space (all
 * illegal on Windows). Spaces, apostrophes, dashes and interior dots are ordinary name
 * characters and are kept verbatim: substituting them would break the equivalence above on
 * everyday names.
 */

/** The project file extension. A bare `.json` is also accepted on the way in. */
export const PROJECT_EXT = '.owpr';

/** Characters no Windows filename may contain (`/` is illegal on POSIX too). */
const ILLEGAL_IN_FILENAME = /[<>:"/\\|?*]/g;
/** Leading/trailing dots and spaces — legal in a project name, not in a Windows filename. */
const EDGE_DOTS_AND_SPACES = /^[.\s]+|[.\s]+$/g;

/** C0/DEL control characters, which no filename may hold. Matched by code point so the
 *  source carries no literal control character (and needs no lint suppression). */
function stripControls(s: string, replacement: string): string {
  return Array.from(s).map((ch) => {
    const cp = ch.codePointAt(0)!;
    return cp < 0x20 || cp === 0x7f ? replacement : ch;
  }).join('');
}

/** The project name a file of this name holds — the basename minus the project extension. */
export function projectNameFromFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? '';
  const lower = base.toLowerCase();
  if (lower.endsWith(PROJECT_EXT)) return base.slice(0, -PROJECT_EXT.length).trim();
  if (lower.endsWith('.json')) return base.slice(0, -'.json'.length).trim();
  return base.trim();
}

/** The file name a project of this name is saved as. */
export function projectFilename(name: string): string {
  const raw = name || '';
  // A name with NO filename-legal character at all (e.g. "///") has no meaningful file name,
  // so it falls back to "design" rather than to a row of underscores.
  const legalChars = stripControls(raw, '').replace(ILLEGAL_IN_FILENAME, '').replace(EDGE_DOTS_AND_SPACES, '');
  if (!legalChars) return 'design' + PROJECT_EXT;
  const safe = stripControls(raw, '_').replace(ILLEGAL_IN_FILENAME, '_').replace(EDGE_DOTS_AND_SPACES, '');
  return safe + PROJECT_EXT;
}

/** The name of a copy of this project. */
export function copyOfName(name: string): string {
  return 'Copy of ' + name;
}

/** `name`, or `name (2)`, `name (3)`… — the first form not already in `taken`. */
export function uniqueName(name: string, taken: readonly string[]): string {
  if (!taken.includes(name)) return name;
  let n = 2;
  while (taken.includes(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}
