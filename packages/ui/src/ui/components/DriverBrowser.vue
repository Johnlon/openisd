<script setup lang="ts">
import {ref, watch} from 'vue';
import {presentationState} from '../../logic/presentationState.js';
import {useEscToClose} from '../../logic/useEscToClose.js';
import {useApp} from '../../logic/app.js';
import DriverLibrary from './DriverLibrary.vue';

const { driverBrowsing } = useApp();

// The driver library as an OVERLAY: this file is the window (title bar, close, scrim); the
// library itself — list, filters, summary, footer — is DriverLibrary.vue, shared with step 1
// of the New Project wizard (FIX_WIZARD_SEALED Q1). All behaviour is logic/driverBrowsingState.ts.
//
// Choosing a driver EMBEDS it in the project and closes this picker (docs/design/STATE_MODEL.md rule 1) —
// the user lands back in the project, not in an editor. The ✎ on a My Drivers row is the other
// thing entirely: it edits that SAVED driver, and never touches the project.
const {
  previewDriver, previewData, pickDriver, closeLibrary,
  myDriversRead, exportedThisSession, exportMyDriversRaw, deleteAllMyDrivers,
} = driverBrowsing;

// The unreadable-bucket Delete CHALLENGES an un-exported session before acting (QO81: the user
// is always offered their bytes first). Two-step, no cancel: every button is a real action.
const deleteChallengeArmed = ref(false);
function requestDeleteAll(): void {
  if (!exportedThisSession.value && !deleteChallengeArmed.value) { deleteChallengeArmed.value = true; return; }
  deleteChallengeArmed.value = false;
  deleteAllMyDrivers();
}

function close() { closeLibrary(); }
useEscToClose(() => presentationState.browseOpen, close);

// Closing the picker drops any open summary, so reopening lands on the list rather than on
// whatever was last being read. (Opening is the library's own job: it re-reads My Drivers on mount.)
watch(() => presentationState.browseOpen, val => { if (!val) pickDriver(null); });
</script>

<template>

  <!-- QO81 hard stop (human ruling, verbatim: "do not allow the app to progress - require
       the user to decide on action - no cancel button"). A true blocking dialog: full scrim,
       no dismiss, no Escape, only real actions. -->
  <div v-if="myDriversRead.kind === 'unreadable'" class="fmt-scrim my-storage-modal-scrim">
    <div class="fmt-panel my-storage-modal" role="dialog" aria-modal="true" aria-label="Saved drivers cannot be read">
      <h3>Your saved drivers cannot be read</h3>
      <p class="fmt-note">
        The browser storage holding your My Drivers list is corrupted — it is no longer valid
        saved-driver data. This is the only copy of those drivers, so nothing has been changed
        and nothing will be written until you choose below.
      </p>
      <p class="fmt-note">
        <b>Export</b> downloads the stored data exactly as it is, as a text file. A partly
        corrupt file usually still contains most of your drivers as recoverable text — keep it
        even if it looks wrong.
        <b>Delete</b> permanently erases the stored list and starts My Drivers fresh; your
        projects and their embedded drivers are not affected.
      </p>
      <div class="fmt-foot" style="margin-top: 14px;">
        <button class="pri my-export-raw" @click="exportMyDriversRaw()">Export my data</button>
        <button class="my-delete-all" @click="requestDeleteAll()">
          {{ deleteChallengeArmed ? 'Delete WITHOUT exporting — erase the only copy' : 'Delete and start fresh' }}
        </button>
      </div>
      <p v-if="deleteChallengeArmed" class="my-storage-warn" style="color:#d93025; font-weight:600;">
        You have not exported this session. Deleting now destroys the only copy of your saved
        drivers, unrecoverably. Export first, or press the delete button again to erase anyway.
      </p>
    </div>
  </div>
  <div class="overlay" :class="{ on: presentationState.browseOpen }">
    <div class="modal wb-modal" v-if="presentationState.browseOpen">
      <h2>
        {{ previewDriver ? previewData?.name : 'Driver database' }}
        <span class="x" @click="close" title="Close the driver library browser">✕</span>
      </h2>
      <div class="body">
        <DriverLibrary />
      </div>
    </div>
  </div>
</template>

<style scoped>
.fmt-scrim {
  position: absolute; inset: 0; z-index: 105;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, .35);
}
.fmt-panel {
  background: var(--panel, #fff); border: 1px solid var(--line, #ccc); box-shadow: 0 6px 22px rgba(0,0,0,.35);
  width: 460px; max-width: 92%; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
}
.fmt-panel h3 { margin: 0 0 2px 0; font-size: 14px; font-weight: 600; color: var(--fg, #000); }
.fmt-note { margin: 0; font-size: 13px; line-height: 1.4; color: var(--fg, #000); }
.overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.18); z-index:100; align-items:center; justify-content:center; }
.overlay.on { display:flex; }

/* styling for Driver Library to match Driver Editor */
.wb-modal {
  background: #f7f7f7 !important;
  border: 1px solid #888 !important;
  box-shadow: 3px 6px 18px rgba(0,0,0,.35) !important;
  border-radius: 6px !important;
  color: #000 !important;
  width: 770px !important;
  max-width: 95vw !important;
  height: 535px !important;
  max-height: 85vh !important;
  display: flex !important;
  flex-direction: column !important;
}
.wb-modal h2 {
  background: #e8e8e8 !important;
  color: #000 !important;
  padding: 10px 12px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  border-bottom: 1px solid #ddd !important;
  margin: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.wb-modal h2 .x {
  background: none !important;
  border: none !important;
  font-size: 18px !important;
  color: #888 !important;
  cursor: pointer !important;
  width: auto !important;
  height: auto !important;
  padding: 0 !important;
  display: inline-block !important;
}
.wb-modal h2 .x:hover {
  color: #000 !important;
}
.wb-modal .body {
  padding: 12px !important;
  background: #f7f7f7 !important;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
  flex: 1;
}
</style>
