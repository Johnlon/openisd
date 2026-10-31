<script setup lang="ts">
// Options dialog — recreates WinISD's "Options" modal (docs/images/winisd/options-general.png,
// options-plot-window.png), opened via the wrench/tools toolbar icon.
//
// General tab, top→bottom (matches the WinISD wireframe order):
//   Username        — free-text app-level identity preference (presentationState.ui.username).
//   Environment     — Temperature/Air pressure/Relative humidity + derived Sound velocity and
//                      Air density readouts. An app setting (`appSettingsRepo.envDefaults()`),
//                      edited through `OptionsModal-hooks.ts`: a project reads it for any of the
//                      three it has not entered itself, as a calculated value; a project's own
//                      entered value is never touched by editing this.
//   WinISD differences — "Show WinISD difference markers (≠W)": an app setting, same hook and
//                      repo; unticked hides every ≠W cue (John, 2026-10-05: default show).
//   Vented design limits — the band a designed vented box is judged plausible against. Same
//                      hook, same app settings repo. OpenISD's own, no WinISD counterpart.
//   Units           — WinISD's own "Reset to Metric (l, mm, …)" button: a one-click GLOBAL
//                      unit-system reset, distinct from the per-field unit-cycling behaviour
//                      (docs/research/WINISD_PARITY.md §14). presentationState.resetUnitTokens() clears presentationState.ui.unitTokens, so
//                      every field reverts to its own default display unit — never touches the
//                      stored SI design.
//
// Plot Window tab:
//   Colors  — WinISD has 6 swatches; OpenISD has a real rendering hook for 5 rows (wired via
//             CSS custom properties on the canvas element, GraphPanel.vue → canvas.ts):
//               Background  → --chart-bg-override (canvas fill; empty by default — transparent,
//                              app's own .gpanel background shows through, unchanged).
//               Other lines → --chart-grid (frequency/level gridlines).
//               Labels      → --chart-text (axis tick labels).
//               Xmax limit  → --chart-pelimit (canvas.ts's amber Pe-limited trace segment — the
//                              closest OpenISD equivalent; WinISD's own Xmax-limited segment
//                              reuses the trace's own per-project color, not a single constant,
//                              so this customizes the Pe-limited tint, not literally "Xmax").
//               Cursor lines→ --chart-cross + --chart-band-line (the crosshair/level cursor and
//                              the drag-selection band edges).
//             "0 dB line" / "-3dB line" colour the 0 dB and -3 dB lines of every chart that
//             draws them (transfer function, PR transfer function, port gains; 0 dB also on the
//             filter chain). The chart builder reads them (packages/design/chart/series.ts).
//   Limits  — WinISD's per-chart-type Start/End/Unit table. "Frequency range" binds directly to
//             the existing global sweep fmin/fmax (already a real, always-populated field —
//             this is just another entry point onto it, matching WinISD's own single global
//             setting). Every other row writes into the SAME presentationState.yRanges[chartId] mechanism the
//             chart's own drag-to-zoom already uses (GraphPanel.vue) — so editing a row here is
//             literally "set this chart's persisted default view", not a parallel concept, and
//             an untouched row still auto-scales exactly as it does today. The rows are
//             `LIMIT_ROWS` in OptionsModal-hooks.ts, keyed by `ChartId`.
import {ImportChoiceText, NumberField, PhoneDialogHelp, PhoneRowColumns} from '@openisd/design/fields';
import {computed, reactive, ref} from 'vue';
import {useEscToClose} from '../../logic/useEscToClose.js';
import {LIMIT_ROWS, type LimitRow, useOptionsModal} from '../../hooks/OptionsModal-hooks.js';
import {useBackupSettings} from '../../hooks/useBackupSettings.js';
import {useApp} from '../../logic/app.js';
import type {ChartId} from '@openisd/design/engine';
import type {ChartColorKey} from '@openisd/design/chart';
import PhoneDialogPage from './PhoneDialogPage.vue';
import StorageHistory from './StorageHistory.vue';
import UIFixedField from './UIFixedField.vue';
import MobilePaneDialog from '../shells/mobile/MobilePaneDialog.vue';
import PhoneBand from '../shells/mobile/PhoneBand.vue';
import {inputValue} from '../../logic/domEvents.js';

const emit = defineEmits<{ close: [] }>();
function close() { emit('close'); }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }
useEscToClose(() => true, close);

const { confirmPort, presentation: presentationState } = useApp();
/** The phone draws this dialog as a classic full-screen dialog (PHONE_CLASSIC_BUILD_SPEC row 20); the desktop is unchanged. */
/** The label column the dialogs' rows use (their labels are longer than a project page's). */
const DIALOG_COLUMNS = PhoneRowColumns.MEDIUM_LABEL;
const phone = computed(() => presentationState.shownSkin() === 'mobile');
const { resetUnitTokens } = presentationState;
const { downloadBackup, restoreFromFile } = useBackupSettings();
const backupFileInput = ref<HTMLInputElement | null>(null);
// Off by default: a restore keeps whatever the file does not hold. Ticked, the browser becomes
// exactly the file.
const replaceEverything = ref(false);
function pickBackupFile() { backupFileInput.value?.click(); }
async function onBackupFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const replace = replaceEverything.value;
  const confirmed = await confirmPort.port.ask({
    title: 'Import this file?',
    message: replace
      ? 'Everything in this browser is replaced by what is in this file. Anything not in the file is removed. '
        + 'A backup of what is here now is made first. Continue?'
      : 'What is in the file (projects, My Drivers, My Passive Radiators, settings) is put into this browser, '
        + 'replacing the same items. Anything the file does not hold is kept. A backup of what is here now is made first. Continue?',
    confirmLabel: 'Import',
    cancelLabel: 'Cancel',
  });
  if (!confirmed) return;
  const result = await restoreFromFile(file, replace);
  if (!result.ok) { alert(`Could not import: ${result.reason}`); return; }
  alert(`Restored (${result.keysRestored} item${result.keysRestored === 1 ? '' : 's'}). The app will now reload.`);
  window.location.reload();
}

// App settings — environment + vented design limits — are the hook's draft; OK applies both.
// The frequency range lives in the hook too, so its validation gates the same OK
// (BUG_20261001 options-frequency-range-unvalidated-empty-inverted).
const {
  tempK, humidityPct, pressurePa, defaultAir, envIsFactory, resetEnv,
  differenceCuesShown, resetDifferenceCues,
  minVolume_m3, maxVolume_m3, minTuning_hz, maxTuning_hz, error: limitsError, limitsAreFactory, resetLimits,
  setFreqRange,
  canApply, apply: applyAppSettings,
  colorRows, colorDefault,
} = useOptionsModal();

type Tab = 'General' | 'Plot Window' | 'Your data';
const limitsMoreOpen = ref(false);
const tab = reactive<{ v: Tab }>({ v: 'General' });

const draft = reactive({
  username: presentationState.ui.username,
  chartColors: JSON.parse(JSON.stringify(presentationState.ui.chartColors ?? {})),
  unitTokens: JSON.parse(JSON.stringify(presentationState.ui.unitTokens ?? {})),
  yRanges: JSON.parse(JSON.stringify(presentationState.yRanges)),
  // At the fields' display precision: a drag-zoomed axis stores e.g. 13.478123 Hz.
  P: {
    fmin: NumberField.PLOT_FMIN_HZ.rounded(presentationState.sweepRange.min),
    fmax: NumberField.PLOT_FMAX_HZ.rounded(presentationState.sweepRange.max),
  },
});
// Seed the hook's frequency-range draft from the dialog's display-precision copy; every edit
// below re-publishes it so the hook's validation sees exactly what OK would write.
setFreqRange(draft.P.fmin, draft.P.fmax);
function onFreqChange() {
  setFreqRange(draft.P.fmin, draft.P.fmax);
}

const unitsResetPending = ref(false);

function resetUnitsDraft() {
  draft.unitTokens = {};
  resetUnitTokens();
}

function restoreDefaults() {
  draft.username = '';
  resetEnv();
  resetLimits();
  resetDifferenceCues();
  draft.chartColors = {};
  draft.unitTokens = {};
  draft.yRanges = {};
  draft.P = { fmin: 10, fmax: 20000 };
  onFreqChange();
  unitsResetPending.value = true;
}

function saveAndClose() {
  if (!canApply.value) return;
  applyAppSettings();
  presentationState.ui.username = draft.username;
  presentationState.ui.chartColors = { ...draft.chartColors };
  presentationState.ui.unitTokens = { ...draft.unitTokens };
  presentationState.yRanges = { ...draft.yRanges };
  presentationState.sweepRange = { min: draft.P.fmin, max: draft.P.fmax };
  if (unitsResetPending.value) {
    resetUnitTokens();
  }
  close();
}

function colorValue(key: ChartColorKey): string {
  return draft.chartColors?.[key] ?? colorDefault(key);
}
function setColor(key: ChartColorKey, e: Event) {
  const v = inputValue(e);
  draft.chartColors[key] = v;
}
function clearColor(key: ChartColorKey) {
  delete draft.chartColors[key];
}

function setLimit(chartId: ChartId, key: 'min' | 'max', v: number) {
  const cur = draft.yRanges[chartId] ?? { min: NaN, max: NaN };
  draft.yRanges[chartId] = { ...cur, [key]: v };
  // BUG_20261001 options-chart-y-limit-partial-edit-silently-drops: an untouched half was
  // seeded NaN, and GraphPanel's view contract drops an override unless BOTH halves are
  // finite and ordered — so a one-sided edit silently did nothing. Fill the untouched half
  // from the row's own placeholder default, the value the user could see it promising.
  const row = LIMIT_ROWS.find(r => r.tab === chartId);
  const stored = draft.yRanges[chartId];
  if (row && stored) {
    if (!isFinite(stored.min)) stored.min = row.start;
    if (!isFinite(stored.max)) stored.max = row.end;
    if (stored.min >= stored.max) {
      // An inverted pair would be silently dropped by the chart too; order it from the
      // placeholder so the row stays meaningful.
      stored.min = Math.min(row.start, row.end);
      stored.max = Math.max(row.start, row.end);
    }
  }
}
function resetLimit(chartId: ChartId) { delete draft.yRanges[chartId]; }
function resetFreqRange() { draft.P = { fmin: 10, fmax: 20000 }; onFreqChange(); }
// The number a limit box shows: the draft when it has one, else the row's own default (what an
// untouched row promises). Never NaN, so the box is never blank.
function limitShown(row: LimitRow, key: 'min' | 'max'): number {
  const v = draft.yRanges[row.tab]?.[key];
  return v != null && isFinite(v) ? v : key === 'min' ? row.start : row.end;
}
</script>

<template>
  <MobilePaneDialog v-if="phone" title="Options" class="opt-phone" @close="close">
    <template #sub>
      <div class="opt-phone-tabs" role="tablist">
        <button v-for="t in (['General', 'Plot Window', 'Your data'] as const)" :key="t" type="button" role="tab" :aria-selected="tab.v === t" :class="{ on: tab.v === t }" @click="tab.v = t">{{ t }}</button>
      </div>
      <div v-if="!canApply" class="opt-error opt-phone-error" data-testid="settings-error">{{ limitsError ?? 'The frequency range needs both a start and an end, with the start below the end.' }}</div>
    </template>
    <PhoneDialogPage :columns="tab.v === 'General' ? DIALOG_COLUMNS : PhoneRowColumns.WIDE_LABEL">
      <template v-if="tab.v === 'General'">
        <PhoneBand :section="PhoneDialogHelp.OPTIONS_USER" />
        <div class="mob-crow">
          <label class="mob-crow-label" for="opt-phone-username">Username</label>
          <input id="opt-phone-username" class="mob-dtext" type="text" v-model="draft.username" placeholder="johnl" autocomplete="off" />
        </div>
        <PhoneBand :section="PhoneDialogHelp.OPTIONS_ENVIRONMENT" />
        <p class="mob-dhint">The air a project uses for any of these it has not set on its own Advanced tab.</p>
        <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" :field="NumberField.ADV_TEMP_K" :value="tempK" stepper @update:value="v => tempK = v" />
        <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" :field="NumberField.ADV_HUMIDITY_PCT" :value="humidityPct" stepper @update:value="v => humidityPct = v" />
        <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" :field="NumberField.ADV_PRESSURE_KPA" :value="pressurePa" stepper @update:value="v => pressurePa = v" />
        <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" :field="NumberField.ADV_SOUNDVELOCITY_M_PER_S" :value="defaultAir.c" readonly plain />
        <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" :field="NumberField.ADV_AIRDENSITY_KG_PER_M3" :value="defaultAir.rho" readonly plain />
        <div class="mob-cbtns mob-dbtns-one">
          <button type="button" data-testid="env-reset" :disabled="envIsFactory" @click="resetEnv">Reset to defaults</button>
        </div>
        <PhoneBand :section="PhoneDialogHelp.OPTIONS_VENTED_LIMITS" />
        <p class="mob-dhint">
          A vented design outside these limits is marked. Its numbers are never changed.
          <button type="button" class="mob-dlink" data-testid="limits-more" :aria-expanded="limitsMoreOpen" @click="limitsMoreOpen = !limitsMoreOpen">More info</button>
        </p>
        <div v-if="limitsMoreOpen" class="mob-dhint" role="note" data-testid="limits-more-popup">
          <p>WinISD does not limit its vented alignments, so it will design a box of any size or tuning.</p>
          <p>OpenISD gives the same answer, so its results match WinISD.</p>
          <p>If a design falls outside the limits below, OpenISD shows it exactly as designed and marks it.</p>
        </div>
        <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" label="Min box volume" :field="NumberField.BOX_VB_L" :value="minVolume_m3" stepper @update:value="v => minVolume_m3 = v" />
        <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" label="Min tuning" :field="NumberField.BOX_FB_HZ" :value="minTuning_hz" stepper @update:value="v => minTuning_hz = v" />
        <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" label="Max box volume" :field="NumberField.BOX_VB_L" :value="maxVolume_m3" stepper @update:value="v => maxVolume_m3 = v" />
        <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" label="Max tuning" :field="NumberField.BOX_FB_HZ" :value="maxTuning_hz" stepper @update:value="v => maxTuning_hz = v" />
        <div class="mob-cbtns mob-dbtns-one">
          <button type="button" data-testid="settings-reset" :disabled="limitsAreFactory" @click="resetLimits">Reset to defaults</button>
        </div>
        <PhoneBand :section="PhoneDialogHelp.OPTIONS_WINISD_DIFFERENCES" />
        <label class="mob-dcheck" data-testid="difference-cues">
          <input type="checkbox" v-model="differenceCuesShown" />
          <span>Show WinISD difference markers (≠W)</span>
        </label>
        <PhoneBand :section="PhoneDialogHelp.OPTIONS_UNITS" />
        <div class="mob-cbtns mob-dbtns-one">
          <button type="button" @click="resetUnitsDraft">Reset to Metric (l, mm, …)</button>
        </div>
      </template>

      <template v-else-if="tab.v === 'Plot Window'">
        <PhoneBand :section="PhoneDialogHelp.OPTIONS_COLORS" />
        <div v-for="row in colorRows" :key="row.key" class="mob-crow mob-dcolor-row">
          <label class="mob-crow-label" :for="'opt-phone-color-' + row.key">{{ row.label }}</label>
          <input :id="'opt-phone-color-' + row.key" class="mob-dcolor" type="color" :value="colorValue(row.key)" :aria-label="row.label + ' colour'" @input="setColor(row.key, $event)" />
          <button type="button" class="mob-dreset" :aria-label="'Reset ' + row.label" :title="'Back to ' + row.resetWord" @click="clearColor(row.key)">↺</button>
        </div>
        <p class="mob-dhint">Each project's curve colour is its coloured square in the ☰ menu.</p>
        <PhoneBand :section="PhoneDialogHelp.OPTIONS_LIMITS" />
        <div class="mob-dlim-block" role="group" aria-label="Frequency range">
          <div class="mob-dlim">
            <span class="mob-crow-label">Frequency range</span>
            <button type="button" class="mob-dreset" aria-label="Reset Frequency range" title="Back to the default" @click="resetFreqRange()">↺</button>
          </div>
          <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" input-id="opt-phone-lim-fmin" :field="NumberField.PLOT_FMIN_HZ" :value="draft.P.fmin" stepper @update:value="v => { draft.P.fmin = v; onFreqChange(); }" />
          <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" input-id="opt-phone-lim-fmax" :field="NumberField.PLOT_FMAX_HZ" :value="draft.P.fmax" stepper @update:value="v => { draft.P.fmax = v; onFreqChange(); }" />
        </div>
        <div v-for="row in LIMIT_ROWS" :key="row.tab" class="mob-dlim-block" role="group" :aria-label="row.label">
          <div class="mob-dlim">
            <span class="mob-crow-label">{{ row.label }}</span>
            <button type="button" class="mob-dreset" :aria-label="'Reset ' + row.label" title="Back to auto-scale" @click="resetLimit(row.tab)">↺</button>
          </div>
          <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" :input-id="'opt-phone-lim-' + row.tab" :label="row.label + ' start'" :field="row.field" :value="limitShown(row, 'min')" stepper @update:value="v => setLimit(row.tab, 'min', v)" />
          <UIFixedField class="mob-ui-field" :columns="DIALOG_COLUMNS" :input-id="'opt-phone-lim-' + row.tab + '-max'" :label="row.label + ' end'" :field="row.field" :value="limitShown(row, 'max')" stepper @update:value="v => setLimit(row.tab, 'max', v)" />
        </div>
      </template>

      <template v-else>
        <StorageHistory />
        <PhoneBand :section="PhoneDialogHelp.OPTIONS_EXPORT_IMPORT" />
        <p class="mob-dhint">Everything in this browser as one file: projects, My Drivers, My Passive Radiators and settings. The built-in driver catalogue is not included.</p>
        <div class="mob-cbtns">
          <button type="button" @click="downloadBackup">Export everything</button>
          <button type="button" @click="pickBackupFile">Import file…</button>
        </div>
        <p class="mob-dhint"><b>{{ ImportChoiceText.LEAD }}</b></p>
        <label class="mob-dcheck">
          <input type="radio" name="opt-import-choice" :checked="!replaceEverything" @change="replaceEverything = false" />
          <span>{{ ImportChoiceText.ADD_LABEL }}</span>
        </label>
        <p class="mob-dhint">{{ ImportChoiceText.ADD_LINE }}</p>
        <label class="mob-dcheck">
          <input type="radio" name="opt-import-choice" :checked="replaceEverything" @change="replaceEverything = true" />
          <span>{{ ImportChoiceText.REPLACE_LABEL }}</span>
        </label>
        <p class="mob-dhint">{{ ImportChoiceText.REPLACE_LINE }}</p>
        <input ref="backupFileInput" type="file" accept="application/json,.json" style="display:none" @change="onBackupFile">
      </template>
    </PhoneDialogPage>
    <template #footer>
      <button type="button" class="mob-dlg-btn" @click="restoreDefaults">Defaults</button>
      <span class="mob-dlg-spacer"></span>
      <button type="button" class="mob-dlg-btn pri" data-testid="settings-apply" :disabled="!canApply" :title="canApply ? 'Apply and close' : 'Resolve the error before applying'" @click="saveAndClose">OK</button>
      <button type="button" class="mob-dlg-btn" @click="close">Cancel</button>
    </template>
  </MobilePaneDialog>
  <div v-else class="opt-overlay" @click="onBackdrop">
    <div class="opt-modal">
      <h2 class="opt-h2">Options<button class="opt-x" @click="close" title="Close">✕</button></h2>

      <div class="opt-tabs">
        <button class="opt-tab" :class="{ on: tab.v === 'General' }" @click="tab.v = 'General'">General</button>
        <button class="opt-tab" :class="{ on: tab.v === 'Plot Window' }" @click="tab.v = 'Plot Window'">Plot Window</button>
        <button class="opt-tab" :class="{ on: tab.v === 'Your data' }" @click="tab.v = 'Your data'">Your data</button>
      </div>

      <div class="opt-body">
        <template v-if="tab.v === 'General'">
          <div class="opt-row">
            <label>Username</label>
            <input class="opt-input" type="text" v-model="draft.username" placeholder="johnl" />
          </div>

          <fieldset class="opt-group">
            <legend>Environment</legend>
            <p class="opt-help">The air a project uses for any of these it has not set on its own Advanced tab.</p>
            <div class="opt-env-grid">
              <div class="opt-fld"><UIFixedField label="Temperature" :field="NumberField.ADV_TEMP_K" :value="tempK" @update:value="v => tempK = v" /></div>
              <div class="opt-fld"><UIFixedField label="Relative humidity" :field="NumberField.ADV_HUMIDITY_PCT" :value="humidityPct" @update:value="v => humidityPct = v" /></div>
              <div class="opt-fld"><UIFixedField label="Air pressure" :field="NumberField.ADV_PRESSURE_KPA" :value="pressurePa" @update:value="v => pressurePa = v" /></div>
              <div class="opt-fld"><UIFixedField label="Sound velocity" :field="NumberField.ADV_SOUNDVELOCITY_M_PER_S" :value="defaultAir.c" readonly /></div>
              <div class="opt-fld"><UIFixedField label="Air density" :field="NumberField.ADV_AIRDENSITY_KG_PER_M3" :value="defaultAir.rho" readonly /></div>
            </div>
            <div class="opt-group-actions">
              <button class="opt-reset-btn" data-testid="env-reset" :disabled="envIsFactory" title="Back to the built-in environment: 293.15 K, 30 %, 101325 Pa. Only this fieldset is affected." @click="resetEnv">Reset to defaults</button>
            </div>
          </fieldset>

          <fieldset class="opt-group">
            <legend>Vented design limits</legend>
            <p class="opt-help">
              A vented design outside these limits is marked. Its numbers are never changed.
              <button type="button" class="opt-more-btn" data-testid="limits-more" :aria-expanded="limitsMoreOpen" @click="limitsMoreOpen = !limitsMoreOpen">More info</button>
            </p>
            <div v-if="limitsMoreOpen" class="opt-popup" role="note" data-testid="limits-more-popup">
              <p>WinISD does not limit its vented alignments, so it will design a box of any size or tuning.</p>
              <p>OpenISD gives the same answer, so its results match WinISD.</p>
              <p>If a design falls outside the limits below, OpenISD shows it exactly as designed and marks it.</p>
              <button type="button" class="opt-more-btn" @click="limitsMoreOpen = false">Close</button>
            </div>
            <div class="opt-env-grid">
              <div class="opt-fld"><UIFixedField input-id="set-min-volume" label="Min box volume" :field="NumberField.BOX_VB_L" :value="minVolume_m3" @update:value="v => minVolume_m3 = v" /></div>
              <div class="opt-fld"><UIFixedField input-id="set-min-tuning" label="Min tuning" :field="NumberField.BOX_FB_HZ" :value="minTuning_hz" @update:value="v => minTuning_hz = v" /></div>
              <div class="opt-fld"><UIFixedField input-id="set-max-volume" label="Max box volume" :field="NumberField.BOX_VB_L" :value="maxVolume_m3" @update:value="v => maxVolume_m3 = v" /></div>
              <div class="opt-fld"><UIFixedField input-id="set-max-tuning" label="Max tuning" :field="NumberField.BOX_FB_HZ" :value="maxTuning_hz" @update:value="v => maxTuning_hz = v" /></div>
            </div>
            <div v-if="limitsError" class="opt-error">{{ limitsError }}</div>
            <div class="opt-group-actions">
              <button class="opt-reset-btn" data-testid="settings-reset" :disabled="limitsAreFactory" title="Back to the built-in limits. Only this fieldset is affected." @click="resetLimits">Reset to defaults</button>
            </div>
          </fieldset>

          <fieldset class="opt-group">
            <legend>WinISD differences</legend>
            <label class="opt-check-label" data-testid="difference-cues" title="Ticked (the default): a ≠W marker sits by every control and chart whose result differs from WinISD's, and opens the page that explains it. Unticked: no markers; the page stays in the Info menu.">
              <input type="checkbox" v-model="differenceCuesShown" />
              Show WinISD difference markers (≠W)
            </label>
          </fieldset>

          <fieldset class="opt-group">
            <legend>Units</legend>
            <button class="opt-reset-btn" title="Reset every field's display unit back to its default (cm, L, g, Hz, K, Pa…) — undoes any unit clicking. The stored design is never affected." @click="resetUnitsDraft">
              Reset to Metric (l, mm, …)
            </button>
          </fieldset>
        </template>

        <template v-else-if="tab.v === 'Your data'">
          <StorageHistory />
          <fieldset class="opt-group">
            <legend>Export / Import</legend>
            <p class="opt-help">
              Everything in this browser as one file: projects, My Drivers, My Passive Radiators and settings.
              The built-in driver catalogue is not included.
            </p>
            <div class="opt-group-actions">
              <button class="opt-reset-btn" title="Save everything in this browser as one file." @click="downloadBackup">
                Export everything
              </button>
              <button class="opt-reset-btn" title="Put what is in an exported file into this browser. Whatever the file does not hold is kept, unless the box below is ticked." @click="pickBackupFile">
                Import file…
              </button>
            </div>
            <label class="opt-help">
              <input v-model="replaceEverything" type="checkbox">
              Remove what the file does not hold
            </label>
            <input ref="backupFileInput" type="file" accept="application/json,.json" style="display:none" @change="onBackupFile">
          </fieldset>
        </template>

        <template v-else>
          <fieldset class="opt-group">
            <legend>Colors</legend>
            <div class="opt-color-grid">
              <div class="opt-color-row" v-for="row in colorRows" :key="row.key" :title="row.hint">
                <label>{{ row.label }}</label>
                <input type="color" :value="colorValue(row.key)" @input="setColor(row.key, $event)" />
                <button class="opt-clear-btn" :title="row.hint ? 'Reset to ' + row.resetWord : 'Revert to the app\'s own color'" @click="clearColor(row.key)">↺</button>
              </div>
            </div>
          </fieldset>

          <fieldset class="opt-group">
            <legend>Limits</legend>
            <table class="opt-limits">
              <thead><tr><th></th><th>Start</th><th>End</th><th></th></tr></thead>
              <tbody>
                <tr>
                  <td>Frequency range</td>
                  <td><UIFixedField class="opt-lim-field" label="Frequency range start" :field="NumberField.PLOT_FMIN_HZ" :value="draft.P.fmin" @update:value="v => { draft.P.fmin = v; onFreqChange(); }" /></td>
                  <td><UIFixedField class="opt-lim-field" label="Frequency range end" :field="NumberField.PLOT_FMAX_HZ" :value="draft.P.fmax" @update:value="v => { draft.P.fmax = v; onFreqChange(); }" /></td>
                  <td><button class="opt-clear-btn" title="Reset to default" @click="resetFreqRange()">↺</button></td>
                </tr>
                <tr v-for="row in LIMIT_ROWS" :key="row.tab">
                  <td>{{ row.label }}</td>
                  <td><UIFixedField class="opt-lim-field" :label="row.label + ' start'" :field="row.field" :value="limitShown(row, 'min')" @update:value="v => setLimit(row.tab, 'min', v)" /></td>
                  <td><UIFixedField class="opt-lim-field" :label="row.label + ' end'" :field="row.field" :value="limitShown(row, 'max')" @update:value="v => setLimit(row.tab, 'max', v)" /></td>
                  <td><button class="opt-clear-btn" title="Reset to auto-scale" @click="resetLimit(row.tab)">↺</button></td>
                </tr>
              </tbody>
            </table>
          </fieldset>
        </template>
      </div>

      <div class="opt-footer">
        <!-- The dialog's ONE validity surface, visible from either tab: OK is one write or
             none, and the reason it is refused must be visible wherever the user is looking. -->
        <div v-if="!canApply" class="opt-error opt-footer-error" data-testid="settings-error">{{ limitsError ?? 'The frequency range needs both a start and an end, with the start below the end.' }}</div>
        <button class="opt-defaults-btn" @click="restoreDefaults">Defaults</button>
        <button class="opt-ok" data-testid="settings-apply" :disabled="!canApply" :title="canApply ? 'Apply and close' : 'Resolve the error before applying'" @click="saveAndClose">OK</button>
        <button @click="close">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Fully self-contained (own overlay/modal shell, not the shared global .overlay/.modal) —
   deliberately unique class names. The shell defines its OWN unscoped `.overlay`/
   `.modal` rules for their native-style dialogs (e.g. Original's centers-at-top variant); Vue
   applies a parent's scoped-style attribute to a child component's ROOT element too, so reusing
   those same class names here would leak the shell's positioning/sizing onto this modal. */
.opt-overlay { position: fixed; inset: 0; background: rgba(4, 8, 14, 0.66); display: flex;
  align-items: center; justify-content: center; z-index: 200; }
 .opt-modal { width: min(560px, 92vw); max-height: 94vh; display: flex; flex-direction: column;
  background: var(--panel); border: 1px solid var(--line); border-radius: 9px; overflow: hidden;
  color: var(--fg); }
.opt-h2 { margin: 0; font-size: 14px; padding: 11px 14px; border-bottom: 1px solid var(--line);
  display: flex; align-items: center; gap: 8px; }
.opt-x { margin-left: auto; cursor: pointer; color: var(--mut); font-size: 18px; line-height: 1;
  background: none; border: none; padding: 0; }
.opt-tabs { display: flex; gap: 2px; padding: 8px 14px 0; }
.opt-tab { font-size: 12px; padding: 6px 12px; border: 1px solid var(--line);
  border-radius: 4px 4px 0 0; background: var(--panel2); color: var(--mut); cursor: pointer; }
/* The active tab must look physically attached to the panel below, not a separate chip sitting
   above a visible seam. Two things are both required — colour-matching the border alone still
   anti-aliases into a thin visible line at a sub-pixel boundary:
   1. Drop the border-bottom entirely (padding-bottom +1px keeps the same overall height as the
      inactive tab, so tabs don't jump/misalign when switching).
   2. Overlap 1px into .opt-body (margin-bottom:-1px) and paint above it (position+z-index) —
      .opt-body's own border-top still draws under the tab's width unless covered like this. */
.opt-tab.on { background: var(--panel); color: var(--fg); font-weight: 600;
  border-bottom: none; padding-bottom: 7px; margin-bottom: -1px; position: relative; z-index: 2; }
.opt-body { min-height: 90px; border-top: 1px solid var(--line); padding: 12px 14px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 10px; }
.opt-group { border: 1px solid var(--line); border-radius: 5px; padding: 10px 12px; margin: 0; }
.opt-group legend { padding: 0 6px; font-size: 11px; color: var(--mut); }
.opt-help { margin: 0 0 8px; font-size: 11px; color: var(--mut); line-height: 1.4; }
.opt-more-btn { background: none; border: 0; padding: 0; font: inherit; color: var(--acc, #36c); text-decoration: underline; cursor: pointer; }
.opt-popup { margin: 0 0 8px; padding: 8px 10px; font-size: 11px; line-height: 1.4; border: 1px solid var(--bdr, #888); border-radius: 4px; background: var(--bg, #fff); }
.opt-popup p { margin: 0 0 6px; }
.opt-error { color: #8a1f1f; background: #fdeeee; border: 1px solid #e8b0b0; border-radius: 3px;
  padding: 4px 8px; font-size: 11px; margin-top: 8px; }
.opt-group-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.opt-reset-btn { width: max-content; padding: 4px 12px; cursor: pointer; }
.opt-reset-btn:disabled { cursor: default; opacity: 0.5; }
.opt-footer { display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--line); }
.opt-footer-error { margin-right: auto; }
.opt-ok { font-weight: 600; }
.opt-defaults-btn { margin-right: auto; cursor: pointer; }

.opt-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.opt-row label { flex: 0 0 90px; color: var(--mut); }
.opt-input { flex: 1; padding: 4px 6px; }

/* One column of field rows: the three editable and two calculated environment values, or the four
   vented limits. A field row is wider than the old two-column pair could hold in this dialog. */
.opt-env-grid { display: flex; flex-direction: column; gap: 6px; }
.opt-fld { font-size: 12px; min-width: 0; }
.opt-checkbox-row { grid-column: 1 / -1; }
.opt-check-label { display: flex; align-items: center; gap: 6px; color: var(--mut); }

.opt-color-grid { display: grid; grid-template-rows: repeat(3, auto); grid-auto-flow: column; grid-auto-columns: max-content; gap: 2px 6px; }
.opt-color-col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.opt-color-row { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.opt-color-row label { flex: 0 0 84px; white-space: nowrap; color: var(--mut); }
.opt-color-row input[type="color"] { width: 36px; height: 26px; padding: 0; border: 1px solid var(--line); cursor: pointer; }
.opt-color-row.opt-disabled input[type="color"] { cursor: not-allowed; opacity: 0.5; }
.opt-clear-btn { border: 1px solid var(--line); background: var(--panel2); color: var(--mut);
  cursor: pointer; font-size: 14px; width: 26px; height: 26px; line-height: 1; }

.opt-limits { width: auto; border-collapse: collapse; font-size: 11px; }
.opt-limits th, .opt-limits td { padding: 3px 4px; text-align: left; }
.opt-limits td:first-child { white-space: nowrap; }
.opt-limits th { color: var(--mut); font-weight: 500; border-bottom: 1px solid var(--line); }
/* A chart limit's start or end: the box and ▲▼ and unit only. Its label stays for screen readers
   but takes no room, and the ⚠ and ≠W slots (never used here) are dropped so a pair fits a row. */
.joined-fields .opt-limits .opt-lim-field.ui-field[data-field] { --joined-label: 0px; grid-template-columns: 0 var(--joined-box) var(--joined-buttons); column-gap: 0; }
.opt-lim-field.ui-field { column-gap: 0; }
.opt-lim-field :deep(.ui-field-label) { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
.opt-lim-field :deep(.ui-field-dq),
.opt-lim-field :deep(.ui-field-dev) { display: none; }

/* The phone's tab strip under the title (accepted mock, Options): three equal tabs, 40 px. */
.opt-phone-tabs { flex: none; display: flex; border-bottom: 1px solid var(--line); background: var(--panel); }
.opt-phone-tabs button { flex: 1; min-width: 0; height: 40px; border: none; border-bottom: 3px solid transparent; background: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--mut); white-space: nowrap; cursor: pointer; }
.opt-phone-tabs button.on { color: var(--acc); border-bottom-color: var(--acc); }
.opt-phone-error { margin: 0; border-radius: 0; font-size: 13px; padding: 6px 16px; }
</style>
