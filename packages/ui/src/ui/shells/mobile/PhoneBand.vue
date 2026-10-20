<script setup lang="ts">
// A section band of a classic phone page: the section name in caps, and a ? at the right end that
// opens the section's help sheet (what the section is for, then one line per row). The words come
// from packages/design (`PhoneHelp`); this draws them.
import {ref} from 'vue';
import type {PhoneHelpSection} from '@openisd/design/fields';
import {useEscToClose} from '../../../logic/useEscToClose.js';

const props = defineProps<{section: PhoneHelpSection}>();
const open = ref(false);
useEscToClose(() => open.value, () => { open.value = false; });
</script>

<template>
  <div class="mob-band">
    <span class="mob-band-title">{{ props.section.title }}</span>
    <button type="button" class="mob-band-help" :aria-label="'Help: ' + props.section.title" @click="open = true">?</button>
  </div>
  <div v-if="open" class="mob-help-overlay" @click.self="open = false">
    <div class="mob-help-sheet" role="dialog" :aria-label="'Help: ' + props.section.title">
      <div class="mob-help-head">
        <span>{{ props.section.title }}</span>
        <button type="button" class="mob-help-close" aria-label="Close help" @click="open = false">&#10005;</button>
      </div>
      <p class="mob-help-intro">{{ props.section.intro }}</p>
      <p v-for="row in props.section.rows" :key="row.label" class="mob-help-row"><b>{{ row.label }}:</b> {{ row.text }}</p>
    </div>
  </div>
</template>
