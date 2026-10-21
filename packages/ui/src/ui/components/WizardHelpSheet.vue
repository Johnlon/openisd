<script setup lang="ts">
/** The sheet the ? on the wizard's step bar opens: for each section of the step, what it is for, then one line per row. */
import type {PhoneHelpSection} from '@openisd/design/fields';

defineProps<{ title: string; sections: readonly PhoneHelpSection[] }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <div class="mob-help-overlay" @click.self="$emit('close')">
    <div class="mob-help-sheet" role="dialog" :aria-label="'Help: ' + title">
      <div class="mob-help-head">
        <span>{{ title }}</span>
        <button type="button" class="mob-help-close" aria-label="Close help" @click="$emit('close')">&#10005;</button>
      </div>
      <template v-for="section in sections" :key="section.title">
        <h4 v-if="section.title !== ''" class="mob-help-section">{{ section.title }}</h4>
        <p v-if="section.intro !== ''" class="mob-help-intro">{{ section.intro }}</p>
        <p v-for="row in section.rows" :key="row.label" class="mob-help-row"><b>{{ row.label }}:</b> {{ row.text }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.mob-help-section { margin: 10px 0 0; font-size: 14px; font-weight: 700; }
</style>
