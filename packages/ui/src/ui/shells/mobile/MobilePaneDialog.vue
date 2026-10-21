<script setup lang="ts">
// Full-screen dialog frame in the Options style: title with a top-right ✕, a scrolling body,
// and a footer with one Close button. Fixed to the whole screen so its size never depends on
// its content. A dialog with its own buttons fills the `footer` slot; one with tabs under the title
// fills `sub` (it stays put while the body scrolls).
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
    <slot name="sub" />
    <div class="mob-dlg-body"><slot /></div>
    <div class="mob-dlg-footer">
      <slot name="footer">
        <button type="button" class="mob-dlg-ok" @click="emit('close')">Close</button>
      </slot>
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
  display: flex; align-items: center; gap: 8px; flex: none; box-sizing: border-box; height: 48px;
  padding: 0 16px; border-bottom: 1px solid var(--line); background: var(--panel);
}
.mob-dlg-title { font-size: 16px; font-weight: 600; }
.mob-dlg-close {
  margin-left: auto; width: 40px; height: 40px; background: none; border: none; padding: 0;
  font-size: 20px; line-height: 1; color: var(--mut); cursor: pointer;
}
.mob-dlg-body { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }
.mob-dlg-body :deep(.mob-panel) { flex-shrink: 0; }
/* The Cloud sync body brings its own bands and rows, which run edge to edge. */
.mob-dlg-body :deep(.mob-cloud-dialog-body) { padding: 0; }
.mob-dlg-footer { flex: none; display: flex; gap: 8px; padding: 8px 16px 10px; border-top: 1px solid var(--line); background: var(--panel); }
.mob-dlg-ok {
  min-height: 44px; padding: 0 24px; margin-left: auto; font: inherit; font-weight: 600;
  border: 1px solid var(--line); border-radius: 4px; background: var(--panel2); color: var(--fg); cursor: pointer;
}
/* A dialog's own footer buttons (Options: Defaults, OK, Cancel): 44 px, one row. */
.mob-dlg-footer :slotted(.mob-dlg-btn) {
  flex: 0 0 auto; min-width: 0; height: 44px; padding: 0 12px; box-sizing: border-box; font: inherit; font-size: 15px; font-weight: 600;
  white-space: nowrap; border: 1px solid #aaa; border-radius: 4px; background: #fff; color: var(--fg); cursor: pointer;
}
.mob-dlg-footer :slotted(.mob-dlg-btn.pri) { background: var(--acc); border-color: var(--acc); color: #fff; }
.mob-dlg-footer :slotted(.mob-dlg-btn:disabled) { opacity: 0.5; cursor: default; }
.mob-dlg-footer :slotted(.mob-dlg-spacer) { flex: 1 1 0; min-width: 0; }
</style>
