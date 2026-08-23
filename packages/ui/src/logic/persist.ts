import type { BoxType } from '@openisd/engine';
import type { ProjectMeta, SerializedState, UiParams } from '../types.js';
import type { PresentationState } from './presentationState.js';
import { CURRENT_SCHEMA, upgrade, type StoredBlob } from './schemaUpgrade.js';

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

/** `p` is the project's flat `UiParams` snapshot (`managedProject.toUiParams()`) — passed in
 *  rather than read off the store because the store holds no such copy (ledger QO54: the
 *  project already owns this state; the store never duplicates it). `driver` is the managed
 *  layer's own serialisation (`managedProject.persistedDriverText()`) — TEXT, never the
 *  record value, so no UI code touches the private shape (QO73). */
export function serialize(
  box: BoxType, project: ProjectMeta, view: PresentationState, driver: string | undefined, p: UiParams,
): SerializedState {
  return {
    // The MODEL version this payload is written from — every reader upgrades from it
    // (ARCHITECTURE.md §"EVERY STORED PAYLOAD CARRIES THE SCHEMA VERSION..."). `v` was
    // written for years and never read once, so it recorded nothing; it is kept only because
    // the type still declares it, and `schema` is the field that means something.
    schema: CURRENT_SCHEMA,
    v: 2,
    driver,
    box,
    lossMode: view.lossMode,
    P: p,
    graphs: view.graphs,
    ui: view.ui,
    project,
    // Graph cursor/marker/band-selection — carried the same way tab/chart are: both a local
    // save (refresh fidelity) and a share link reproduce exactly what the sender was pointing
    // at. The band carries only fLo/fHi; stats are recomputed per-panel on load.
    cursor: {
      f: view.cursorF, pinnedF: view.pinnedF, locked: view.cursorLocked,
      range: view.dragRange ? { fLo: view.dragRange.fLo, fHi: view.dragRange.fHi } : null,
    },
  };
}

export async function stateToUrl(serialized: SerializedState): Promise<string> {
  // The URL carries the WHOLE state, stripped of nothing (human ruling 2026-08-14). A share
  // link is a complete description of the session: the recipient lands on exactly what the
  // sender was looking at, which is what makes a link usable for diagnostics and not just for
  // handing over a design.
  //
  // This deliberately includes the recipient's-preference fields an earlier version removed
  // (unit tokens, chart colours, environment defaults, username, panel sizes) and the
  // open-panel flags. Fidelity beats politeness: a link that quietly differs from what the
  // sender saw cannot be used to diagnose what the sender saw.
  const encoded = await gzipEncodeBase64Url(JSON.stringify(serialized));
  return location.origin + location.pathname + '#s=' + encoded;
}

/**
 * Bring an already-parsed persisted payload to the current schema, or null when it cannot be.
 * The ONE upgrade seam every reader of a persisted payload shares — localStorage
 * (`loadLocal`), the share-link hash (`loadFromHash`), and File → Open's JSON branch
 * (`useDesignIO.importFile`) — so a payload an older build wrote loads identically whichever
 * door it arrives through
 * (bugs/BUG_20260822_share_links_and_file_imports_bypass_the_schema_upgrade.md).
 */
export function upgradeParsedState(parsed: unknown): SerializedState | null {
  if (!parsed || typeof parsed !== 'object') return null;
  let blob: StoredBlob;
  try {
    const result = upgrade(parsed as StoredBlob);
    blob = result.blob;
    if (result.applied.length) {
      console.info(`[restore] upgraded saved state from schema V${result.from}: ${result.applied.join('; ')}`);
    }
  } catch (e) {
    console.error(`[restore] cannot load saved state — ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  // `upgrade()` guarantees the VERSION, not the shape: it applies the declared steps and stamps
  // the result. `carriesStateShape` below checks the two fields the app dereferences without
  // asking first, so a payload that states a version it does not actually match is refused at
  // this boundary rather than throwing somewhere downstream. Every OTHER field is
  // optional-and-guarded at its own read site (`applyState`), so those two are the whole
  // obligation — and the narrowing is a real type predicate, not a cast.
  if (!carriesStateShape(blob)) return null;
  return blob;
}

/** The shape check `upgradeParsedState` narrows on: `box` present as a string, and `driver`
 *  either absent or the serialised TEXT the current schema declares. Reports what it refused,
 *  because a silent null at a restore boundary is indistinguishable from "nothing was saved". */
function carriesStateShape(blob: StoredBlob): blob is StoredBlob & SerializedState {
  if (typeof blob.box !== 'string') {
    console.error('[restore] saved state states a schema but carries no box type — refused');
    return false;
  }
  if (blob.driver !== undefined && typeof blob.driver !== 'string') {
    console.error('[restore] saved state carries a driver slot that is not serialised text — refused');
    return false;
  }
  return true;
}

export async function loadFromHash(): Promise<SerializedState | null> {
  const m = (location.hash || '').match(/[#&]s=([^&]+)/);
  if (!m) return null;
  try { return upgradeParsedState(JSON.parse(await gzipDecodeBase64Url(m[1]))); } catch { return null; }
}

export function saveLocal(serialized: SerializedState): void {
  try { localStorage.setItem('openisd.state', JSON.stringify(serialized)); } catch { /* quota / disabled storage — non-fatal */ }
}

/**
 * Read the saved state and bring it to the current schema.
 *
 * The upgrade runs HERE, at the boundary, so nothing downstream ever sees an older shape. A
 * payload this build cannot upgrade — a future version, or a gap in the chain — is refused
 * rather than loaded hopefully; `upgrade()` throws and this returns null, leaving the app on
 * its own defaults with the stored bytes untouched for diagnosis.
 */
export function loadLocal(): SerializedState | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem('openisd.state'); } catch { return null; }
  if (!raw) return null;

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    console.error('[restore] saved state is not valid JSON — ignored');
    return null;
  }
  return upgradeParsedState(parsed);
}

