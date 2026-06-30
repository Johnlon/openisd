<script setup>
import { ref, computed, watch } from 'vue';
import { state } from '../store.js';
import { parseWdr } from '@resonate/engine';
import sourcesJson from '../../drivers/sources.json';
import bundleJson  from '../drivers-bundle.json';

const sources     = sourcesJson.sources || [];
const allFiles    = ref([]);   // unified pool across all sources
const filterQ     = ref('');
const statusMsg   = ref('');
const statusErr   = ref(false);
const customUrl   = ref('');
const initialized = ref(false);

// SpeakerBoxLite opt-in state
const sblLoaded   = ref(false);
const sblLoading  = ref(false);

// Source filter
const selectedSources = ref([]);   // empty = all
const sourcesOpen     = ref(false);

// Type + param filters
const typeHelpOpen  = ref(false);
const typeStates = ref({});   // id → 'include' | 'exclude'
const fsMin = ref('');
const fsMax = ref('');
const sdMin = ref('');   // cm²
const sdMax = ref('');   // cm²
const selZ  = ref([]);   // '4', '8', '16'

// Multi-label type chips — a driver can match several simultaneously.
// Selecting a chip shows all drivers that carry that label.
const DRIVER_TYPES = [
  { id: 'bass',      label: 'Bass',       title: 'Handles bass/low frequencies — sub, woofer, mid-bass, full-range' },
  { id: 'sub',       label: 'Sub',        title: 'Subwoofer — dedicated very-low-frequency driver' },
  { id: 'woofer',    label: 'Woofer',     title: 'Woofer — low to mid-bass cone driver' },
  { id: 'mid',       label: 'Mid',        title: 'Midrange / mid-bass — between woofer and tweeter' },
  { id: 'tweet',     label: 'Tweet',      title: 'Tweeter — high-frequency driver (dome, ribbon, planar, AMT)' },
  { id: 'fullrange', label: 'Full-range', title: 'Full-range — single driver covering bass through treble (not BMR)' },
  { id: 'pr',           label: 'PR',           title: 'Passive radiator — no voice coil, passive acoustic resonator' },
  { id: 'coax',         label: 'Coaxial',      title: 'Coaxial — woofer and tweeter sharing the same axis' },
  { id: 'unclassified', label: 'Unclassified', title: 'Drivers that did not match any type pattern' },
];

function quickParse(content) {
  const m = k => { const r = (content || '').match(new RegExp('^' + k + '=(.+)$', 'm')); return r ? parseFloat(r[1]) : null; };
  return { Fs: m('Fs'), Sd: m('Sd'), Re: m('Re'), Znom: m('Znom'), Pe: m('Pe') };
}

function fmtHz(hz) {
  if (hz == null) return null;
  const v = parseFloat(hz);
  if (!isFinite(v)) return null;
  return v >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'kHz' : Math.round(v) + 'Hz';
}

// Multi-label classification. Name-based matching takes priority over T/S params.
// Returns an array of type IDs — a driver can carry several labels.
//
// Relationships verified against PE/SI/Cambridge Audio/Tectonic sources (2026-06-25):
//   sub      ⊂ woofer ⊂ bass
//   mid-bass ⊂ woofer + mid, both ⊂ bass
//   full-range = woofer + mid + tweet + bass
//   BMR        = mid + tweet  (Tectonic sells separate woofers for bass; not a bass driver)
//   PR         = orthogonal  (no motor, no frequency range)

const TWEET_PAT    = /\btweet(er)?\b|dome.tweeter|ribbon.tweeter|\bplanar\b|\bAMT\b|air.motion/i;
const SUB_PAT      = /\bsub(woofer)?\b|sub[-_ ]/i;
const WOOFER_PAT   = /\bwoofer\b/i;
const MIDBASS_PAT  = /\bmid[-_ ]?(bass|woof(er)?)\b|\bmidbass\b/i;
const MIDRANGE_PAT = /\bmid[-_ ]?range\b|\bmidrange\b/i;
const FULLRANGE_PAT= /\bfull[-_ ]?range\b|\bfullrange\b/i;
const BMR_PAT      = /\bBMR\b|balanced.mode/i;
const PR_PAT       = /\bpassive.radiator\b|\bP\.?R\.?\b/i;
const COAX_PAT     = /\bcoax(ial)?\b|coaxial/i;

// Returns { types: string[], canonical: string }
// types  = functional chip IDs for filtering
// canonical = the normalised product-type name for display (e.g. "Subwoofer", "Midrange")
// driverType = scraper-derived type written to _meta.yml (e.g. 'coaxial', 'subwoofer')
function classifyTypes(Fs, Sd, nameStr, driverType) {
  const nm = nameStr || '';
  const dt = (driverType || '').toLowerCase();
  const types = new Set();
  const canonical = [];

  if (PR_PAT.test(nm) || dt === 'pr' || dt === 'passive radiator')
    return { types: ['pr'], canonical: 'Passive Radiator' };
  if (COAX_PAT.test(nm) || dt === 'coaxial' || dt === 'coax')
    return { types: ['coax', 'woofer', 'bass', 'mid', 'tweet'], canonical: 'Coaxial' };

  if (TWEET_PAT.test(nm) || dt === 'tweeter') {
    types.add('tweet');
    if (/\bAMT\b|air.motion/i.test(nm))          canonical.push('AMT');
    else if (/\bribbon\b/i.test(nm))              canonical.push('Ribbon Tweeter');
    else if (/\bplanar\b/i.test(nm))              canonical.push('Planar Tweeter');
    else                                          canonical.push('Tweeter');
  }
  if (SUB_PAT.test(nm) || dt === 'subwoofer' || dt === 'sub')
    { types.add('sub'); types.add('woofer'); types.add('bass'); canonical.push('Subwoofer'); }
  if (MIDBASS_PAT.test(nm) || dt === 'mid-bass' || dt === 'midbass')
    { types.add('woofer'); types.add('mid'); types.add('bass'); canonical.push('Mid-bass'); }
  if ((WOOFER_PAT.test(nm) || dt === 'woofer') && !MIDBASS_PAT.test(nm))
    { types.add('woofer'); types.add('bass'); canonical.push('Woofer'); }
  if (MIDRANGE_PAT.test(nm) || dt === 'midrange')
    { types.add('mid'); types.add('woofer'); canonical.push('Midrange'); }
  if (FULLRANGE_PAT.test(nm) || dt === 'fullrange' || dt === 'full-range')
    { types.add('woofer'); types.add('mid'); types.add('tweet'); types.add('bass'); types.add('fullrange'); canonical.push('Full-range'); }
  if (BMR_PAT.test(nm) || dt === 'bmr')
    { types.add('mid'); types.add('tweet'); canonical.push('BMR'); }

  if (types.size > 0) return { types: [...types], canonical: canonical.join(' / ') };

  const SdCm2 = Sd != null ? Sd * 1e4 : null;
  if (SdCm2 != null && SdCm2 < 12) return { types: ['tweet'],               canonical: 'Tweeter' };
  if (Fs != null && Fs < 40)        return { types: ['sub','woofer','bass'], canonical: 'Subwoofer' };
  return                                   { types: [],                      canonical: 'Unclassified' };
}

function toggleType(id) {
  const cur = typeStates.value[id];
  if (!cur)            typeStates.value = { ...typeStates.value, [id]: 'include' };
  else if (cur === 'include') typeStates.value = { ...typeStates.value, [id]: 'exclude' };
  else                 { const s = { ...typeStates.value }; delete s[id]; typeStates.value = s; }
}
function toggleZ(z) {
  const idx = selZ.value.indexOf(z);
  if (idx >= 0) selZ.value.splice(idx, 1); else selZ.value.push(z);
}
function clearParamFilters() {
  typeStates.value = {}; fsMin.value = ''; fsMax.value = '';
  sdMin.value = ''; sdMax.value = ''; selZ.value = [];
}

const availableSources = computed(() => {
  const counts = {};
  for (const f of allFiles.value) {
    if (f.sourceName) counts[f.sourceName] = (counts[f.sourceName] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
});

function toggleSource(name) {
  const idx = selectedSources.value.indexOf(name);
  if (idx >= 0) selectedSources.value.splice(idx, 1);
  else selectedSources.value.push(name);
}

function clearSources() { selectedSources.value = []; }

// Normalise any date string to YYYY-MM-DD for comparison and display.
// Handles ISO (2026-06-24), DD/MM/YYYY, DD-MM-YYYY, "Jun 24 2026", etc.
function normaliseDate(raw) {
  if (!raw) return '';
  const s = raw.trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  // Try native parse as last resort
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return s;
}

const filteredFiles = computed(() => {
  const tokens = filterQ.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const srcFilter = selectedSources.value;
  let filtered = allFiles.value;
  if (tokens.length)
    filtered = filtered.filter(f => tokens.every(t => f.name.toLowerCase().includes(t)));
  if (srcFilter.length)
    filtered = filtered.filter(f => srcFilter.includes(f.sourceName));
  const included = Object.keys(typeStates.value).filter(k => typeStates.value[k] === 'include');
  const excluded = Object.keys(typeStates.value).filter(k => typeStates.value[k] === 'exclude');
  const isUnclassified = f => !f._types?.length;
  if (included.length)
    filtered = filtered.filter(f => (included.includes('unclassified') && isUnclassified(f)) || included.filter(t => t !== 'unclassified').some(t => f._types?.includes(t)));
  if (excluded.length) {
    if (excluded.includes('unclassified')) filtered = filtered.filter(f => !isUnclassified(f));
    const excTypes = excluded.filter(t => t !== 'unclassified');
    if (excTypes.length) filtered = filtered.filter(f => !excTypes.some(t => f._types?.includes(t)));
  }
  const fsMinV = parseFloat(fsMin.value), fsMaxV = parseFloat(fsMax.value);
  const sdMinV = parseFloat(sdMin.value), sdMaxV = parseFloat(sdMax.value);
  if (isFinite(fsMinV)) filtered = filtered.filter(f => f._Fs != null && f._Fs >= fsMinV);
  if (isFinite(fsMaxV)) filtered = filtered.filter(f => f._Fs != null && f._Fs <= fsMaxV);
  if (isFinite(sdMinV)) filtered = filtered.filter(f => f._Sd != null && f._Sd * 1e4 >= sdMinV);
  if (isFinite(sdMaxV)) filtered = filtered.filter(f => f._Sd != null && f._Sd * 1e4 <= sdMaxV);
  if (selZ.value.length)
    filtered = filtered.filter(f => selZ.value.some(oz => f._Znom != null && Math.abs(f._Znom - parseFloat(oz)) < 1.5));

  // Pure alphabetical sort
  const sorted = [...filtered].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  // Find the latest normalised date for each name (to flag newer/older versions)
  const latestDate = {};
  const nameCount = {};
  for (const f of sorted) {
    nameCount[f.name] = (nameCount[f.name] || 0) + 1;
    const nd = normaliseDate(f.date);
    if (nd > (latestDate[f.name] || '')) latestDate[f.name] = nd;
  }

  return sorted.map(f => {
    const nd = normaliseDate(f.date);
    const hasDups = nameCount[f.name] > 1;
    const isLatest = hasDups && nd !== '' && nd === latestDate[f.name];
    return { ...f, _nd: nd, _isLatest: isLatest, _isOlder: hasDups && !isLatest };
  });
});

// ── GitHub source helpers ────────────────────────────────────────────────────

async function ghDefaultBranch(repo) {
  const r = await fetch(`https://api.github.com/repos/${repo}`);
  if (!r.ok) throw new Error('repo not found (' + r.status + ')');
  return (await r.json()).default_branch || 'main';
}

async function fetchSource(src) {
  try {
    const branch = src.branch || await ghDefaultBranch(src.repo);
    const r = await fetch(`https://api.github.com/repos/${src.repo}/git/trees/${branch}?recursive=1`);
    if (!r.ok) return;
    const tree = (await r.json()).tree || [];
    const base = (src.path || '').replace(/^\/|\/$/g, '');
    const found = tree
      .filter(t => t.type === 'blob' && t.path.toLowerCase().endsWith('.wdr')
                && (!base || t.path.toLowerCase().startsWith(base.toLowerCase() + '/')))
      .map(t => {
        const nm = t.path.split('/').pop().replace(/\.wdr$/i, '');
        return {
          path: t.path, branch, repo: src.repo,
          name: nm,
          sourceName: src.name,
          sourceUrl:  src.url || '',
          sourceDesc: src.description || '',
          _Fs: null, _Sd: null, _Re: null, _Znom: null, _Pe: null,
          ...(({ types, canonical }) => ({ _types: types, _canonical: canonical }))(classifyTypes(null, null, nm)),
        };
      });
    allFiles.value = [
      ...allFiles.value.filter(f => f.sourceName !== src.name),
      ...found,
    ];
    statusMsg.value = `${allFiles.value.length} drivers`;
  } catch {}
}

function parseRepoInput(s) {
  s = s.trim(); if (!s) return null;
  let m = s.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*))?)?$/i);
  if (m) return { name: m[1]+'/'+m[2], type:'github', repo: m[1]+'/'+m[2], branch: m[3]||'', path: m[4]||'' };
  m = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m) return { name: s, type:'github', repo: s, branch: '', path: '' };
  return null;
}

// ── Initialise ───────────────────────────────────────────────────────────────

// Index bundled sources by name for O(1) lookup
const bundledByName = Object.fromEntries(
  (bundleJson.sources || []).map(s => [s.name, s.files])
);

async function init() {
  if (initialized.value) return;
  initialized.value = true;
  statusErr.value = false;

  // 1. Load bundled sources instantly from the pre-built JSON (no network)
  for (const src of sources) {
    const files = bundledByName[src.name];
    if (!files) continue;
    const entries = files.map(f => {
      const qp = quickParse(f.content);
      const nameStr = f.name + ' ' +
        ((f.content || '').match(/^Brand=(.+)$/m)?.[1] || '') + ' ' +
        ((f.content || '').match(/^Model=(.+)$/m)?.[1] || '');
      return {
        name: f.name,
        content: f.content,
        date: f.date || '',
        datasheet:   f.datasheet   || '',
        manupage:    f.manupage    || '',
        vendorpage:  f.vendorpage  || '',
        frd:         f.frd         || '',
        impedance:   f.impedance   || '',
        path: null, repo: null, branch: null,
        sourceName: src.name,
        sourceUrl:  src.url || '',
        sourceDesc: src.description || '',
        _Fs: qp.Fs, _Sd: qp.Sd, _Re: qp.Re, _Znom: qp.Znom, _Pe: qp.Pe,
        _freqRange: (() => { const lo = parseFloat(f.freq_low_hz), hi = parseFloat(f.freq_high_hz); return (isFinite(lo) && isFinite(hi)) ? { lo, hi } : null; })(),
        ...(({ types, canonical }) => ({ _types: types, _canonical: canonical }))(classifyTypes(qp.Fs, qp.Sd, nameStr, f.driver_type)),
      };
    });
    allFiles.value = [...allFiles.value, ...entries];
  }

  statusMsg.value = `${allFiles.value.length} drivers`;

  // 2. Fetch any non-bundled sources from GitHub in the background
  const liveSources = sources
    .filter(src => !bundledByName[src.name])
    .map(src => {
      const m = src.url?.match(/github\.com\/([^/]+\/[^/]+?)(?:\/tree\/([^/]+)(?:\/(.*?))?)?(?:\.git)?$/i);
      return m ? { ...src, repo: m[1], branch: m[2] || '', path: m[3] || '' } : src;
    })
    .filter(s => s.repo);

  if (liveSources.length) {
    await Promise.all(liveSources.map(fetchSource));
  }

  statusMsg.value = allFiles.value.length
    ? `${allFiles.value.length} drivers`
    : 'No drivers loaded — check network';
}

// ── SpeakerBoxLite opt-in load ───────────────────────────────────────────────

async function loadSpeakerBoxLite() {
  if (sblLoaded.value || sblLoading.value) return;
  sblLoading.value = true; statusErr.value = false;
  const PAGE = 500, base = 'https://speakerboxlite.com/api/v1/speakers';

  // Probe first so we can tell network-block from CORS from real errors.
  // NOTE: speakerboxlite.com returns Access-Control-Allow-Origin: * on HEAD but NOT on GET.
  // This is a server-side CORS misconfiguration — the browser blocks the GET response.
  let countResp;
  try { countResp = await fetch(base + '/count'); }
  catch {
    statusErr.value = true;
    statusMsg.value = 'speakerboxlite.com CORS error — their API returns Access-Control-Allow-Origin '
      + 'on HEAD requests but not GET requests, so browsers block it. '
      + 'This is a bug on their server; nothing can be done client-side.';
    sblLoading.value = false; return;
  }
  if (!countResp.ok) {
    statusErr.value = true;
    statusMsg.value = `SpeakerBoxLite: server returned ${countResp.status}`;
    sblLoading.value = false; return;
  }

  try {
    const { count } = await countResp.json();
    const batches = Math.ceil(count / PAGE);
    const sblFiles = [];
    for (let i = 0; i < batches; i++) {
      statusMsg.value = `SpeakerBoxLite: loading ${Math.min((i+1)*PAGE, count)} / ${count}…`;
      const rows = await (await fetch(`${base}?offset=${i*PAGE}&limit=${PAGE}`)).json();
      for (const d of rows) {
        const SblSd = d.sd_cm2 != null ? d.sd_cm2 / 1e4 : null;
        const sblName = [d.brand, d.model, d.name].filter(Boolean).join(' ') || 'Unknown';
        sblFiles.push({
          path: null, branch: null, repo: null,
          name: sblName,
          sourceName: 'SpeakerBoxLite',
          sourceUrl:  'https://www.speakerboxlite.com/',
          sourceDesc: 'speakerboxlite.com community database',
          sblData: d,
          _Fs: d.fs || null, _Sd: SblSd, _Re: d.re || null, _Znom: null, _Pe: d.pe || null,
          ...(({ types, canonical }) => ({ _types: types, _canonical: canonical }))(classifyTypes(d.fs, SblSd, sblName, d.driver_type)),
        });
      }
    }
    allFiles.value = [...allFiles.value.filter(f => f.sourceName !== 'SpeakerBoxLite'), ...sblFiles];
    sblLoaded.value = true;
    statusMsg.value = `${allFiles.value.length} drivers total`;
  } catch (err) {
    statusErr.value = true;
    statusMsg.value = 'SpeakerBoxLite load failed mid-stream: ' + err.message;
  }
  sblLoading.value = false;
}

// ── Add custom source ────────────────────────────────────────────────────────

async function loadCustom() {
  const src = parseRepoInput(customUrl.value);
  if (!src) { statusErr.value = true; statusMsg.value = 'Enter owner/repo or a github.com URL'; return; }
  statusErr.value = false; statusMsg.value = `Loading ${src.name}…`;
  await fetchSource(src);
  customUrl.value = '';
}

// ── Pick / preview a driver ──────────────────────────────────────────────────

const previewFile = ref(null);

// Lightweight WDR parser — returns whatever it finds, never throws
function parseWdrLoose(content) {
  const raw = {};
  for (const line of (content || '').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 0 || line.startsWith('[')) continue;
    raw[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return raw;
}

const previewData = computed(() => {
  const f = previewFile.value;
  if (!f) return null;

  const links = [];
  if (f.datasheet) links.push({ href: f.datasheet, label: 'Datasheet (PDF)' });
  if (f.manupage)  links.push({ href: f.manupage,  label: 'Manufacturer page' });
  if (f.vendorpage && f.vendorpage !== f.manupage) links.push({ href: f.vendorpage, label: 'Vendor page' });
  if (f.frd)       links.push({ href: f.frd,        label: 'FRD / ZMA data' });

  if (f.sblData) {
    const d = f.sblData;
    const n = v => (v != null && isFinite(v) && v !== 0) ? v : null;
    const Fs = n(d.fs), Qes = n(d.qes);
    return {
      name: f.name, source: f.sourceName, providedBy: '', links,
      specs: [
        { label: 'Fs',   value: Fs?.toFixed(1),                    unit: 'Hz'   },
        { label: 'Qts',  value: n(d.qts)?.toFixed(3) },
        { label: 'Qes',  value: Qes?.toFixed(3) },
        { label: 'Qms',  value: n(d.qms)?.toFixed(3) },
        { label: 'Re',   value: n(d.re)?.toFixed(2),               unit: 'Ω'    },
        { label: 'BL',   value: n(d.bl)?.toFixed(2),               unit: 'T·m'  },
        { label: 'Vas',  value: n(d.vas_l)?.toFixed(2),            unit: 'L'    },
        { label: 'Sd',   value: n(d.sd_cm2)?.toFixed(1),           unit: 'cm²'  },
        { label: 'Xmax', value: n(d.xmax_mm)?.toFixed(1),          unit: 'mm'   },
        { label: 'Pe',   value: n(d.pe)?.toFixed(0),               unit: 'W'    },
        { label: 'EBP',  value: (Fs && Qes) ? (Fs/Qes).toFixed(0) : null       },
        { label: 'Freq', value: f._freqRange ? fmtHz(f._freqRange.lo) + '–' + fmtHz(f._freqRange.hi) : null },
      ].filter(s => s.value != null),
    };
  }

  const raw = parseWdrLoose(f.content);
  const n = k => { const v = parseFloat(raw[k]); return isFinite(v) && v !== 0 ? v : null; };
  const Fs = n('Fs'), Qes = n('Qes'), Le = n('Le'), Vas = n('Vas'), Sd = n('Sd'), Xmax = n('Xmax');
  return {
    name: f.name,
    source: f.sourceName,
    providedBy: raw.ProvidedBy || '',
    links,
    specs: [
      { label: 'Fs',   value: Fs?.toFixed(1),                     unit: 'Hz'   },
      { label: 'Qts',  value: n('Qts')?.toFixed(3) },
      { label: 'Qes',  value: Qes?.toFixed(3) },
      { label: 'Qms',  value: n('Qms')?.toFixed(3) },
      { label: 'Re',   value: n('Re')?.toFixed(2),                unit: 'Ω'    },
      { label: 'Znom', value: n('Znom')?.toFixed(0),              unit: 'Ω'    },
      { label: 'Le',   value: Le ? (Le*1000).toFixed(3) : null,   unit: 'mH'   },
      { label: 'BL',   value: n('BL')?.toFixed(2),                unit: 'T·m'  },
      { label: 'Vas',  value: Vas ? (Vas*1000).toFixed(2) : null, unit: 'L'    },
      { label: 'Sd',   value: Sd ? (Sd*1e4).toFixed(1) : null,   unit: 'cm²'  },
      { label: 'Xmax', value: Xmax ? (Xmax*1000).toFixed(1):null, unit: 'mm'   },
      { label: 'Pe',   value: n('Pe')?.toFixed(0),                unit: 'W'    },
      { label: 'SPL',  value: n('SPL')?.toFixed(1),               unit: 'dB'   },
      { label: 'Freq', value: f._freqRange ? fmtHz(f._freqRange.lo) + '–' + fmtHz(f._freqRange.hi) : null },
      { label: 'EBP',  value: (Fs && Qes) ? (Fs/Qes).toFixed(0) : null        },
    ].filter(s => s.value != null),
  };
});

async function loadDriver(f) {
  if (f.sblData) {
    const d = f.sblData;
    const raw = {
      name:  f.name, brand: d.brand || '', model: d.model || '',
      Fs: d.fs, Qts: d.qts, Qes: d.qes, Qms: d.qms,
      Vas:  d.vas_l   != null ? d.vas_l   / 1000   : undefined,
      Sd:   d.sd_cm2  != null ? d.sd_cm2  / 1e4    : undefined,
      Re:   d.re,
      Le:   d.le_mh   != null ? d.le_mh   / 1000   : undefined,
      Bl:   d.bl,
      Xmax: d.xmax_mm != null ? d.xmax_mm / 1000   : undefined,
      Mms:  d.mms_g   != null ? d.mms_g   / 1000   : undefined,
      Cms:  d.cms_mm_n!= null ? 1 / (d.cms_mm_n * 1000) : undefined,
      Rms:  d.rms, Pe: d.pe,
    };
    Object.keys(raw).forEach(k => raw[k] === undefined && delete raw[k]);
    state.driverRaw = raw;
    state.browseOpen = false; previewFile.value = null; return;
  }
  if (f.content) {
    state.driverRaw = parseWdr(f.content);
    state.browseOpen = false; previewFile.value = null; return;
  }
  statusErr.value = false; statusMsg.value = 'Loading ' + f.name + '…';
  try {
    const url = `https://raw.githubusercontent.com/${f.repo}/${f.branch}/${f.path.split('/').map(encodeURIComponent).join('/')}`;
    const r = await fetch(url); if (!r.ok) throw new Error('fetch failed (' + r.status + ')');
    state.driverRaw = parseWdr(await r.text());
    state.browseOpen = false; previewFile.value = null;
  } catch(err) { statusErr.value = true; statusMsg.value = 'Could not load: ' + err.message; }
}

function pickFile(f) {
  if (state.browseMode === 'select') { loadDriver(f); return; }
  previewFile.value = f;
}

function openSourceUrl(url) {
  if (url) window.open(url, '_blank', 'noopener');
}

watch(() => state.browseOpen, val => { if (val) init(); else previewFile.value = null; });
function close() { state.browseOpen = false; }
function onBackdrop(e) { if (e.target === e.currentTarget) close(); }
</script>

<template>
  <div class="overlay" :class="{ on: state.browseOpen }" @click="onBackdrop">
    <div class="modal" v-if="state.browseOpen">
      <h2>
        {{ state.browseMode === 'select' ? 'Select driver' : (previewFile ? previewData.name : 'Browse driver library') }}
        <span class="x" @click="close" title="Close the driver library browser">&times;</span>
      </h2>
      <div class="body">
        <template v-if="!previewFile">
        <input class="filter" v-model="filterQ" placeholder="Search drivers…" autofocus>
        <div class="type-row">
          <button v-for="t in DRIVER_TYPES" :key="t.id"
                  class="type-chip"
                  :class="{ include: typeStates[t.id] === 'include', exclude: typeStates[t.id] === 'exclude' }"
                  :title="typeStates[t.id] === 'include' ? 'Including ' + t.label + ', click again to exclude ' + t.label : typeStates[t.id] === 'exclude' ? 'Excluding ' + t.label + ', click again to clear' : 'Click to include/exclude ' + t.label"
                  @click="toggleType(t.id)">{{ t.label }}</button>
          <button v-if="Object.keys(typeStates).length || fsMin || fsMax || sdMin || sdMax || selZ.length"
                  class="type-chip type-clear" title="Clear all type and parameter filters"
                  @click="clearParamFilters">✕ clear</button>
          <!-- Help popup — keep content in sync with drivers/DRIVER_TYPES.md -->
          <div class="help-wrap">
            <button class="help-btn" :class="{ active: typeHelpOpen }"
                    title="How are driver types classified?"
                    @click.stop="typeHelpOpen = !typeHelpOpen">?</button>
            <div v-if="typeHelpOpen" class="help-drop" @click.stop>
              <div class="help-title">Driver type classification
                <span class="help-ref">· see <code>drivers/DRIVER_TYPES.md</code></span>
              </div>
              <table class="help-table">
                <thead><tr><th>Vendor calls it</th><th>Badge</th><th>Chips</th></tr></thead>
                <tbody>
                  <tr><td>Subwoofer</td><td>Subwoofer</td><td>Sub · Woofer · Bass</td></tr>
                  <tr><td>Woofer</td><td>Woofer</td><td>Woofer · Bass</td></tr>
                  <tr><td>Mid-bass / mid-woofer</td><td>Mid-bass</td><td>Woofer · Mid · Bass</td></tr>
                  <tr><td>Midrange / mid-range</td><td>Midrange</td><td>Woofer · Mid</td></tr>
                  <tr><td>Full-range</td><td>Full-range</td><td>Woofer · Mid · Tweet · Bass · Full-range</td></tr>
                  <tr><td>BMR / balanced mode</td><td>BMR</td><td>Mid · Tweet <em>(not bass)</em></td></tr>
                  <tr><td>Tweeter / dome</td><td>Tweeter</td><td>Tweet</td></tr>
                  <tr><td>Ribbon tweeter</td><td>Ribbon Tweeter</td><td>Tweet</td></tr>
                  <tr><td>Planar</td><td>Planar Tweeter</td><td>Tweet</td></tr>
                  <tr><td>AMT / air motion</td><td>AMT</td><td>Tweet</td></tr>
                  <tr><td>Passive radiator</td><td>Passive Radiator</td><td>PR</td></tr>
                  <tr class="help-fallback"><td><em>Tiny piston (Sd &lt; 12 cm²)</em></td><td>Tweeter</td><td>Tweet</td></tr>
                  <tr class="help-fallback"><td><em>Very low Fs (&lt; 40 Hz)</em></td><td>Subwoofer</td><td>Sub · Woofer · Bass</td></tr>
                  <tr class="help-unclass"><td><em>No signal either way</em></td><td>⚠ Unclassified</td><td><em>shows in all queries</em></td></tr>
                </tbody>
              </table>
            </div>
            <div v-if="typeHelpOpen" class="src-backdrop" @click="typeHelpOpen = false"></div>
          </div>
        </div>
        <div class="param-row">
          <span class="plabel">Fs</span>
          <input class="pnum" v-model="fsMin" type="number" min="1" placeholder="min"
                 title="Minimum free-air resonance (Hz) — WinISD: Fs">
          <span class="pmid">–</span>
          <input class="pnum" v-model="fsMax" type="number" min="1" placeholder="max"
                 title="Maximum free-air resonance (Hz) — WinISD: Fs">
          <span class="plabel">Hz</span>
          <span class="psep"></span>
          <span class="plabel">Sd</span>
          <input class="pnum" v-model="sdMin" type="number" min="0" placeholder="min"
                 title="Minimum piston area in cm² — WinISD: Sd (converts from m²)">
          <span class="pmid">–</span>
          <input class="pnum" v-model="sdMax" type="number" min="0" placeholder="max"
                 title="Maximum piston area in cm² — WinISD: Sd (converts from m²)">
          <span class="plabel">cm²</span>
          <span class="psep"></span>
          <span class="plabel">Z</span>
          <button v-for="z in ['4','8','16']" :key="z" class="zchip"
                  :class="{ active: selZ.includes(z) }"
                  :title="`Filter to nominal ${z}Ω impedance — WinISD: Znom`"
                  @click="toggleZ(z)">{{ z }}Ω</button>
        </div>
        <div class="src-row">
          <div class="src-wrap">
            <button class="src-btn" @click.stop="sourcesOpen = !sourcesOpen"
                    :class="{ active: selectedSources.length }"
                    :title="selectedSources.length ? `Showing ${selectedSources.length} of ${availableSources.length} sources` : 'Filter by source collection'">
              {{ selectedSources.length ? `Sources (${selectedSources.length}/${availableSources.length})` : 'All sources' }} ▾
            </button>
            <div v-if="sourcesOpen" class="src-drop" @click.stop>
              <label class="src-item" :class="{ checked: !selectedSources.length }">
                <input type="checkbox" :checked="!selectedSources.length" @change="clearSources()">
                <span class="src-name">All sources</span>
              </label>
              <label v-for="[name, count] in availableSources" :key="name"
                     class="src-item" :class="{ checked: selectedSources.includes(name) }">
                <input type="checkbox" :checked="selectedSources.includes(name)" @change="toggleSource(name)">
                <span class="src-name">{{ name }}</span>
                <span class="src-count">{{ count }}</span>
              </label>
            </div>
          </div>
          <div v-if="sourcesOpen" class="src-backdrop" @click="sourcesOpen = false"></div>
        </div>
        <div class="statusrow">
          <span class="status" :class="{ err: statusErr }">{{ statusMsg }}</span>
          <button v-if="!sblLoaded" class="sblbtn" :disabled="sblLoading"
                  title="Load ~6000 drivers from the speakerboxlite.com community database (fetched live)"
                  @click="loadSpeakerBoxLite">
            {{ sblLoading ? 'Loading…' : '+ SpeakerBoxLite' }}
          </button>
        </div>
        </template><!-- end !previewFile controls -->
        <!-- ── Driver summary (browse mode) ── -->
        <div v-if="previewFile && previewData" class="preview">
          <div class="prev-nav">
            <button @click="previewFile = null" title="Back to driver list">← Back</button>
            <button class="use-btn" @click="loadDriver(previewFile)"
                    title="Load this driver into the current design">Use this driver</button>
          </div>
          <div class="prev-body">
            <div class="prev-specs">
              <div v-for="s in previewData.specs" :key="s.label" class="spec-row">
                <span class="spec-lbl">{{ s.label }}</span>
                <span class="spec-val"><b>{{ s.value }}</b><span v-if="s.unit" class="spec-unit"> {{ s.unit }}</span></span>
              </div>
            </div>
            <div v-if="previewData.links.length" class="prev-links">
              <a v-for="lnk in previewData.links" :key="lnk.href"
                 :href="lnk.href" target="_blank" rel="noopener"
                 class="prev-link">{{ lnk.label }} ↗</a>
            </div>
            <div v-if="previewData.providedBy" class="prev-source">{{ previewData.providedBy }}</div>
            <div v-else-if="previewData.source" class="prev-source">{{ previewData.source }}</div>
          </div>
        </div>

        <!-- ── Driver list ── -->
        <div v-else class="dlist">
          <div v-for="f in filteredFiles.slice(0, 5000)" :key="(f.sourceName || '') + (f.path || '') + f.name"
               :class="['ditem', f._isLatest && 'ditem-latest', f._isOlder && 'ditem-older']"
               @click="pickFile(f)">
            <b>{{ f.name }}</b>
            <span class="dmeta">
              <span v-if="f._nd" :class="['ddate', f._isLatest && 'ddate-latest', f._isOlder && 'ddate-older']">{{ f._nd }}</span>
              <a v-if="f.datasheet" class="dpdf"
                 :href="f.datasheet" target="_blank" rel="noopener"
                 title="Open manufacturer datasheet (PDF)" @click.stop>PDF</a>
              <a v-if="f.manupage" class="dpdf"
                 :href="f.manupage" target="_blank" rel="noopener"
                 title="Open manufacturer product page" @click.stop>Manu ↗</a>
              <a v-if="f.vendorpage && f.vendorpage !== f.manupage" class="dpdf"
                 :href="f.vendorpage" target="_blank" rel="noopener"
                 title="Open vendor/retailer product listing" @click.stop>Vendor ↗</a>
              <a v-if="f.frd" class="dpdf"
                 :href="f.frd" target="_blank" rel="noopener"
                 title="Download frequency response & impedance data (FRD/ZMA)" @click.stop>FRD ↗</a>
              <span v-if="f._canonical" :class="['dtype', f._canonical === 'Unclassified' && 'unk']">{{ f._canonical }}</span>
              <a v-if="f.sourceUrl" class="stag"
                 :title="f.sourceUrl + (f.sourceDesc ? ' — ' + f.sourceDesc : '')"
                 @click.stop.prevent="openSourceUrl(f.sourceUrl)">{{ f.sourceName }}</a>
              <span v-else class="stag">{{ f.sourceName }}</span>
            </span>
          </div>
          <div v-if="!filteredFiles.length && !statusErr" class="status loading">
            {{ filterQ ? 'No matching drivers.' : 'Loading…' }}
          </div>
        </div><!-- end dlist -->
        <div class="addrow">
          <input v-model="customUrl" placeholder="Add GitHub source: owner/repo or full URL"
                 @keydown.enter="loadCustom"
                 title="Load .wdr files from any public GitHub repository and add them to the pool">
          <button @click="loadCustom" title="Fetch .wdr files from the specified GitHub repository">Add</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { display:none; position:fixed; inset:0; background:#0008; z-index:1000; align-items:center; justify-content:center; }
.overlay.on { display:flex; }
.modal { background:var(--panel2); border:1px solid var(--mut); border-radius:8px; width:620px; max-width:95vw; max-height:80vh; display:flex; flex-direction:column; backdrop-filter:none; isolation:isolate; }
h2 { margin:0; padding:12px 16px; font-size:14px; font-weight:600; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--mut); }
.x { cursor:pointer; font-size:18px; line-height:1; color:var(--mut); }
.x:hover { color:var(--fg); }
.body { display:flex; flex-direction:column; padding:10px; gap:6px; overflow:hidden; }
.filter { width:100%; box-sizing:border-box; padding:5px 8px; font-size:12px; background:var(--bg); border:1px solid var(--mut); border-radius:4px; color:var(--fg); }
.filter:focus { outline:none; border-color:var(--acc); }
.statusrow { display:flex; align-items:center; gap:8px; }
.status { font-size:11px; color:var(--mut); flex:1; }
.status.err { color:#ff6b6b; }
.sblbtn { font-size:11px; padding:2px 8px; white-space:nowrap; }
.dlist { flex:1; overflow-y:auto; border:1px solid var(--mut); border-radius:4px; min-height:200px; }
.ditem { padding:4px 10px; cursor:pointer; font-size:12px; display:flex; justify-content:space-between; align-items:center; gap:6px; }
.ditem b { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:1; }
.ditem:hover { background:var(--bg3); }
.dmeta { display:flex; align-items:center; gap:6px; flex-shrink:0; }
.ddate { font-size:10px; color:var(--mut); white-space:nowrap; }
.ditem-latest .ddate { color:var(--acc); font-weight:600; }
.ditem-older { opacity:0.5; }
.ditem-older .ddate { color:#c07000; }
.dpdf { font-size:9px; font-weight:600; color:var(--acc); white-space:nowrap; text-decoration:none; border:1px solid var(--acc); border-radius:2px; padding:0 3px; line-height:1.6; }
.dpdf:hover { background:var(--acc); color:var(--bg); }
.dtype { font-size:9px; color:var(--acc); white-space:nowrap; border:1px solid var(--acc); border-radius:2px; padding:0 3px; line-height:1.6; opacity:0.7; }
.dtype.unk { color:#c07000; border-color:#c07000; opacity:1; }
.stag { font-size:10px; color:var(--mut); white-space:nowrap; cursor:pointer; }
.stag:hover { color:var(--acc); text-decoration:underline; }
.status.loading { padding:8px 10px; }
.addrow { display:flex; gap:6px; }
.addrow input { flex:1; padding:4px 8px; font-size:11px; background:var(--bg); border:1px solid var(--mut); border-radius:4px; color:var(--fg); }
.addrow input:focus { outline:none; border-color:var(--acc); }
.addrow button { font-size:11px; padding:3px 10px; }
.src-row { position:relative; }
.src-wrap { position:relative; display:inline-block; }
.src-btn { font-size:11px; padding:3px 8px; background:var(--bg); border:1px solid var(--mut); border-radius:4px; color:var(--mut); cursor:pointer; white-space:nowrap; }
.src-btn:hover, .src-btn.active { border-color:var(--acc); color:var(--acc); }
.src-drop { position:absolute; top:calc(100% + 3px); left:0; min-width:220px; max-height:260px; overflow-y:auto; background:var(--panel2); border:1px solid var(--mut); border-radius:6px; box-shadow:0 4px 16px #0006; z-index:10; padding:4px 0; }
.src-item { display:flex; align-items:center; gap:7px; padding:4px 10px; cursor:pointer; font-size:12px; color:var(--fg); }
.src-item:hover, .src-item.checked { background:var(--bg3); }
.src-item input[type=checkbox] { accent-color:var(--acc); cursor:pointer; flex-shrink:0; }
.src-name { flex:1; }
.src-count { font-size:10px; color:var(--mut); }
.src-backdrop { position:fixed; inset:0; z-index:9; }
.type-row { display:flex; gap:4px; flex-wrap:wrap; align-items:center; position:relative; }
.help-wrap { position:relative; margin-left:auto; }
.help-btn { font-size:11px; width:18px; height:18px; border-radius:50%; border:1px solid var(--mut); background:none; color:var(--mut); cursor:pointer; padding:0; line-height:1; }
.help-btn:hover, .help-btn.active { border-color:var(--acc); color:var(--acc); }
.help-drop { position:absolute; top:calc(100% + 4px); right:0; width:520px; max-width:90vw; background:var(--panel2); border:1px solid var(--mut); border-radius:6px; box-shadow:0 4px 20px #0008; z-index:20; padding:10px 12px; }
.help-title { font-size:11px; font-weight:600; margin-bottom:8px; color:var(--fg); }
.help-ref { font-size:10px; font-weight:400; color:var(--mut); }
.help-table { width:100%; border-collapse:collapse; font-size:11px; }
.help-table th { text-align:left; color:var(--mut); font-weight:600; border-bottom:1px solid var(--mut); padding:2px 6px; }
.help-table td { padding:2px 6px; border-bottom:1px solid color-mix(in srgb, var(--mut) 20%, transparent); color:var(--fg); }
.help-table tr:last-child td { border-bottom:none; }
.help-fallback td { color:var(--mut); font-style:italic; }
.help-unclass td { color:#c07000; }
.type-chip { font-size:11px; padding:2px 9px; border:1px solid var(--mut); border-radius:12px; background:none; color:var(--mut); cursor:pointer; white-space:nowrap; }
.type-chip:hover { border-color:var(--fg); color:var(--fg); }
.type-chip.include { border-color:#3a3; color:#3a3; background:color-mix(in srgb, #3a3 12%, transparent); }
.type-chip.exclude { border-color:#b90; color:#b90; background:color-mix(in srgb, #b90 12%, transparent); }
.type-clear { border-color:transparent; }
.param-row { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
.plabel { font-size:10px; color:var(--mut); white-space:nowrap; padding:0 1px; }
.pnum { width:46px; padding:2px 3px; font-size:11px; background:var(--bg); border:1px solid var(--mut); border-radius:3px; color:var(--fg); text-align:right; }
.pnum:focus { outline:none; border-color:var(--acc); }
.pmid { font-size:11px; color:var(--mut); }
.psep { width:8px; flex-shrink:0; }
.zchip { font-size:10px; padding:1px 6px; border:1px solid var(--mut); border-radius:10px; background:none; color:var(--mut); cursor:pointer; white-space:nowrap; }
.zchip:hover { border-color:var(--fg); color:var(--fg); }
.zchip.active { border-color:var(--acc); color:var(--acc); background:color-mix(in srgb, var(--acc) 12%, transparent); }
.preview { display:flex; flex-direction:column; flex:1; overflow:hidden; }
.prev-nav { display:flex; justify-content:space-between; align-items:center; gap:8px; padding-bottom:6px; }
.use-btn { font-size:11px; padding:3px 10px; background:var(--acc); color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:600; }
.use-btn:hover { opacity:0.85; }
.prev-body { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px; }
.prev-specs { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:4px 12px; }
.spec-row { display:flex; justify-content:space-between; align-items:baseline; padding:3px 6px; background:var(--bg); border-radius:3px; font-size:12px; }
.spec-lbl { color:var(--mut); }
.spec-val { font-variant-numeric:tabular-nums; }
.spec-unit { color:var(--mut); font-size:10px; }
.prev-links { display:flex; flex-direction:column; gap:5px; }
.prev-link { font-size:12px; color:var(--acc); text-decoration:none; padding:5px 8px; border:1px solid var(--acc); border-radius:4px; }
.prev-link:hover { background:var(--acc); color:var(--bg); }
.prev-source { font-size:11px; color:var(--mut); }
</style>
