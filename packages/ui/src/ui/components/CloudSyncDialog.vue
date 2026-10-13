<script setup lang="ts">
import type {ConflictCopy, SyncDialogAction, SyncDialogModel, SyncTone} from '@openisd/design/cloud';
import {createConfirmPort} from '../../logic/confirmPort.js';
import ConfirmDialog from './ConfirmDialog.vue';

const props = defineProps<{
  model: SyncDialogModel;
}>();

const emit = defineEmits<{
  (e: 'connect'): void;
  (e: 'syncNow'): void;
  (e: 'reconnect'): void;
  (e: 'disconnect'): void;
  (e: 'openConflict', id: ConflictCopy['id']): void;
}>();

const {port: confirmPort, state: confirmState} = createConfirmPort();

const TONE_VARS: Record<SyncTone, string> = {
  muted: 'var(--mut)',
  accent: 'var(--acc)',
  good: 'var(--good)',
  warn: 'var(--acc2)',
  bad: 'var(--bad)',
};

async function handleAction(action: SyncDialogAction): Promise<void> {
  if (action === 'disconnect') {
    const ok = await confirmPort.ask({
      title: props.model.disconnectConfirm.title,
      message: props.model.disconnectConfirm.body,
      confirmLabel: props.model.disconnectConfirm.yes,
      cancelLabel: props.model.disconnectConfirm.no,
    });
    if (ok) {
      emit('disconnect');
    }
    return;
  }
  switch (action) {
    case 'connect': emit('connect'); return;
    case 'syncNow': emit('syncNow'); return;
    case 'reconnect': emit('reconnect'); return;
  }
}
</script>

<template>
  <div class="cloud-sync-dialog">
    <div class="cloud-sync-heading">{{ model.providerHeading }}</div>
    <div class="cloud-sync-headline">
      <span
        class="cloud-sync-tone-dot"
        :style="{ backgroundColor: TONE_VARS[model.tone] }"
      ></span>
      <span>{{ model.headline }}</span>
    </div>
    <div v-if="model.account" class="cloud-sync-account">
      {{ model.account }}
    </div>
    <div v-if="model.pendingLine" class="cloud-sync-pending">
      {{ model.pendingLine }}
    </div>
    <div v-if="model.offExplainer" class="cloud-sync-explainer">
      {{ model.offExplainer }}
    </div>
    <div v-if="model.notConfiguredLine" class="cloud-sync-not-configured">
      {{ model.notConfiguredLine }}
    </div>
    <div class="cloud-sync-buttons">
      <button
        v-for="btn in model.buttons"
        :key="btn.action"
        type="button"
        :disabled="!btn.enabled"
        :class="{ pri: btn.primary }"
        @click="handleAction(btn.action)"
      >{{ btn.label }}</button>
    </div>

    <div v-if="model.conflicts.length > 0" class="cloud-sync-conflicts-section">
      <div class="cloud-sync-heading">{{ model.conflictsHeading }}</div>
      <div
        v-for="c in model.conflicts"
        :key="c.id.text"
        class="cloud-sync-conflict-row"
      >
        <div class="cloud-sync-conflict-info">
          <div class="cloud-sync-conflict-title">{{ c.title }}</div>
          <div class="cloud-sync-conflict-sub">{{ c.sub }}</div>
        </div>
        <button
          type="button"
          class="cloud-sync-conflict-open-btn"
          @click="emit('openConflict', c.id)"
        >{{ model.conflictOpenLabel }}</button>
      </div>
    </div>

    <ConfirmDialog :state="confirmState" />
  </div>
</template>

<style scoped>
.cloud-sync-dialog {
  display: flex;
  flex-direction: column;
  color: var(--fg);
  font-size: 13px;
}

.cloud-sync-heading {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--mut);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.cloud-sync-headline {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.cloud-sync-tone-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.cloud-sync-account {
  color: var(--fg);
  font-size: 13px;
  margin-bottom: 4px;
}

.cloud-sync-pending {
  color: var(--acc2);
  font-size: 13px;
  margin-bottom: 8px;
}

.cloud-sync-explainer {
  color: var(--fg);
  font-size: 13px;
  line-height: 1.5;
  margin: 6px 0 10px;
}

.cloud-sync-not-configured {
  color: var(--mut);
  font-size: 12px;
  margin: 4px 0 8px;
}

.cloud-sync-buttons {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  margin-bottom: 12px;
}

.cloud-sync-buttons button {
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: var(--panel2, #e8edf2);
  color: var(--fg);
  border: 1px solid var(--line, #ccd3db);
}

.cloud-sync-buttons button.pri {
  background: var(--acc, #1a73e8);
  color: #fff;
  border: 1px solid transparent;
}

.cloud-sync-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cloud-sync-conflicts-section {
  border-top: 1px solid var(--line, #ccd3db);
  padding-top: 14px;
  margin-top: 8px;
}

.cloud-sync-conflict-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--line, #ccd3db);
}

.cloud-sync-conflict-title {
  font-weight: 500;
  font-size: 13px;
}

.cloud-sync-conflict-sub {
  color: var(--mut);
  font-size: 12px;
  margin-top: 2px;
}

.cloud-sync-conflict-open-btn {
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid var(--line, #ccd3db);
  background: var(--panel2, #e8edf2);
  color: var(--fg);
  cursor: pointer;
}
</style>
