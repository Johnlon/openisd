<script setup lang="ts">
// The mobile Driver tab — identity, driver count, and voice-coil wiring. Thin: all state and
// domain reads/writes live in useMobileDriverTab() (src/hooks/MobileDriverTab-hooks.ts).
import { useMobileDriverTab } from '../../../hooks/MobileDriverTab-hooks.js';

const { project, brand, model, browseDrivers, editDriver, N_DRIVERS_OPTIONS, ARRAY_WIRING_OPTIONS, selectedOption } = useMobileDriverTab();
</script>

<template>
  <div class="mob-panel">
    <div class="mob-panel-head">Driver</div>
    <div class="mob-row">
      <div class="mob-driver-id">
        <span class="mob-driver-brand">{{ brand || '—' }}</span>
        <span class="mob-driver-model">{{ model || 'No driver selected' }}</span>
      </div>
    </div>
    <div class="mob-row mob-row-actions">
      <button type="button" class="mob-btn" @click="browseDrivers">Select driver</button>
      <button type="button" class="mob-btn mob-btn-secondary" @click="editDriver">Edit</button>
    </div>
  </div>

  <div class="mob-panel">
    <div class="mob-panel-head">Placement</div>
    <div class="mob-row">
      <label class="mob-row-label" for="mob-n-drivers">Number of drivers</label>
      <select id="mob-n-drivers" class="mob-select" :value="project.nDrivers.value"
              @change="e => { const n = selectedOption(e, N_DRIVERS_OPTIONS); if (n !== null) project.nDrivers.set(n); }">
        <option v-for="o in N_DRIVERS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div class="mob-row">
      <label class="mob-row-label" for="mob-wiring">Voice coil connection</label>
      <select id="mob-wiring" class="mob-select" :value="project.wiring.value"
              @change="e => { const w = selectedOption(e, ARRAY_WIRING_OPTIONS); if (w !== null) project.wiring.set(w); }">
        <option v-for="o in ARRAY_WIRING_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
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
.mob-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  min-height: 48px;
  border-top: 1px solid var(--line);
}
.mob-row:first-of-type { border-top: none; }
.mob-row-label { font-size: 14px; color: var(--fg); }
.mob-driver-id { display: flex; flex-direction: column; gap: 2px; }
.mob-driver-brand { font-size: 13px; color: var(--mut); }
.mob-driver-model { font-size: 17px; font-weight: 600; }
.mob-row-actions { gap: 12px; }
.mob-btn {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--acc);
  border-radius: 4px;
  background: var(--acc);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.mob-btn-secondary { background: var(--panel); color: var(--acc); }
.mob-select {
  flex: 1;
  max-width: 60%;
  min-height: 40px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 14px;
}
</style>
