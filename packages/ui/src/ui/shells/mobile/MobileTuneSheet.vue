<script setup lang="ts">
// The Tune bottom sheet on the mobile Graph page: a pull-tab when closed, a resizable sheet of
// what-if rows when open. Behaviour lives in MobileTuneSheet-hooks.ts.
import NumInput from '../../components/NumInput.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import { useMobileTuneSheet } from '../../../hooks/MobileTuneSheet-hooks.js';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();
const { isOpen, rows, sheetEl, sheetStyle, setValue, openSheet, done, cancel, reset,
  onTabDown, onTabUp, onHandleDown, onHandleMove, onHandleUp } =
  useMobileTuneSheet({ open: () => props.open, setOpen: v => emit('update:open', v) });
</script>

<template>
  <button v-if="!isOpen" type="button" class="mob-tune-tab" aria-label="Open Tune"
          @pointerdown="onTabDown" @pointerup="onTabUp" @click="openSheet">Tune ▲</button>
  <section v-else ref="sheetEl" class="mob-tune-sheet" :style="sheetStyle" aria-label="Tune">
    <div class="mob-tune-handle" role="separator" aria-label="Drag to resize Tune"
         @pointerdown="onHandleDown" @pointermove="onHandleMove" @pointerup="onHandleUp" @pointercancel="onHandleUp">
      <span class="mob-tune-grip"></span>
    </div>
    <div class="mob-tune-rows">
      <div v-for="row in rows" :key="row.tune.label" class="mob-tune-row">
        <span class="mob-tune-label">{{ row.tune.label }}</span>
        <span class="mob-tune-value">
          <NumInput :field="row.tune.field" :model-value="row.value" :precision="row.tune.field.precision"
                    :aria-label="row.tune.label" stepper
                    @update:model-value="(v: number | null) => setValue(row.tune, v)" />
        </span>
        <UnitToggle :field="row.tune.field" unit-class="mob-tune-unit" />
      </div>
    </div>
    <div class="mob-tune-foot">
      <button type="button" class="mob-tune-btn" title="Back to the last save" @click="reset">Reset</button>
      <button type="button" class="mob-tune-btn" title="Discard these changes and close" @click="cancel">Cancel</button>
      <button type="button" class="mob-tune-btn mob-tune-done" title="Keep these changes on the charts and close" @click="done">Done</button>
    </div>
  </section>
</template>

<style scoped>
.mob-tune-tab {
  flex: none;
  height: 28px;
  border: none;
  border-top: 1px solid var(--line);
  background: var(--panel2, #f0f0f0);
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  touch-action: none;
  cursor: pointer;
}
.mob-tune-sheet {
  flex: none;
  height: 45%;
  max-height: calc(100% - 120px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--panel);
  border-top: 1px solid var(--line);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
}
.mob-tune-handle {
  flex: none;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  cursor: ns-resize;
}
.mob-tune-grip { width: 40px; height: 4px; border-radius: 2px; background: var(--line); }
.mob-tune-rows { flex: 1; min-height: 0; overflow-y: auto; }
.mob-tune-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-top: 1px solid var(--line);
}
.mob-tune-row:first-child { border-top: none; }
.mob-tune-label { flex: none; width: 92px; font-size: 13px; color: var(--mut); }
.mob-tune-value { flex: 1; min-width: 0; display: flex; align-items: center; font-size: 16px; font-variant-numeric: tabular-nums; }
.mob-tune-value :deep(input) {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 32px;
  padding: 2px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--fg);
  font: inherit;
}
.mob-tune-value :deep(input:focus) { border-color: var(--acc); outline: none; }
.mob-tune-row :deep(.mob-tune-unit) { flex: none; min-width: 30px; font-size: 13px; color: var(--mut); }
.mob-tune-foot {
  flex: none;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 8px 12px;
  border-top: 1px solid var(--line);
}
.mob-tune-btn {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 15px;
}
.mob-tune-done { background: var(--acc, #36c); border-color: var(--acc, #36c); color: #fff; }
</style>
