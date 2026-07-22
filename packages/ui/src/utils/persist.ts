import type { AppState, Design, DriverJSON, SerializedState, UiState } from '../types.js';

const b64enc = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64dec = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/'))));

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

export function stateToUrl(serialized: SerializedState): string {
  // A share link reproduces the sender's whole VIEW — same SKIN and same active tab/chart
  // (both kept) — so the recipient lands on the identical page, not a generic default. It
  // still drops personal WORKING state that only makes sense mid-edit for the sender: an
  // open editor/what-if overlay + its uncommitted buffer (share the committed design, not
  // someone's half-finished edit), and per-field unit-display prefs (a recipient's own
  // display choice, not part of the design).
  const { ui, ...rest } = serialized;
  const shareable: Omit<SerializedState, 'ui'> & { ui?: Partial<UiState> } = rest;
  if (ui) {
    const { originalTuneOpen: _t, originalWhatIf: _w, originalEditorOpen: _e, unitTokens: _u, ...shareableUi } = ui;
    shareable.ui = shareableUi;   // Partial<UiState> — skin + tab/chart KEPT; open-editor state/buffer + unit prefs dropped
  }
  return location.origin + location.pathname + '#s=' + b64enc(JSON.stringify(shareable));
}

export function loadFromHash(): SerializedState | null {
  const m = (location.hash || '').match(/[#&]s=([^&]+)/);
  if (!m) return null;
  try { return JSON.parse(b64dec(m[1])); } catch { return null; }
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
