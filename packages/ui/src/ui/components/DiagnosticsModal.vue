<script setup lang="ts">
/**
 * The fault dialog — what broke, and the smallest repair that fixes it.
 *
 * Raised automatically on the first fault, because a runtime failure that only reaches the
 * console is a failure the user experiences as "the panel is blank" with nothing to act on.
 *
 * Repairs are listed LEAST DESTRUCTIVE FIRST and each states what it keeps and what it loses
 * before it is clicked. Nothing here clears the whole store to make an error go away — an
 * unexpected app state is still the user's work, and wiping it also destroys the evidence
 * needed to fix the cause.
 */
import {computed} from 'vue';
import {PhoneDialogHelp} from '@openisd/design/fields';
import {injectDiagnosticsModal} from '../../hooks/DiagnosticsModal-hooks.js';
import {useApp} from '../../logic/app.js';
import {useEscToClose} from '../../logic/useEscToClose.js';
import MobilePaneDialog from '../shells/mobile/MobilePaneDialog.vue';
import PhoneBand from '../shells/mobile/PhoneBand.vue';
import PhoneDialogPage from './PhoneDialogPage.vue';
const {faultLog, open, outcome, copied, applyFix, downloadOriginal, reload, copyReport} = injectDiagnosticsModal();
useEscToClose(() => open.value, () => { open.value = false; });
/** The phone draws this as a classic full-screen dialog (PHONE_CLASSIC_BUILD_SPEC row 24). */
const presentation = useApp().presentation;
const phone = computed(() => presentation.shownSkin() === 'mobile');
const title = computed(() => faultLog.faults.length ? 'Something went wrong' : faultLog.repairs.length ? 'Saved projects were repaired' : 'Diagnostics');
</script>

<template>
  <MobilePaneDialog v-if="open && phone" :title="title" @close="open = false">
    <PhoneDialogPage>
      <div v-for="(r, i) in faultLog.repairs" :key="'r' + i" class="dg-fix dg-phone-card">
        <strong>“{{ r.projectName }}” loaded with {{ r.fields.length }} field(s) reset to the default</strong>
        <div class="dg-loses">Reset: {{ r.fields.join(', ') }}</div>
        <button v-if="r.backupKey" type="button" class="dg-phone-btn" @click="downloadOriginal(r)">Download the original</button>
      </div>
      <div v-for="f in faultLog.faults" :key="f.id" class="dg-fault dg-phone-card">
        <div class="dg-msg">
          <span class="dg-kind">{{ f.kind }}</span>
          <span class="dg-kind">{{ f.originLabel }}</span>
          {{ f.message }}
          <span v-if="f.count > 1" class="dg-count">×{{ f.count }}</span>
        </div>
        <pre v-if="f.stack" class="dg-stack">{{ f.stack.split('\n').slice(0, 5).join('\n') }}</pre>
      </div>
      <template v-if="faultLog.applicable().length">
        <p class="mob-dhint"><b>Repairs — least damaging first</b></p>
        <div v-for="fix in faultLog.applicable()" :key="fix.id" class="dg-fix dg-phone-card">
          <strong>{{ fix.title }}</strong>
          <div class="dg-keeps">Keeps: {{ fix.keeps }}</div>
          <div v-if="fix.loses" class="dg-loses">Loses: {{ fix.loses }}</div>
          <div v-else class="dg-keeps">Loses: nothing</div>
          <button type="button" class="dg-phone-btn" @click="applyFix(fix)">Apply</button>
        </div>
      </template>
      <p v-else-if="faultLog.faults.length" class="mob-dhint">No stored-state repair applies — this fault is in the running code, not in your saved data. Copy the report below.</p>
      <p v-if="!faultLog.faults.length && !faultLog.repairs.length" class="mob-dhint">
        Nothing to report. No fault has occurred and no saved project needed repair. Copy diagnostics gives a report of this browser's stored data if you want to send one.
      </p>
      <PhoneBand :section="PhoneDialogHelp.DIAGNOSTICS_CLOUD_SYNC" />
      <pre class="mob-dpre">{{ faultLog.cloudSyncLines().join('\n') }}</pre>
      <PhoneBand :section="PhoneDialogHelp.DIAGNOSTICS_BROWSER_STORAGE" />
      <pre class="mob-dpre">{{ faultLog.storageLines().join('\n') }}</pre>
      <p v-if="outcome" class="dg-outcome mob-dhint">{{ outcome }}</p>
    </PhoneDialogPage>
    <template #footer>
      <button type="button" class="mob-dlg-btn" @click="copyReport">{{ copied ? 'Copied' : 'Copy diagnostics' }}</button>
      <button type="button" class="mob-dlg-btn" @click="reload">Reload</button>
      <span class="mob-dlg-spacer"></span>
      <button type="button" class="mob-dlg-btn pri" @click="open = false">Dismiss</button>
    </template>
  </MobilePaneDialog>
  <div v-else-if="open" class="dg-backdrop">
    <div class="dg" role="alertdialog" aria-labelledby="dg-title">
      <header>
        <h2 id="dg-title">{{ faultLog.faults.length ? 'Something went wrong' : faultLog.repairs.length ? 'Saved projects were repaired' : 'Diagnostics' }}</h2>
        <button class="dg-x" title="Dismiss — the app stays as it is" @click="open = false">&times;</button>
      </header>

      <section v-if="faultLog.repairs.length" class="dg-repaired">
        <div v-for="(r, i) in faultLog.repairs" :key="i" class="dg-fix">
          <div class="dg-fix-head">
            <strong>“{{ r.projectName }}” loaded with {{ r.fields.length }} field(s) reset to the default</strong>
            <button v-if="r.backupKey" @click="downloadOriginal(r)">Download the original</button>
          </div>
          <div class="dg-loses">Reset: {{ r.fields.join(', ') }}</div>
        </div>
      </section>

      <section v-if="faultLog.faults.length" class="dg-faults">
        <div v-for="f in faultLog.faults" :key="f.id" class="dg-fault">
          <div class="dg-msg">
            <span class="dg-kind">{{ f.kind }}</span>
            <span class="dg-kind">{{ f.originLabel }}</span>
            {{ f.message }}
            <span v-if="f.count > 1" class="dg-count">×{{ f.count }}</span>
          </div>
          <pre v-if="f.stack" class="dg-stack">{{ f.stack.split('\n').slice(0, 5).join('\n') }}</pre>
        </div>
      </section>

      <section v-if="faultLog.applicable().length" class="dg-fixes">
        <h3>Repairs — least damaging first</h3>
        <div v-for="fix in faultLog.applicable()" :key="fix.id" class="dg-fix">
          <div class="dg-fix-head">
            <strong>{{ fix.title }}</strong>
            <button @click="applyFix(fix)">Apply</button>
          </div>
          <div class="dg-keeps">Keeps: {{ fix.keeps }}</div>
          <div v-if="fix.loses" class="dg-loses">Loses: {{ fix.loses }}</div>
          <div v-else class="dg-keeps">Loses: nothing</div>
        </div>
      </section>
      <p v-else-if="faultLog.faults.length" class="dg-nofix">
        No stored-state repair applies — this fault is in the running code, not in your saved
        data. Copy the report below.
      </p>

      <p v-if="!faultLog.faults.length && !faultLog.repairs.length && faultLog.cloudSyncSummary()" class="dg-nofix">
        {{ faultLog.cloudSyncSummary() }}
      </p>
      <p v-else-if="!faultLog.faults.length && !faultLog.repairs.length" class="dg-keeps">
        Nothing to report. No fault has occurred and no saved project needed repair. Copy diagnostics
        gives a report of this browser's stored data if you want to send one.
      </p>

      <section class="dg-cloud">
        <h3>Cloud sync</h3>
        <pre class="dg-stack">{{ faultLog.cloudSyncLines().join('\n') }}</pre>
      </section>

      <section class="dg-storage">
        <h3>Browser storage</h3>
        <pre class="dg-stack">{{ faultLog.storageLines().join('\n') }}</pre>
      </section>

      <p v-if="outcome" class="dg-outcome">{{ outcome }}</p>

      <footer>
        <button @click="copyReport">{{ copied ? 'Copied' : 'Copy diagnostics' }}</button>
        <button @click="reload">Reload</button>
        <button @click="open = false">Dismiss</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.dg-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
}
.dg {
  background: var(--panel, #fff); color: var(--fg, #111);
  border: 1px solid var(--border, #999); border-radius: 6px;
  width: min(720px, 92vw); max-height: 86vh; overflow: auto;
  padding: 1rem 1.25rem; font-size: 13px;
}
.dg header { display: flex; align-items: baseline; justify-content: space-between; }
.dg h2 { font-size: 15px; margin: 0 0 .5rem; }
.dg h3 { font-size: 13px; margin: 1rem 0 .35rem; }
.dg-x { border: 0; background: none; font-size: 20px; cursor: pointer; color: inherit; }
.dg-fault { margin-bottom: .5rem; }
.dg-kind {
  font-size: 11px; text-transform: uppercase; opacity: .7;
  border: 1px solid currentColor; border-radius: 3px; padding: 0 .3em; margin-right: .4em;
}
.dg-msg { font-family: ui-monospace, monospace; }
.dg-count { opacity: .7; margin-left: .4em; }
.dg-stack {
  font-size: 11px; opacity: .75; margin: .25rem 0 0; white-space: pre-wrap;
  max-height: 7em; overflow: auto;
}
.dg-fix { border: 1px solid var(--border, #ccc); border-radius: 4px; padding: .5rem .6rem; margin-bottom: .4rem; }
.dg-fix-head { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
.dg-keeps { opacity: .8; }
.dg-loses { color: var(--warn, #b45309); }
.dg-nofix { opacity: .85; }
.dg-phone-card { margin: 8px 16px; }
.dg-phone-btn { margin-top: 8px; height: 36px; padding: 0 12px; border: 1px solid #aaa; border-radius: 4px; background: #fff; font: inherit; font-size: 13px; cursor: pointer; }
.dg-outcome { border-left: 3px solid var(--accent, #2563eb); padding-left: .6rem; white-space: pre-wrap; }
.dg footer { display: flex; gap: .5rem; margin-top: .9rem; }
</style>
