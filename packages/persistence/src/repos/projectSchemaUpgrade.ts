/** Brings a project payload written by an older build up to the current schema, so every
 *  reader — localStorage autosave, the share-link hash, `File → Open` — accepts the same set of
 *  payloads. ARCHITECTURE.md §"EVERY STORED PAYLOAD CARRIES THE SCHEMA VERSION": every reader
 *  upgrades from it.
 *
 *  The upgrade is a TEXT→TEXT step over the wire form, never a reach into the domain's record:
 *  it rebuilds the project through `OpenISDProject`'s own builder and asks it for `.owpr` text,
 *  so this file states no record shape of its own. */
import { OpenISDDriver, OpenISDProject } from '@openisd/design';
import type { Engine } from '@openisd/design/engine';

/** A pre-session payload: the driver as a record OBJECT beside flat project meta, with no
 *  `{label, saved, edited}` wrapper. Written by builds before the session wrapper landed. */
interface V1Payload {
  schema: number;
  box?: string;
  graphs?: unknown;
  project?: { name?: string; creator?: string; created?: string; modified?: string; description?: string };
  driver?: unknown;
}

/** Is this parsed payload the V1 shape? Keyed on `schema: 1` plus the object driver slot that
 *  defines the version — not on absence of the V2 keys, so a corrupt V2 payload is reported by
 *  V2's own validator rather than silently taking the upgrade path. */
function isV1(parsed: unknown): parsed is V1Payload {
  if (typeof parsed !== 'object' || parsed === null) return false;
  return 'schema' in parsed && parsed.schema === 1 && 'driver' in parsed && typeof parsed.driver === 'object' && parsed.driver !== null;
}

/** Brings an older payload to the current schema. One `engine` for the module's life, taken at
 *  construction like every other repo here, rather than threaded through each call. */
export interface ProjectSchemaUpgrade {
  /**
   * `parsed` as current-schema `.owpr` text, or the problems that stopped it.
   *
   * A payload already at the current schema is returned as its own text unchanged — the caller
   * hands the result to `OpenISDProject.fromOwprText()` either way, so there is one validation
   * boundary, not two.
   */
  projectPayload(parsed: unknown): string | string[];
  /**
   * A whole SHARE-LINK payload brought to the current schema. A V1 link is the bare payload —
   * driver, meta and `graphs` at the top level, with no `{project, view}` split — so the upgrade
   * produces both halves: the project as `.owpr` text, and the view the link was carrying.
   *
   * A payload already at the current schema is returned unchanged, so the repo's own
   * `sharePayload()` remains the one validator for the current shape.
   */
  sharePayload(parsed: unknown): unknown | string[];
}

export function createProjectSchemaUpgrade(engine: Engine): ProjectSchemaUpgrade {
  return { projectPayload, sharePayload };

  function projectPayload(parsed: unknown): string | string[] {
  if (!isV1(parsed)) return JSON.stringify(parsed);

  const driver = OpenISDDriver.fromConformingRecord(parsed.driver, engine);
  if (Array.isArray(driver)) {
    return driver.map(problem => `the V1 payload's driver does not conform: ${problem}`);
  }

  // A V1 payload states no box volume — the field did not travel — so the upgraded project takes
  // the builder's sealed default. The design's own numbers are the driver's; the box is what the
  // recipient re-states, exactly as they would on a fresh project.
  const project = OpenISDProject.builder(driver, engine).sealed().volume_m3(0.03).build();

  const meta = parsed.project ?? {};
  if (meta.name !== undefined) project.name.set(meta.name);
  if (meta.creator !== undefined) project.creator.set(meta.creator);
  if (meta.created !== undefined) project.created.set(meta.created);
  if (meta.modified !== undefined) project.modified.set(meta.modified);
  if (meta.description !== undefined) project.description.set(meta.description);
  // An upgraded payload arrives SAVED, not edited: it is a design the sender already committed,
  // and leaving it in the edited state would show the recipient unsaved changes they never made.
  project.save();

  return project.toOwprText();
}

  function sharePayload(parsed: unknown): unknown | string[] {
  if (!isV1(parsed)) return parsed;

  const text = projectPayload(parsed);
  if (Array.isArray(text)) return text;

  // V1 carried the open charts and nothing else of the view; the rest takes the same
  // all-unset values a fresh session has, rather than inventing preferences the sender never
  // expressed.
  return {
    project: text,
    view: {
      graphs: Array.isArray(parsed.graphs) ? parsed.graphs : [],
      ui: {},
      cursor: { f: null, pinnedF: null, locked: false, range: null },
    },
  };
}
}
