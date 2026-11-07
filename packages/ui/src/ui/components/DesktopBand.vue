<script setup lang="ts">
// A section band of the desktop skin: the section name and a ? at its right end that asks the shell
// to open that section's help panel. The words come from packages/design (`DesktopHelp`, `PhoneHelp`);
// this draws the band. `title` replaces the section's own title when the band is named differently.
// With `titleClass` the ? sits beside the band, not inside it: the banner element carries that class and
// holds only the title text, and the ? is laid over its right end.
import type {PhoneHelpSection} from '@openisd/design/fields';

const props = defineProps<{section: PhoneHelpSection; title?: string; titleClass?: string}>();
defineEmits<{help: [section: PhoneHelpSection]}>();
</script>

<template>
  <div v-if="props.titleClass !== undefined" class="desk-band-wrap">
    <div class="section-header" :class="props.titleClass"><slot>{{ props.title ?? props.section.title }}</slot></div>
    <button type="button" class="desk-band-help desk-band-help-over" :aria-label="'Help: ' + (props.title ?? props.section.title)" @click="$emit('help', props.section)">?</button>
  </div>
  <div v-else class="section-header desk-band">
    <span class="desk-band-title"><slot>{{ props.title ?? props.section.title }}</slot></span>
    <button type="button" class="desk-band-help" :aria-label="'Help: ' + (props.title ?? props.section.title)" @click="$emit('help', props.section)">?</button>
  </div>
</template>

<style scoped>
.desk-band { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.desk-band-title { min-width: 0; }
.desk-band-wrap { position: relative; }
.desk-band-help-over { position: absolute; right: 8px; top: 50%; margin: -8px 0 0; }
</style>

<style>
/* Not scoped: the desktop New project wizard's ? buttons (WizardInfoButton) use this class too. */
.desk-band-help { flex: none; width: 16px; height: 16px; margin: -1px 0; padding: 0; border: 1px solid #999; border-radius: 50%; background: #fff; color: #1868d1; font: inherit; font-size: 11px; font-weight: 700; line-height: 1; cursor: pointer; }
.desk-band-help:hover { background: #dbeaff; border-color: #7fb3ff; }
</style>
