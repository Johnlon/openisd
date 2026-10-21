<script setup lang="ts">
import type {ProvenanceInfo} from '../../logic/provenance.js';

defineProps<{
  /** In the flow of the dialog that hosts it, under its body (the phone), not floating beside it. */
  docked?: boolean;
  open: boolean;
  targetField: string | null;
  provenanceInfo: ProvenanceInfo | null;
  /** Phone: the text of an input's badge, with the input's current value ("Qes = 0.420"). Absent: the badge names the input only. */
  inputBadge?: (key: string) => string;
}>();

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div v-if="open && targetField && provenanceInfo" class="eq-inspector-card" :class="{'eq-docked': docked}" title="Non-modal Equation Inspector — live formula provenance">
    <div class="eq-hdr">
      <span class="eq-title">Provenance: <strong class="eq-target">{{ targetField }}</strong></span>
      <button class="eq-x" @click="emit('close')" title="Close Equation Inspector">✕</button>
    </div>

    <div class="eq-body">
      <div v-if="provenanceInfo.paths.length === 0" class="eq-empty">
        No calculation formula maps to <em>{{ targetField }}</em> (direct user entry or constant).
      </div>

      <div v-for="path in provenanceInfo.paths" :key="path.id" class="eq-path-card" :style="{ borderColor: path.color }">
        <div class="eq-path-head">
          <span class="eq-swatch" :style="{ backgroundColor: path.color }"></span>
          <span class="eq-path-name" :style="{ color: path.color }">{{ path.colorName }}</span>
        </div>
        <div class="eq-formula">{{ path.formulaText }}</div>
        <div class="eq-inputs">
          <span class="eq-in-lbl">Participating fields:</span>
          <span v-for="k in path.inputs" :key="k" class="eq-in-badge" :style="{ borderColor: path.color, color: path.color }">
            {{ inputBadge ? inputBadge(k) : k }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.eq-inspector-card {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 380px;
  max-width: calc(100vw - 40px);
  background: var(--panel, #161c28);
  border: 1px solid var(--line, #2c384e);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  z-index: 10050;
  font-family: inherit;
  overflow: hidden;
  pointer-events: auto;
  animation: eq-fade 0.15s ease-out;
}

/* Docked: a band in the dialog's own column, between its body and its footer, so it covers none of
   the dialog's controls. Sizes come from the dialog's phone row sizes (`--mob-*`, PhoneRowSizes). */
.eq-inspector-card.eq-docked {
  position: static;
  flex: none;
  width: auto;
  max-width: none;
  border-radius: 0;
  border-width: 1px 0 0;
  box-shadow: none;
  animation: none;
}
/* The phone's inspector (gaps-phone/equation-inspector.html): a 44 px header with a 44x44 ✕, and nothing
   under 12 px. */
.eq-docked .eq-hdr { min-height: var(--mob-touch-min); padding-top: 0; padding-bottom: 0; }
.eq-docked .eq-x { width: var(--mob-touch-min); height: var(--mob-touch-min); display: inline-flex; align-items: center; justify-content: center; padding: 0; font-size: 18px; }
.eq-docked .eq-title, .eq-docked .eq-path-name, .eq-docked .eq-formula, .eq-docked .eq-in-lbl, .eq-docked .eq-in-badge, .eq-docked .eq-empty { font-size: 12px; }
.eq-docked .eq-target { font-size: 13px; }
.eq-docked .eq-body { max-height: calc(var(--mob-row-min) * 2); }

@keyframes eq-fade {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.eq-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--panel, #161c28) 85%, #000);
  border-bottom: 1px solid var(--line, #2c384e);
}

.eq-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg, #e2e8f0);
}

.eq-target {
  color: #38bdf8;
  font-family: monospace;
  font-size: 13px;
}

.eq-x {
  background: transparent;
  border: none;
  color: var(--mut, #94a3b8);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 4px;
}

.eq-x:hover {
  color: var(--fg, #fff);
  background: rgba(255, 255, 255, 0.1);
}

.eq-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  min-height: 0;
}

.eq-empty {
  font-size: 11px;
  color: var(--mut, #94a3b8);
  font-style: italic;
  padding: 8px 0;
}

.eq-path-card {
  border-left: 3px solid #3b82f6;
  background: var(--panel2, #1d2535);
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.eq-path-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.eq-swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.eq-path-name {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.eq-formula {
  font-family: monospace;
  font-size: 11.5px;
  color: var(--fg, #f8fafc);
  background: rgba(0, 0, 0, 0.25);
  padding: 4px 6px;
  border-radius: 3px;
}

.eq-inputs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.eq-in-lbl {
  font-size: 10px;
  color: var(--mut, #94a3b8);
  margin-right: 2px;
}

.eq-in-badge {
  font-size: 10px;
  font-family: monospace;
  font-weight: 600;
  padding: 1px 5px;
  border: 1px solid;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.2);
}
</style>
