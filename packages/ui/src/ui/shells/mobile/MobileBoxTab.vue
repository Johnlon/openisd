<script setup lang="ts">
// The mobile Box tab — box type, volume, and the calculated resonance/Qtc readout. Thin: all
// state and domain reads/writes live in useMobileBoxTab() (src/hooks/MobileBoxTab-hooks.ts), which
// calls the SAME field-wiring factories src/hooks/boxFields.ts exports.
import {NumberField} from '@openisd/design/fields';
import {selectedOption} from '../../../logic/domEvents.js';
import BoxTypeDiagram from '../../components/BoxTypeDiagram.vue';
import NumInput from '../../components/NumInput.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import { useMobileBoxTab } from '../../../hooks/MobileBoxTab-hooks.js';

const {
  selectedBox, pending, boxLabel, showEnclosureTab, enclosureNavLabel,
  boxResonance, rearQtc, boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3,
  selectBoxType, BOX_TYPE_OPTIONS,
  sealedAlignmentEditor, sealedAlignmentOpen, sealedAlignmentOptions, sealedAlignmentSelected,
  sealedAlignmentVolume_L, sealedAlignmentEbp, sealedAlignmentSuitability, sealedAlignmentSuitabilityLabel,
  boxQl, setBoxQl, boxQa, setBoxQa, boxQp, setBoxQp, boxLossesOpen,
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
                    :field="NumberField.BOX_VB_L" unit-key="Vb" :precision="NumberField.BOX_VB_L.precision" />
        </span>
      </div>
      <UnitToggle :field="NumberField.BOX_VB_L" unit-key="Vb" unit-class="mob-unit" />
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
    <div v-if="selectedBox === 'sealed'" class="mob-row">
      <button class="mob-btn" @click="sealedAlignmentEditor.openEditor">Choose alignment</button>
    </div>
    <div class="mob-row">
      <button class="mob-btn" @click="boxLossesOpen = true">Box losses -&gt;</button>
    </div>
  </div>

  <p v-if="showEnclosureTab" class="mob-hint">
    Vents and enclosure details for {{ boxLabel }} are on the "{{ enclosureNavLabel }}" tab.
  </p>

  <div v-if="sealedAlignmentOpen" class="mob-align-overlay" @click.self="sealedAlignmentEditor.cancel">
    <div class="mob-align-sheet">
      <div class="mob-panel-head mob-panel-head-row">
        <span>Choose sealed alignment</span>
        <button class="mob-x" @click="sealedAlignmentEditor.cancel">&#10005;</button>
      </div>
      <div class="mob-row">
        <label class="mob-row-label">Alignment</label>
        <select class="mob-select" :value="sealedAlignmentSelected?.value ?? ''"
                @change="e => { const qtc = selectedOption(e, sealedAlignmentOptions); if (qtc !== null) sealedAlignmentEditor.selectQtc(qtc); }">
          <option v-for="o in sealedAlignmentOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <div class="mob-field-row mob-field-entered">
        <div class="mob-field-main">
          <span class="mob-field-label">Volume</span>
          <span class="mob-field-value">
            <input type="number" min="0" step="0.01"
                   :value="sealedAlignmentVolume_L == null ? '' : sealedAlignmentVolume_L.toFixed(2)"
                   @input="sealedAlignmentVolume_L = Number(($event.target as HTMLInputElement).value)">
          </span>
        </div>
        <span class="mob-unit">L</span>
      </div>
      <div class="mob-align-readout">
        <span class="mob-align-dot" :class="sealedAlignmentSuitability ?? 'unknown'"></span>
        <span>EBP {{ sealedAlignmentEbp == null ? '—' : sealedAlignmentEbp.toFixed(1) }} Hz — {{ sealedAlignmentSuitabilityLabel }}</span>
      </div>
      <div class="mob-align-footer">
        <button class="mob-btn" @click="sealedAlignmentEditor.cancel">Cancel</button>
        <button class="mob-btn mob-btn-primary" @click="sealedAlignmentEditor.accept">Accept</button>
      </div>
    </div>
  </div>

  <div v-if="boxLossesOpen" class="mob-align-overlay" @click.self="boxLossesOpen = false">
    <div class="mob-align-sheet">
      <div class="mob-panel-head mob-panel-head-row">
        <span>Box losses</span>
        <button class="mob-x" @click="boxLossesOpen = false">&#10005;</button>
      </div>
      <div class="mob-field-row mob-field-entered">
        <div class="mob-field-main">
          <span class="mob-field-label">Leakage Ql</span>
          <span class="mob-field-value">
            <NumInput :model-value="boxQl" @update:model-value="(v: number | null) => setBoxQl(v ?? 0)" :precision="NumberField.LOSS_QL.precision" />
          </span>
        </div>
      </div>
      <div class="mob-field-row mob-field-entered">
        <div class="mob-field-main">
          <span class="mob-field-label">Absorption Qa</span>
          <span class="mob-field-value">
            <NumInput :model-value="boxQa" @update:model-value="(v: number | null) => setBoxQa(v ?? 0)" :precision="NumberField.LOSS_QA.precision" />
          </span>
        </div>
      </div>
      <div v-if="boxQp !== null" class="mob-field-row mob-field-entered">
        <div class="mob-field-main">
          <span class="mob-field-label">Port Qp</span>
          <span class="mob-field-value">
            <NumInput :model-value="boxQp" @update:model-value="(v: number | null) => setBoxQp(v ?? 0)" :precision="NumberField.LOSS_QP.precision" />
          </span>
        </div>
      </div>
      <p class="mob-hint">100 = no stuffing · 20–50 = light · 5–10 = heavy. WinISD defaults: Ql=10, Qa=100, Qp=100.</p>
      <div class="mob-align-footer">
        <button class="mob-btn mob-btn-primary" @click="boxLossesOpen = false">OK</button>
      </div>
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

.mob-btn {
  flex: 1;
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 14px;
}
.mob-btn-primary { background: var(--acc); border-color: var(--acc); color: #fff; font-weight: 600; }

/* absolute, not fixed: same reasoning as MobileShell.vue's own .mob-menu-overlay — covers
   .mobile-root (its containing block) so the sheet stays within the phone pane. */
.mob-align-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 210;
  display: flex;
  align-items: flex-end;
}
.mob-align-sheet {
  width: 100%;
  max-height: 80%;
  overflow-y: auto;
  background: var(--panel);
  border-top: 1px solid var(--line);
  border-radius: 8px 8px 0 0;
}
.mob-panel-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mob-x { all: unset; cursor: pointer; padding: 4px 8px; font-size: 14px; color: var(--mut); }
.mob-align-readout {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--line);
  font-size: 13px;
  color: var(--fg);
}
.mob-align-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.mob-align-dot.sealed { background: #2f9e44; }
.mob-align-dot.either { background: #d08a00; }
.mob-align-dot.vented { background: #2878c8; }
.mob-align-dot.unknown { background: #888; }
.mob-align-footer {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid var(--line);
}
</style>
