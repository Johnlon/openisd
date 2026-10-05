<script setup lang="ts">
// Full-screen dialog frame in the Options style: title with a top-right ✕, a scrolling body,
// and a footer with one Close button (a `footer` slot replaces it, e.g. Cancel and Save). Fixed to the whole screen so its size never depends on
// its content.
import {useEscToClose} from '../../../logic/useEscToClose.js';

defineProps<{ title: string }>();
const emit = defineEmits<{ close: [] }>();

useEscToClose(() => true, () => emit('close'));
</script>

<template>
  <div class="mob-dlg" role="dialog" :aria-label="title">
    <div class="mob-dlg-head">
      <span class="mob-dlg-title">{{ title }}</span>
      <button type="button" class="mob-dlg-close" title="Close" aria-label="Close" @click="emit('close')">✕</button>
    </div>
    <div class="mob-dlg-body"><slot /></div>
    <div class="mob-dlg-footer">
      <slot name="footer"><button type="button" class="mob-dlg-ok" @click="emit('close')">Close</button></slot>
    </div>
  </div>
</template>

<style scoped>
.mob-dlg {
  position: fixed; inset: 0; z-index: 100;
  display: flex; flex-direction: column;
  background: var(--panel); color: var(--fg);
}
.mob-dlg-head {
  display: flex; align-items: center; gap: 8px;
  padding: 11px 14px; border-bottom: 1px solid var(--line);
}
.mob-dlg-title { font-size: 16px; font-weight: 600; }
.mob-dlg-close {
  margin-left: auto; background: none; border: none; padding: 6px 10px;
  font-size: 18px; line-height: 1; color: var(--mut); cursor: pointer;
}
.mob-dlg-body { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }
.mob-dlg-body :deep(.mob-panel) { flex-shrink: 0; }
.mob-dlg-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--line); }
.mob-dlg-ok {
  min-height: 44px; padding: 0 24px; font: inherit; font-weight: 600;
  border: 1px solid var(--line); border-radius: 4px; background: var(--panel2); color: var(--fg); cursor: pointer;
}
</style>
