<script setup lang="ts">
import type {StoreGateSession} from '../../logic/storeGate.js';

const props = defineProps<{ session: StoreGateSession }>();
</script>

<template>
  <div class="store-gate" role="alertdialog" aria-labelledby="store-gate-title" aria-modal="true" data-testid="store-gate">
    <div class="store-gate-body">
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
</style>
