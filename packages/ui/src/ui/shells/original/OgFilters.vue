<script setup lang="ts">
/**
 * Filters tab — the `.filters-quickadd` + `.filters-list` markup. Presentation only: the
 * list, add, remove and patch live in `hooks/OgFilters-hooks.ts` (`createOgFilters`), the
 * starting values of a new filter in the engine (`Engine.defaultFilter`), and the row caption
 * in `logic/filterCaption.ts`. This file owns which row is open for editing and the per-type
 * field layout, nothing else.
 *
 * Editing builds the next value of the SAME variant, then hands the WHOLE filter to
 * `api.replaceFilter` — never a per-field string route. Each `*Next` function below narrows
 * `f.type` itself (a template `v-if` narrows `f` for a direct member read inside its own
 * block, but that narrowing does not survive being passed as an argument across a function
 * call), and returns null when `f` is not that family — `replace` then no-ops, so a stray call
 * from the wrong block is inert rather than a crash.
 */
import {ref} from 'vue';
import {limits} from '../../../logic/fields/uiFields.js';
import type {Filter, FilterType, PassFamily} from '@openisd/design/engine';
import type {SelectorOption} from '@openisd/design/fields';
import {inputChecked, inputValue, selectedOption} from '../../../logic/domEvents.js';
import type {OgFiltersAPI} from '../../../hooks/OgFilters-hooks.js';
import {filterCaption} from '../../../logic/filterCaption.js';

const {api} = defineProps<{ api: OgFiltersAPI }>();
const filters = api.filters;

/** One quick-add button per type, WinISD's Filter Editor "Filter type" order, then the two
 *  OpenISD-only shelves. */
const QUICK_ADD: { type: FilterType; label: string }[] = [
  { type: 'lowpass',      label: '+ LP' },
  { type: 'highpass',     label: '+ HP' },
  { type: 'allpass',      label: '+ AP' },
  { type: 'linkwitz',     label: '+ LT' },
  { type: 'peaking',      label: '+ PEQ' },
  { type: 'peakHighpass', label: '+ Peak HP' },
  { type: 'staticGain',   label: '+ Gain' },
  { type: 'raisedCosine', label: '+ DLP' },
  { type: 'lowshelf',     label: '+ LS' },
  { type: 'highshelf',    label: '+ HS' },
];
const BADGE: Record<FilterType, string> = {
  lowpass: 'LP', highpass: 'HP', allpass: 'AP', linkwitz: 'LT', peaking: 'PEQ',
  peakHighpass: 'PHP', staticGain: 'GAIN', raisedCosine: 'DLP', lowshelf: 'LS', highshelf: 'HS',
};

/** Lowpass/highpass "Subtype" choices, WinISD's Filter Editor order and wording. */
const PASS_FAMILY_OPTIONS: readonly SelectorOption<PassFamily>[] = [
  { value: 'butterworth',   label: 'Butterworth' },
  { value: 'linkwitzRiley', label: 'Linkwitz-Riley (4th order only)' },
  { value: 'bessel',        label: 'Bessel' },
  { value: 'sos',           label: 'SOS, User specified fc and Q' },
];

/** Which row is open for editing — presentation state, this tab's alone. */
const editing = ref<string | null>(null);

function addFilter(type: FilterType) { editing.value = api.addFilter(type); }
function removeFilter(id: string | undefined) {
  if (!id) return;
  api.removeFilter(id);
  if (editing.value === id) editing.value = null;
}
function toggleEdit(id: string | undefined) { editing.value = editing.value === id ? null : (id ?? null); }
function numFrom(e: Event): number { return Number(inputValue(e)); }
function intFrom(e: Event): number { return Math.round(numFrom(e)); }

/** The one place that calls into the API — every editor below builds `next`, this sends it. */
function replace(f: Filter, next: Filter | null): void {
  if (f.id === undefined || next === null) return;
  api.replaceFilter(f.id, next);
}

// ---- Per-family "next value" builders — one per WinISD Filter Editor family. ------------------
function passFamilyNext(f: Filter, e: Event): Filter | null {
  if (f.type !== 'lowpass' && f.type !== 'highpass') return null;
  const family = selectedOption(e, PASS_FAMILY_OPTIONS);
  return family === null ? null : {...f, family};
}
function passFilterNext(f: Filter, patch: Partial<Pick<Filter & { type: 'lowpass' | 'highpass' }, 'order' | 'fc' | 'Q'>>): Filter | null {
  if (f.type !== 'lowpass' && f.type !== 'highpass') return null;
  return {...f, ...patch};
}
function allpassNext(f: Filter, patch: Partial<Pick<Filter & { type: 'allpass' }, 'order' | 't' | 'Q'>>): Filter | null {
  if (f.type !== 'allpass') return null;
  return {...f, ...patch};
}
function linkwitzNext(f: Filter, patch: Partial<Pick<Filter & { type: 'linkwitz' }, 'f0' | 'Q0' | 'fp' | 'Qp'>>): Filter | null {
  if (f.type !== 'linkwitz') return null;
  return {...f, ...patch};
}
function peakingNext(f: Filter, patch: Partial<Pick<Filter & { type: 'peaking' }, 'fc' | 'Q' | 'gain'>>): Filter | null {
  if (f.type !== 'peaking') return null;
  return {...f, ...patch};
}
function peakHighpassNext(f: Filter, patch: Partial<Pick<Filter & { type: 'peakHighpass' }, 'fpk' | 'gainPk'>>): Filter | null {
  if (f.type !== 'peakHighpass') return null;
  return {...f, ...patch};
}
function staticGainNext(f: Filter, gain: number): Filter | null {
  if (f.type !== 'staticGain') return null;
  return {...f, gain};
}
function raisedCosineNext(f: Filter, patch: Partial<Pick<Filter & { type: 'raisedCosine' }, 'fc' | 'bwOct' | 'gain'>>): Filter | null {
  if (f.type !== 'raisedCosine') return null;
  return {...f, ...patch};
}
function shelfNext(f: Filter, patch: Partial<Pick<Filter & { type: 'lowshelf' | 'highshelf' }, 'fc' | 'Q' | 'gain'>>): Filter | null {
  if (f.type !== 'lowshelf' && f.type !== 'highshelf') return null;
  return {...f, ...patch};
}
</script>

<template>
  <section class="og-filters">
    <div class="filters-quickadd">
      <button v-for="q in QUICK_ADD" :key="q.type" class="action-btn" @click="addFilter(q.type)">{{ q.label }}</button>
    </div>

    <div class="filters-list">
      <p v-if="!filters.length" class="hint" style="padding:8px 10px">No filters active.</p>
      <div v-for="(f, i) in filters" :key="f.id ?? i"
           class="filter-row-inline" :class="{ editing: editing === f.id, 'filter-disabled': !f.enabled }">
        <div class="filter-row-head">
          <input type="checkbox" :checked="f.enabled" title="Bypass / enable this filter" @click.stop
                 @change="replace(f, {...f, enabled: inputChecked($event)})">
          <span class="filter-type-badge">{{ BADGE[f.type] }}</span>
          <span class="filter-summary" @click="toggleEdit(f.id)">{{ filterCaption(f) }}</span>
          <span class="filter-edit-hint" @click="toggleEdit(f.id)">✎ edit</span>
          <button class="filter-del" title="Remove this filter" @click.stop="removeFilter(f.id)">×</button>
        </div>

        <div v-if="editing === f.id" class="filter-edit-body">
          <template v-if="f.type === 'lowpass' || f.type === 'highpass'">
            <label>Subtype
              <select :value="f.family" @change="replace(f, passFamilyNext(f, $event))">
                <option v-for="o in PASS_FAMILY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </label>
            <label>Order <input type="number" step="1" v-limits="limits('filterOrder')" :value="f.order" @change="replace(f, passFilterNext(f, {order: intFrom($event)}))"></label>
            <label>Q <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q" @change="replace(f, passFilterNext(f, {Q: numFrom($event)}))"></label>
            <label>Cutoff <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fc" @change="replace(f, passFilterNext(f, {fc: numFrom($event)}))"> Hz</label>
          </template>

          <template v-if="f.type === 'allpass'">
            <label>Order <input type="number" step="1" v-limits="limits('filterOrder')" :value="f.order" @change="replace(f, allpassNext(f, {order: intFrom($event)}))"></label>
            <label>Q <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q" @change="replace(f, allpassNext(f, {Q: numFrom($event)}))"></label>
            <label>t <input v-expo-step type="number" step="0.001" v-limits="limits('filterT')" :value="f.t" @change="replace(f, allpassNext(f, {t: numFrom($event)}))"> s</label>
          </template>

          <template v-if="f.type === 'linkwitz'">
            <label>f0 <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.f0" @change="replace(f, linkwitzNext(f, {f0: numFrom($event)}))"> Hz</label>
            <label>Q0 <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q0" @change="replace(f, linkwitzNext(f, {Q0: numFrom($event)}))"></label>
            <label>fp <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fp" @change="replace(f, linkwitzNext(f, {fp: numFrom($event)}))"> Hz</label>
            <label>Qp <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Qp" @change="replace(f, linkwitzNext(f, {Qp: numFrom($event)}))"></label>
          </template>

          <template v-if="f.type === 'peaking'">
            <label>fc <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fc" @change="replace(f, peakingNext(f, {fc: numFrom($event)}))"> Hz</label>
            <label>Gain <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gain" @change="replace(f, peakingNext(f, {gain: numFrom($event)}))"> dB</label>
            <label>Q <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q" @change="replace(f, peakingNext(f, {Q: numFrom($event)}))"></label>
          </template>

          <template v-if="f.type === 'peakHighpass'">
            <label>Gpk <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gainPk" @change="replace(f, peakHighpassNext(f, {gainPk: numFrom($event)}))"> dB</label>
            <label>fpk <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fpk" @change="replace(f, peakHighpassNext(f, {fpk: numFrom($event)}))"> Hz</label>
          </template>

          <template v-if="f.type === 'staticGain'">
            <label>Gain <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gain" @change="replace(f, staticGainNext(f, numFrom($event)))"> dB</label>
          </template>

          <template v-if="f.type === 'raisedCosine'">
            <label>fc <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fc" @change="replace(f, raisedCosineNext(f, {fc: numFrom($event)}))"> Hz</label>
            <label>Gain <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gain" @change="replace(f, raisedCosineNext(f, {gain: numFrom($event)}))"> dB</label>
            <label>BW <input v-expo-step type="number" step="0.01" v-limits="limits('filterBw')" :value="f.bwOct" @change="replace(f, raisedCosineNext(f, {bwOct: numFrom($event)}))"> oct</label>
          </template>

          <template v-if="f.type === 'lowshelf' || f.type === 'highshelf'">
            <label>fc <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fc" @change="replace(f, shelfNext(f, {fc: numFrom($event)}))"> Hz</label>
            <label>Q <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q" @change="replace(f, shelfNext(f, {Q: numFrom($event)}))"></label>
            <label>Gain <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gain" @change="replace(f, shelfNext(f, {gain: numFrom($event)}))"> dB</label>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.og-filters { display:flex; flex-direction:column; min-height:0; }
.filters-quickadd { flex:none; display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
.action-btn { background:#f0f0f0; border:1px solid #999; border-radius:3px; padding:4px 10px; cursor:pointer; font:inherit; }
.action-btn:hover { background:#dbeaff; border-color:#7fb3ff; }
.filters-list { flex:1 1 auto; min-height:0; border:1px solid #999; background:#fff; overflow:auto; }
.filter-row-inline { border-bottom:1px solid #eee; }
.filter-row-head { display:flex; align-items:center; gap:8px; padding:6px 10px; cursor:pointer; }
.filter-row-head:hover { background:#f5f8fc; }
.filter-type-badge { font-weight:600; }
.filter-summary { color:#555; flex:1; }
.filter-summary::before { content:"\2014\00a0"; color:#bbb; }
.filter-edit-hint { color:#6a8cae; font-size:12px; opacity:0; }
.filter-row-head:hover .filter-edit-hint { opacity:.8; }
.filter-row-inline.editing { background:#eef4ff; }
.filter-disabled .filter-type-badge, .filter-disabled .filter-summary { opacity:.45; text-decoration:line-through; }
.filter-del { border:none; background:none; color:#b02a2a; cursor:pointer; padding:2px 6px; }
.filter-del:hover { background:#fbdada; border-radius:3px; }
.filter-edit-body { display:flex; flex-wrap:wrap; gap:10px 16px; padding:6px 12px 10px 30px; font-size:12px; }
.filter-edit-body label { display:flex; align-items:center; gap:5px; color:#333; }
.filter-edit-body input, .filter-edit-body select { border:1px solid #999; border-radius:2px; padding:3px 5px; font:inherit; }
.filter-edit-body input { width:70px; }
</style>
