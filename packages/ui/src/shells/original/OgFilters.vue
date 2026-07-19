<script setup lang="ts">
/**
 * Original-skin Filters tab — the mock's `.filters-quickadd` + `.filters-list` markup,
 * wired to the SAME shared filter state (`state.P.filters`) the Modern skin's FiltersPanel
 * uses. This is a per-skin presentation (its own component under shells/original/), not an
 * edit of the shared FiltersPanel — so Modern is untouched (Invariant 1) and the filter
 * logic stays single-sourced in the store + engine.
 *
 * Honesty note: the engine models exactly four filter types (highpass, lowpass, linkwitz,
 * peaking — packages/engine/src/types.ts FilterType). The mock's other four quick-add
 * buttons (Allpass, DLP, Static gain, Peaking-2nd-order-HP) have no engine model, so they
 * are intentionally omitted rather than added as controls that do nothing.
 */
import { ref } from 'vue';
import { state } from '../../store.js';
import type { Filter, FilterType } from '@openisd/engine';

const QUICK_ADD: { type: FilterType; label: string; badge: string }[] = [
  { type: 'highpass', label: '+ HP',  badge: 'HP' },
  { type: 'lowpass',  label: '+ LP',  badge: 'LP' },
  { type: 'linkwitz', label: '+ LT',  badge: 'LT' },
  { type: 'peaking',  label: '+ PEQ', badge: 'PEQ' },
];
const BADGE: Record<FilterType, string> = { highpass: 'HP', lowpass: 'LP', linkwitz: 'LT', peaking: 'PEQ' };
// Same field defaults the shared FiltersPanel uses — one source of truth for the shape.
const DEFAULTS: Record<FilterType, Record<string, number>> = {
  highpass: { fc: 80,  Q: 0.7071 },
  lowpass:  { fc: 200, Q: 0.7071 },
  linkwitz: { f0: 50,  Q0: 0.7, fp: 20, Qp: 0.5 },
  peaking:  { fc: 300, Q: 1.0, gain: -6 },
};

const editing = ref<string | null>(null);

function addFilter(type: FilterType) {
  const flt = { id: crypto.randomUUID(), type, enabled: true, ...DEFAULTS[type] };
  state.P.filters.push(flt);
  editing.value = flt.id;
}
function removeFilter(i: number) {
  const removed = state.P.filters[i];
  state.P.filters.splice(i, 1);
  if (editing.value === removed.id) editing.value = null;
}
function toggleEdit(id: string | undefined) { editing.value = editing.value === id ? null : (id ?? null); }

function fnum(v: number | undefined, dp: number): string { return v != null && isFinite(v) ? v.toFixed(dp) : '—'; }
function summary(f: Filter): string {
  if (f.type === 'linkwitz') return `f0 ${fnum(f.f0, 0)} / fp ${fnum(f.fp, 0)} Hz`;
  if (f.type === 'peaking')  return `fc ${fnum(f.fc, 0)} Hz · Q ${fnum(f.Q, 2)} · ${fnum(f.gain, 1)} dB`;
  return `fc ${fnum(f.fc, 0)} Hz · Q ${fnum(f.Q, 3)}`;
}
</script>

<template>
  <section class="og-filters">
    <div class="filters-quickadd">
      <button v-for="q in QUICK_ADD" :key="q.type" class="action-btn" @click="addFilter(q.type)">{{ q.label }}</button>
    </div>

    <div class="filters-list">
      <p v-if="!state.P.filters.length" class="hint" style="padding:8px 10px">No filters active.</p>
      <div v-for="(f, i) in state.P.filters" :key="f.id"
           class="filter-row-inline" :class="{ editing: editing === f.id, 'filter-disabled': !f.enabled }">
        <div class="filter-row-head">
          <input type="checkbox" v-model="f.enabled" title="Bypass / enable this filter" @click.stop>
          <span class="filter-type-badge">{{ BADGE[f.type] }}</span>
          <span class="filter-summary" @click="toggleEdit(f.id)">{{ summary(f) }}</span>
          <span class="filter-edit-hint" @click="toggleEdit(f.id)">✎ edit</span>
          <button class="filter-del" title="Remove this filter" @click.stop="removeFilter(i)">×</button>
        </div>

        <div v-if="editing === f.id" class="filter-edit-body">
          <template v-if="f.type === 'highpass' || f.type === 'lowpass' || f.type === 'peaking'">
            <label>fc <input v-expo-step type="number" step="1" min="1" v-model.number="f.fc"> Hz</label>
            <label>Q <input v-expo-step type="number" step="0.01" min="0.1" v-model.number="f.Q"></label>
          </template>
          <template v-if="f.type === 'peaking'">
            <label>Gain <input v-expo-step type="number" step="0.5" v-model.number="f.gain"> dB</label>
          </template>
          <template v-if="f.type === 'linkwitz'">
            <label>f0 <input v-expo-step type="number" step="1" min="1" v-model.number="f.f0"> Hz</label>
            <label>Q0 <input v-expo-step type="number" step="0.01" min="0.1" v-model.number="f.Q0"></label>
            <label>fp <input v-expo-step type="number" step="1" min="1" v-model.number="f.fp"> Hz</label>
            <label>Qp <input v-expo-step type="number" step="0.01" min="0.1" v-model.number="f.Qp"></label>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Ported from mock/style.css (.filters-quickadd / .filters-list / .filter-row-*). */
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
.filter-edit-body input { width:70px; border:1px solid #999; border-radius:2px; padding:3px 5px; font:inherit; }
</style>
