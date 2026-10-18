<script setup lang="ts">
// A chart's plotted curves as a text table, with Copy and Download CSV.
import type {ChartData} from '@openisd/design/chart';
import {useApp} from '../../logic/app.js';

const props = defineProps<{ data: ChartData }>();
const emit = defineEmits<{ close: [] }>();
const { designIO } = useApp();
</script>

<template>
  <Teleport to="body">
    <div class="cdata-overlay" @click.self="emit('close')">
      <div class="cdata-modal" role="dialog" aria-labelledby="cdata-title" aria-modal="true">
        <h2 id="cdata-title">{{ props.data.chartName }} data</h2>
        <div class="cdata-scroll">
          <table class="cdata-table">
            <thead>
              <tr><th v-for="h in props.data.headers" :key="h">{{ h }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in props.data.rows" :key="i"><td v-for="(cell, j) in row" :key="j">{{ cell }}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="cdata-footer">
          <button title="Copy the table, tab separated, to paste into a spreadsheet" @click="designIO.copyChartData(props.data)">Copy</button>
          <button title="Save the table as a CSV file" @click="designIO.downloadChartData(props.data)">Download CSV</button>
          <button class="pri" @click="emit('close')">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cdata-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 8, 14, 0.66);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000; /* below the popup that says what was saved (ConfirmDialog, 10002) */
}
.cdata-modal {
  width: min(720px, 94vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 9px;
  box-shadow: 3px 6px 18px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  color: var(--fg);
}
.cdata-modal h2 {
  margin: 0;
  font-size: 14px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--line);
}
.cdata-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.cdata-table {
  border-collapse: collapse;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  width: 100%;
}
.cdata-table th {
  position: sticky;
  top: 0;
  background: var(--panel2);
  text-align: right;
  font-weight: 600;
  padding: 4px 10px;
  white-space: nowrap;
}
.cdata-table td {
  text-align: right;
  padding: 2px 10px;
  white-space: nowrap;
}
.cdata-footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--line);
}
</style>
