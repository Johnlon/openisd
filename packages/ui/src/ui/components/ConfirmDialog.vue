<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, watch} from 'vue';
import type {ConfirmDialogState} from '../../logic/confirmPort.js';

interface Props {
  state: ConfirmDialogState;
}

const props = defineProps<Props>();

const currentRequest = computed(() => props.state.current.value?.request);

/** Esc or a click outside: counts as Cancel unless the request wants a button press. */
function dismiss(): void {
  if (currentRequest.value?.dismissal === 'buttonsOnly') return;
  props.state.answer(false);
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') dismiss();
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

watch(() => props.state.current.value, (current) => {
  if (current) {
    nextTick(() => {
      const confirmBtn = document.querySelector<HTMLButtonElement>('.confirm-dialog-confirm');
      confirmBtn?.focus();
    });
  }
});
</script>

<template>
  <div v-if="currentRequest" class="confirm-overlay" @click.self="dismiss()">
    <div class="confirm-modal" role="alertdialog" aria-labelledby="confirm-title" aria-modal="true">
      <h2 id="confirm-title">{{ currentRequest.title }}</h2>
      <p>{{ currentRequest.message }}</p>
      <div class="confirm-footer">
        <button
          class="confirm-dialog-cancel"
          @click="props.state.answer(false)"
        >
          {{ currentRequest.cancelLabel }}
        </button>
        <button
          class="confirm-dialog-confirm pri"
          @click="props.state.answer(true)"
        >
          {{ currentRequest.confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 8, 14, 0.66);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.confirm-modal {
  width: min(420px, 92vw);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 9px;
  box-shadow: 3px 6px 18px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  color: var(--fg);
}
.confirm-modal h2 {
  margin: 0;
  font-size: 14px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--line);
  background: var(--panel2);
  font-weight: 600;
}
.confirm-modal p {
  padding: 16px 14px;
  margin: 0;
  line-height: 1.5;
}
.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--line);
}
.confirm-footer button {
  min-width: 80px;
}
</style>