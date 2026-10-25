<script setup lang="ts">
// The New Project wizard's passive-radiator step, as WinISD's wizard has it: choose a saved or
// bundled radiator, or define one, then its Vas / Qms / Fs / Sd / Xmax. Both skins show it.
import {NumberField, PhoneWizardText, PickWidth} from '@openisd/design/fields';
import UIFixedField from './UIFixedField.vue';
import UIPickField from './UIPickField.vue';
import PRBrowser from './PRBrowser.vue';
import {inputValue} from '../../logic/domEvents.js';
import type {PassiveRadiatorStepEdits, PassiveRadiatorStepView} from '../../hooks/OriginalNewProject-hooks.js';

interface Props {
  radiator: PassiveRadiatorStepView | null;
  edits: PassiveRadiatorStepEdits;
  /** The PR picker is open over the step. */
  browsing: boolean;
  /** The skin's class for a field row (the phone's `mob-ui-field`); none on the desktop. */
  fieldClass?: string;
  /** The classic phone page (PHONE_CLASSIC_BUILD_SPEC screen 25): a full-width Select PR button, the name in a plain row, no hint. */
  classic?: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  loadSaved: [string];
  loadBundled: [string];
  define: [];
  browse: [];
  closeBrowse: [];
}>();
</script>

<template>
  <div class="np-pr-step">
    <button id="np-pr-select" class="np-pr-browse" :class="{'np-pr-browse-classic': classic}" title="Choose a saved or bundled passive radiator, or define a new one." @click="emit('browse')">{{ classic ? PhoneWizardText.SELECT_PR : 'Select passive radiator ▸' }}</button>
    <PRBrowser v-if="browsing" @close="emit('closeBrowse')"
      @load="id => emit('loadSaved', id)" @load-bundled="id => emit('loadBundled', id)" @define="emit('define')" />
    <p v-if="!classic" class="np-pr-hint">Pick one above, or type the values straight in.</p>

    <div v-if="classic" class="mob-crow">
      <input id="np-pr-name" class="mob-cname np-pr-name" type="text" aria-label="Passive radiator name" :value="radiator?.name ?? ''" placeholder="e.g. Dayton SD270A-88"
        @input="e => edits.setName(inputValue(e))">
    </div>
    <UIPickField v-else :class="fieldClass" label="Passive radiator name" input-id="np-pr-name" :width="PickWidth.TEXT">
      <input id="np-pr-name" class="np-pr-name" type="text" :value="radiator?.name ?? ''" placeholder="e.g. Dayton SD270A-88"
        @input="e => edits.setName(inputValue(e))">
    </UIPickField>
    <UIFixedField :class="fieldClass" input-id="np-pr-vas" :field="NumberField.PR_VAS_L" :value="radiator?.Vas_m3 ?? null" @update:value="edits.setVas_m3" />
    <UIFixedField :class="fieldClass" input-id="np-pr-qms" :field="NumberField.PR_QMS" :value="radiator?.Qms ?? null" @update:value="edits.setQms" />
    <UIFixedField :class="fieldClass" label="Fs" input-id="np-pr-fs" :field="NumberField.PR_FS_HZ" :value="radiator?.Fs_hz ?? null" @update:value="edits.setFs_hz" />
    <UIFixedField :class="fieldClass" input-id="np-pr-sd" :field="NumberField.PR_SD_CM2" :value="radiator?.Sd_m2 ?? null" @update:value="edits.setSd_m2" />
    <UIFixedField :class="fieldClass" input-id="np-pr-xmax" :field="NumberField.PR_XMAX_MM" :value="radiator?.Xmax_m ?? null" @update:value="edits.setXmax_m" />
  </div>
</template>

<style scoped>
.np-pr-step { margin-top: 10px; }
.np-pr-step:has(.np-pr-browse-classic) { margin-top: 0; }
.np-pr-browse { width: 100%; min-height: var(--ctl-h); border: 1px solid #999; background: #f0f0f0; color: #222; border-radius: 4px; font: inherit; cursor: pointer; }
.np-pr-browse-classic { width: calc(100% - 32px); min-height: 38px; margin: 8px 16px; background: #fff; border-color: #aaa; font-size: 14px; font-weight: 600; }
.np-pr-hint { color: #555; font-size: 13px; margin: 8px 0 12px; }
.np-pr-step :deep(.ui-field) { margin-top: 10px; }
</style>
