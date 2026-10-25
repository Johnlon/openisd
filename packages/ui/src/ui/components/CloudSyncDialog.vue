<script setup lang="ts">
import type {ConflictCopy, SyncDialogAction, SyncDialogModel, SyncTone} from '@openisd/design/cloud';
import {computed} from 'vue';
import {PhoneDialogHelp} from '@openisd/design/fields';
import {createConfirmPort} from '../../logic/confirmPort.js';
import {useApp} from '../../logic/app.js';
import ConfirmDialog from './ConfirmDialog.vue';
import PhoneDialogPage from './PhoneDialogPage.vue';
import PhoneBand from '../shells/mobile/PhoneBand.vue';
import {PRIVACY_URL} from '../siteLinks.js';

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
/** The phone draws this as a classic dialog body (PHONE_CLASSIC_BUILD_SPEC row 22); the desktop is unchanged. */
const presentation = useApp().presentation;
const phone = computed(() => presentation.shownSkin() === 'mobile');

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
    <PhoneDialogPage v-if="phone">
      <PhoneBand :section="PhoneDialogHelp.SYNC_GOOGLE_DRIVE" />
      <div class="mob-dstate cloud-sync-headline">
        <i class="cloud-sync-tone-dot" :style="{ backgroundColor: TONE_VARS[model.tone] }"></i>
        <span>{{ model.headline }}</span>
      </div>
      <p v-if="model.account" class="mob-dhint cloud-sync-account">{{ model.account }}</p>
      <p v-if="model.pendingLine" class="mob-dhint cloud-sync-pending">{{ model.pendingLine }}</p>
      <div v-if="model.privacy" class="mob-dhint cloud-sync-explainer">
        <p v-for="line in model.privacy.lines" :key="line">{{ line }}</p>
        <a class="mob-dlink" :href="PRIVACY_URL" target="_blank" rel="noopener">{{ model.privacy.linkLabel }}</a>
      </div>
      <p v-if="model.notConfiguredLine" class="mob-dhint cloud-sync-not-configured">{{ model.notConfiguredLine }}</p>
      <div class="mob-cbtns mob-dbtns-one cloud-sync-buttons">
        <button v-for="btn in model.buttons" :key="btn.action" type="button" :disabled="!btn.enabled" :class="{ pri: btn.primary }" @click="handleAction(btn.action)">{{ btn.label }}</button>
      </div>
      <template v-if="model.activity.length > 0">
        <PhoneBand :section="PhoneDialogHelp.syncActivity(model.activityHeading)" />
        <ol class="mob-dpre cloud-sync-activity">
          <li v-for="(line, i) in model.activity" :key="i" class="cloud-sync-activity-line">{{ line }}</li>
        </ol>
      </template>
      <template v-if="model.conflicts.length > 0">
        <PhoneBand :section="PhoneDialogHelp.syncConflicts(model.conflictsHeading)" />
        <div v-for="c in model.conflicts" :key="c.id.text" class="mob-dkv cloud-sync-conflict-row">
          <div class="cloud-sync-conflict-info">
            <div class="cloud-sync-conflict-title">{{ c.title }}</div>
            <div class="cloud-sync-conflict-sub">{{ c.sub }}</div>
          </div>
          <button type="button" class="cloud-sync-conflict-open-btn" @click="emit('openConflict', c.id)">{{ model.conflictOpenLabel }}</button>
        </div>
      </template>
    </PhoneDialogPage>
    <template v-else>
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
    <div v-if="model.privacy" class="cloud-sync-explainer">
      <p v-for="line in model.privacy.lines" :key="line">{{ line }}</p>
      <a :href="PRIVACY_URL" target="_blank" rel="noopener">{{ model.privacy.linkLabel }}</a>
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

    <div v-if="model.activity.length > 0" class="cloud-sync-activity-section">
      <div class="cloud-sync-heading">{{ model.activityHeading }}</div>
      <ol class="cloud-sync-activity">
        <li v-for="(line, i) in model.activity" :key="i" class="cloud-sync-activity-line">{{ line }}</li>
      </ol>
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
    </template>

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

.cloud-sync-explainer p {
  margin: 0 0 4px;
}

.cloud-sync-explainer a {
  color: var(--acc);
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

.cloud-sync-activity-section {
  border-top: 1px solid var(--line, #ccd3db);
  padding-top: 14px;
  margin-top: 8px;
}

.cloud-sync-activity {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 180px;
  overflow-y: auto;
}

.cloud-sync-activity-line {
  font-size: 12px;
  padding: 2px 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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

/* The phone's list lines (accepted mock, Cloud sync): activity as report text, conflicts as rows with an Open button. */
.cloud-sync-dialog .mob-dpre.cloud-sync-activity { list-style: none; max-height: none; }
.cloud-sync-dialog .cloud-sync-conflict-row { min-height: 48px; padding-top: 4px; padding-bottom: 4px; }
.cloud-sync-dialog .cloud-sync-conflict-open-btn { min-height: 44px; min-width: 44px; padding: 0 12px; }
.cloud-sync-dialog .mob-cbtns button.pri { background: var(--acc); border-color: var(--acc); color: #fff; }
</style>
