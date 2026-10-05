<script setup lang="ts">
// The small dialog that confirms the name a copy is saved under, before it goes into a library
// (Copy to My Drivers, Save to library on the PR page). Display only: the caller holds the names,
// decides whether Save is allowed, and does the save. Centred in the screen (the phone pane on
// mobile), whatever dialog opened it, so it never inherits a parent's width.
import {onMounted, ref} from 'vue';
import {useEscToClose} from '../../logic/useEscToClose.js';
import type {SaveToLibraryField} from '../../hooks/saveToLibraryField.js';

const props = defineProps<{
  title: string;
  note: string;
  fields: readonly SaveToLibraryField[];
  canSave: boolean;
  saveLabel: string;
}>();
const emit = defineEmits<{ save: []; cancel: [] }>();

// The last box takes focus: the model for a driver (the brand rarely changes), the name for a PR.
const inputs = ref<HTMLInputElement[]>([]);
onMounted(() => { inputs.value[props.fields.length - 1]?.focus(); });
useEscToClose(() => true, () => emit('cancel'));
</script>

<template>
  <div class="save-lib-scrim" @click.self="emit('cancel')">
    <div class="save-lib-panel" role="dialog" :aria-label="title">
      <h3>{{ title }}</h3>
      <p class="save-lib-note">{{ note }}</p>
      <div v-for="f in fields" :key="f.label" class="save-lib-fld">
        <label>{{ f.label }}
          <input ref="inputs" v-model="f.text.value" type="text" :class="f.inputClass" :placeholder="f.placeholder"
                 @keydown.enter="canSave && emit('save')">
        </label>
      </div>
      <div class="save-lib-foot">
        <button type="button" class="pri save-confirm-btn" :disabled="!canSave" @click="emit('save')">{{ saveLabel }}</button>
        <button type="button" class="save-cancel-btn" @click="emit('cancel')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.save-lib-scrim {
  position: fixed; inset: 0; z-index: 1200;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, .35);
}
.save-lib-panel {
  box-sizing: border-box; width: 460px; max-width: calc(100% - 24px);
  background: var(--panel); color: var(--fg); border: 1px solid var(--line); box-shadow: 0 6px 22px rgba(0,0,0,.35);
  padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
}
.save-lib-panel h3 { margin: 0 0 2px 0; font-size: 14px; font-weight: 600; }
.save-lib-note { margin: 0; font-size: 11px; line-height: 1.45; color: var(--mut); }
.save-lib-fld label {
  display: flex; align-items: center; gap: 10px;
  font-size: 12px; font-weight: 600; color: var(--mut);
}
.save-lib-fld input {
  flex: 1 1 auto; min-width: 0; box-sizing: border-box; padding: 6px 10px; font-size: 13px;
  border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--fg);
}
.save-lib-foot { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; margin-top: 6px; }
.save-lib-foot .pri { background: var(--acc); color: #fff; border-color: var(--acc); }
.save-lib-foot button:disabled { opacity: .5; cursor: default; }
</style>
