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
    // Local-only UI preference (e.g. skin). Kept for saveLocal; stripped by stateToUrl.
    ui: state.ui,
    project: state.project,
  };
}

export function stateToUrl(serialized: SerializedState): string {
  // A share link carries the shareable VIEW context (active tab, selected chart) so the
  // recipient lands on the same page — but NOT device-local prefs (skin, which adapts to the
  // recipient's own device) nor personal working state (an open editor + its uncommitted
  // what-if buffer). Strip those from ui; keep the rest.
  const { ui, ...rest } = serialized;
  const shareable: Omit<SerializedState, 'ui'> & { ui?: Partial<UiState> } = rest;
  if (ui) {
    const { skin: _skin, originalTuneOpen: _t, originalWhatIf: _w, originalEditorOpen: _e, ...shareableUi } = ui;
    shareable.ui = shareableUi;   // Partial<UiState> — skin + open-editor state/buffer dropped
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
