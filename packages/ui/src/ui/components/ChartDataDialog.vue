<script setup lang="ts">
// A chart's plotted curves as a text table, with Copy and Download CSV. `phone` makes it a full-screen sheet
// (title and ✕ over the table, buttons in a footer), the classic phone Graph page's Data sheet.
import type {ChartData} from '@openisd/design/chart';
import {useApp} from '../../logic/app.js';

const props = defineProps<{ data: ChartData; phone?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const { designIO } = useApp();
</script>

<template>
  <Teleport to="body">
    <div class="cdata-overlay" :class="{ phone }" @click.self="emit('close')">
      <div class="cdata-modal" role="dialog" aria-labelledby="cdata-title" aria-modal="true">
        <h2 id="cdata-title">{{ props.data.chartName }} data</h2>
        <button v-if="phone" type="button" class="cdata-x" aria-label="Dismiss" @click="emit('close')">✕</button>
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

/* The phone sheet: the whole screen; a 48 px title row, a table of 14 px rows, a footer of 44 px buttons. */
.cdata-overlay.phone { background: #fff; }
.phone .cdata-modal { position: relative; width: 100%; max-height: none; height: 100%; border: none; border-radius: 0; box-shadow: none; }
.phone .cdata-modal h2 { display: flex; align-items: center; box-sizing: border-box; height: 48px; padding: 0 16px; font-size: 16px; }
.phone .cdata-x { position: absolute; top: 4px; right: 12px; width: 40px; height: 40px; border: none; background: none; font-size: 20px; color: var(--mut); cursor: pointer; }
.phone .cdata-table { font-size: 14px; }
.phone .cdata-table th { padding: 6px 16px; border-bottom: 1px solid var(--line); }
.phone .cdata-table td { padding: 3px 16px; border-bottom: 1px solid #f0f0f0; }
.phone .cdata-footer { flex-wrap: nowrap; justify-content: stretch; padding: 8px 16px 10px; background: var(--panel); }
.phone .cdata-footer button { flex: 1 0 auto; min-width: 0; height: 44px; padding: 0 12px; border: 1px solid #aaa; border-radius: 4px; background: #fff; font: inherit; font-size: 15px; font-weight: 600; white-space: nowrap; cursor: pointer; }
.phone .cdata-footer button.pri { background: var(--acc); border-color: var(--acc); color: #fff; }
</style>
