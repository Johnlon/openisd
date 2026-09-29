<script setup lang="ts">
// The mobile Box tab — box type, volume, and the calculated resonance/Qtc readout. Thin: all
// state and domain reads/writes live in useMobileBoxTab() (src/hooks/MobileBoxTab-hooks.ts), which
// calls the SAME field-wiring factories OriginalShell-hooks.ts exports.
import {NumberField} from '@openisd/design/fields';
import BoxTypeDiagram from '../../components/BoxTypeDiagram.vue';
import NumInput from '../../components/NumInput.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import { useMobileBoxTab } from '../../../hooks/MobileBoxTab-hooks.js';

const {
  selectedBox, pending, boxLabel, showEnclosureTab,
  boxResonance, rearQtc, boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3,
  selectBoxType, BOX_TYPE_OPTIONS,
} = useMobileBoxTab();
</script>

<template>
  <div class="mob-panel">
    <div class="mob-panel-head">Box</div>
    <div class="mob-row">
      <label class="mob-row-label" for="mob-box-type">Box type</label>
      <select id="mob-box-type" class="mob-select" :value="selectedBox"
              @change="e => selectBoxType((e.target as HTMLSelectElement).value)">
        <option v-for="o in BOX_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <p v-if="pending" class="mob-hint mob-hint-warn">
      Response model pending — {{ boxLabel }} isn't simulated by the engine yet, so no curve is drawn.
    </p>
    <div class="mob-diagram"><BoxTypeDiagram :box-type="selectedBox" /></div>
  </div>

  <div class="mob-panel">
    <div class="mob-panel-head">Rear chamber</div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main">
        <span class="mob-field-label">Volume</span>
        <span class="mob-field-value">
          <NumInput :model-value="boxVolume_m3" @update:model-value="(v: number | null) => setBoxVolume_m3(v ?? 0)"
                    :field="NumberField.BOX_VB_L" unit-key="Vb" group="volume" base="L" :precision="NumberField.BOX_VB_L.precision" />
        </span>
      </div>
      <UnitToggle field="Vb" group="volume" base="L" unit-class="mob-unit" />
    </div>
    <p v-if="boxVolumeDqNote" class="mob-hint mob-hint-warn">{{ boxVolumeDqNote }}</p>

    <div class="mob-field-row mob-field-calculated">
      <div class="mob-field-main">
        <span class="mob-field-label">{{ selectedBox === 'box-passive-radiator' ? 'Fh' : 'Fsc' }}</span>
        <span class="mob-field-value mob-readonly">{{ boxResonance != null ? boxResonance.toFixed(NumberField.BOX_RESONANCE_HZ.precision) + ' Hz' : '—' }}</span>
      </div>
    </div>
    <div v-if="selectedBox === 'sealed'" class="mob-field-row mob-field-calculated">
      <div class="mob-field-main">
        <span class="mob-field-label">Qtc</span>
        <span class="mob-field-value mob-readonly">{{ rearQtc != null ? rearQtc.toFixed(3) : '—' }}</span>
      </div>
    </div>
  </div>

  <p v-if="showEnclosureTab" class="mob-hint">
    Vents and enclosure details for {{ boxLabel }} are on the Enclosure tab.
  </p>
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
}
.mob-row-label { font-size: 14px; color: var(--fg); }
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
.mob-diagram { display: flex; justify-content: center; padding: 8px 12px 16px; }

/* One editable/readonly row = one "instrument control": a left-edge status stripe carrying the
   SAME provenance colour desktop uses in text (--good entered / --acc calculated), so the value
   itself stays high-contrast rather than tinted — a phone needs the number legible at arm's
   length more than it needs the colour ON the digits. */
.mob-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px 10px 14px;
  min-height: 48px;
  border-left: 3px solid transparent;
  border-top: 1px solid var(--line);
}
.mob-field-row:first-of-type { border-top: none; }
.mob-field-entered { border-left-color: var(--good); }
.mob-field-calculated { border-left-color: var(--acc); }
.mob-field-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.mob-field-label { font-size: 13px; color: var(--mut); }
.mob-field-value { font-size: 18px; font-variant-numeric: tabular-nums; }
.mob-field-value :deep(input) {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 18px;
  color: var(--fg);
  padding: 0;
  width: 100%;
  min-height: 32px;
}
.mob-readonly { color: var(--acc); }
.mob-unit { font-size: 13px; color: var(--mut); }
.mob-hint { margin: 8px 16px; font-size: 12.5px; color: var(--mut); line-height: 1.4; }
.mob-hint-warn { color: var(--acc2); }
</style>
