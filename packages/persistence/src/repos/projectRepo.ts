/** REPO: the open design as a persisted payload — localStorage autosave, the share-link
 *  hash, and the project file on disk (`.owpr`). Takes the domain object, returns the domain
 *  object; the JSON wire shape stays inside this file. */
import { OpenISDProject, OpenISDDriver } from '@openisd/model';
import type { AlignmentKind, OpenISDProjectMeta, UiParams } from '@openisd/model';
import type { BoxType } from '@openisd/engine';
import type { KeyValueStorage } from '../storage/keyValueStorage.js';
import type { FileStorage, SaveResult } from '../storage/fileStorage.js';

/** `AlignmentKind` (`@openisd/model`) and this file's own wire field `box: BoxType`
 *  (`@openisd/engine`) name the same four alignments and spell one of them differently
 *  ('passive-radiator' vs 'pr') — the SAME translation `managedProject.ts` makes at its own
 *  seam (ui/logic → engine vocabulary), duplicated here because persistence may not import a
 *  ui/logic module (layering runs one way) and this crossing is needed at this boundary too. */
const PR_ALIGNMENT = 'passive-radiator' satisfies AlignmentKind;
function wireBoxOf(kind: AlignmentKind): BoxType {
  return kind === PR_ALIGNMENT ? 'pr' : kind;
}
function alignmentOfWireBox(box: BoxType): AlignmentKind {
  return box === 'pr' ? PR_ALIGNMENT : box;
}

/** UI-only preferences (not part of a design). Persisted across refresh and carried by a
 *  share link (human ruling 2026-08-14: a link is a complete description of the session,
 *  stripped of nothing). */
export interface UiState {
  /** The selected Project tab rail entry (persists across reload). */
  originalProjectTab?: string;
  /** The selected chart type (persists across reload). */
  originalChartTab?: string;
  /** The chosen chart menu label (may name an engine-unavailable chart). */
  originalChartLabel?: string;
  /** A Tune (what-if) panel is open. Persisted so a refresh reopens it. */
  originalTuneOpen?: boolean;
  /** The Driver Editor modal is open. Persisted so a refresh reopens it. */
  originalEditorOpen?: boolean;
  /** Left panel width in px (splitter-dragged). Persisted across refresh AND carried by a
   *  share link (human ruling 2026-08-14: a link is a complete description of the session,
   *  stripped of nothing — see `stateToUrl()`). */
  originalNavW?: number;
  /** Bottom section height in px (splitter-dragged). Persisted across refresh and carried by
   *  a share link (2026-08-14 ruling, as above). */
  originalBottomH?: number;
  /** The left panel (Projects / Signal Generator) is collapsed. Persisted and shared, as above. */
  originalNavCollapsed?: boolean;
  /** The bottom section (tab rail + content) is collapsed. Persisted and shared, as above. */
  originalBottomCollapsed?: boolean;
  /** The chart is maximised over the whole main area (toolbar stays). Persisted and shared,
   *  as above. */
  originalChartMax?: boolean;
  /** Per-field selected display-unit token (keyed by field id; see fields/units.ts). The store
   *  always holds SI — this only picks how a field is shown/entered. Absent field ⇒ its base
   *  unit. Persisted across refresh and carried by a share link (2026-08-14 ruling, as above —
   *  the recipient sees the sender's chosen units, not their own). */
  unitTokens?: Record<string, string>;
  /** Options dialog → General tab "Username" field (WinISD parity). Persisted across refresh
   *  and carried by a share link (2026-08-14 ruling, as above). */
  username?: string;
  /** Options dialog → General tab "Environment" group (WinISD parity: Temperature/Air
   *  pressure/Relative humidity — Sound velocity is derived, not stored). These are
   *  APP-LEVEL defaults, distinct from a project's own Advanced-pane values: they only seed
   *  a shell's Advanced-pane refs on mount,
   *  they never overwrite an already-open project. Persisted across refresh and carried by a
   *  share link (2026-08-14 ruling, as above). */
  envDefaults: { tempK: number; pressurePa: number; humidityPct: number };
  /** Options dialog → Plot Window tab "Colors" group (WinISD parity, partial — see
   *  OptionsModal.vue header comment for which of WinISD's 6 swatches have a real OpenISD
   *  hook). Absent key = the app's own default (CSS custom property / hardcoded constant).
   *  Persisted across refresh and carried by a share link (2026-08-14 ruling, as above). */
  chartColors?: Partial<Record<'background' | 'otherLines' | 'labels' | 'xmaxLimit' | 'cursor', string>>;
}

/** The presentation remainder of a saved session — everything a link carries that is neither
 *  the project's own fields (`UiParams`) nor its metadata: the loss-model choice, the open
 *  charts, the panel/unit preferences, and the graph cursor. Declared HERE, by the repo, as
 *  the port the logic layer maps its live presentation state into. */
export interface ViewSnapshot {
  lossMode?: string;
  graphs: string[];
  ui?: UiState;
  cursor?: { f: number | null; pinnedF: number | null; locked: boolean; range?: { fLo: number; fHi: number } | null };
}

/**
 * The storage's schema collaborator — INJECTED at the composition root (a repo takes its
 * collaborators as arguments; it never reaches up into the logic layer). The implementation
 * is `logic/schemaUpgrade.ts`'s chain for this payload family.
 */
export interface ProjectSchema {
  /** The schema this build writes. */
  current: number;
  /** Bring a parsed payload to `current`. Throws when there is no route — a newer build's
   *  payload, or one older than the oldest step. */
  upgrade(blob: Record<string, unknown>): { blob: Record<string, unknown>; from: number; applied: string[] };
}

export const PROJECT_STATE_KEY = 'openisd.state';

/** The persisted / URL-encoded snapshot shape. INTERNAL: repo callers speak `OpenISDProject`
 *  (+ `ViewSnapshot` for the share-link doors); this is the flat wire shape it becomes on disk
 *  and in links, built from and read back into the project's OWN `toUiParams()`/`loadUiParams()`
 *  surface. `P`/`graphs`/`lossMode`/`ui`/`cursor` are all optional on the wire because a
 *  pure-project save (QO90 — `saveLocal`/`saveToFile`/`saveToNewFile`) never writes the view
 *  fields, while a share link (`stateToUrl`) writes every field. One schema, an optional view
 *  section — not two payload shapes. */
interface SerializedState {
  /** The MODEL schema version this payload was serialised from. Readers upgrade from it
   *  (the injected `ProjectSchema`). Optional on the way IN because pre-policy payloads carry none —
   *  those are V0 — and always written on the way OUT. */
  schema?: number;
  v: number;
  // The driver as the managed layer's own SERIALISED TEXT (`managedProject.
  // persistedDriverText()`) — provenance and every stated field survive reload, share and
  // save, while no UI code ever holds the record shape itself (QO73). REQUIRED: a project
  // cannot exist without a driver (`docs/design/DRIVER_NON_NULL_INVARIANT.md`) — a payload
  // with no driver is refused on load, never repaired by inventing one.
  driver: string;
  box: BoxType;
  lossMode?: string;
  P?: UiParams;
  graphs?: string[];
  // A share link carries the full ui (human ruling 2026-08-14); a pure-project save carries
  // none of it (QO90).
  ui?: UiState;
  project?: OpenISDProjectMeta;
  // Graph cursor/marker — carried by BOTH a local save (refresh fidelity) and a share link,
  // same as tab/chart: the live hover cursor (f, transient — usually null unless a share was
  // taken mid-hover), the locked/pinned marker (pinnedF + locked), and the dragged frequency
  // band selection (range — fLo/fHi only; each panel recomputes its own stats). Optional so an
  // old v2 blob (saved/shared before this field existed) still parses — absent reads as "no
  // marker"; range likewise optional within it.
  cursor?: { f: number | null; pinnedF: number | null; locked: boolean; range?: { fLo: number; fHi: number } | null };
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
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function gzipDecodeBase64Url(encoded: string): Promise<string> {
  const binary = atob(encoded.replace(/-/g,'+').replace(/_/g,'/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const decompressed = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(decompressed).arrayBuffer();
  return new TextDecoder().decode(buf);
}

export interface ProjectRepo {
  /** Autosave to browser storage. Quota/disabled storage is non-fatal — an autosave that
   *  cannot happen must not take the session down. Pure project data (QO90) — no view. */
  saveLocal(project: OpenISDProject): void;
  /** The saved design, brought to the current schema, or null when none/unreadable. */
  loadLocal(): OpenISDProject | null;
  /** A URL carrying the WHOLE session, stripped of nothing (human ruling 2026-08-14) — `view`
   *  is written to the wire here, unlike the pure-project doors. The one legitimate place a
   *  project and its view are bundled together — a share link is genuinely both at once. */
  stateToUrl(project: OpenISDProject, view: ViewSnapshot): Promise<string>;
  /** The design and view in the current location hash, or null when the hash carries none. */
  loadFromHash(): Promise<{ project: OpenISDProject; view: ViewSnapshot } | null>;
  /** A design parsed from opened file TEXT — File → Open's JSON branch. Same schema seam as
   *  every other door, so a payload an older build wrote loads identically whichever way it
   *  arrives (bugs/BUG_20260822_share_links_and_file_imports_bypass_the_schema_upgrade.md). */
  readProjectText(text: string): OpenISDProject | null;
  /** Write to the previously-picked file (first save prompts). `naming` carries the
   *  suggested filename and the picker's format bits. Pure project data (QO90), like
   *  `saveLocal`. */
  saveToFile(project: OpenISDProject, naming: FileNaming): Promise<SaveResult>;
  /** Always prompt for a new location. Pure project data (QO90), like `saveLocal`. */
  saveToNewFile(project: OpenISDProject, naming: FileNaming): Promise<SaveResult>;
}

export interface FileNaming { suggestedName: string; mime: string; label: string; ext: string }

export function createProjectRepo(
  storage: KeyValueStorage, schema: ProjectSchema, fileStorage: FileStorage,
): ProjectRepo {

  /** PURE PROJECT DATA (QO90) — `saveLocal`/`saveToFile`/`saveToNewFile`'s wire writer, built
   *  from the project's OWN existing serialisation surface (`toUiParams()`/`activeAlignment()`/
   *  `projectMeta()`/`driver()`) rather than a hand-assembled second shape — `OpenISDProject` is
   *  what every caller of this repo already holds; nothing here re-declares its fields. */
  function projectPayloadOf(project: OpenISDProject): SerializedState {
    return {
      // The MODEL version this payload is written from — every reader upgrades from it
      // (ARCHITECTURE.md §"EVERY STORED PAYLOAD CARRIES THE SCHEMA VERSION..."). `v` was
      // written for years and never read once, so it recorded nothing; it is kept only because
      // the type still declares it, and `schema` is the field that means something.
      schema: schema.current,
      v: 2,
      driver: project.driver().toOwdrJson(),
      box: wireBoxOf(project.activeAlignment()),
      P: project.toUiParams(),
      project: project.projectMeta(),
    };
  }

  /** The WHOLE session (human ruling 2026-08-14) — `stateToUrl`'s wire writer. */
  function sessionPayloadOf(project: OpenISDProject, view: ViewSnapshot): SerializedState {
    return {
      ...projectPayloadOf(project),
      lossMode: view.lossMode,
      graphs: view.graphs,
      ui: view.ui,
      cursor: view.cursor,
    };
  }

  /**
   * A saved wire state → a live `OpenISDProject`, via the project's own `loadUiParams()` — the
   * SAME restore surface `OpenISDProject` already exposes, not a second reconstruction path.
   * The driver's text is untrusted (a hand-edited file, an old build's link), so it is CHECKED
   * (`OpenISDDriver.fromConformingRecord`) rather than trusted outright: a driver too broken to
   * load safely is quarantined and dropped, while the rest of the project still loads
   * (least-impact refusal — the user loses the driver selection, not the session).
   *
   * Old-schema repair (a pre-vent-group save carrying no `ventShape`/`ventW`/`ventH`/`entered`)
   * happens here too, on the raw incoming params, before they ever reach a live project —
   * `OpenISDProject.solveVentGroup()` (the domain object's own solver) settles the fabricated
   * entered set once, on the detached project, before anything reactive can see it.
   *
   * Null when the driver record is too broken to load — a project cannot exist without a
   * driver (`docs/design/DRIVER_NON_NULL_INVARIANT.md`), so the WHOLE payload is refused
   * rather than adopted driverless.
   */
  function projectOf(s: SerializedState): OpenISDProject | null {
    let parsed: unknown;
    try { parsed = JSON.parse(s.driver); } catch { parsed = null; }
    const driver = parsed != null ? OpenISDDriver.fromConformingRecord(parsed) : null;
    if (!driver) {
      console.error('[restore] refused the saved driver record — not a conforming driver record');
      // QUARANTINE BEFORE THE AUTOSAVE EATS IT. Refusing the record leaves nothing to load
      // from, and the very next autosave would overwrite the same key — so within a tick the
      // evidence would be gone with nothing left to repair.
      try { storage.set('openisd.quarantine.driver', s.driver); }
      catch { /* storage full or disabled — the refusal still stands */ }
      return null;
    }

    const incoming: Partial<UiParams> = { ...(s.P ?? {}) };
    if (incoming.ventShape === undefined) incoming.ventShape = 'round';
    if (incoming.ventW === undefined) incoming.ventW = 0.10;
    if (incoming.ventH === undefined) incoming.ventH = 0.05;
    const hadEntered = !!incoming.entered;
    if (!hadEntered) incoming.entered = { Vb: true, ventD: true, ventW: true, ventH: true, ventL: true };

    const project = OpenISDProject.empty(driver);
    project.loadUiParams(incoming, alignmentOfWireBox(s.box));
    if (!hadEntered) project.solveVentGroup();
    project.setProjectMeta(s.project!);   // guaranteed present — carriesStateShape refuses a blob without it
    return project;
  }

  /**
   * Bring an already-parsed persisted payload to the current schema, or null when it cannot
   * be. The ONE upgrade seam every reader of a persisted payload shares — browser storage,
   * the share-link hash, and File → Open's JSON branch — so a payload an older build wrote
   * loads identically whichever door it arrives through
   * (bugs/BUG_20260822_share_links_and_file_imports_bypass_the_schema_upgrade.md).
   */
  function upgradeParsedState(parsed: unknown): SerializedState | null {
    if (!parsed || typeof parsed !== 'object') return null;
    let blob: Record<string, unknown>;
    try {
      const result = schema.upgrade(parsed as Record<string, unknown>);
      blob = result.blob;
      if (result.applied.length) {
        console.info(`[restore] upgraded saved state from schema V${result.from}: ${result.applied.join('; ')}`);
      }
    } catch (e) {
      console.error(`[restore] cannot load saved state — ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
    // `upgrade()` guarantees the VERSION, not the shape: it applies the declared steps and
    // stamps the result. `carriesStateShape` checks the two fields dereferenced without
    // asking first, so a payload that states a version it does not actually match is refused
    // here rather than throwing somewhere downstream. Every OTHER field is optional-and-
    // guarded at its own read site, so those two are the whole obligation — and the narrowing
    // is a real type predicate, not a cast.
    if (!carriesStateShape(blob)) return null;
    return blob;
  }

  /** The shape check `upgradeParsedState` narrows on: `box` present as a string, `driver`
   *  present as serialised TEXT (REQUIRED — a project cannot exist without a driver,
   *  `docs/design/DRIVER_NON_NULL_INVARIANT.md`), and `P`/`project` present — a saved
   *  project's params and meta are always both written together, so a blob missing either is
   *  refused rather than reconstructed from defaults. Reports what it refused, because a
   *  silent null at a restore boundary is indistinguishable from "nothing was saved". */
  function carriesStateShape(blob: Record<string, unknown>): blob is Record<string, unknown> & SerializedState {
    if (typeof blob.box !== 'string') {
      console.error('[restore] saved state states a schema but carries no box type — refused');
      return false;
    }
    if (typeof blob.driver !== 'string') {
      console.error('[restore] saved state carries no driver — refused (a project cannot exist without one)');
      return false;
    }
    if (!blob.P || typeof blob.P !== 'object') {
      console.error('[restore] saved state carries no project params — refused');
      return false;
    }
    if (!blob.project || typeof blob.project !== 'object') {
      console.error('[restore] saved state carries no project metadata — refused');
      return false;
    }
    return true;
  }

  function readParsedProject(parsed: unknown): OpenISDProject | null {
    const s = upgradeParsedState(parsed);
    return s ? projectOf(s) : null;
  }

  function readParsedSession(parsed: unknown): { project: OpenISDProject; view: ViewSnapshot } | null {
    const s = upgradeParsedState(parsed);
    if (!s) return null;
    const project = projectOf(s);
    if (!project) return null;
    return { project, view: { lossMode: s.lossMode, graphs: s.graphs ?? [], ui: s.ui, cursor: s.cursor } };
  }

  return {
    saveLocal(project: OpenISDProject): void {
      storage.set(PROJECT_STATE_KEY, JSON.stringify(projectPayloadOf(project)));   // createLocalStorage already guards quota/disabled
    },

    /**
     * Read the saved state and bring it to the current schema.
     *
     * The upgrade runs HERE, at the door, so nothing downstream ever sees an older shape. A
     * payload this build cannot upgrade — a future version, or a gap in the chain — is
     * refused rather than loaded hopefully; `upgrade()` throws and this returns null, leaving
     * the app on its own defaults with the stored bytes untouched for diagnosis.
     */
    loadLocal(): OpenISDProject | null {
      const raw = storage.get(PROJECT_STATE_KEY);
      if (!raw) return null;
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch {
        console.error('[restore] saved state is not valid JSON — ignored');
        return null;
      }
      return readParsedProject(parsed);
    },

    async stateToUrl(project: OpenISDProject, view: ViewSnapshot): Promise<string> {
      // The URL carries the WHOLE state, stripped of nothing (human ruling 2026-08-14). A
      // share link is a complete description of the session: the recipient lands on exactly
      // what the sender was looking at, which is what makes a link usable for diagnostics and
      // not just for handing over a design.
      //
      // This deliberately includes the recipient's-preference fields (unit tokens, chart
      // colours, environment defaults, username, panel sizes) and the open-panel flags, even
      // though they are preferences rather than design data. Fidelity beats politeness: a
      // link that quietly differs from what the sender saw cannot be used to diagnose what
      // the sender saw.
      const encoded = await gzipEncodeBase64Url(JSON.stringify(sessionPayloadOf(project, view)));
      return location.origin + location.pathname + '#s=' + encoded;
    },

    async loadFromHash(): Promise<{ project: OpenISDProject; view: ViewSnapshot } | null> {
      const m = (location.hash || '').match(/[#&]s=([^&]+)/);
      if (!m) return null;
      try { return readParsedSession(JSON.parse(await gzipDecodeBase64Url(m[1]))); } catch { return null; }
    },

    readProjectText(text: string): OpenISDProject | null {
      try { return readParsedProject(JSON.parse(text)); } catch { return null; }
    },

    saveToFile(project: OpenISDProject, naming: FileNaming): Promise<SaveResult> {
      return fileStorage.save(JSON.stringify(projectPayloadOf(project), null, 2),
        naming.suggestedName, naming.mime, naming.label, naming.ext);
    },

    saveToNewFile(project: OpenISDProject, naming: FileNaming): Promise<SaveResult> {
      return fileStorage.saveAs(JSON.stringify(projectPayloadOf(project), null, 2),
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
