<script setup lang="ts">
// What the three value colours mean, as one thin row: a screen that shows entered (green),
// calculated (blue) and not-entered (black) values puts this at its bottom.
import {CellClass} from '../../logic/driverCells.js';

const ITEMS = [
  {cell: CellClass.Entered, label: 'Entered'},
  {cell: CellClass.Calculated, label: 'Calculated'},
  {cell: CellClass.NotAvailable, label: 'Not entered'},
] as const;
</script>

<template>
  <div class="prov-legend" role="note" aria-label="Value colours">
    <span v-for="item in ITEMS" :key="item.cell" class="prov-legend-item">
      <span class="prov-legend-sw" :class="item.cell"></span>{{ item.label }}
    </span>
    <slot />
  </div>
</template>

<style scoped>
.prov-legend { display: flex; flex-wrap: nowrap; align-items: center; gap: 14px; padding: 2px 10px; font-size: 11px; line-height: 16px; color: var(--mut); border-top: 1px solid var(--line); background: var(--panel2); flex: 0 0 auto; white-space: nowrap; overflow: hidden; }
.prov-legend-item { display: inline-flex; align-items: center; gap: 5px; }
.prov-legend-sw { width: 10px; height: 10px; border: 1px solid var(--line); border-radius: 2px; display: inline-block; }
.prov-legend-sw.value-e { background: var(--good); }
.prov-legend-sw.value-c { background: var(--acc); }
.prov-legend-sw.value-n { background: var(--mut); }
</style>
