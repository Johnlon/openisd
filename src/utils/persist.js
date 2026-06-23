const b64enc = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64dec = s => decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/'))));

export function serialize(state, driver, compare) {
  return {
    v: 1,
    driver: state.driverRaw,
    box: state.box,
    P: state.P,
    graphs: state.graphs,
    compare: compare.map(d => ({ driver: d.driver, box: d.box, P: d.P, name: d.name, color: d.color })),
  };
}

export function stateToUrl(serialized) {
  return location.origin + location.pathname + '#s=' + b64enc(JSON.stringify(serialized));
}

export function loadFromHash() {
  const m = (location.hash || '').match(/[#&]s=([^&]+)/);
  if (!m) return null;
  try { return JSON.parse(b64dec(m[1])); } catch { return null; }
}

export function saveLocal(serialized) {
  try { localStorage.setItem('resonate.state', JSON.stringify(serialized)); } catch {}
}

export function loadLocal() {
  try { const s = localStorage.getItem('resonate.state'); return s ? JSON.parse(s) : null; } catch { return null; }
}

export function download(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' }));
  a.download = name; a.click();
}
