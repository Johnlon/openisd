<script setup lang="ts">
// The colour key under the phone header: what the three value colours mean.
import {KeyStripText} from '@openisd/design/fields';
import {CellClass} from '../../../logic/driverCells.js';

const ITEMS = [
  {cell: CellClass.Entered, label: KeyStripText.ENTERED},
  {cell: CellClass.Calculated, label: KeyStripText.CALCULATED},
  {cell: CellClass.NotAvailable, label: KeyStripText.NOT_AVAILABLE},
] as const;
</script>

<template>
  <div class="mob-key-strip" role="note" aria-label="Value colours">
    <span v-for="item in ITEMS" :key="item.cell" class="mob-key-item" :class="item.cell"><i class="mob-key-sw">&#9632;</i>{{ item.label }}</span>
  </div>
</template>

<style scoped>
.mob-key-strip { flex: none; height: 24px; box-sizing: border-box; display: flex; gap: 14px; justify-content: center; align-items: center; padding: 0 16px; border-bottom: 1px solid var(--line); background: #ececec; font-size: 13px; white-space: nowrap; overflow: hidden; }
.mob-key-sw { font-style: normal; margin-right: 4px; }
.mob-key-item.value-e { color: var(--good); }
.mob-key-item.value-c { color: var(--acc); }
.mob-key-item.value-n { color: var(--mut); }
</style>
