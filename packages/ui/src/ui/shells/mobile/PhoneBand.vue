<script setup lang="ts">
// A section band of a classic phone page: the section name in caps, and a ? at the right end that
// opens the section's help sheet (what the section is for, then one line per row).
import {ref} from 'vue';
import type {PhoneHelpSection} from '@openisd/design/fields';
import {useEscToClose} from '../../../logic/useEscToClose.js';
import PhoneHelpSheet from './PhoneHelpSheet.vue';

const props = defineProps<{section: PhoneHelpSection}>();
const open = ref(false);
useEscToClose(() => open.value, () => { open.value = false; });
</script>

<template>
  <div class="mob-band">
    <span class="mob-band-title">{{ props.section.title }}</span>
    <button type="button" class="mob-band-help" :aria-label="'Help: ' + props.section.title" @click="open = true">?</button>
  </div>
  <PhoneHelpSheet v-if="open" :section="props.section" @close="open = false" />
</template>
