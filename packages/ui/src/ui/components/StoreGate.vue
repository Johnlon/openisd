<script setup lang="ts">
import type {ConfirmDialogState} from '../../logic/confirmPort.js';
import type {StoreGateSession} from '../../logic/storeGate.js';
import ConfirmDialog from './ConfirmDialog.vue';

const props = defineProps<{ session: StoreGateSession; confirmState: ConfirmDialogState }>();
/** The gate runs before the app (no skin yet), so it follows the width that picks the phone skin. */
const PHONE_MAX_WIDTH_PX = 600;
const phone = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`).matches;
</script>

<template>
  <div class="store-gate" role="alertdialog" aria-labelledby="store-gate-title" aria-modal="true" data-testid="store-gate">
    <div class="store-gate-body">
      <div v-if="phone" class="store-gate-brand"><img src="/icon.svg" alt="" aria-hidden="true"><span>OpenISD Storage</span></div>
      <h1 id="store-gate-title">{{ props.session.screen.value.title }}</h1>
      <p>{{ props.session.screen.value.message }}</p>
      <ul v-if="props.session.screen.value.backups.length > 0" class="store-gate-backups">
        <li v-for="row in props.session.screen.value.backups" :key="row.key">
          <span>{{ row.label }}</span>
          <button type="button" @click="props.session.restore(row.key)">Restore</button>
          <button type="button" @click="props.session.readOnly(row.key)">Open read-only</button>
        </li>
      </ul>
      <div class="store-gate-actions">
        <button type="button" class="pri" @click="props.session.exportEverything()">Export everything</button>
      </div>
    </div>
    <ConfirmDialog :state="props.confirmState" />
  </div>
</template>

<style scoped>
.store-gate {
  position: fixed; inset: 0; z-index: 10001; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center; padding: 16px;
  background: var(--bg, #fff); color: var(--fg, #222); overflow-y: auto;
}
.store-gate-body { width: min(560px, 100%); }
.store-gate h1 { font-size: 18px; margin: 0 0 12px; }
.store-gate p { line-height: 1.5; margin: 0 0 12px; }
.store-gate-backups { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.store-gate-backups li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.store-gate-backups li span { flex: 1 1 100%; }
.store-gate-actions { display: flex; gap: 8px; }
button { min-height: 40px; padding: 0 14px; }

/* Phone (accepted mock, store-gate): the page runs top to bottom, each backup is a card, and Export everything is a full-width button at the foot. */
@media (max-width: 600px) {
  .store-gate { display: block; padding: 0; }
  .store-gate-body { box-sizing: border-box; min-height: 100%; display: flex; flex-direction: column; padding: 20px 16px; }
  .store-gate-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 16px; font-weight: 700; color: var(--acc, #1868d1); }
  .store-gate-brand img { width: 24px; height: 24px; }
  .store-gate h1 { font-size: 19px; line-height: 1.35; font-weight: 700; }
  .store-gate p { font-size: 14px; color: #444; margin-bottom: 16px; }
  .store-gate-backups { gap: 12px; margin-bottom: 20px; }
  .store-gate-backups li { padding: 12px; border: 1px solid var(--line, #ccc); border-radius: 6px; background: var(--panel2, #f4f6f8); }
  .store-gate-backups li span { font-weight: 600; font-size: 13px; color: #222; margin-bottom: 2px; }
  .store-gate-backups li button { min-height: 38px; font-size: 13px; }
  .store-gate-actions { flex-direction: column; gap: 10px; margin-top: auto; padding-top: 16px; border-top: 1px solid #eee; }
  .store-gate-actions button { width: 100%; height: 44px; font-size: 15px; }
}
</style>
