<script setup>
import { ref, computed, reactive, watch, nextTick } from 'vue';

const props = defineProps({ open: Boolean });
const emit  = defineEmits(['close', 'apply']);

const RHO = 1.2;   // kg/m³
const C   = 343;   // m/s

// ── Parameter definitions ─────────────────────────────────────────────────
// readOnly  = always derived by engine, shown as read-only display
// optional  = not required for Apply
// dimOnly   = physical dimension field — no SI conversion, stored as-is in mm or g
const PARAMS = [
  // Thiele–Small — Fs & Vas on the top row; the interchangeable Q-trio grouped below
  { key: 'Fs',   unit: 'Hz',    sect: 'TS',   label: 'Fs',        desc: 'Free-air resonance — from T/S table on datasheet. WinISD: Fs' },
  { key: 'Vas',  unit: 'L',     sect: 'TS',   label: 'Vas',       desc: 'Equivalent compliance volume — from T/S table. WinISD: Vas' },
  { key: 'Qms',  unit: '',      sect: 'TS',   label: 'Qms',       desc: 'Mechanical Q factor — losses in spider/surround. WinISD: Qms', newRow: true },
  { key: 'Qes',  unit: '',      sect: 'TS',   label: 'Qes',       desc: 'Electrical Q factor — losses in voice coil resistance. WinISD: Qes' },
  { key: 'Qts',  unit: '',      sect: 'TS',   label: 'Qts',       desc: 'Total Q = Qms·Qes / (Qms+Qes). Enter any 2 of the 3 Q values — third is auto-calculated. WinISD: Qts' },
  // Piston / Acoustic — Sd/Dia (interchangeable) + Xmax on one row
  { key: 'Sd',   unit: 'cm²',   sect: 'Piston', label: 'Sd',      desc: 'Effective piston area. Enter Sd or cone Dia — the other is auto-calculated. WinISD: Sd' },
  { key: 'Dia',  unit: 'mm',    sect: 'Piston', label: 'Cone ⌀',  desc: 'Cone effective diameter → Sd = π·(Dia/2)². Enter Sd or Dia, not both. WinISD: Dia' },
  { key: 'Xmax', unit: 'mm',    sect: 'Piston', label: 'Xmax',    desc: 'Peak linear excursion (one-way). Enables excursion and max-SPL curves. WinISD: Xmax', optional: true },
  // Electrical — Re/Le/Znom on one row
  { key: 'Re',   unit: 'Ω',     sect: 'Electrical', label: 'Re',  desc: 'DC voice coil resistance. Required to calculate Bl. WinISD: Re' },
  { key: 'Le',   unit: 'mH',    sect: 'Electrical', label: 'Le',  desc: 'Voice coil inductance at 1 kHz. Affects impedance shape only. WinISD: Le', optional: true },
  { key: 'Znom', unit: 'Ω',     sect: 'Electrical', label: 'Znom', desc: 'Nominal impedance rating (typically 4, 8, or 16 Ω). Label only — not used in SPL calculation. WinISD: Z', optional: true },
  // Performance
  { key: 'Pe',   unit: 'W',     sect: 'Performance', label: 'Pe', desc: 'Long-term continuous power handling. Enables max-power curves. WinISD: Pe', optional: true },
  // Motor / large-signal — WinISD Le model + voice-coil geometry (WDR: fLe, KLe, Hc, Hg)
  { key: 'fLe',  unit: 'Hz',    sect: 'Motor', label: 'fLe', desc: 'Frequency at which Le/KLe were measured. 0 = standard Le model. WinISD: fLe', optional: true, raw: true },
  { key: 'KLe',  unit: 'H·√Hz', sect: 'Motor', label: 'KLe', desc: 'Semi-inductance (Vanderkooy lossy-inductance model). 0 = not active. WinISD: KLe', optional: true, raw: true },
  { key: 'Hc',   unit: 'mm',    sect: 'Motor', label: 'Hc',  desc: 'Voice-coil winding height. WinISD large-signal: Hc', optional: true },
  { key: 'Hg',   unit: 'mm',    sect: 'Motor', label: 'Hg',  desc: 'Magnetic air-gap height. WinISD large-signal: Hg', optional: true },
  // Voice coil & thermal (WDR: numVC, VCCon, alfaVC, Rt, Ct)
  { key: 'numVC',  unit: 'count', sect: 'VC', label: 'VCs',   desc: 'Number of voice coils — 1 for most, 2 for dual-voice-coil. WinISD: Voicecoils', optional: true, raw: true },
  { key: 'VCCon',  unit: '1∥/2S', sect: 'VC', label: 'VCCon', desc: 'Voice-coil wiring: 1 = parallel, 2 = series. WinISD: Connection', optional: true, raw: true },
  { key: 'alfaVC', unit: '1/K',   sect: 'VC', label: 'αVC',   desc: 'VC resistance temperature coefficient (copper ≈ 0.0039). WinISD Advanced: AlfaVC', optional: true, raw: true },
  { key: 'Rt',     unit: 'K/W',   sect: 'VC', label: 'R(t)',  desc: 'Voice-coil-to-ambient thermal resistance. WinISD Advanced: R(t)', optional: true, raw: true },
  { key: 'Ct',     unit: 'J/K',   sect: 'VC', label: 'C(t)',  desc: 'Voice-coil thermal capacitance. WinISD Advanced: C(t)', optional: true, raw: true },
  // Environment (WDR: c, roo)
  { key: 'c',    unit: 'm/s',   sect: 'Environment', label: 'c', desc: 'Speed of sound (default ≈ 343.7 m/s at ~20 °C). WinISD Advanced: c', optional: true, raw: true },
  { key: 'roo',  unit: 'kg/m³', sect: 'Environment', label: 'ρ', desc: 'Air density (default ≈ 1.2 kg/m³ at ~20 °C, 1 atm). WinISD Advanced: roo', optional: true, raw: true },
  // Derived — calculated by default (state C) but editable: type to override, clear to revert
  { key: 'Mms',  unit: 'g',     sect: 'Derived', label: 'Mms',   desc: 'Moving mass incl. air load — 1 / ((2π·Fs)²·Cms). Calculated by default; type to override. WinISD: Mms' },
  { key: 'Cms',  unit: 'mm/N',  sect: 'Derived', label: 'Cms',   desc: 'Suspension compliance — Vas / (ρc²·Sd²). Calculated by default; type to override. WinISD: Cms' },
  { key: 'Rms',  unit: 'N·s/m', sect: 'Derived', label: 'Rms',   desc: 'Mechanical resistance — 2π·Fs·Mms / Qms. Calculated by default; type to override. WinISD: Rms' },
  { key: 'Bl',   unit: 'T·m',   sect: 'Derived', label: 'Bl',    desc: 'Motor force factor — √(2π·Fs·Mms·Re / Qes). Calculated by default; type to override. WinISD: Bl' },
  { key: 'Vd',   unit: 'cm³',   sect: 'Derived', label: 'Vd',    desc: 'Volume displacement = Sd × Xmax. Calculated by default; type to override.' },
  { key: 'no',   unit: '%',     sect: 'Derived', label: 'η₀',    desc: 'Reference efficiency — (4π²/c³)·Fs³·Vas/Qes. Calculated by default; type to override. WinISD: Eff', newRow: true },
  { key: 'SPL',  unit: 'dB',    sect: 'Derived', label: '1W/1m', desc: '1W/1m sensitivity = 112.1 + 10·log₁₀(η₀). Calculated by default; type to override. WinISD: SPL' },
  // Physical dimensions — diameters row, axial depths row, misc row
  { key: 'outerMm',    unit: 'mm', sect: 'Dimensions', label: 'Outer ⌀',   desc: 'Overall outer frame diameter (mm). WinISD Dimensions: Outer',               optional: true, dimOnly: true },
  { key: 'basketMm',   unit: 'mm', sect: 'Dimensions', label: 'Basket',    desc: 'Basket/cone height — surround to spider (mm). WinISD Dimensions: Basket',   optional: true, dimOnly: true },
  { key: 'magnetMm',   unit: 'mm', sect: 'Dimensions', label: 'Magnet ⌀',  desc: 'Magnet outer diameter (mm). WinISD Dimensions: Magnet',                    optional: true, dimOnly: true },
  { key: 'depthMm',    unit: 'mm', sect: 'Dimensions', label: 'Depth',     desc: 'Total driver depth front-to-back (mm). WinISD Dimensions: Depth',           optional: true, dimOnly: true },
  { key: 'thickMm',    unit: 'mm', sect: 'Dimensions', label: 'Thick',     desc: 'Flange projection above baffle face (mm). WinISD Dimensions: Thick',        optional: true, dimOnly: true },
  { key: 'magDepthMm', unit: 'mm', sect: 'Dimensions', label: 'MagDpt',    desc: 'Magnet assembly axial depth (mm). WinISD Dimensions: Magnet Depth',         optional: true, dimOnly: true },
  { key: 'vcDiaMm',    unit: 'mm', sect: 'Dimensions', label: 'VCd',       desc: 'Voice coil diameter (mm). WinISD Dimensions: VCd',                          optional: true, dimOnly: true },
  { key: 'weightG',    unit: 'g',  sect: 'Dimensions', label: 'Weight',    desc: 'Driver weight (grams). Reference only.',                                     optional: true, dimOnly: true },
];

const SECTIONS = [
  { id: 'TS',          label: 'Thiele–Small',      hint: 'Any 2 of Qts/Qes/Qms — the third is auto-calculated' },
  { id: 'Piston',      label: 'Piston / Acoustic', hint: 'Enter Sd or cone Dia — the other is calculated' },
  { id: 'Electrical',  label: 'Electrical' },
  { id: 'Performance', label: 'Performance',        hint: 'Optional — enables max-power and max-SPL curves', allOptional: true },
  { id: 'Motor',       label: 'Motor / large-signal', hint: 'Inductance model & voice-coil geometry (WinISD large-signal) — all optional', allOptional: true },
  { id: 'VC',          label: 'Voice coil & thermal', hint: 'VC count/wiring & thermal model — all optional', allOptional: true },
  { id: 'Environment', label: 'Environment',        hint: 'Air constants — defaults c≈343.7 m/s, ρ≈1.2 kg/m³ — all optional', allOptional: true },
  { id: 'Derived',     label: 'Derived values',     hint: 'Calculated from your entries — editable to override, clear to recalculate', isDerived: true },
  { id: 'Dimensions',  label: 'Dimensions',         hint: 'Physical size for cabinet planning (WinISD Dimensions tab) — all optional', allOptional: true },
];

// ── Reactive state ────────────────────────────────────────────────────────
const drvName    = ref('');
const drvBrand   = ref('');
const drvModel   = ref('');
const drvComment = ref('');
const dimExpanded = ref(false);

// entered: key → display-unit string. A field is "entered" (authoritative, state E)
// whenever it holds a non-empty string. Entered values ALWAYS stick — the tool never
// silently rewrites a value you typed. A blank field is calculated from the others
// (state C) when possible, otherwise not-entered (state N). Clear a field to turn it
// back into a calculated one.
const entered = reactive({});
const activeEntered = computed(() =>
  new Set(Object.keys(entered).filter(k => entered[k] !== '')));

// ── Unit conversions ──────────────────────────────────────────────────────
function toSI(key, displayStr) {
  const v = parseFloat(displayStr);
  if (!isFinite(v) || v < 0) return null;
  const p = PARAMS.find(x => x.key === key);
  if (p?.dimOnly) return v > 0 ? v : null;
  switch (key) {
    case 'Le':   return v / 1000;
    case 'Mms':  return v / 1000;
    case 'Cms':  return v / 1000;
    case 'Sd':   return v / 1e4;
    case 'Dia':  return v / 1000;
    case 'Vas':  return v / 1000;
    case 'Xmax': return v / 1000;
    case 'Hc':   return v / 1000;
    case 'Hg':   return v / 1000;
    case 'Vd':   return v / 1e6;
    case 'no':   return v / 100;
    default:     return v;
  }
}

function fmtSI(key, si) {
  if (si == null || !isFinite(si) || si <= 0) return '';
  const p = PARAMS.find(x => x.key === key);
  if (p?.dimOnly) return parseFloat(si.toPrecision(4)).toString();
  let v;
  switch (key) {
    case 'Le':   v = si * 1000;  break;
    case 'Mms':  v = si * 1000;  break;
    case 'Cms':  v = si * 1000;  break;
    case 'Sd':   v = si * 1e4;   break;
    case 'Dia':  v = si * 1000;  break;
    case 'Vas':  v = si * 1000;  break;
    case 'Xmax': v = si * 1000;  break;
    case 'Hc':   v = si * 1000;  break;
    case 'Hg':   v = si * 1000;  break;
    case 'Vd':   v = si * 1e6;   break;
    case 'no':   v = si * 100;   break;
    default:     v = si;
  }
  if (['Qts', 'Qms', 'Qes'].includes(key)) return v.toFixed(3);
  if (key === 'SPL')  return v.toFixed(1);
  if (key === 'no')   return v.toFixed(4);
  if (key === 'Sd')   return v.toFixed(1);
  if (key === 'Vd')   return v.toFixed(1);
  if (key === 'Dia')  return v.toFixed(0);
  if (key === 'Fs')   return v.toFixed(1);
  if (key === 'Rms')  return v.toFixed(3);
  if (key === 'Cms')  return v.toFixed(4);
  if (key === 'Bl')   return v.toFixed(2);
  if (key === 'Vas')  return v.toFixed(3);
  if (key === 'Mms')  return v.toFixed(2);
  return parseFloat(v.toPrecision(4)).toString();
}

// ── Calculation (same equations as engine's deriveDriver) ─────────────────
const resolvedSI = computed(() => {
  const r = {};

  for (const key of activeEntered.value) {
    const str = entered[key];
    if (!str) continue;
    const si = toSI(key, str);
    if (si != null && si > 0) r[key] = si;
  }

  for (let pass = 0; pass < 2; pass++) {
    if (!r.Sd && r.Dia)  r.Sd  = Math.PI * (r.Dia / 2) ** 2;
    if (!r.Dia && r.Sd)  r.Dia = 2 * Math.sqrt(r.Sd / Math.PI);

    if (!r.Qts && r.Qes && r.Qms) r.Qts = r.Qes * r.Qms / (r.Qes + r.Qms);
    if (!r.Qes && r.Qts && r.Qms) r.Qes = r.Qts * r.Qms / (r.Qms - r.Qts);
    if (!r.Qms && r.Qts && r.Qes) r.Qms = r.Qts * r.Qes / (r.Qes - r.Qts);

    // Derived values: `== null` guards so an entered override (state E) is never
    // overwritten by the computed value, and feeds downstream formulas.
    if (r.Fs && r.Vas && r.Sd) {
      const Cas = r.Vas / (RHO * C * C);
      if (r.Cms == null) r.Cms = Cas / (r.Sd * r.Sd);
      if (r.Mms == null) r.Mms = 1 / ((2 * Math.PI * r.Fs) ** 2 * r.Cms);
      if (r.Rms == null && r.Qms) r.Rms = 2 * Math.PI * r.Fs * r.Mms / r.Qms;
      if (r.Bl == null && r.Re && r.Qes) r.Bl = Math.sqrt(2 * Math.PI * r.Fs * r.Mms * r.Re / r.Qes);
    }

    if (r.Vd == null && r.Sd && r.Xmax) r.Vd = r.Sd * r.Xmax;
    if (r.no == null && r.Fs && r.Vas && r.Qes)
      r.no = 4 * Math.PI ** 2 / C ** 3 * r.Fs ** 3 * r.Vas / r.Qes;
    if (r.SPL == null && r.no && r.no > 0) r.SPL = 112.1 + 10 * Math.log10(r.no);
  }

  return r;
});

// E = you typed it (sticks); C = calculated from the others; N = not entered yet.
function stateOf(key) {
  if (activeEntered.value.has(key)) return 'E';
  if (resolvedSI.value[key] != null) return 'C';
  return 'N';
}

function displayVal(key) {
  if (activeEntered.value.has(key)) return entered[key];
  const si = resolvedSI.value[key];
  return si != null ? fmtSI(key, si) : '';
}

function onInput(key, e) {
  const val = e.target.value;
  if (val === '') delete entered[key];
  else entered[key] = val;
}

// ── Validation ────────────────────────────────────────────────────────────
const canApply = computed(() => {
  const si = resolvedSI.value;
  const qCount = [si.Qts, si.Qes, si.Qms].filter(v => v != null).length;
  return !!(si.Fs && si.Sd && si.Re && si.Vas && qCount >= 2);
});

const missing = computed(() => {
  const si = resolvedSI.value;
  const m = [];
  if (!si.Fs)  m.push('Fs');
  if (!si.Re)  m.push('Re');
  if (!si.Sd)  m.push('Sd or Dia');
  if (!si.Vas) m.push('Vas');
  const qCount = [si.Qts, si.Qes, si.Qms].filter(v => v != null).length;
  if (qCount < 2) m.push('at least 2 of Qts/Qes/Qms');
  return m;
});

// A field that is REQUIRED to build the driver but still N reads red (blocking),
// vs. the gentle yellow used for optional not-entered fields.
const Q_KEYS = ['Qts', 'Qes', 'Qms'];
function isRequiredMissing(key) {
  if (stateOf(key) !== 'N') return false;
  const si = resolvedSI.value;
  if (key === 'Fs' || key === 'Re' || key === 'Vas') return true;
  if (key === 'Sd' || key === 'Dia') return si.Sd == null;
  if (Q_KEYS.includes(key)) return Q_KEYS.filter(k => si[k] != null).length < 2;
  return false;
}

// Optional fields that gate specific graphs — leaving them N disables those curves.
const GRAPH_GATES = [
  { key: 'Xmax', graphs: ['Cone excursion', 'Maximum SPL'] },
  { key: 'Pe',   graphs: ['Maximum power', 'Maximum SPL'] },
];
const disabledGraphs = computed(() => {
  const byGraph = {};
  for (const g of GRAPH_GATES) {
    if (resolvedSI.value[g.key] == null) {
      for (const gr of g.graphs) (byGraph[gr] ||= new Set()).add(g.key);
    }
  }
  return Object.entries(byGraph).map(([graph, keys]) => ({ graph, need: [...keys].join(' + ') }));
});

// ── Actions ───────────────────────────────────────────────────────────────
function resetAll() {
  drvName.value = ''; drvBrand.value = ''; drvModel.value = ''; drvComment.value = '';
  Object.keys(entered).forEach(k => delete entered[k]);
}

function applyDriver() {
  if (!canApply.value) return;
  const si = resolvedSI.value;
  const name = drvName.value.trim() ||
    [drvBrand.value, drvModel.value].filter(Boolean).join(' ') || 'Custom Driver';

  const raw = { name };
  if (drvBrand.value.trim())   raw.brand   = drvBrand.value.trim();
  if (drvModel.value.trim())   raw.model   = drvModel.value.trim();
  if (drvComment.value.trim()) raw.comment = drvComment.value.trim();

  if (si.Fs)   raw.Fs   = si.Fs;
  if (si.Qts)  raw.Qts  = si.Qts;
  if (si.Qes)  raw.Qes  = si.Qes;
  if (si.Qms)  raw.Qms  = si.Qms;
  if (si.Re)   raw.Re   = si.Re;
  if (si.Le)   raw.Le   = si.Le;
  if (si.Znom) raw.Z    = si.Znom;
  if (si.Vas)  raw.Vas  = si.Vas;
  if (si.Sd)   raw.Sd   = si.Sd;
  if (si.Xmax) raw.Xmax = si.Xmax;
  if (si.Pe)   raw.Pe   = si.Pe;

  // Physical dimension fields (stored in mm/g as-is from resolvedSI, which passes dimOnly through)
  for (const p of PARAMS.filter(x => x.dimOnly)) {
    const v = si[p.key];
    if (v != null && v > 0) raw[p.key] = v;
  }
  // Note: Bl/Mms/Cms/Rms are NOT stored — engine always recalculates from above

  emit('apply', raw);
}

watch(() => props.open, v => { if (v) { resetAll(); nextTick(() => document.querySelector('.dd-name')?.focus()); } });
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dd-overlay" @click.self="$emit('close')">
      <div class="dd-modal">
        <!-- Header -->
        <div class="dd-header">
          <span>Define Driver Model</span>
          <button class="dd-x" @click="$emit('close')" title="Close">×</button>
        </div>

        <div class="dd-body">
          <!-- Identity -->
          <div class="dd-id-grid">
            <label>Name</label>
            <input class="dd-text dd-name" v-model="drvName"
                   placeholder="Display name (auto-built from Brand + Model if blank)">
            <label>Brand</label>
            <input class="dd-text" v-model="drvBrand" placeholder="e.g. Dayton Audio">
            <label>Model</label>
            <input class="dd-text" v-model="drvModel" placeholder="e.g. RS180-8">
          </div>

          <!-- State legend -->
          <div class="dd-legend">
            <span class="leg-e">E entered</span>
            <span class="leg-c">C calculated</span>
            <span class="leg-n">N not entered</span>
          </div>

          <!-- Parameter table -->
          <div class="dd-table">
            <template v-for="sect in SECTIONS" :key="sect.id">
              <div class="dd-sect-hdr"
                   :class="{ 'hdr-derived': sect.isDerived, 'hdr-optional': sect.allOptional }">
                {{ sect.label }}
                <span v-if="sect.allOptional" class="sect-opt-badge">all optional</span>
              </div>
              <div v-if="sect.hint" class="dd-sect-hint">{{ sect.hint }}</div>

              <!-- Dimensions: measures on the left, diagram on the right. Other sections stack normally. -->
              <div :class="['dd-sect-body', { 'dd-dim-layout': sect.id === 'Dimensions' }]">

              <!-- Driver cross-section diagram for Dimensions section -->
              <div v-if="sect.id === 'Dimensions'" class="dd-dim-wrap" :class="{ 'dd-dim-expanded': dimExpanded }">
                <button class="dd-dim-toggle" @click="dimExpanded = !dimExpanded"
                        :title="dimExpanded ? 'Collapse diagram' : 'Expand diagram'">
                  {{ dimExpanded ? '▲ collapse' : '▼ expand' }}
                </button>
                <!--
                  Cross-section matching WinISD pg4. Front = RIGHT, Back = LEFT.
                  Basket outer frame; two nested magnet rects (motor body + pole piece);
                  two parallel diagonal cone lines per half (cone thickness); flanges at
                  front corners only. All 7 dimensional params labelled.
                  Blue: Thick, Outer ⌀, Depth.  Amber: Basket, Magnet ⌀, MagDpt, VCd.
                -->
                <svg viewBox="0 0 540 450" class="dd-dim-svg" xmlns="http://www.w3.org/2000/svg"
                     @click="dimExpanded = !dimExpanded"
                     :title="dimExpanded ? 'Click to collapse diagram' : 'Click to expand diagram'">
                  <defs>
                    <marker id="dd-arr-s" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 10 1.5 L 0 5 L 10 8.5 Z" fill="#4fb0ff"/>
                    </marker>
                    <marker id="dd-arr-e" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                      <path d="M 0 1.5 L 10 5 L 0 8.5 Z" fill="#4fb0ff"/>
                    </marker>
                  </defs>

                  <!-- Driver geometry (front = RIGHT). Held in a +15,+15 group so the dimension
                       lines/labels can live in the outer 540×450 frame. Ported from the WinISD
                       Dimensions cross-section reference. -->
                  <g transform="translate(15,15)">
                    <!-- Mounting flange (right edge) — taller than the basket connection points -->
                    <rect x="400" y="40" width="10" height="340" fill="#1a2029" stroke="#c9d4e0"
                          stroke-width="1.3" stroke-linejoin="round"/>

                    <!-- Basket chassis: straight diagonal walls + two windows -->
                    <g stroke="#c9d4e0" stroke-width="1.3" fill="none" stroke-linejoin="round" stroke-linecap="round">
                      <path d="M 310 140 L 400 50"/>   <!-- top diagonal wall -->
                      <path d="M 310 280 L 400 370"/>  <!-- bottom diagonal wall -->
                      <path d="M 310 140 L 310 280"/>  <!-- rear vertical wall -->
                      <!-- upper window: outer box masks the bg, inner box = frame border -->
                      <polygon points="330,150 330,180 385,180 385,105" fill="#11151c"/>
                      <polygon points="335,155 335,175 380,175 380,114"/>
                      <!-- lower window -->
                      <polygon points="330,270 330,240 385,240 385,315" fill="#11151c"/>
                      <polygon points="335,265 335,245 380,245 380,306"/>
                    </g>

                    <!-- Rear magnet motor structure -->
                    <g stroke="#c9d4e0" stroke-width="1.3" fill="#1a2029" stroke-linejoin="round">
                      <rect x="235" y="140" width="55" height="140"/> <!-- main magnet core -->
                      <rect x="227" y="150" width="8"  height="120"/> <!-- rear backplate / vent cap -->
                      <rect x="290" y="145" width="20" height="130"/> <!-- front plate junction -->
                    </g>
                  </g>

                  <!-- Dimension lines & extensions (outer frame coords) -->
                  <g stroke="#4fb0ff" stroke-width="0.8" fill="none">
                    <!-- Outer -->
                    <line x1="430" y1="55" x2="480" y2="55"/>
                    <line x1="430" y1="395" x2="480" y2="395"/>
                    <line x1="465" y1="70" x2="465" y2="380" marker-start="url(#dd-arr-s)" marker-end="url(#dd-arr-e)"/>
                    <!-- Basket (dashed extensions) -->
                    <line x1="415" y1="65" x2="155" y2="65" stroke-dasharray="2,2"/>
                    <line x1="415" y1="385" x2="155" y2="385" stroke-dasharray="2,2"/>
                    <line x1="170" y1="80" x2="170" y2="370" marker-start="url(#dd-arr-s)" marker-end="url(#dd-arr-e)"/>
                    <!-- Magnet -->
                    <line x1="250" y1="155" x2="205" y2="155"/>
                    <line x1="250" y1="295" x2="205" y2="295"/>
                    <line x1="215" y1="170" x2="215" y2="280" marker-start="url(#dd-arr-s)" marker-end="url(#dd-arr-e)"/>
                    <!-- Thick -->
                    <line x1="415" y1="55" x2="415" y2="20"/>
                    <line x1="425" y1="55" x2="425" y2="20"/>
                    <line x1="385" y1="25" x2="415" y2="25" marker-end="url(#dd-arr-e)"/>
                    <line x1="455" y1="25" x2="425" y2="25" marker-end="url(#dd-arr-e)"/>
                    <!-- MagDpt -->
                    <line x1="250" y1="295" x2="250" y2="340"/>
                    <line x1="325" y1="295" x2="325" y2="340"/>
                    <line x1="250" y1="330" x2="325" y2="330" marker-start="url(#dd-arr-s)" marker-end="url(#dd-arr-e)"/>
                    <!-- Depth -->
                    <line x1="242" y1="295" x2="242" y2="420"/>
                    <line x1="415" y1="385" x2="415" y2="420"/>
                    <line x1="242" y1="410" x2="415" y2="410" marker-start="url(#dd-arr-s)" marker-end="url(#dd-arr-e)"/>
                  </g>

                  <!-- Labels -->
                  <g font-family="system-ui,sans-serif" font-size="14" fill="#4fb0ff" text-anchor="middle">
                    <text x="482" y="225" transform="rotate(90,482,225)">Outer</text>
                    <text x="153" y="225" transform="rotate(-90,153,225)">Basket</text>
                    <text x="198" y="225" transform="rotate(-90,198,225)">Magnet</text>
                    <text x="420" y="15" font-size="13">Thick</text>
                    <text x="287" y="355">MagDpt</text>
                    <text x="328" y="435">Depth</text>
                  </g>
                </svg>
              </div>

              <div class="dd-grid">
                <div v-for="p in PARAMS.filter(x => x.sect === sect.id)" :key="p.key"
                     class="dd-row"
                     :class="{ 'row-derived': sect.isDerived, 'dd-newrow': p.newRow }"
                     :title="p.desc">
                  <span class="dd-lbl">
                    {{ p.label }}
                    <span v-if="p.optional && !sect.allOptional" class="opt-tag">opt</span>
                  </span>
                  <input class="dd-val" type="number" step="any"
                         :class="['input-' + stateOf(p.key), { 'input-required': isRequiredMissing(p.key) }]"
                         :value="displayVal(p.key)"
                         @input="onInput(p.key, $event)"
                         @focus="e => { if (stateOf(p.key) !== 'E') e.target.select(); }"
                         :title="p.desc">
                  <span class="dd-unit">{{ p.unit }}</span>
                  <span class="dd-badge"
                        :class="[ 'badge-' + stateOf(p.key), { 'badge-required': isRequiredMissing(p.key) } ]">{{ stateOf(p.key) }}</span>
                </div>
              </div>
              </div>
            </template>
          </div>

          <!-- Notes -->
          <div class="dd-notes-wrap">
            <label class="dd-notes-lbl">Notes</label>
            <textarea class="dd-notes" v-model="drvComment" rows="2"
                      placeholder="Optional notes about this driver…"></textarea>
          </div>

          <!-- Missing params hint -->
          <div v-if="!canApply" class="dd-missing">
            Still needed: {{ missing.join(' · ') }}
          </div>

          <!-- Which graphs stay disabled because an optional field is blank.
               Only meaningful once the driver itself is valid — before that the
               required (red) fields block every graph, so the note would mislead. -->
          <div v-if="canApply && disabledGraphs.length" class="dd-graphgate">
            <span class="dd-gg-hd">Graphs disabled by blank fields:</span>
            <span v-for="d in disabledGraphs" :key="d.graph" class="dd-gg">
              {{ d.graph }} <em>(add {{ d.need }})</em>
            </span>
          </div>

          <!-- Reference links -->
          <div class="dd-refs">
            <a href="https://en.wikipedia.org/wiki/Thiele/Small_parameters"
               target="_blank" rel="noopener"
               title="Wikipedia: Thiele/Small parameters — definitions, equations, and units">
              Wikipedia: T/S Parameters
            </a>
            <span class="dd-ref-sep">·</span>
            <a href="https://www.youtube.com/watch?v=JdQ3mLU5zBE"
               target="_blank" rel="noopener"
               title="T/S Parameters Explained — YouTube video guide">
              T/S Parameters Explained ▶
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div class="dd-footer">
          <button @click="resetAll" title="Clear all entered values">Reset</button>
          <span class="dd-sp"></span>
          <button @click="$emit('close')">Cancel</button>
          <button class="pri" :disabled="!canApply" @click="applyDriver"
                  :title="canApply ? 'Load this driver into the current design' : 'Fill in required parameters first'">
            Apply
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dd-overlay {
  position: fixed; inset: 0; background: rgba(4,8,14,.75);
  display: flex; align-items: center; justify-content: center; z-index: 300;
}
.dd-modal {
  width: min(524px, 96vw);
  display: flex; flex-direction: column;
  background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 32px #0009;
}
.dd-header {
  display: flex; align-items: center; padding: 10px 14px;
  border-bottom: 1px solid var(--line); font-weight: 600; font-size: 13px; flex-shrink: 0;
}
.dd-x {
  margin-left: auto; background: none; border: none; color: var(--mut);
  font-size: 20px; cursor: pointer; padding: 0 2px; min-height: unset; line-height: 1;
}
.dd-x:hover { color: var(--fg); }

.dd-body {
  overflow-y: auto;
  max-height: calc(90vh - 96px);
  padding: 10px; display: flex; flex-direction: column; gap: 8px;
}
.dd-body > * { flex-shrink: 0; }

.dd-id-grid { display: grid; grid-template-columns: 52px 1fr; gap: 3px 8px; align-items: center; }
.dd-id-grid label { font-size: 11px; color: var(--mut); text-align: right; }
.dd-text { padding: 3px 6px; background: var(--panel2); border: 1px solid var(--line); border-radius: 4px; color: var(--fg); font: inherit; font-size: 12px; width: 100%; }
.dd-name { border-color: var(--acc); }

/* State legend */
.dd-legend { display: flex; gap: 10px; font-size: 10px; color: var(--mut); padding: 0 2px; }
.leg-e { color: var(--good); font-weight: 700; }
.leg-c { color: var(--acc); font-style: italic; font-weight: 700; }
.leg-n { color: #d8c176; }

.dd-badge { font-size: 9px; font-weight: 700; text-align: center; padding: 0 2px; }
.badge-E { color: var(--good); }
.badge-C { color: var(--acc); }
.badge-N { color: #d8c176; opacity: 0.85; }

.dd-table { border: 1px solid var(--line); border-radius: 5px; overflow: hidden; }

.dd-sect-hdr {
  display: flex; align-items: center; gap: 6px; padding: 3px 8px;
  background: var(--panel2); border-bottom: 1px solid var(--line);
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--acc);
}
.hdr-derived  { color: var(--mut); }
.hdr-optional { color: var(--mut); }
.sect-opt-badge { font-size: 9px; font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--mut); opacity: 0.7; font-style: italic; }

.dd-sect-hint {
  padding: 2px 8px 3px; background: var(--panel2); border-bottom: 1px solid var(--line);
  font-size: 10px; color: var(--mut); font-style: italic;
}

/* Dimensions section: measures on the left, diagram on the right. */
.dd-dim-layout {
  display: flex; align-items: flex-start; gap: 10px; padding: 4px 8px;
  border-bottom: 1px solid var(--line);
}
.dd-dim-layout .dd-grid { order: 1; flex: 0 0 auto; grid-template-columns: max-content; }
.dd-dim-layout .dd-dim-wrap {
  order: 2; flex: 1 1 auto; min-width: 0; padding: 0; background: none; border-bottom: none;
}

/* Dimensions cross-section diagram */
.dd-dim-wrap {
  background: var(--bg); border-bottom: 1px solid var(--line); padding: 4px 8px 4px;
}
.dd-dim-toggle {
  display: block; width: 100%; margin-bottom: 4px;
  background: none; border: none; border-bottom: 1px solid var(--line);
  color: var(--mut); font-size: 10px; padding: 2px 0 4px; text-align: center;
  cursor: pointer;
}
.dd-dim-toggle:hover { color: var(--fg) }
.dd-dim-svg { display: block; width: 100%; max-height: 150px; cursor: zoom-in; }
.dd-dim-expanded .dd-dim-svg { max-height: none; cursor: zoom-out; }

/* Two-column parameter layout (like the WinISD Parameters tab). Each section's
   rows flow row-major into two equal columns; a vertical divider splits them. */
.dd-grid {
  display: grid; grid-template-columns: repeat(3, max-content);
  justify-content: start; column-gap: 10px;
}
/* A field flagged newRow starts a fresh grid row, so related params stay grouped. */
.dd-newrow { grid-column-start: 1; }
@media (max-width: 560px) {
  .dd-grid { grid-template-columns: max-content; }
  .dd-newrow { grid-column-start: auto; }
}

.dd-row {
  display: grid; grid-template-columns: 58px 46px 28px 20px;
  align-items: center; border-bottom: 1px solid var(--line);
}
.row-derived { opacity: 0.7; }

.dd-lbl {
  font-size: 11px; color: var(--mut); padding: 0 6px;
  text-align: right; white-space: nowrap; user-select: none;
  display: flex; align-items: center; justify-content: flex-end; gap: 3px;
}
.opt-tag { font-size: 9px; color: var(--mut); opacity: 0.55; font-style: italic; }

.dd-val {
  width: 100%; padding: 3px 5px; border: none;
  border-left: 1px solid var(--line); border-right: 1px solid var(--line);
  font: inherit; font-size: 11px; font-variant-numeric: tabular-nums;
  text-align: right; outline: none; min-height: 24px;
}
/* No spinners in the editor — up/down steppers only make sense for live what-if
   tweaking in the sidebar, not for typing exact datasheet values here. */
.dd-val::-webkit-outer-spin-button,
.dd-val::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.dd-val { -moz-appearance: textfield; appearance: textfield; }
.dd-val:focus { border-color: var(--acc); position: relative; z-index: 1; }

/* State-specific input colours */
.input-E { background: color-mix(in srgb, #3a3 8%, var(--bg)); color: var(--fg); }
.input-C { background: color-mix(in srgb, var(--acc) 10%, var(--bg)); color: var(--acc); }
/* Not-entered = a gentle, non-alarming yellow prompt (not red — nothing is wrong yet). */
.input-N { background: color-mix(in srgb, #e6c24d 9%, var(--bg)); color: #d8c176; }
/* Required-but-missing = red: this field actually blocks building the driver. */
.input-required { background: color-mix(in srgb, var(--bad) 13%, var(--bg)); color: var(--bad); }
.badge-required { color: var(--bad); opacity: 1; }

/* Read-only derived cells */
.dd-ro-val {
  padding: 3px 5px; font-size: 11px; font-variant-numeric: tabular-nums;
  text-align: right; border-left: 1px solid var(--line); border-right: 1px solid var(--line);
  line-height: 1.45; min-height: 24px; display: flex; align-items: center; justify-content: flex-end;
  font-style: italic;
}
.ro-C { background: color-mix(in srgb, var(--acc) 10%, var(--bg)); color: var(--acc); }
.ro-N { background: var(--bg); color: var(--line); }

.dd-unit { font-size: 10px; color: var(--mut); padding: 0 4px; white-space: nowrap; text-align: left; }

.dd-notes-wrap { display: flex; flex-direction: column; gap: 3px; }
.dd-notes-lbl { font-size: 10.5px; color: var(--mut); }
.dd-notes {
  background: var(--panel2); border: 1px solid var(--line); border-radius: 4px;
  color: var(--fg); font: inherit; font-size: 11px; padding: 4px 6px; resize: vertical; width: 100%;
}

.dd-missing {
  font-size: 10.5px; color: var(--acc2);
  background: rgba(255,180,84,.07); border: 1px solid rgba(255,180,84,.25);
  border-radius: 4px; padding: 5px 8px;
}
/* Info note: which graphs are unavailable because an optional field is blank. */
.dd-graphgate {
  font-size: 10.5px; color: var(--mut);
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 10px;
  padding: 5px 8px; border: 1px solid var(--line); border-radius: 4px;
}
.dd-gg-hd { color: var(--fg); font-weight: 600; }
.dd-gg { white-space: nowrap; }
.dd-gg em { color: var(--acc2); font-style: normal; }
.dd-refs { font-size: 10.5px; color: var(--mut); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.dd-refs a { color: var(--acc); text-decoration: none; }
.dd-refs a:hover { text-decoration: underline; }
.dd-ref-sep { color: var(--line); }

.dd-footer {
  display: flex; gap: 8px; padding: 10px 14px;
  border-top: 1px solid var(--line); align-items: center; flex-shrink: 0;
}
.dd-sp { flex: 1; }
.dd-footer button:disabled { opacity: .4; cursor: not-allowed; }
</style>
