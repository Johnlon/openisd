<script setup lang="ts">
// The mobile Filters tab — thin: all state and domain reads/writes live in
// useMobileFiltersTab() (src/hooks/MobileFiltersTab-hooks.ts). The actual list/quick-add/editor
// UI is OriginalFilters.vue itself, reused unchanged (it's already presentation-only, taking its
// API as a prop) rather than duplicated — one Filters UI, not two.
import OriginalFilters from '../original/OriginalFilters.vue';
import { useMobileFiltersTab } from '../../../hooks/MobileFiltersTab-hooks.js';

const api = useMobileFiltersTab();
</script>

<template>
  <div class="mob-panel">
    <div class="mob-panel-head">Filters</div>
    <OriginalFilters :api="api" />
  </div>
</template>

<style scoped>
.mob-panel { padding: 12px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; }
.mob-panel-head {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--mut);
  padding: 6px 4px 10px;
  flex-shrink: 0;
}
</style>
