import type { AppState, Design, DriverRaw, SerializedState } from '../types.js';

const b64enc = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64dec = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/'))));

export function serialize(state: AppState, driverRaw: DriverRaw, compare: Design[]): SerializedState {
  return {
    v: 1,
    driver: driverRaw,
    box: state.box,
    P: state.P,
    graphs: state.graphs,
    compare: compare.map(d => ({ driver: d.driver, box: d.box, P: d.P, name: d.name, color: d.color })),
  };
}

export function stateToUrl(serialized: SerializedState): string {
  return location.origin + location.pathname + '#s=' + b64enc(JSON.stringify(serialized));
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
