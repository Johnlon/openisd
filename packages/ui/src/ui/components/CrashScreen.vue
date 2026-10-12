<script setup lang="ts">
import {useTelemetryUi} from '../../telemetry/context.js';
import {useCrashScreen} from '../../telemetry/CrashScreen-hooks.js';

const {visible, note, contact, send, dismiss} = useCrashScreen(useTelemetryUi().crashReports);
</script>
<template>
  <div v-if="visible" class="crash" role="dialog" aria-label="Something went wrong" data-testid="crash-screen">
    <strong>Something went wrong.</strong>
    <label>What were you doing? (optional)
      <textarea v-model="note" rows="3" maxlength="1000" data-testid="crash-note"></textarea>
    </label>
    <label>How can we reach you? (optional)
      <input v-model="contact" type="text" maxlength="200" data-testid="crash-contact">
    </label>
    <div class="crash-buttons">
      <button type="button" data-testid="crash-send" @click="send">Send report</button>
      <button type="button" data-testid="crash-dismiss" @click="dismiss">Not now</button>
    </div>
  </div>
</template>
<style scoped>
.crash {
  position: fixed; right: 12px; bottom: 12px; z-index: 10000; /* above the diagnostics backdrop (9999), which raises on the same error */
  box-sizing: border-box; width: min(340px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px; padding: 10px;
  background: #fff; border: 1px solid #c33; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,.3);
  font-size: 13px; color: #222;
}
.crash label { display: flex; flex-direction: column; gap: 2px; }
.crash textarea, .crash input { box-sizing: border-box; width: 100%; }
.crash-buttons { display: flex; gap: 6px; justify-content: flex-end; }
</style>
