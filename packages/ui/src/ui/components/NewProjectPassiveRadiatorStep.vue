<script setup lang="ts">
// The New Project wizard's passive-radiator step, as WinISD's wizard has it: choose a saved or
// bundled radiator, or define one, then its eight figures, each stated or calculated. Both skins show it.
import {NumberField, PhoneWizardText, PickWidth, WinisdDeviation} from '@openisd/design/fields';
import UIField from './UIField.vue';
import UIPickField from './UIPickField.vue';
import PRBrowser from './PRBrowser.vue';
import {inputValue} from '../../logic/domEvents.js';
import type {PassiveRadiatorStepCells, PassiveRadiatorStepView} from '../../hooks/OriginalNewProject-hooks.js';

interface Props {
  radiator: PassiveRadiatorStepView | null;
  cells: PassiveRadiatorStepCells;
  /** The PR picker is open over the step. */
  browsing: boolean;
  /** The skin's class for a field row (the phone's `mob-ui-field`); none on the desktop. */
  fieldClass?: string;
  /** The classic phone page (PHONE_CLASSIC_BUILD_SPEC screen 25): a full-width Select PR button, the name in a plain row. */
  classic?: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  loadSaved: [string];
  loadBundled: [string];
  define: [];
  browse: [];
  closeBrowse: [];
  rename: [string];
}>();
</script>

<template>
  <div class="np-pr-step">
    <button id="np-pr-select" class="np-pr-browse" :class="{'np-pr-browse-classic': classic}" title="Choose a saved or bundled passive radiator, or define a new one." @click="emit('browse')">{{ classic ? PhoneWizardText.SELECT_PR : 'Select passive radiator ▸' }}</button>
    <PRBrowser v-if="browsing" @close="emit('closeBrowse')"
      @load="id => emit('loadSaved', id)" @load-bundled="id => emit('loadBundled', id)" @define="emit('define')" />
    <p class="np-pr-hint">{{ PhoneWizardText.SELECT_OR_DEFINE_PR }}</p>

    <div v-if="classic" class="mob-crow">
      <input id="np-pr-name" class="mob-cname np-pr-name" type="text" aria-label="Passive radiator name" :value="radiator?.name ?? ''" placeholder="e.g. Dayton SD270A-88"
        @input="e => emit('rename', inputValue(e))">
    </div>
    <UIPickField v-else :class="fieldClass" label="Passive radiator name" input-id="np-pr-name" :width="PickWidth.TEXT">
      <input id="np-pr-name" class="np-pr-name" type="text" :value="radiator?.name ?? ''" placeholder="e.g. Dayton SD270A-88"
        @input="e => emit('rename', inputValue(e))">
    </UIPickField>
    <div class="np-pr-figures" :class="{'np-pr-figures-two': !classic}">
      <UIField :class="fieldClass" input-id="np-pr-vas" :field="NumberField.PR_VAS_L" :cell="cells.Vas_m3" />
      <UIField :class="fieldClass" input-id="np-pr-qms" :field="NumberField.PR_QMS" :cell="cells.Qms" />
      <UIField :class="fieldClass" label="Fs" input-id="np-pr-fs" :field="NumberField.PR_FS_HZ" :cell="cells.Fs_hz" />
      <UIField :class="fieldClass" input-id="np-pr-sd" :field="NumberField.PR_SD_CM2" :cell="cells.Sd_m2" />
      <UIField :class="fieldClass" input-id="np-pr-mms" :field="NumberField.MMS_KG" :cell="cells.Mms_kg" :deviation="WinisdDeviation.PR_MMS_CMS_TYPING" />
      <UIField :class="fieldClass" input-id="np-pr-cms" :field="NumberField.CMS_M_PER_N" :cell="cells.Cms_m_per_N" :deviation="WinisdDeviation.PR_MMS_CMS_TYPING" />
      <UIField :class="fieldClass" input-id="np-pr-rms" :field="NumberField.RMS_KG_PER_S" :cell="cells.Rms_kg_per_s" />
      <UIField :class="fieldClass" input-id="np-pr-xmax" :field="NumberField.PR_XMAX_MM" :cell="cells.Xmax_m" />
    </div>
  </div>
</template>

<style scoped>
.np-pr-step { margin-top: 10px; }
.np-pr-step:has(.np-pr-browse-classic) { margin-top: 0; }
.np-pr-browse { width: 100%; min-height: var(--ctl-h); border: 1px solid var(--acc); background: var(--acc); color: #fff; border-radius: 4px; font: inherit; cursor: pointer; }
.np-pr-browse-classic { width: calc(100% - 32px); min-height: 38px; margin: 8px 16px; font-size: 14px; font-weight: 600; }
.np-pr-hint { color: #555; font-size: 13px; margin: 8px 0 12px; }
.np-pr-step:has(.np-pr-browse-classic) .np-pr-hint { margin: 0 16px 8px; }
.np-pr-step :deep(.ui-field) { margin-top: 10px; }
.np-pr-figures-two { display: grid; grid-template-columns: auto auto; justify-content: start; column-gap: 12px; }
</style>
