<script setup lang="ts">
// The help sheet a ? opens: what the section is for, then one line per row. The words come from
// packages/design (`PhoneHelp`); this draws them. Shared by the section bands and the filter cards.
import type {PhoneHelpSection} from '@openisd/design/fields';
import {useHelpDifferenceLink} from '../../../hooks/WinisdDifferencesModal-hooks.js';
import {usePhoneHelpSheet} from '../../../hooks/PhoneHelpSheet-hooks.js';

const props = defineProps<{section: PhoneHelpSection}>();
const emit = defineEmits<{close: []}>();
usePhoneHelpSheet();
const showDifference = useHelpDifferenceLink(() => emit('close'));
</script>

<template>
  <div class="mob-help-overlay" @click.self="emit('close')">
    <div class="mob-help-sheet" role="dialog" :aria-label="'Help: ' + props.section.title">
      <div class="mob-help-head">
        <span>{{ props.section.title }}</span>
        <button type="button" class="mob-help-close" aria-label="Close help" @click="emit('close')">&#10005;</button>
      </div>
      <p class="mob-help-intro">{{ props.section.intro }}</p>
      <p v-for="row in props.section.rows" :key="row.label" class="mob-help-row"><b>{{ row.label }}:</b> {{ row.text }}<template v-if="row.difference !== undefined"> <button type="button" class="mob-help-more" @click="showDifference(row)">More in Differences ›</button></template></p>
    <ul v-if="props.section.links.length > 0" class="mob-help-links">
        <li v-for="link in props.section.links" :key="link.url"><a :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.title }}</a></li>
      </ul>
    </div>
  </div>
</template>
