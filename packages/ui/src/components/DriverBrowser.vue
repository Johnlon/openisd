<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { state, DEFAULT_DRIVER, setDriverFromRaw, setDriverFromWdr } from '../store.js';
import HelpTip from './HelpTip.vue';
import type { DriverRaw } from '@openisd/engine';
import { useEscToClose } from '../composables/useEscToClose.js';
import { DriverType } from '../driverType';
import sourcesJson from '../../../../drivers/sources.json';
import bundleJson  from '../drivers-bundle.json';

// A driver source (federated GitHub repo or bundled collection).
interface SourceEntry {
  key: string; name: string; type?: string;
  url?: string; description?: string;
  repo?: string; branch?: string; path?: string;
}
// A saved "My Driver" — a raw driver plus a save timestamp (name always present).
type MyDriver = DriverRaw & { name: string; _savedAt?: number };
// A row in the unified driver pool. Built dynamically, so most fields are optional.
interface FileEntry {
  name: string;
  fileName?: string;
  content?: string;
  date?: string;
  datasheet?: string; manu_page_url?: string; distributor_page_url?: string; frd?: string; impedance?: string;
  path?: string; repo?: string | null; branch?: string | null;
  sourceKey?: string; sourceName?: string; sourceUrl?: string; sourceDesc?: string;
  _Fs?: number | null; _Sd?: number | null; _Re?: number | null; _Znom?: number | null; _Pe?: number | null;
  _types?: string[]; _canonical?: string;
  _freqRange?: { lo: number; hi: number } | null;
  _nd?: string; _isLatest?: boolean; _isOlder?: boolean;
  myDriverData?: MyDriver;
}

// sources.json v2 keys sources by a short stable id; expose each as { key, ...src }.
const sources: SourceEntry[] = Object.entries(sourcesJson.sources || {}).map(([key, s]) => ({ key, ...(s as Omit<SourceEntry, 'key'>) }));
const allFiles    = ref<FileEntry[]>([]);   // unified pool across all sources
const filterQ     = ref('');
const statusMsg   = ref('');
const statusErr   = ref(false);
const customUrl   = ref('');
const initialized = ref(false);

const DISPLAY_LIMIT = 200;   // rows shown before "search to filter" kicks in
const displayLimit  = ref(DISPLAY_LIMIT);

// Source filter
const selectedSources = ref<string[]>([]);   // empty = all
const sourcesOpen     = ref(false);

// Type + param filters
const typeHelpOpen  = ref(false);
const typeStates = ref<Record<string, string>>({});   // id → 'include' | 'exclude'
const fsMin = ref('');
const fsMax = ref('');
const sdMin = ref('');   // cm²
const sdMax = ref('');   // cm²
const selZ  = ref<string[]>([]);   // '4', '8', '16'

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

function quickParse(content: string | undefined) {
  const m = (k: string) => { const r = (content || '').match(new RegExp('^' + k + '=(.+)$', 'm')); return r ? parseFloat(r[1]) : null; };
  return { Fs: m('Fs'), Sd: m('Sd'), Re: m('Re'), Znom: m('Znom'), Pe: m('Pe') };
}

function fmtHz(hz: number | string | null | undefined): string | null {
  if (hz == null) return null;
  const v = parseFloat(String(hz));
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
function classifyTypes(Fs: number | null, Sd: number | null, nameStr: string, driverType?: string, hasWoofer?: boolean, hasTweeter?: boolean): { types: string[]; canonical: string } {
  const nm = nameStr || '';
  // Scrapers may write compound values like "midwoofer, automotive" — take the primary
  // type token only; secondary qualifiers (automotive, marine, etc.) are not type tags.
  const dt = (driverType || '').split(',')[0].trim().toLowerCase();
  const types = new Set<string>();
  const canonical: string[] = [];

  if (PR_PAT.test(nm) || dt === DriverType.PassiveRadiator || dt === 'pr' || dt === 'passive radiator' || dt === 'passive_radiator')
    return { types: ['pr'], canonical: 'Passive Radiator' };
  if (COAX_PAT.test(nm) || dt === 'coaxial' || dt === 'coax' || (hasWoofer && hasTweeter))
    return { types: ['coax', 'woofer', 'bass', 'mid', 'tweet'], canonical: 'Coaxial' };

  if (TWEET_PAT.test(nm) || dt === DriverType.Tweeter || dt === DriverType.Amt || hasTweeter) {
    types.add('tweet');
    if (/\bAMT\b|air.motion/i.test(nm))          canonical.push('AMT');
    else if (/\bribbon\b/i.test(nm))              canonical.push('Ribbon Tweeter');
    else if (/\bplanar\b/i.test(nm))              canonical.push('Planar Tweeter');
    else                                          canonical.push('Tweeter');
  }
  if (SUB_PAT.test(nm) || dt === 'subwoofer' || dt === 'sub')
    { types.add('sub'); types.add('woofer'); types.add('bass'); canonical.push('Subwoofer'); }
  // "midwoofer" is Scan-Speak's category name for mid-bass cone drivers — same chip mapping
  if (MIDBASS_PAT.test(nm) || dt === DriverType.MidBass || dt === DriverType.MidWoofer || dt === 'midbass' || dt === 'midwoofer')
    { types.add('woofer'); types.add('mid'); types.add('bass'); canonical.push('Mid-bass'); }
  if (((WOOFER_PAT.test(nm) || dt === 'woofer' || hasWoofer) && !MIDBASS_PAT.test(nm)) && !SUB_PAT.test(nm))
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

function toggleType(id: string) {
  const cur = typeStates.value[id];
  if (!cur)            typeStates.value = { ...typeStates.value, [id]: 'include' };
  else if (cur === 'include') typeStates.value = { ...typeStates.value, [id]: 'exclude' };
  else                 { const s = { ...typeStates.value }; delete s[id]; typeStates.value = s; }
  displayLimit.value = DISPLAY_LIMIT;
}
function toggleZ(z: string) {
  const idx = selZ.value.indexOf(z);
  if (idx >= 0) selZ.value.splice(idx, 1); else selZ.value.push(z);
  displayLimit.value = DISPLAY_LIMIT;
}
function clearParamFilters() {
  typeStates.value = {}; fsMin.value = ''; fsMax.value = '';
  sdMin.value = ''; sdMax.value = ''; selZ.value = [];
  displayLimit.value = DISPLAY_LIMIT;
}

const availableSources = computed(() => {
  const counts: Record<string, number> = {};
  for (const f of allFiles.value) {
    if (f.sourceName) counts[f.sourceName] = (counts[f.sourceName] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
});

function toggleSource(name: string) {
  const idx = selectedSources.value.indexOf(name);
  if (idx >= 0) selectedSources.value.splice(idx, 1);
  else selectedSources.value.push(name);
  displayLimit.value = DISPLAY_LIMIT;
}

function clearSources() { selectedSources.value = []; displayLimit.value = DISPLAY_LIMIT; }

// Normalise any date string to YYYY-MM-DD for comparison and display.
// Handles ISO (2026-06-24), DD/MM/YYYY, DD-MM-YYYY, "Jun 24 2026", etc.
function normaliseDate(raw: string | undefined): string {
  if (!raw) return '';
  const s = raw.trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  // Try native parse as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

const filteredFiles = computed(() => {
  const tokens = filterQ.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const srcFilter = selectedSources.value;
  let filtered = allFiles.value;
  if (tokens.length)
    filtered = filtered.filter(f => tokens.every(t => f.name.toLowerCase().includes(t)));
  if (srcFilter.length)
    filtered = filtered.filter(f => f.sourceName != null && srcFilter.includes(f.sourceName));
  const included = Object.keys(typeStates.value).filter(k => typeStates.value[k] === 'include');
  const excluded = Object.keys(typeStates.value).filter(k => typeStates.value[k] === 'exclude');
  const isUnclassified = (f: FileEntry) => !f._types?.length;
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
  const latestDate: Record<string, string> = {};
  const nameCount: Record<string, number> = {};
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

watch(filterQ, () => { displayLimit.value = DISPLAY_LIMIT; });

const displayedFiles = computed(() => filteredFiles.value.slice(0, displayLimit.value));
const listTruncated  = computed(() => filteredFiles.value.length > displayLimit.value);

// ── GitHub source helpers ────────────────────────────────────────────────────

async function ghDefaultBranch(repo: string): Promise<string> {
  const r = await fetch(`https://api.github.com/repos/${repo}`);
  if (!r.ok) throw new Error('repo not found (' + r.status + ')');
  return (await r.json()).default_branch || 'main';
}

async function fetchSource(src: SourceEntry) {
  try {
    const branch = src.branch || await ghDefaultBranch(src.repo!);
    const r = await fetch(`https://api.github.com/repos/${src.repo}/git/trees/${branch}?recursive=1`);
    if (!r.ok) return;
    const result = await r.json();
    if (result.truncated) {
      statusErr.value = true;
      statusMsg.value = `Repo "${src.name}" is too large to list fully. Specify a direct subfolder in the URL — e.g. github.com/${src.repo}/tree/main/drivers — so only that folder is scanned.`;
      return;
    }
    const tree: Array<{ path: string; type: string }> = result.tree || [];
    const base = (src.path || '').replace(/^\/|\/$/g, '');
    const found = tree
      .filter(t => t.type === 'blob' && t.path.toLowerCase().endsWith('.wdr')
                && (!base || t.path.toLowerCase().startsWith(base.toLowerCase() + '/')))
      .map(t => {
        const nm = t.path.split('/').pop()!.replace(/\.wdr$/i, '');
        return {
          path: t.path, branch, repo: src.repo,
          name: nm,
          sourceKey:  src.key,
          sourceName: src.name,
          sourceUrl:  src.url || '',
          sourceDesc: src.description || '',
          // _ properties are computed at client runtime from WDR content — not in the bundle JSON
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

function parseRepoInput(s: string): SourceEntry | null {
  s = s.trim(); if (!s) return null;
  let m = s.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*))?)?$/i);
  if (m) return { key: m[1]+'/'+m[2], name: m[1]+'/'+m[2], type:'github', repo: m[1]+'/'+m[2], branch: m[3]||'', path: m[4]||'' };
  m = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m) return { key: s, name: s, type:'github', repo: s, branch: '', path: '' };
  return null;
}

// ── Initialise ───────────────────────────────────────────────────────────────

// Index bundled sources by their stable key for O(1) lookup
// Shape of a pre-bundled driver entry in drivers-bundle.json.
interface BundleFile {
  name: string; content: string; date?: string;
  datasheet?: string; manu_page_url?: string; distributor_page_url?: string; frd?: string; impedance?: string;
  path?: string; driver_type?: string; freq_low_hz?: string; freq_high_hz?: string;
  has_woofer?: boolean; has_tweeter?: boolean;
}
const bundledByKey: Record<string, BundleFile[]> = Object.fromEntries(
  (bundleJson.sources || []).map((s: { key: string; files: BundleFile[] }) => [s.key, s.files])
);

async function init() {
  if (initialized.value) return;
  initialized.value = true;
  statusErr.value = false;

  // 1. Load bundled sources instantly from the pre-built JSON (no network)
  for (const src of sources) {
    const files = bundledByKey[src.key];
    if (!files) continue;
    const entries = files.map((f: BundleFile) => {
      const qp = quickParse(f.content);
      const brand = (f.content || '').match(/^Brand=(.+)$/m)?.[1]?.trim() || '';
      const model = (f.content || '').match(/^Model=(.+)$/m)?.[1]?.trim() || '';
      // Identify/display by the WDR's Brand + Model (the driver's real name),
      // NOT the filename. Fall back to the filename only if both are absent.
      const displayName = [brand, model].filter(Boolean).join(' ') || f.name;
      const nameStr = displayName + ' ' + f.name;
      return {
        name: displayName,
        fileName: f.name,
        content: f.content,
        date: f.date || '',
        datasheet:   f.datasheet   || '',
        manu_page_url:    f.manu_page_url    || '',
        distributor_page_url:  f.distributor_page_url  || '',
        frd:         f.frd         || '',
        impedance:   f.impedance   || '',
        path: f.path, repo: null, branch: null,
        sourceKey:  src.key,
        sourceName: src.name,
        sourceUrl:  src.url || '',
        sourceDesc: src.description || '',
        _Fs: qp.Fs, _Sd: qp.Sd, _Re: qp.Re, _Znom: qp.Znom, _Pe: qp.Pe,
        _freqRange: (() => { const lo = parseFloat(f.freq_low_hz || ''), hi = parseFloat(f.freq_high_hz || ''); return (isFinite(lo) && isFinite(hi)) ? { lo, hi } : null; })(),
        ...(({ types, canonical }) => ({ _types: types, _canonical: canonical }))(classifyTypes(qp.Fs, qp.Sd, nameStr, f.driver_type, f.has_woofer, f.has_tweeter)),
      };
    });
    allFiles.value = [...allFiles.value, ...entries];
  }

  statusMsg.value = `${allFiles.value.length} drivers`;

  // 2. Fetch any non-bundled sources from GitHub in the background
  const liveSources = sources
    .filter(src => !bundledByKey[src.key])
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

// ── Add custom source ────────────────────────────────────────────────────────

async function loadCustom() {
  const src = parseRepoInput(customUrl.value);
  if (!src) { statusErr.value = true; statusMsg.value = 'Enter owner/repo or a github.com URL'; return; }
  statusErr.value = false; statusMsg.value = `Loading ${src.name}…`;
  await fetchSource(src);
  customUrl.value = '';
}

// ── Pick / preview a driver ──────────────────────────────────────────────────

const previewFile  = ref<FileEntry | null>(null);
const myDrivers    = ref<MyDriver[]>([]);   // drivers saved by the user to localStorage

const MY_DRIVERS_KEY = 'openisd_my_drivers';
function reloadMyDrivers() {
  try { myDrivers.value = JSON.parse(localStorage.getItem(MY_DRIVERS_KEY) ?? '[]'); }
  catch { myDrivers.value = []; }
}
function deleteMyDriver(name: string) {
  const list = myDrivers.value.filter(d => d.name !== name);
  try { localStorage.setItem(MY_DRIVERS_KEY, JSON.stringify(list)); } catch { /* storage disabled/full — non-fatal */ }
  myDrivers.value = list;
}
// My Drivers respect the text search too, so a query like "demo" doesn't leave
// unrelated saved drivers on screen.
const filteredMyDrivers = computed(() => {
  const tokens = filterQ.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return myDrivers.value;
  return myDrivers.value.filter(d => tokens.every(t => (d.name || '').toLowerCase().includes(t)));
});
// Shorter source label for the list — drop the "(… bundled …)" clutter; the full
// name and description stay in the hover tooltip.
function shortSource(name: string | undefined) {
  return (name || '').replace(/\s*\([^)]*bundled[^)]*\)/gi, '').trim();
}

// Lightweight WDR parser — returns whatever it finds, never throws
function parseWdrLoose(content: string | undefined): Record<string, string> {
  const raw: Record<string, string> = {};
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
  if (f.manu_page_url)  links.push({ href: f.manu_page_url,  label: 'Manufacturer page' });
  if (f.distributor_page_url && f.distributor_page_url !== f.manu_page_url) links.push({ href: f.distributor_page_url, label: 'Distributor page' });
  if (f.frd)       links.push({ href: f.frd,        label: 'FRD / ZMA data' });

  if (f.myDriverData) {
    const d = f.myDriverData;
    const n = (v: number | undefined, scale = 1): number | null => (v != null && isFinite(v * scale) && v !== 0) ? v * scale : null;
    const Fs = n(d.Fs), Qes = n(d.Qes);
    return {
      name: d.name || 'My Driver', source: 'My Drivers', providedBy: '', links,
      specs: [
        { label: 'Fs',   value: Fs?.toFixed(1),                         unit: 'Hz'  },
        { label: 'Qts',  value: n(d.Qts)?.toFixed(3) },
        { label: 'Qes',  value: Qes?.toFixed(3) },
        { label: 'Qms',  value: n(d.Qms)?.toFixed(3) },
        { label: 'Re',   value: n(d.Re)?.toFixed(2),                    unit: 'Ω'   },
        { label: 'Le',   value: d.Le ? (d.Le*1000).toFixed(3) : null,   unit: 'mH'  },
        { label: 'Vas',  value: d.Vas ? (d.Vas*1000).toFixed(2) : null, unit: 'L'   },
        { label: 'Sd',   value: d.Sd ? (d.Sd*1e4).toFixed(1) : null,   unit: 'cm²' },
        { label: 'Xmax', value: d.Xmax ? (d.Xmax*1000).toFixed(1) : null, unit: 'mm' },
        { label: 'Pe',   value: n(d.Pe)?.toFixed(0),                    unit: 'W'   },
        { label: 'EBP',  value: (Fs && Qes) ? (Fs/Qes).toFixed(0) : null },
      ].filter(s => s.value != null),
    };
  }

  const raw = parseWdrLoose(f.content);
  const n   = (k: string): number | null => { const v = parseFloat(raw[k]); return isFinite(v) && v !== 0 ? v : null; };
  const str = (k: string): string | null => (raw[k] || '').trim() || null;
  const Fs = n('Fs'), Qes = n('Qes'), Le = n('Le'), Vas = n('Vas'), Sd = n('Sd'), Xmax = n('Xmax');
  const Mms = n('Mms'), Cms = n('Cms'), Rms = n('Rms'), Vd = n('Vd'), Dia = n('Dia'), noEff = n('no');
  return {
    name: f.name,
    source: f.sourceName,
    sourceUrl: f.sourceUrl || '',
    providedBy: str('ProvidedBy'),
    brand: str('Brand'),
    model: str('Model'),
    manufacturer: str('Manufacturer'),
    notes: str('Comment'),
    added: str('DateAdded'),
    links,
    specs: [
      { label: 'Fs',     value: Fs?.toFixed(1),                       unit: 'Hz'    },
      { label: 'Qts',    value: n('Qts')?.toFixed(3) },
      { label: 'Qes',    value: Qes?.toFixed(3) },
      { label: 'Qms',    value: n('Qms')?.toFixed(3) },
      { label: 'Re',     value: n('Re')?.toFixed(2),                  unit: 'Ω'     },
      { label: 'Znom',   value: n('Znom')?.toFixed(0),                unit: 'Ω'     },
      { label: 'Le',     value: Le  ? (Le*1000).toFixed(3)  : null,   unit: 'mH'    },
      { label: 'Bl',     value: n('BL')?.toFixed(2),                  unit: 'T·m'   },
      { label: 'Vas',    value: Vas ? (Vas*1000).toFixed(2) : null,   unit: 'L'     },
      { label: 'Sd',     value: Sd  ? (Sd*1e4).toFixed(1)   : null,   unit: 'cm²'   },
      { label: 'Xmax',   value: Xmax? (Xmax*1000).toFixed(1): null,   unit: 'mm'    },
      { label: 'Pe',     value: n('Pe')?.toFixed(0),                  unit: 'W'     },
      { label: 'SPL',    value: n('SPL')?.toFixed(1),                 unit: 'dB'    },
      { label: 'SPLmax', value: n('SPLmax')?.toFixed(1),              unit: 'dB'    },
      { label: 'Mms',    value: Mms ? (Mms*1000).toFixed(1) : null,   unit: 'g'     },
      { label: 'Cms',    value: Cms ? (Cms*1000).toFixed(3) : null,   unit: 'mm/N'  },
      { label: 'Rms',    value: Rms?.toFixed(2),                      unit: 'N·s/m' },
      { label: 'Vd',     value: Vd  ? (Vd*1e6).toFixed(1)  : null,   unit: 'cm³'   },
      { label: 'Dia',    value: Dia ? (Dia*1000).toFixed(0) : null,   unit: 'mm'    },
      { label: 'η₀',     value: noEff ? (noEff*100).toFixed(3): null, unit: '%'     },
      { label: 'Type',   value: f._canonical && f._canonical !== 'Unclassified' ? f._canonical : null },
      { label: 'Freq',   value: f._freqRange ? fmtHz(f._freqRange.lo) + '–' + fmtHz(f._freqRange.hi) : null },
      { label: 'EBP',    value: (Fs && Qes) ? (Fs/Qes).toFixed(0) : null },
    ].filter(sp => sp.value != null),
  };
});

function resetToDemo() {
  setDriverFromRaw(DEFAULT_DRIVER);
  state.driverSource = { ...DEFAULT_DRIVER };
  close();
}

// Load WDR text through the Driver ADT (lossless, provenance-preserving) and overlay the
// library-provided links, which live in the catalogue entry, not the .wdr file itself.
function applyWdr(text: string, f: FileEntry) {
  const m = setDriverFromWdr(text);
  if (f.datasheet)  m.enter('datasheetUrl',  f.datasheet);
  if (f.manu_page_url)   m.enter('manuPageUrl',   f.manu_page_url);
  if (f.distributor_page_url) m.enter('distributorPageUrl', f.distributor_page_url);
  if (f.frd)        m.enter('frdUrl',        f.frd);
  if (f.impedance)  m.enter('impedanceUrl',  f.impedance);
  state.driverSource = m.raw();
}

async function loadDriver(f: FileEntry) {
  if (f.myDriverData) {
    setDriverFromRaw(f.myDriverData);
    state.driverSource = { ...f.myDriverData };
    state.browseOpen = false; previewFile.value = null; return;
  }
  if (f.content) {
    applyWdr(f.content, f);
    state.browseOpen = false; previewFile.value = null; return;
  }
  statusErr.value = false; statusMsg.value = 'Loading ' + f.name + '…';
  const url = `https://raw.githubusercontent.com/${f.repo}/${f.branch}/${f.path!.split('/').map(encodeURIComponent).join('/')}`;
  let fetchResult: Response;
  try { fetchResult = await fetch(url); } catch(err) { statusErr.value = true; statusMsg.value = 'Could not load: ' + (err as Error).message; return; }
  if (!fetchResult.ok) { statusErr.value = true; statusMsg.value = 'Could not load: fetch failed (' + fetchResult.status + ')'; return; }
  const text = await fetchResult.text();
  if (!/\[Driver\]/.test(text)) { statusErr.value = true; statusMsg.value = 'Could not load: file did not parse as a WDR'; return; }
  applyWdr(text, f);
  state.browseOpen = false; previewFile.value = null;
}

function pickFile(f: FileEntry) {
  previewFile.value = f;
}

function openSourceUrl(url: string | undefined) {
  if (url) window.open(url, '_blank', 'noopener');
}

watch(() => state.browseOpen, val => {
  if (val) { init(); reloadMyDrivers(); }
  else previewFile.value = null;
});
function close() { previewFile.value = null; state.browseOpen = false; }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }
useEscToClose(() => state.browseOpen, close);
async function openDefine() {
  state.browseOpen = false;
  await nextTick();
  state.defineOpen = true;
}
</script>

<template>
  <div class="overlay" :class="{ on: state.browseOpen }" @click="onBackdrop">
    <div class="modal" v-if="state.browseOpen">
      <h2>
        {{ previewFile ? previewData?.name : 'Driver library' }}
        <button v-if="!previewFile" class="reset-demo-btn" @click="resetToDemo"
                title="Reset the driver to the built-in demo (Generic 6.5&quot; Woofer)">↺ Reset to demo</button>
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
                  <tr><td>Mid-bass / mid-woofer / midwoofer</td><td>Mid-bass</td><td>Woofer · Mid · Bass</td></tr>
                  <tr><td>Midrange / mid-range</td><td>Midrange</td><td>Woofer · Mid</td></tr>
                  <tr><td>Full-range</td><td>Full-range</td><td>Woofer · Mid · Tweet · Bass · Full-range</td></tr>
                  <tr><td>BMR / balanced mode</td><td>BMR</td><td>Mid · Tweet <em>(not bass)</em></td></tr>
                  <tr><td>Tweeter / dome</td><td>Tweeter</td><td>Tweet</td></tr>
                  <tr><td>Ribbon tweeter</td><td>Ribbon Tweeter</td><td>Tweet</td></tr>
                  <tr><td>Planar</td><td>Planar Tweeter</td><td>Tweet</td></tr>
                  <tr><td>AMT / air motion</td><td>AMT</td><td>Tweet</td></tr>
                  <tr><td>Passive radiator</td><td>Passive Radiator</td><td>PR</td></tr>
                  <tr><td>Coaxial / coax</td><td>Coaxial</td><td>Woofer · Mid · Tweet · Bass · Coaxial</td></tr>
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
                  :title="`Filter to nominal ${z}Ω impedance — stored as WinISD Znom (descriptive label only; not used in simulation by WinISD or OpenISD)`"
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
            <div v-if="previewData.brand || previewData.model || previewData.manufacturer || previewData.notes || previewData.added || previewData.providedBy" class="prev-textinfo">
              <div v-if="previewData.brand || previewData.model" class="prev-textrow">
                <span class="prev-src-lbl">Brand / Model</span>
                {{ [previewData.brand, previewData.model].filter(Boolean).join(' — ') }}
              </div>
              <div v-if="previewData.manufacturer" class="prev-textrow">
                <span class="prev-src-lbl">Manufacturer</span> {{ previewData.manufacturer }}
              </div>
              <div v-if="previewData.providedBy" class="prev-textrow">
                <span class="prev-src-lbl">Measured by</span> {{ previewData.providedBy }}
              </div>
              <div v-if="previewData.added" class="prev-textrow">
                <span class="prev-src-lbl">Date added</span> {{ previewData.added }}
              </div>
              <div v-if="previewData.notes" class="prev-textrow prev-notes">
                <span class="prev-src-lbl">Notes</span> {{ previewData.notes }}
              </div>
            </div>
            <div v-if="previewData.source" class="prev-source">
              <span class="prev-src-lbl">Source</span>
              <a v-if="previewData.sourceUrl" :href="previewData.sourceUrl" target="_blank" rel="noopener" :title="previewData.sourceUrl">{{ previewData.source }} ↗</a>
              <span v-else>{{ previewData.source }}</span>
            </div>
          </div>
        </div>

        <!-- ── Driver list ── -->
        <div v-else class="dlist">
          <!-- My Drivers (respect the search query) -->
          <template v-if="filteredMyDrivers.length">
            <div class="dlist-section">My Drivers</div>
            <div v-for="d in filteredMyDrivers" :key="d.name + d._savedAt"
                 class="ditem my-ditem"
                 @click="pickFile({ name: d.name, myDriverData: d })">
              <b>{{ d.name }}</b>
              <button class="my-del" @click.stop="deleteMyDriver(d.name)" title="Remove from My Drivers">✕</button>
            </div>
            <div class="dlist-sep"></div>
          </template>
          <div v-for="f in displayedFiles" :key="(f.sourceKey || f.sourceName || '') + '/' + (f.path || f.fileName || f.name)"
               :class="['ditem', f._isLatest && 'ditem-latest', f._isOlder && 'ditem-older']"
               @click="pickFile(f)">
            <b>{{ f.name }}</b>
            <span class="dmeta">
              <span v-if="f._nd" :class="['ddate', f._isLatest && 'ddate-latest', f._isOlder && 'ddate-older']">{{ f._nd }}</span>
              <a v-if="f.datasheet" class="dpdf"
                 :href="f.datasheet" target="_blank" rel="noopener"
                 title="Open manufacturer datasheet (PDF)" @click.stop>PDF</a>
              <a v-if="f.manu_page_url" class="dpdf"
                 :href="f.manu_page_url" target="_blank" rel="noopener"
                 title="Open manufacturer product page" @click.stop>Manu ↗</a>
              <a v-if="f.distributor_page_url && f.distributor_page_url !== f.manu_page_url" class="dpdf"
                 :href="f.distributor_page_url" target="_blank" rel="noopener"
                 title="Open distributor/retailer product listing" @click.stop>Distributor ↗</a>
              <a v-if="f.frd" class="dpdf"
                 :href="f.frd" target="_blank" rel="noopener"
                 title="Download frequency response & impedance data (FRD/ZMA)" @click.stop>FRD ↗</a>
              <span v-if="f._canonical" :class="['dtype', f._canonical === 'Unclassified' && 'unk']">{{ f._canonical }}</span>
              <a v-if="f.sourceUrl" class="stag"
                 :title="f.sourceName + (f.sourceDesc ? ' — ' + f.sourceDesc : '') + '\n' + f.sourceUrl"
                 @click.stop.prevent="openSourceUrl(f.sourceUrl)">{{ shortSource(f.sourceName) }}</a>
              <span v-else class="stag" :title="f.sourceName + (f.sourceDesc ? ' — ' + f.sourceDesc : '')">{{ shortSource(f.sourceName) }}</span>
            </span>
          </div>
          <div v-if="listTruncated" class="dlist-more">
            Showing {{ displayLimit }} of {{ filteredFiles.length }} —
            <button class="dlist-more-btn" @click="displayLimit += 200"
                    title="Show 200 more drivers">show more</button>
            or type to search
          </div>
          <div v-if="!filteredFiles.length && !statusErr" class="status loading">
            {{ filterQ ? 'No matching drivers.' : 'Loading…' }}
          </div>
        </div><!-- end dlist -->
        <div class="addrow">
          <div class="addrow-label">
            Add GitHub URL where other WinISD files are found
            <HelpTip text="Paste a GitHub URL pointing to a folder containing .wdr files — e.g. github.com/owner/repo or github.com/owner/repo/tree/main/subfolder. The drivers load temporarily for this session only and won't be saved." />
          </div>
          <div class="addrow-inputs">
            <input v-model="customUrl" placeholder="github.com/owner/repo or full URL"
                   @keydown.enter="loadCustom"
                   title="Load .wdr files from any public GitHub repository">
            <button @click="loadCustom" title="Fetch .wdr files from the specified GitHub repository">Add</button>
          </div>
        </div>
        <div class="browser-footer">
          <button @click="openDefine"
                  title="Define a new driver model from datasheet T/S parameters">
            Add new Driver
          </button>
          <a href="https://speakerboxlite.com/manufacturers/shared" target="_blank" rel="noopener"
             title="Browse shared WinISD driver files on SpeakerBoxLite">
            Find more drivers at SpeakerBoxLite.com ↗
          </a>
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
.reset-demo-btn { margin-left:auto; margin-right:12px; font-size:11px; padding:3px 9px; background:var(--bg); border:1px solid var(--mut); border-radius:4px; color:var(--mut); cursor:pointer; white-space:nowrap; }
.reset-demo-btn:hover { border-color:var(--acc); color:var(--acc); }
.x { cursor:pointer; font-size:18px; line-height:1; color:var(--mut); }
.x:hover { color:var(--fg); }
.body { display:flex; flex-direction:column; padding:10px; gap:6px; overflow:hidden; }
.filter { width:100%; box-sizing:border-box; padding:5px 8px; font-size:12px; background:var(--bg); border:1px solid var(--mut); border-radius:4px; color:var(--fg); }
.filter:focus { outline:none; border-color:var(--acc); }
.statusrow { display:flex; align-items:center; gap:8px; }
.status { font-size:11px; color:var(--mut); flex:1; }
.status.err { color:#ff6b6b; }
.dlist { flex:1; overflow-y:auto; border:1px solid var(--mut); border-radius:4px; min-height:200px; }
.dlist-section { padding:4px 10px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--acc2); background:rgba(255,180,84,.07); border-bottom:1px solid var(--line); }
.dlist-sep { height:1px; background:var(--line); margin:4px 0; }
.my-ditem { background:rgba(255,180,84,.04); }
.my-del { flex-shrink:0; background:none; border:none; color:var(--mut); cursor:pointer; padding:0 4px; font-size:12px; line-height:1; min-height:unset; }
.my-del:hover { color:var(--bad); }
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
.dlist-more { padding:6px 10px; font-size:11px; color:var(--mut); text-align:center; border-top:1px solid var(--line); }
.dlist-more-btn { background:none; border:none; color:var(--acc); cursor:pointer; font-size:11px; padding:0 3px; text-decoration:underline; min-height:unset; }
.addrow { display:flex; flex-direction:column; gap:4px; }
.addrow-label { font-size:11px; color:var(--mut); display:flex; align-items:center; gap:5px; }
.addrow-inputs { display:flex; gap:6px; }
.addrow-inputs input { flex:1; padding:4px 8px; font-size:11px; background:var(--bg); border:1px solid var(--mut); border-radius:4px; color:var(--fg); }
.addrow-inputs input:focus { outline:none; border-color:var(--acc); }
.addrow-inputs button { font-size:11px; padding:3px 10px; }
.browser-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:4px 0 2px; flex-wrap:wrap; }
.browser-footer a { font-size:11px; color:var(--mut); text-decoration:none; }
.browser-footer a:hover { color:var(--acc); }
.browser-footer button { font-size:11px; padding:3px 10px; }
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
/* No spinners — these are search bounds in a picker, not live what-if controls. */
.pnum::-webkit-outer-spin-button,
.pnum::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
.pnum { -moz-appearance:textfield; appearance:textfield; }
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
.prev-source { font-size:11px; color:var(--mut); margin-top:2px; }
.prev-src-lbl { font-weight:600; color:var(--acc2); margin-right:4px; }
.prev-textinfo { display:flex; flex-direction:column; gap:3px; padding:7px 9px; background:var(--bg); border-radius:4px; border:1px solid var(--line); }
.prev-textrow { font-size:11px; color:var(--mut); line-height:1.4; }
.prev-notes { white-space:pre-wrap; }
</style>
