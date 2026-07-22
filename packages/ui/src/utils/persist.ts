import type { AppState, Design, DriverJSON, SerializedState, UiState } from '../types.js';

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

export function serialize(state: AppState, driver: DriverJSON, compare: Design[]): SerializedState {
  return {
    v: 2,
    driver,
    box: state.box,
    P: state.P,
    graphs: state.graphs,
    compare: compare.map(d => ({ driver: d.driver, box: d.box, P: d.P, name: d.name, color: d.color })),
    ui: state.ui,
    project: state.project,
  };
}

export async function stateToUrl(serialized: SerializedState): Promise<string> {
  // A share link reproduces the sender's whole VIEW — same SKIN and same active tab/chart
  // (both kept) — so the recipient lands on the identical page, not a generic default. It
  // still drops personal WORKING state that only makes sense mid-edit for the sender: an
  // open editor/what-if overlay + its uncommitted buffer (share the committed design, not
  // someone's half-finished edit), and per-field unit-display prefs (a recipient's own
  // display choice, not part of the design).
  const { ui, ...rest } = serialized;
  const shareable: Omit<SerializedState, 'ui'> & { ui?: Partial<UiState> } = rest;
  if (ui) {
    const { originalTuneOpen: _t, originalWhatIf: _w, originalEditorOpen: _e, unitTokens: _u,
            originalNavW: _nw, originalBottomH: _bh, originalNavCollapsed: _nc,
            originalBottomCollapsed: _bc, originalChartMax: _cm, ...shareableUi } = ui;
    shareable.ui = shareableUi;   // Partial<UiState> — skin + tab/chart KEPT; open-editor state/buffer + unit prefs + device-local layout (panel sizes/collapse/maximise) dropped
  }
  const encoded = await gzipEncodeBase64Url(JSON.stringify(shareable));
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

export function loadLocal(): SerializedState | null {
  try { const s = localStorage.getItem('openisd.state'); return s ? JSON.parse(s) : null; } catch { return null; }
}

export function download(name: string, text: string, mime?: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' }));
  a.download = name; a.click();
}
