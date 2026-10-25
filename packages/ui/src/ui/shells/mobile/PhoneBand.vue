<script setup lang="ts">
// A section band of a classic phone page: the section name in caps, and a ? at the right end that
// opens the section's help sheet (what the section is for, then one line per row). The words come
// from packages/design (`PhoneHelp`); this draws them. A band whose section has no help text passes
// `title` alone and gets no ?. The default slot sits right after the title (the Graph page's Data chip).
import {computed, ref} from 'vue';
import type {PhoneHelpSection} from '@openisd/design/fields';
import {useEscToClose} from '../../../logic/useEscToClose.js';
import PhoneHelpSheet from './PhoneHelpSheet.vue';

const props = defineProps<{section?: PhoneHelpSection; title?: string}>();
const heading = computed(() => props.title ?? props.section?.title ?? '');
const open = ref(false);
useEscToClose(() => open.value, () => { open.value = false; });
</script>

<template>
  <div class="mob-band">
    <span class="mob-band-title">{{ heading }}<slot /></span>
    <button v-if="props.section" type="button" class="mob-band-help" :aria-label="'Help: ' + heading" @click="open = true">?</button>
  </div>
  <PhoneHelpSheet v-if="open && props.section" :section="props.section" @close="open = false" />
</template>
