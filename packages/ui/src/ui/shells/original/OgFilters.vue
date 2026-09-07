<script setup lang="ts">
/**
 * Filters tab — the `.filters-quickadd` + `.filters-list` markup, wired to the project's
 * filter chain. Presentation only: the filter logic is single-sourced in the domain object and
 * the engine.
 *
 * No live mirror array, no deep watch. Every read is `project.filters()` (a fresh copy,
 * reactive via the focused-project injection); every write is a per-filter mutator
 * (`addFilter`/`removeFilter`/`setFilter(id, patch)`) straight through to it — the
 * delegate-free pattern `docs/design/REACTIVITY.md` specifies, applied to an ARRAY of records
 * instead of one flat bag. A local mutable draft synced by a bidirectional watch (the earlier
 * shape here) replaces the array under the user's cursor on every external notification,
 * including the one its own write causes — editing field A while the pull from that write is
 * in flight could stomp field B's in-progress keystroke. Per-field patches have no such
 * window: each write names exactly the filter and field it changes, nothing else is touched,
 * and there is nothing to pull back.
 *
 * Honesty note: the engine models exactly four filter types (highpass, lowpass, linkwitz,
 * peaking — @openisd/design/engine FilterType). The other four quick-add buttons
 * WinISD offers (Allpass, DLP, Static gain, Peaking-2nd-order-HP) have no engine model, so
 * they are intentionally omitted rather than added as controls that do nothing.
 */
import { computed, ref } from 'vue';
import { useFocusedProject } from '../../../logic/focusedProjectContext.js';
import { limits } from '../../../logic/fields/fieldRegistry.js';
import type { Filter, FilterType } from '@openisd/design/engine';
import { inputValue, inputChecked } from '../../../logic/domEvents.js';

const project = useFocusedProject();
const filters = computed<readonly Filter[]>(() => project.value.filters.get());

// Order: LP, HP, …, LT, …, PEQ, with the four engine-unsupported types (AP, Peak, DLP,
// Gain) omitted — see honesty note above.
const QUICK_ADD: { type: FilterType; label: string }[] = [
  { type: 'lowpass',  label: '+ LP' },
  { type: 'highpass', label: '+ HP' },
  { type: 'linkwitz', label: '+ LT' },
  { type: 'peaking',  label: '+ PEQ' },
  { type: 'lowshelf',  label: '+ LS' },
  { type: 'highshelf', label: '+ HS' },
];
const BADGE: Record<FilterType, string> = { highpass: 'HP', lowpass: 'LP', linkwitz: 'LT', peaking: 'PEQ', lowshelf: 'LS', highshelf: 'HS' };
const DEFAULTS: Record<FilterType, Record<string, number>> = {
  highpass: { fc: 80,  Q: 0.7071 },
  lowpass:  { fc: 200, Q: 0.7071 },
  linkwitz: { f0: 50,  Q0: 0.7, fp: 20, Qp: 0.5 },
  peaking:  { fc: 300, Q: 1.0, gain: -6 },
  lowshelf:  { fc: 150,  Q: 0.7071, gain: 6 },
  highshelf: { fc: 2000, Q: 0.7071, gain: 6 },
};

const editing = ref<string | null>(null);

function addFilter(type: FilterType) {
  const flt: Filter = { id: crypto.randomUUID(), type, enabled: true, ...DEFAULTS[type] };
  project.value.filters.set([...project.value.filters.get(), flt]);
  editing.value = flt.id ?? null;
}
function removeFilter(id: string | undefined) {
  if (!id) return;
  project.value.filters.set(project.value.filters.get().filter(f => f.id !== id));
  if (editing.value === id) editing.value = null;
}
function toggleEdit(id: string | undefined) { editing.value = editing.value === id ? null : (id ?? null); }

/** One input's `@input`/`@change` handler: patches exactly this filter's named field. */
function patch(id: string | undefined, field: keyof Filter, value: number | boolean) {
  if (!id) return;
  project.value.filters.set(
    project.value.filters.get().map(f => f.id === id ? { ...f, [field]: value } as Filter : f));
}
function numFrom(e: Event): number { return Number(inputValue(e)); }

function fnum(v: number | undefined, dp: number): string { return v != null && isFinite(v) ? v.toFixed(dp) : '—'; }
function summary(f: Filter): string {
  if (f.type === 'linkwitz') return `f0 ${fnum(f.f0, 0)} / fp ${fnum(f.fp, 0)} Hz`;
  if (f.type === 'peaking')  return `fc ${fnum(f.fc, 0)} Hz · Q ${fnum(f.Q, 2)} · ${fnum(f.gain, 1)} dB`;
  if (f.type === 'lowshelf' || f.type === 'highshelf') return `fc ${fnum(f.fc, 0)} Hz · Q ${fnum(f.Q, 2)} · ${fnum(f.gain, 1)} dB`;
  return `fc ${fnum(f.fc, 0)} Hz · Q ${fnum(f.Q, 3)}`;
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
                 @change="patch(f.id, 'enabled', inputChecked($event))">
          <span class="filter-type-badge">{{ BADGE[f.type] }}</span>
          <span class="filter-summary" @click="toggleEdit(f.id)">{{ summary(f) }}</span>
          <span class="filter-edit-hint" @click="toggleEdit(f.id)">✎ edit</span>
          <button class="filter-del" title="Remove this filter" @click.stop="removeFilter(f.id)">×</button>
        </div>

        <div v-if="editing === f.id" class="filter-edit-body">
          <template v-if="f.type === 'highpass' || f.type === 'lowpass' || f.type === 'peaking' || f.type === 'lowshelf' || f.type === 'highshelf'">
            <label>fc <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fc" @change="patch(f.id, 'fc', numFrom($event))"> Hz</label>
            <label>Q <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q" @change="patch(f.id, 'Q', numFrom($event))"></label>
          </template>
          <template v-if="f.type === 'peaking' || f.type === 'lowshelf' || f.type === 'highshelf'">
            <label>Gain <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gain" @change="patch(f.id, 'gain', numFrom($event))"> dB</label>
          </template>
          <template v-if="f.type === 'linkwitz'">
            <label>f0 <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.f0" @change="patch(f.id, 'f0', numFrom($event))"> Hz</label>
            <label>Q0 <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q0" @change="patch(f.id, 'Q0', numFrom($event))"></label>
            <label>fp <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fp" @change="patch(f.id, 'fp', numFrom($event))"> Hz</label>
            <label>Qp <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Qp" @change="patch(f.id, 'Qp', numFrom($event))"></label>
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
.filter-edit-body input { width:70px; border:1px solid #999; border-radius:2px; padding:3px 5px; font:inherit; }
</style>
