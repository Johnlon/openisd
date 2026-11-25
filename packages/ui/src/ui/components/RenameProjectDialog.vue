<script setup lang="ts">
import {computed, ref} from 'vue';
import SaveToLibraryDialog from './SaveToLibraryDialog.vue';

const props = defineProps<{ name: string; phone: boolean }>();
const emit = defineEmits<{ save: [name: string]; cancel: [] }>();
const name = ref(props.name);
const fields = [{label: 'Project name', placeholder: '', text: name, inputClass: 'project-rename-input'}];
const canSave = computed(() => name.value.trim().length > 0);
</script>

<template>
  <SaveToLibraryDialog title="Rename project" note="Choose a name for this project." :fields="fields"
    :can-save="canSave" save-label="Save" :phone="phone" @cancel="emit('cancel')" @save="emit('save', name.trim())" />
</template>
