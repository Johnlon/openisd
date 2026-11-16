<script setup lang="ts">
// The passive radiator's Info (John 16 Nov 2026, QO946.c117 "the same select info edit setup and workflow as the driver"; c119 the Type row):
// read-only, laid out as the driver's Info: its name, its figures, then who made it and where it came from.
import type {PassiveRadiatorInfo} from '../../hooks/passiveRadiatorActions.js';
import {useEscToClose} from '../../logic/useEscToClose.js';

defineProps<{ info: PassiveRadiatorInfo; phone?: boolean }>();
const emit = defineEmits<{ close: [] }>();
useEscToClose(() => true, () => emit('close'));
</script>

<template>
  <div class="pri-scrim" :class="{'pri-phone': phone}" @click.self="emit('close')">
    <div class="pri-panel" role="dialog" :aria-label="info.title">
      <div class="pri-head"><span>{{ info.title }}</span><button type="button" class="pri-x" aria-label="Close" @click="emit('close')">&#10005;</button></div>
      <div class="pri-body">
                <div class="pri-grid">
          <div v-for="f in info.figures" :key="f.label" class="pri-cell"><span class="pri-l">{{ f.label }}</span><b class="pri-v">{{ f.value }}</b><span class="pri-u">{{ f.unit }}</span></div>
          <div class="pri-cell pri-type"><span class="pri-l">Type</span><b class="pri-t">{{ info.type }}</b></div>
        </div>
        <div v-if="info.links.length > 0" class="pri-links"><a v-for="l in info.links" :key="l.url" :href="l.url" target="_blank" rel="noopener">{{ l.label }}</a></div>
        <div v-for="l in info.lines" :key="l.label" class="pri-line"><span>{{ l.label }}</span><span>{{ l.value }}</span></div>
      </div>
      <div class="pri-foot"><button type="button" class="pri-close" @click="emit('close')">Close</button></div>
    </div>
  </div>
</template>

<style scoped>
.pri-scrim { position: fixed; inset: 0; z-index: 1300; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.3); }
.pri-panel { box-sizing: border-box; width: 768px; max-width: calc(100% - 24px); height: 533px; display: flex; flex-direction: column; background: #f7f7f7; border-radius: 4px; box-shadow: 0 6px 22px rgba(0,0,0,.35); font-size: 12px; color: #333; }
.pri-head { display: flex; align-items: center; justify-content: space-between; padding: 0 12px; height: 40px; background: #e8e8e8; border-bottom: 1px solid #d8d8d8; font-weight: 700; font-size: 14px; }
.pri-x { border: 0; background: none; font-size: 18px; color: #777; cursor: pointer; }
.pri-body { flex: 1 1 auto; overflow: auto; padding: 18px 28px; }
.pri-star { font-size: 24px; color: #aaa; margin-bottom: 8px; }
.pri-grid { display: grid; grid-template-columns: repeat(4, 170px); column-gap: 0; margin-bottom: 14px; }
.pri-cell { display: grid; grid-template-columns: 70px 50px 40px; align-items: center; padding: 3px 0; border-bottom: 1px solid #e3e3e3; margin-right: 10px; }
.pri-v { text-align: right; padding-right: 6px; font-size: 11px; }
.pri-u { color: #666; }
.pri-type { grid-column: span 2; grid-template-columns: 70px auto; }
.pri-t { font-size: 11px; white-space: nowrap; }
.pri-links { display: flex; gap: 10px; margin-bottom: 14px; }
.pri-links a { color: #1565c0; }
.pri-line { display: grid; grid-template-columns: 94px 1fr; padding: 3px 0; }
.pri-foot { display: flex; justify-content: flex-end; padding: 12px 28px 14px; border-top: 1px solid #e3e3e3; margin: 0 0; }
.pri-close { padding: 5px 14px; border: 1px solid #bbb; border-radius: 3px; background: #fff; cursor: pointer; }
.pri-phone { align-items: stretch; background: #f7f7f7; }
.pri-phone .pri-panel { width: 100%; max-width: 100%; height: 100%; border-radius: 0; box-shadow: none; font-size: 13px; }
.pri-phone .pri-head { height: 48px; font-size: 17px; padding: 0 16px; }
.pri-phone .pri-x { font-size: 22px; }
.pri-phone .pri-body { padding: 14px 16px; }
.pri-phone .pri-grid { grid-template-columns: 1fr 1fr; }
.pri-phone .pri-cell { grid-template-columns: 60px 1fr 40px; }
.pri-phone .pri-line { grid-template-columns: 96px 1fr; }
.pri-phone .pri-foot { padding: 12px 16px 16px; }
.pri-phone .pri-close { flex: 1; height: 44px; font-size: 14px; }
</style>
