/** REPO: the open design as a persisted payload — localStorage autosave, the share-link
 *  hash, and the project file on disk (`.owpr`). Takes the domain object, returns the domain
 *  object; validation and reconstruction are entirely `@openisd/design`'s (`projectRepo()`,
 *  `openISDProjectJsonSchema` — QO116: one whole-record `.safeParse()` at the load boundary).
 *  This file supplies no shape of its own: it is a `RecordStoreFactory` per door (file, URL
 *  hash, browser storage) feeding that one validator, never a second wire format. */
import {
  projectRepo as designProjectRepo,
  type OpenISDProject, type ProjectRepo as DesignProjectRepo,
  type RecordStore, type RecordStoreFactory,
} from '@openisd/design';
import type { Engine } from '@openisd/design/engine';
import type { FileStorage, SaveResult } from '../storage/fileStorage.js';

/** A store holding exactly the one record most recently `put()` — the adapter every one-shot
 *  door (a file, a URL hash) uses to borrow design's own save/validate/load logic without
 *  actually keeping a second copy anywhere. `list()`/`remove()` are unreachable through these
 *  doors (there is no browsing a file or a link), so they refuse rather than pretend to work. */
function singleSlotStore<R>(): RecordStore<R> & { current(): R | null } {
  let held: R | null = null;
  return {
    put(_id, record) { held = record; },
    get(_id) { return held; },
    list() { return []; },
    remove() { /* nothing to remove: this door holds no listing */ },
    current: () => held,
  };
}

export interface FileNaming { suggestedName: string; mime: string; label: string; ext: string }

/** View/UI preferences a share link carries ALONGSIDE the project (human ruling 2026-08-14:
 *  a link is a complete description of the session, stripped of nothing) — loss-model choice,
 *  open charts, panel/unit preferences, the graph cursor. Not part of `openISDProjectJsonSchema`
 *  (QO90: a saved `.owpr`/autosave carries only the project; view state persists under its own
 *  storage key, independent of the project) so it travels as a sibling field in the share-link
 *  payload, never inside the project record itself. */
export interface ViewSnapshot {
  lossMode?: string;
  graphs: string[];
  ui: Record<string, unknown>;
  cursor: {
    f: number | null;
    pinnedF: number | null;
    locked: boolean;
    range: { fLo: number; fHi: number } | null;
  };
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

/** One door, one throwaway design-`ProjectRepo` over a single-slot store — `save()` extracts
 *  the validated JSON; `load()` re-validates and reconstructs. Neither keeps state past the
 *  call: a fresh slot per operation, since each door (file, hash) already holds its own bytes. */
function doorRepo(engine: Engine): { repo: DesignProjectRepo; slot: RecordStore<unknown> & { current(): unknown } } {
  const slot = singleSlotStore<unknown>();
  const make: RecordStoreFactory = <R,>() => slot as unknown as RecordStore<R>;
  return { repo: designProjectRepo(make, engine), slot };
}

export function createProjectRepo(
  engine: Engine, fileStorage: FileStorage,
): ProjectRepo {
  function payloadOf(project: OpenISDProject): unknown {
    const { repo, slot } = doorRepo(engine);
    repo.save(project);
    return slot.current();
  }

  function projectOf(payload: unknown): OpenISDProject | string[] {
    const { repo, slot } = doorRepo(engine);
    slot.put(project_id_placeholder(payload), payload);
    return repo.load(project_id_placeholder(payload));
  }

  // The single-slot store ignores the id it is given (there is only ever one record in it), so
  // any stable string satisfies `put`/`load`'s signature without meaning anything.
  function project_id_placeholder(_payload: unknown): string { return 'door'; }

  return {
    async stateToUrl(project: OpenISDProject, view: ViewSnapshot): Promise<string> {
      const payload = { project: payloadOf(project), view };
      const encoded = await gzipEncodeBase64Url(JSON.stringify(payload));
      return location.origin + location.pathname + '#s=' + encoded;
    },

    async loadFromHash(): Promise<{ project: OpenISDProject; view: ViewSnapshot } | string[] | null> {
      const m = (location.hash || '').match(/[#&]s=([^&]+)/);
      if (!m) return null;
      let parsed: unknown;
      try { parsed = JSON.parse(await gzipDecodeBase64Url(m[1])); } catch { return null; }
      if (!parsed || typeof parsed !== 'object' || !('project' in parsed) || !('view' in parsed)) {
        return ['share link is not a recognised session payload'];
      }
      const { project, view } = parsed as { project: unknown; view: ViewSnapshot };
      const result = projectOf(project);
      return Array.isArray(result) ? result : { project: result, view };
    },

    readProjectText(text: string): OpenISDProject | string[] {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { return ['not valid JSON']; }
      return projectOf(parsed);
    },

    saveToFile(project: OpenISDProject, naming: FileNaming): Promise<SaveResult> {
      return fileStorage.save(JSON.stringify(payloadOf(project), null, 2),
        naming.suggestedName, naming.mime, naming.label, naming.ext);
    },

    saveToNewFile(project: OpenISDProject, naming: FileNaming): Promise<SaveResult> {
      return fileStorage.saveAs(JSON.stringify(payloadOf(project), null, 2),
        naming.suggestedName, naming.mime, naming.label, naming.ext);
    },
  };
}

/**
 * Project name ↔ file name.
 *
 * The FILE NAME is the source of truth for a project's name. Opening `glob 3.openisd.json`
 * gives the project `glob 3`; saving the project `glob 3` writes `glob 3.openisd.json`. The
 * two are one string, so a user reading their file list is reading their project list.
 *
 * The only transformation on the way to disk is dropping characters a filename genuinely
 * cannot hold — `<>:"/\|?*`, control characters, and a leading/trailing dot or space (all
 * illegal on Windows). Spaces, apostrophes, dashes and interior dots are ordinary name
 * characters and are kept verbatim; anything stricter breaks the equivalence on everyday
 * names (the historic `[^\w.-]+ → _` rule silently turned `glob 3` into `glob_3`).
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
