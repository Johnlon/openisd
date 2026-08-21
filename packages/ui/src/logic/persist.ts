import type { AppState, DriverJSON, SerializedState, UiParams } from '../types.js';
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
 *  rather than read off `state` because the store holds no such copy (ledger QO54: the
 *  project already owns this state; the store never duplicates it). */
export function serialize(
  state: AppState, view: PresentationState, driver: DriverJSON | undefined, p: UiParams,
): SerializedState {
  return {
    // The MODEL version this payload is written from — every reader upgrades from it
    // (ARCHITECTURE.md §"EVERY STORED PAYLOAD CARRIES THE SCHEMA VERSION..."). `v` was
    // written for years and never read once, so it recorded nothing; it is kept only because
    // the type still declares it, and `schema` is the field that means something.
    schema: CURRENT_SCHEMA,
    v: 2,
    driver,
    box: state.box,
    lossMode: view.lossMode,
    P: p,
    graphs: view.graphs,
    ui: view.ui,
    project: state.project,
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

export async function loadFromHash(): Promise<SerializedState | null> {
  const m = (location.hash || '').match(/[#&]s=([^&]+)/);
  if (!m) return null;
  try { return JSON.parse(await gzipDecodeBase64Url(m[1])); } catch { return null; }
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
  if (!parsed || typeof parsed !== 'object') return null;

  try {
    const { blob, from, applied } = upgrade(parsed as StoredBlob);
    if (applied.length) {
      console.info(`[restore] upgraded saved state from schema V${from}: ${applied.join('; ')}`);
    }
    return blob as unknown as SerializedState;
  } catch (e) {
    console.error(`[restore] cannot load saved state — ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** `body` is BYTES for any format with its own encoding — a `.wdr`/`.wpr` newline sentinel is
 *  one byte that UTF-8 cannot express, so those callers encode first and hand the bytes over. */
export function download(name: string, body: string | Uint8Array<ArrayBuffer>, mime?: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: mime || 'text/plain' }));
  a.download = name; a.click();
}
