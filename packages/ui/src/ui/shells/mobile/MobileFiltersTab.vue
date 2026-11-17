<script setup lang="ts">
// The mobile Filters tab: the quick-add chips (one line, a carousel with ‹ › beside it showing more filter
// types exist) and one card per filter. Thin: all state and domain reads/writes live in
// useMobileFiltersTab() (src/hooks/MobileFiltersTab-hooks.ts); the cards' words and rows come from
// packages/design.
import {onBeforeUnmount, onMounted, ref} from 'vue';
import {PhoneHelp, PHONE_FILTER_CHIPS} from '@openisd/design/fields';
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

const strip = ref<HTMLElement | null>(null);
const atStart = ref(true);
const atEnd = ref(false);
/** How far the chip strip has scrolled decides which ‹ › shows. */
function readScroll(): void {
  const el = strip.value;
  if (el === null) return;
  atStart.value = el.scrollLeft <= 1;
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
}
function scrollStrip(direction: -1 | 1): void {
  const el = strip.value;
  if (el !== null) el.scrollBy({left: direction * el.clientWidth * 0.7, behavior: 'smooth'});
}
let resize: ResizeObserver | null = null;
onMounted(() => {
  readScroll();
  if (strip.value !== null) { resize = new ResizeObserver(readScroll); resize.observe(strip.value); }
});
onBeforeUnmount(() => resize?.disconnect());
</script>

<template>
  <PhoneClassicPage>
    <PhoneBand :section="PhoneHelp.ADD_FILTER" />
    <div class="mob-fstrip-wrap" :class="{'at-start': atStart, 'at-end': atEnd}">
      <PhoneButton class="mob-fstrip-nav mob-fstrip-prev" aria-label="Earlier filter types" @click="scrollStrip(-1)">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </PhoneButton>
      <div ref="strip" class="mob-fstrip" data-carousel @scroll.passive="readScroll">
        <PhoneButton v-for="c in PHONE_FILTER_CHIPS" :key="c.type" @click="api.add(c.type)">+ {{ c.short }}</PhoneButton>
      </div>
      <PhoneButton class="mob-fstrip-nav mob-fstrip-next" aria-label="More filter types" @click="scrollStrip(1)">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </PhoneButton>
    </div>
    <p v-if="!filters.length" class="mob-chint">No filters active.</p>
    <MobileFilterCard v-for="(f, i) in filters" :key="f.id ?? i" :f="f" :api="api" :open="isOpen(f.id)"
                      @toggle="toggle(f.id)" @remove="f.id !== undefined && api.remove(f.id)" />
  </PhoneClassicPage>
</template>

<style scoped>
/* The arrows sit beside the strip, never over a chip; each goes at the end where there is nothing more to see. */
.mob-fstrip-wrap { display: flex; align-items: center; gap: 4px; padding: 0 8px; }
.mob-fstrip { flex: 1 1 0; min-width: 0; display: flex; gap: 6px; padding: 6px 4px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; }
.mob-fstrip::-webkit-scrollbar { display: none; }
.mob-fstrip .mob-btn { flex: none; padding: 0 12px; white-space: nowrap; font-size: 13px; }
.mob-fstrip-nav { flex: none; width: var(--mob-button-h); padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%; border-color: #d0d0d0; background: #fff; color: #333; }
.mob-fstrip-nav svg { fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.mob-fstrip-wrap.at-start .mob-fstrip-prev, .mob-fstrip-wrap.at-end .mob-fstrip-next { display: none; }
</style>
