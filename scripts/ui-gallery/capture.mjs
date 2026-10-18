#!/usr/bin/env node
// UI gallery: deterministic screenshots + overflow/clip numbers, desktop and phone, before vs after.
// Starts nothing. See README.md.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SCREENS, reset } from './screens.mjs';
import { measure } from './measure.mjs';

const DEFAULT_BEFORE = 'https://openisd.app/v/20261015T1542Z/';
const DEFAULT_AFTER = 'http://localhost:4000';
const DEFAULT_ROOT = '/home/john/work/winisd/ui-gallery';

const VIEWPORTS = {
  d: { name: 'desktop', label: 'Desktop 1440x900', displayWidth: 560, ctx: { viewport: { width: 1440, height: 900 } } },
  p: { name: 'phone', label: 'Pixel 9 374x705', displayWidth: 230, ctx: { viewport: { width: 374, height: 705 }, deviceScaleFactor: 2.566, isMobile: true, hasTouch: true } },
};

function parseArgs(argv) {
  const o = { before: DEFAULT_BEFORE, after: DEFAULT_AFTER, root: DEFAULT_ROOT };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!['--before', '--after', '--root', '--rebuild'].includes(k) || argv[i + 1] === undefined) {
      console.error('usage: capture.mjs [--rebuild <run dir>] [--before <url|dir of an earlier run after/|none>] [--after <url>] [--root <dir>]');
      process.exit(2);
    }
    o[k.slice(2)] = argv[i + 1];
  }
  return o;
}

const isUrl = (s) => /^https?:\/\//.test(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const log = (m) => console.log(`${new Date().toISOString()} ${m}`);

async function captureSide(browser, side, dir, flush) {
  fs.mkdirSync(dir, { recursive: true });
  const url = side.url;
  for (const [vk, vp] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext(vp.ctx);
    const page = await ctx.newPage();
    page.setDefaultTimeout(4000);
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    for (const s of SCREENS.filter((x) => x.vp.includes(vk))) {
      const id = `${vp.name}-${s.key}`;
      try {
        await s.act(page);
        await page.waitForTimeout(500);
        const file = `${id}.png`;
        await page.screenshot({ path: path.join(dir, file), fullPage: true });
        const m = await page.evaluate(measure);
        side.screens[id] = { vp: vk, key: s.key, label: s.label, file, ...m };
        flush();
        log(`${url} ${id} ok clipped=${m.clipped} sw=${m.scrollWidth}/${m.clientWidth} sh=${m.scrollHeight}/${m.clientHeight}`);
      } catch (e) {
        side.screens[id] = { vp: vk, key: s.key, label: s.label, missing: true };
        flush();
        log(`${url} ${id} MISSING ${String(e.message).split('\n')[0]}`);
      }
      if (!s.keep) await reset(page);
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(dir, 'measures.json'), JSON.stringify(side, null, 2));
}

function loadStoredSide(dir) {
  const side = JSON.parse(fs.readFileSync(path.join(dir, 'measures.json'), 'utf8'));
  return side;
}

function cell(sc, other, side, isAfter) {
  if (!sc) return '<div class="pend">pending</div>';
  // A screen the before build lacks but the after build has is new, not a fault.
  if (sc.missing && !isAfter && other && !other.missing) return '<div class="new">New in this build</div>';
  if (sc.missing) return `<div class="miss">${isAfter ? 'not in after' : 'not in before'}</div>${isAfter ? verdictBlock(sc, other) : ''}`;
  const hov = sc.scrollWidth > sc.clientWidth;
  const worse = isAfter && other && !other.missing && (sc.clipped > other.clipped || (hov && !(other.scrollWidth > other.clientWidth)) || (sc.scrollHeight - sc.clientHeight) > (other.scrollHeight - other.clientHeight));
  const num = (txt, bad) => `<span class="${bad ? 'bad' : ''}">${txt}</span>`;
  const clipTitle = sc.clippedList.length ? ` title="${esc(sc.clippedList.join('\n'))}"` : '';
  return `<a href="${esc(side.dirName)}/${esc(sc.file)}"><img loading="lazy" src="${esc(side.dirName)}/${esc(sc.file)}"></a>
  <div class="nums${worse ? ' worse' : ''}">${num(`W ${sc.scrollWidth}/${sc.clientWidth}`, hov)} ${num(`H ${sc.scrollHeight}/${sc.clientHeight}`, false)} <span${clipTitle}>${num(`clipped ${sc.clipped}`, sc.clipped > 0)}</span>${worse ? ' <b class="bad">worse</b>' : ''}</div>${isAfter ? verdictBlock(sc, other) : ''}`;
}

function verdictBlock(sc, other) {
  const probs = problems(sc, other) ?? [];
  const ok = probs.length === 0;
  return `<div class="verdict ${ok ? 'good' : 'notgood'}" data-id="${esc(sc.vp === 'd' ? 'desktop' : 'phone')}-${esc(sc.key)}"><b>${ok ? 'GOOD' : 'NOT GOOD'}</b><ul>${probs.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
}

// Plain-sentence problems for one after-screen, from measurements only.
function problems(sc, other) {
  if (!sc) return null;
  if (sc.missing) return ['This screen could not be reached in this build.'];
  const out = [];
  const names = sc.clippedList.map((n) => n.replace(/ \[.*\]$/, '')).join(', ');
  if (sc.clipped > 0) out.push(`${sc.clipped} button${sc.clipped > 1 ? 's are' : ' is'} cut off by the screen edge or a clipping parent: ${names}.`);
  if (sc.scrollWidth > sc.clientWidth) out.push(`The page scrolls sideways: content is ${sc.scrollWidth} px wide in a ${sc.clientWidth} px window.`);
  if (other && !other.missing) {
    if (sc.clipped > other.clipped) out.push(`Worse than before: ${sc.clipped} cut-off buttons against ${other.clipped}.`);
    if ((sc.scrollHeight - sc.clientHeight) > (other.scrollHeight - other.clientHeight)) out.push('Worse than before: the page scrolls further down than it did.');
  }
  return out;
}

function totals(side) {
  let clipped = 0, hover = 0, missing = 0, notGood = 0;
  for (const sc of Object.values(side.screens)) {
    if (sc.missing) { missing++; notGood++; continue; }
    if (problems(sc, null).length) notGood++;
    clipped += sc.clipped;
    if (sc.scrollWidth > sc.clientWidth) hover++;
  }
  return { clipped, hover, missing, notGood };
}

function runIndex(run, before, after) {
  const ids = [];
  for (const s of SCREENS) { const k = s.key; if (!ids.includes(k)) ids.push(k); }
  const blocks = [];
  for (const key of ids) {
    const label = SCREENS.find((s) => s.key === key).label;
    const rows = Object.entries(VIEWPORTS).filter(([vk]) => SCREENS.some((s) => s.key === key && s.vp.includes(vk))).map(([, vp]) => {
      const id = `${vp.name}-${key}`;
      const b = before ? before.screens[id] : undefined;
      const a = after.screens[id];
      return `<tr class="shot" data-vp="${esc(vp.name)}" data-id="${esc(id)}"><th>${vp.label}</th><td class="bcol" style="width:${vp.displayWidth}px">${before ? cell(b, a, before, false) : '<div class="miss">no before</div>'}</td><td style="width:${vp.displayWidth}px">${cell(a, b, after, true)}</td></tr>`;
    });
    blocks.push(`<section class="screen" data-key="${esc(key)}" data-label="${esc(label)}"><h2>${esc(label)} <small>${esc(key)}</small></h2><table>${rows.join('')}</table></section>`);
  }
  const tb = before ? totals(before) : null, ta = totals(after);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI gallery ${esc(run.stamp)}</title>
<style>body{font:14px system-ui,sans-serif;margin:16px;background:#fff;color:#111}h2{margin:24px 0 4px}small{color:#777;font-weight:400}table{border-collapse:collapse;table-layout:fixed}th{text-align:left;vertical-align:top;padding:4px 12px 4px 0;font-weight:600;width:130px}td{vertical-align:top;padding:4px 8px}img{width:100%;border:1px solid #bbb;display:block}.nums{font:12px monospace;margin-top:2px}.bad{color:#c00;font-weight:700}.worse{background:#fdd}.miss{color:#c00;font-style:italic;padding:20px 0}.pend{color:#888;font-style:italic;padding:20px 0}.new{color:#555;font-style:italic;padding:20px 0}.hd td{font-weight:600}.verdict{margin-top:4px;padding:4px 6px;border-radius:3px;font:12px system-ui}.verdict ul{margin:2px 0 0 16px;padding:0}.verdict.good{background:#dff3df;color:#145214}.verdict.notgood{background:#fbdcdc;color:#8a0f0f}.verdict li.rev::marker{content:'R '}.tot{font-weight:700}.tot.bad{color:#c00}.tot.ok{color:#145214}.filters{position:sticky;top:0;background:#f4f4f4;border-bottom:1px solid #ccc;padding:6px 8px;margin:0 -16px 8px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font:13px system-ui;z-index:2}.filters label{display:flex;gap:4px;align-items:center}.filters input[type=search]{width:220px}.filters .cnt{margin-left:auto;font-weight:600}.hidebefore .bcol{display:none}.shot.hide,.screen.hide{display:none}</style></head><body>
<h1>UI gallery ${esc(run.stamp)}</h1>
<div class="filters" id="filters">
 <label>Show <select id="f-verdict"><option value="all">all</option><option value="notgood">NOT GOOD</option><option value="good">GOOD</option><option value="worse">worse than before</option><option value="missing">missing</option><option value="reviewed">has reviewer notes</option></select></label>
 <label>Viewport <select id="f-vp"><option value="all">both</option><option value="desktop">desktop</option><option value="phone">phone</option></select></label>
 <label><input type="search" id="f-text" placeholder="screen or problem text"></label>
 <label><input type="checkbox" id="f-nobefore"> hide before</label>
 <span class="cnt" id="f-cnt"></span>
</div>
<table class="hd"><tr><th></th><td>Before: ${esc(run.before.url)}<br>build ${esc(run.before.build)}<br>${tb ? `clipped ${tb.clipped}, h-overflow screens ${tb.hover}, missing ${tb.missing}` : ''}</td><td>After: ${esc(run.after.url)}<br>build ${esc(run.after.build)}<br>clipped ${ta.clipped}, h-overflow screens ${ta.hover}, missing ${ta.missing}<br><span class="tot" id="tot"></span></td></tr></table>
<p>W = scrollWidth/clientWidth, H = scrollHeight/clientHeight, clipped = buttons partly outside the viewport or an overflow-hidden parent (hover for names). Red = non-zero clipped or horizontal overflow; pink = after worse than before.</p>
${blocks.join('\n')}
<script>
// Merge review.json (written by a reviewer) on load: { "<viewport>-<screen>": ["sentence", ...] }.
(async () => {
  let review = {};
  try { const r = await fetch('review.json', { cache: 'no-store' }); if (r.ok) review = await r.json(); } catch (e) {}
  for (const [id, sentences] of Object.entries(review)) {
    const el = document.querySelector('.verdict[data-id="' + id + '"]');
    if (!el || !Array.isArray(sentences) || !sentences.length) continue;
    el.className = 'verdict notgood';
    el.querySelector('b').textContent = 'NOT GOOD';
    const ul = el.querySelector('ul');
    for (const t of sentences) { const li = document.createElement('li'); li.className = 'rev'; li.textContent = t; ul.appendChild(li); }
  }
  const all = document.querySelectorAll('.verdict');
  const bad = document.querySelectorAll('.verdict.notgood');
  const t = document.getElementById('tot');
  t.textContent = bad.length ? bad.length + ' of ' + all.length + ' screens NOT GOOD' : 'All ' + all.length + ' screens GOOD';
  t.className = 'tot ' + (bad.length ? 'bad' : 'ok');
  // Filters: verdict, viewport, free text over screen name + problem sentences; state kept in the URL hash.
  const q = (id) => document.getElementById(id);
  const fv = q('f-verdict'), fvp = q('f-vp'), ft = q('f-text'), fnb = q('f-nobefore'), cnt = q('f-cnt');
  const rowMatches = (tr) => {
    const vd = tr.querySelector('.verdict');
    const notgood = !!(vd && vd.classList.contains('notgood'));
    const worse = !!tr.querySelector('.worse');
    const missing = !!tr.querySelector('.miss');
    const reviewed = !!tr.querySelector('li.rev');
    const want = fv.value;
    if (want === 'notgood' && !notgood) return false;
    if (want === 'good' && (notgood || missing)) return false;
    if (want === 'worse' && !worse) return false;
    if (want === 'missing' && !missing) return false;
    if (want === 'reviewed' && !reviewed) return false;
    if (fvp.value !== 'all' && tr.dataset.vp !== fvp.value) return false;
    const needle = ft.value.trim().toLowerCase();
    if (needle) {
      const sec = tr.closest('.screen');
      const hay = (sec.dataset.key + ' ' + sec.dataset.label + ' ' + tr.dataset.id + ' ' + (vd ? vd.textContent : '')).toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  };
  const apply = () => {
    let shown = 0, total = 0;
    for (const sec of document.querySelectorAll('.screen')) {
      let any = false;
      for (const tr of sec.querySelectorAll('tr.shot')) {
        total++;
        const ok = rowMatches(tr);
        tr.classList.toggle('hide', !ok);
        if (ok) { any = true; shown++; }
      }
      sec.classList.toggle('hide', !any);
    }
    document.body.classList.toggle('hidebefore', fnb.checked);
    cnt.textContent = shown + ' of ' + total + ' screenshots shown';
    const h = new URLSearchParams({ v: fv.value, vp: fvp.value, t: ft.value, nb: fnb.checked ? '1' : '' });
    history.replaceState(null, '', '#' + h.toString());
  };
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('v')) fv.value = h.get('v');
  if (h.get('vp')) fvp.value = h.get('vp');
  if (h.get('t')) ft.value = h.get('t');
  fnb.checked = h.get('nb') === '1';
  for (const el of [fv, fvp, ft, fnb]) el.addEventListener('input', apply);
  apply();
})();
</script></body></html>`;
}

function rootIndex(root) {
  const runs = [];
  for (const d of fs.readdirSync(root)) {
    const f = path.join(root, d, 'run.json');
    if (fs.existsSync(f)) runs.push({ dir: d, ...JSON.parse(fs.readFileSync(f, 'utf8')) });
  }
  runs.sort((a, b) => b.stamp.localeCompare(a.stamp));
  const rows = runs.map((r) => `<tr><td><a href="${esc(r.dir)}/index.html">${esc(r.stamp)}</a></td><td>${esc(r.before.build)}</td><td>${esc(r.after.build)}</td><td class="${r.totals.after.clipped ? 'bad' : ''}">${r.totals.after.clipped}</td><td class="${r.totals.after.hover ? 'bad' : ''}">${r.totals.after.hover}</td><td>${r.totals.before ? `${r.totals.before.clipped} / ${r.totals.before.hover}` : ''}</td><td>${r.totals.after.missing}</td><td>${r.totals.after.notGood ?? ''}</td><td class="${r.status === 'complete' ? '' : 'bad'}">${esc(r.status ?? 'complete')}</td></tr>`).join('\n');
  fs.writeFileSync(path.join(root, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI gallery runs</title><style>body{font:14px system-ui,sans-serif;margin:16px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 10px;text-align:left}.bad{color:#c00;font-weight:700}</style></head><body><h1>UI gallery runs</h1><table><tr><th>Run (UTC)</th><th>Before build</th><th>After build</th><th>After clipped</th><th>After h-overflow screens</th><th>Before clipped / h-overflow</th><th>After missing</th><th>Not good screens (auto)</th><th>Status</th></tr>${rows}</table></body></html>`);
}

async function probeBuild(browser, url) {
  const ctx = await browser.newContext(VIEWPORTS.p.ctx);
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Start designing', exact: true }).click({ timeout: 4000 }).catch(() => {});
    await page.getByRole('button', { name: 'Menu', exact: true }).click({ timeout: 4000 });
    return (await page.locator('[data-testid=app-version]').first().textContent({ timeout: 4000 })).trim();
  } catch { return url.match(/\/v\/([^/]+)\//)?.[1] ?? '(unknown)'; } finally { await ctx.close(); }
}

const opts = parseArgs(process.argv.slice(2));
if (opts.rebuild) {
  // Rewrites index.html of a finished run from its run.json (no capture). Picks up code changes to the page.
  const dir = path.resolve(opts.rebuild);
  const run = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8'));
  const side = (x, screens, name) => ({ url: x.url, build: x.build, screens: screens ?? {}, dirName: name });
  const before = run.screens.before ? side(run.before, run.screens.before, 'before') : null;
  const after = side(run.after, run.screens.after, 'after');
  run.totals = { before: before ? totals(before) : null, after: totals(after) };
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(run, null, 2));
  fs.writeFileSync(path.join(dir, 'index.html'), runIndex(run, before, after));
  rootIndex(path.dirname(dir));
  console.log(path.join(dir, 'index.html'));
  process.exit(0);
}
fs.mkdirSync(opts.root, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
let flushOnError;
const browser = await chromium.launch();
try {
  const after = { url: opts.after, build: await probeBuild(browser, opts.after), screens: {}, dirName: 'after' };
  let before = null;
  const stored = opts.before !== 'none' && !isUrl(opts.before);
  if (opts.before !== 'none') {
    before = stored ? loadStoredSide(path.resolve(opts.before)) : { url: opts.before, build: await probeBuild(browser, opts.before), screens: {} };
    before.dirName = 'before';
  }
  let hint = (after.build.match(/\b[0-9a-f]{7,40}\b/) ?? [''])[0];
  if (!hint) { try { hint = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { hint = 'nobuild'; } }
  const runDir = path.join(opts.root, `${stamp}_${hint}`);
  fs.mkdirSync(runDir, { recursive: true });
  if (stored) fs.cpSync(path.resolve(opts.before), path.join(runDir, 'before'), { recursive: true });
  let status = 'running';
  const flush = () => {
    const run = {
      stamp, status, viewports: Object.fromEntries(Object.values(VIEWPORTS).map((v) => [v.name, v.ctx])),
      before: before ? { url: before.url, build: before.build } : { url: 'none', build: '-' },
      after: { url: after.url, build: after.build },
      totals: { before: before ? totals(before) : null, after: totals(after) },
      screens: { before: before?.screens ?? null, after: after.screens },
    };
    fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(run, null, 2));
    fs.writeFileSync(path.join(runDir, 'index.html'), runIndex(run, before, after));
    rootIndex(opts.root);
  };
  const abort = () => { if (status === 'running') { status = 'aborted'; flush(); } process.exit(130); };
  process.on('SIGINT', abort); process.on('SIGTERM', abort); process.on('SIGHUP', abort);
  flushOnError = () => { if (status === 'running') { status = 'aborted'; flush(); } };
  flush();
  log(`index: ${path.join(runDir, 'index.html')}`);
  if (before && !stored) await captureSide(browser, before, path.join(runDir, 'before'), flush);
  await captureSide(browser, after, path.join(runDir, 'after'), flush);
  status = 'complete';
  flush();
  console.log(path.join(runDir, 'index.html'));
} catch (e) {
  if (typeof flushOnError === 'function') flushOnError();
  throw e;
} finally {
  await browser.close();
}
