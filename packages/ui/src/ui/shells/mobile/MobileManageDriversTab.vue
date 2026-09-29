<script setup lang="ts">
// The mobile "Manage Drivers" pane — DriverLibrary.vue (shared, presentation-only) hosted full-
// height instead of the desktop DriverBrowser overlay it's normally reached through. Same reuse
// pattern as MobileNewProject.vue's step 1: one driver-library implementation, restyled per host.
import DriverLibrary from '../../components/DriverLibrary.vue';
import {useMobileManageDriversTab} from '../../../hooks/MobileManageDriversTab-hooks.js';

const emit = defineEmits<{ chosen: [] }>();
useMobileManageDriversTab(() => emit('chosen'));
</script>

<template>
  <div class="mob-drivers-wrap">
    <div class="mob-panel-head">Manage drivers</div>
    <DriverLibrary class="mob-drivers-library" show-name />
  </div>
</template>

<style scoped>
.mob-drivers-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  box-sizing: border-box;
}
.mob-panel-head {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--mut);
  padding: 0 0 10px;
  flex-shrink: 0;
}
.mob-drivers-library { flex: 1; min-height: 0; }
/* Cancel/Use restyled to match the rest of the mobile skin's footer buttons — same treatment
   MobileNewProject.vue gives the same pair for its own host, scoped here only. */
.mob-drivers-library :deep(.prev-footer) {
  justify-content: stretch;
  gap: 8px;
  padding: 10px 0 0;
  margin-top: 10px;
  border-top: 1px solid var(--line);
}
.mob-drivers-library :deep(.prev-footer button) {
  flex: 1;
  font-size: 15px;
  padding: 12px;
  border-radius: 4px;
}
.mob-drivers-library :deep(.prev-footer .cancel-btn) {
  color: var(--bad);
  background: var(--panel2);
  border: 1px solid var(--line);
}
.mob-drivers-library :deep(.prev-footer .use-btn) {
  color: var(--good);
  background: var(--panel2);
  border: 1px solid var(--line);
  font-weight: 600;
}
</style>
