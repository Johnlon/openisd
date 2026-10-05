<script setup lang="ts">
// The What-if? bottom sheet on the mobile Graph page: a pull-tab when closed, a resizable sheet of
// What-if rows when open. Behaviour lives in MobileWhatIfSheet-hooks.ts.
import NumInput from '../../components/NumInput.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import { useMobileWhatIfSheet } from '../../../hooks/MobileWhatIfSheet-hooks.js';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();
const { isOpen, rows, sheetEl, sheetStyle, setValue, openSheet, close, reset,
  onTabDown, onTabUp, onHandleDown, onHandleMove, onHandleUp } =
  useMobileWhatIfSheet({ open: () => props.open, setOpen: v => emit('update:open', v) });
</script>

<template>
  <button v-if="!isOpen" type="button" class="mob-what-if-tab" aria-label="Open What-if?"
          @pointerdown="onTabDown" @pointerup="onTabUp" @click="openSheet">What-if? ▲</button>
  <section v-else ref="sheetEl" class="mob-what-if-sheet" :style="sheetStyle" aria-label="What-if?">
    <div class="mob-what-if-handle" role="separator" aria-label="Drag to resize What-if?"
         @pointerdown="onHandleDown" @pointermove="onHandleMove" @pointerup="onHandleUp" @pointercancel="onHandleUp">
      <span class="mob-what-if-grip"></span>
    </div>
    <div class="mob-what-if-rows">
      <div v-for="row in rows" :key="row.field.label" class="mob-what-if-row">
        <span class="mob-what-if-label">{{ row.field.label }}</span>
        <span class="mob-what-if-value">
          <NumInput :field="row.field.field" :model-value="row.value" :precision="row.field.field.precision"
                    :aria-label="row.field.label" stepper
                    @update:model-value="(v: number | null) => setValue(row.field, v)" />
        </span>
        <UnitToggle :field="row.field.field" unit-class="mob-what-if-unit" />
      </div>
    </div>
    <div class="mob-what-if-foot">
      <button type="button" class="mob-what-if-btn" title="Back to the project's values" @click="reset">Reset</button>
      <button type="button" class="mob-what-if-btn mob-what-if-close" title="Close. The project is not changed." @click="close">Close</button>
    </div>
  </section>
</template>

<style scoped>
.mob-what-if-tab {
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
.mob-what-if-sheet {
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
.mob-what-if-handle {
  flex: none;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  cursor: ns-resize;
}
.mob-what-if-grip { width: 40px; height: 4px; border-radius: 2px; background: var(--line); }
.mob-what-if-rows { flex: 1; min-height: 0; overflow-y: auto; }
.mob-what-if-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-top: 1px solid var(--line);
}
.mob-what-if-row:first-child { border-top: none; }
.mob-what-if-label { flex: none; width: 92px; font-size: 13px; color: var(--mut); }
.mob-what-if-value { flex: 1; min-width: 0; display: flex; align-items: center; font-size: 16px; font-variant-numeric: tabular-nums; }
.mob-what-if-value :deep(input) {
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
.mob-what-if-value :deep(input:focus) { border-color: var(--acc); outline: none; }
.mob-what-if-row :deep(.mob-what-if-unit) { flex: none; min-width: 30px; font-size: 13px; color: var(--mut); }
.mob-what-if-foot {
  flex: none;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 8px 12px;
  border-top: 1px solid var(--line);
}
.mob-what-if-btn {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 15px;
}
.mob-what-if-close { background: var(--acc, #36c); border-color: var(--acc, #36c); color: #fff; }
</style>
