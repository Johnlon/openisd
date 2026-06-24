const KEY = 'resonate_pr_lib';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function listPRs() {
  return load();
}

export function savePR(name, P) {
  const list = load();
  list.push({
    id: Date.now(),
    name,
    prSd: P.prSd,
    prMmd: P.prMmd,
    prCms: P.prCms,
    prRms: P.prRms,
    prXmax: P.prXmax,
    savedAt: new Date().toISOString(),
  });
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function deletePR(id) {
  const list = load().filter(e => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}
