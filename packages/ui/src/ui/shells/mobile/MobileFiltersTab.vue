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
.mob-panel {
  margin: 12px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px;
  overflow: hidden;
}
.mob-panel-head {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--mut);
  border-bottom: 1px solid var(--line);
  background: var(--panel2);
}
</style>
