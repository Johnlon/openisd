<script setup lang="ts">
// The mobile Filters tab: the quick-add chips (they wrap onto as many lines as the width needs, so
// none is cut and nothing scrolls sideways) and one card per filter. Thin: all state and domain reads/writes live in
// useMobileFiltersTab() (src/hooks/MobileFiltersTab-hooks.ts); the cards' words and rows come from
// packages/design.
import {ref} from 'vue';
import {PhoneHelp, PhoneRowColumns, PHONE_FILTER_CHIPS} from '@openisd/design/fields';
import PhoneBand from './PhoneBand.vue';
import PhoneButton from './PhoneButton.vue';
import PhoneClassicPage from './PhoneClassicPage.vue';
import MobileFilterCard from './MobileFilterCard.vue';
import {useMobileFiltersTab} from '../../../hooks/MobileFiltersTab-hooks.js';

const api = useMobileFiltersTab();
const filters = api.filters;

/** The filters folded shut; a filter is open until its header is tapped. */
const shut = ref<readonly string[]>([]);
function isOpen(id: string | undefined): boolean { return id === undefined || !shut.value.includes(id); }
function toggle(id: string | undefined): void {
  if (id === undefined) return;
  shut.value = shut.value.includes(id) ? shut.value.filter(s => s !== id) : [...shut.value, id];
}
</script>

<template>
  <PhoneClassicPage :columns="PhoneRowColumns.SHORT_LABEL">
    <PhoneBand :section="PhoneHelp.ADD_FILTER" />
    <div class="mob-fstrip">
      <PhoneButton v-for="c in PHONE_FILTER_CHIPS" :key="c.type" @click="api.add(c.type)">+ {{ c.short }}</PhoneButton>
    </div>
    <p v-if="!filters.length" class="mob-chint">No filters active.</p>
    <MobileFilterCard v-for="(f, i) in filters" :key="f.id ?? i" :f="f" :api="api" :open="isOpen(f.id)"
                      @toggle="toggle(f.id)" @remove="f.id !== undefined && api.remove(f.id)" />
  </PhoneClassicPage>
</template>

<style scoped>
.mob-fstrip { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 12px; }
.mob-fstrip .mob-btn { flex: none; padding: 0 12px; white-space: nowrap; }
</style>
