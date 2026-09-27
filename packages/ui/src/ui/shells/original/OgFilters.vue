<script setup lang="ts">
/**
 * Filters tab — the `.filters-quickadd` + `.filters-list` markup. Presentation only: the
 * list, add, remove and patch live in `hooks/OgFilters-hooks.ts` (`createOgFilters`), the
 * starting values of a new filter and its row caption are both the engine's
 * (`Engine.defaultFilter`, `Engine.filterCaption`, both reached via `api`). This file owns
 * which row is open for editing and dispatches to one editor component per filter type
 * (`./filters/*Editor.vue`), nothing else.
 *
 * Each editor takes its own narrowed `Filter` variant as a typed prop and emits `replace` with
 * a value of that SAME variant; `replace` below hands the whole filter to `api.replaceFilter` —
 * never a per-field string route.
 */
import {ref} from 'vue';
import type {Filter, FilterType} from '@openisd/design/engine';
import {inputChecked} from '../../../logic/domEvents.js';
import type {OgFiltersAPI} from '../../../hooks/OgFilters-hooks.js';
import PassFilterEditor from './filters/PassFilterEditor.vue';
import AllpassEditor from './filters/AllpassEditor.vue';
import LinkwitzTransformEditor from './filters/LinkwitzTransformEditor.vue';
import ParametricEqEditor from './filters/ParametricEqEditor.vue';
import PeakHighpassEditor from './filters/PeakHighpassEditor.vue';
import StaticGainEditor from './filters/StaticGainEditor.vue';
import RaisedCosineEditor from './filters/RaisedCosineEditor.vue';
import ShelfEditor from './filters/ShelfEditor.vue';

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

/** Which row is open for editing — presentation state, this tab's alone. */
const editing = ref<string | null>(null);

function addFilter(type: FilterType) { editing.value = api.addFilter(type); }
function removeFilter(id: string | undefined) {
  if (!id) return;
  api.removeFilter(id);
  if (editing.value === id) editing.value = null;
}
function toggleEdit(id: string | undefined) { editing.value = editing.value === id ? null : (id ?? null); }

/** The one place that calls into the API — every editor emits `next`, this sends it. */
function replace(f: Filter, next: Filter): void {
  if (f.id === undefined) return;
  api.replaceFilter(f.id, next);
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
          <span class="filter-summary" @click="toggleEdit(f.id)">{{ api.caption(f) }}</span>
          <span class="filter-edit-hint" @click="toggleEdit(f.id)">✎ edit</span>
          <button class="filter-del" title="Remove this filter" @click.stop="removeFilter(f.id)">×</button>
        </div>

        <template v-if="editing === f.id">
          <PassFilterEditor          v-if="f.type === 'lowpass' || f.type === 'highpass'" :f="f" :api="api" @replace="next => replace(f, next)" />
          <AllpassEditor             v-else-if="f.type === 'allpass'" :f="f" :api="api" @replace="next => replace(f, next)" />
          <LinkwitzTransformEditor   v-else-if="f.type === 'linkwitz'" :f="f" :api="api" @replace="next => replace(f, next)" />
          <ParametricEqEditor        v-else-if="f.type === 'peaking'" :f="f" :api="api" @replace="next => replace(f, next)" />
          <PeakHighpassEditor        v-else-if="f.type === 'peakHighpass'" :f="f" :api="api" @replace="next => replace(f, next)" />
          <StaticGainEditor          v-else-if="f.type === 'staticGain'" :f="f" :api="api" @replace="next => replace(f, next)" />
          <RaisedCosineEditor        v-else-if="f.type === 'raisedCosine'" :f="f" :api="api" @replace="next => replace(f, next)" />
          <ShelfEditor               v-else-if="f.type === 'lowshelf' || f.type === 'highshelf'" :f="f" :api="api" @replace="next => replace(f, next)" />
        </template>
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
</style>

<!--
  Unscoped on purpose: each `filter-edit-body` now lives inside its own `./filters/*Editor.vue`
  component (a different SFC scope), not inside this file's template. Vue's scoped CSS only
  reaches elements written in the SFC that declares it, so a `scoped` rule here could never
  match an editor's own `<label>`/`<input>`/`<select>` — these four rules are shared layout
  for every editor and are kept here, unscoped, rather than duplicated eight times.
-->
<style>
.filter-edit-body { display:flex; flex-wrap:wrap; gap:10px 16px; padding:6px 12px 10px 30px; font-size:12px; }
.filter-edit-body label { display:flex; align-items:center; gap:5px; color:#333; }
.filter-edit-body input, .filter-edit-body select { border:1px solid #999; border-radius:2px; padding:3px 5px; font:inherit; }
.filter-edit-body input { width:70px; }
</style>
