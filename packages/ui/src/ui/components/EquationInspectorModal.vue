<script setup lang="ts">
import type { ProvenanceInfo } from '../../logic/provenance.js';

defineProps<{
  open: boolean;
  targetField: string | null;
  provenanceInfo: ProvenanceInfo | null;
}>();

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div v-if="open && targetField && provenanceInfo" class="eq-inspector-card" title="Non-modal Equation Inspector — live formula provenance">
    <div class="eq-hdr">
      <span class="eq-title">🔍 Provenance: <strong class="eq-target">{{ targetField }}</strong></span>
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
        <div v-if="path.substitutedText && path.substitutedText !== path.formulaText" class="eq-subst">
          Live: {{ path.substitutedText }}
        </div>
        <div class="eq-inputs">
          <span class="eq-in-lbl">Participating fields:</span>
          <span v-for="k in path.inputs" :key="k" class="eq-in-badge" :style="{ borderColor: path.color, color: path.color }">
            {{ k }}
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
}

.eq-empty {
  font-size: 11px;
  color: var(--mut, #94a3b8);
  font-style: italic;
  padding: 8px 0;
}

.eq-path-card {
  border-left: 3px solid #3b82f6;
  background: color-mix(in srgb, var(--panel, #161c28) 95%, transparent);
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

.eq-subst {
  font-family: monospace;
  font-size: 10.5px;
  color: #a0aec0;
  padding-left: 2px;
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
