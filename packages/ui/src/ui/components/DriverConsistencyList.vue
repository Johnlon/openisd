<script setup lang="ts">
// The driver's consistency summary: "⚠ N values disagree", a link that opens the Driver Editor,
// where the full list is. Display only - the count and the text come from packages/design.
// `inline` (desktop hint row): small text that adds nothing to the row's height.
import {PhoneEditorText} from '@openisd/design/fields';

defineProps<{count: number; inline?: boolean}>();
defineEmits<{open: []}>();
</script>

<template>
  <button v-if="count" type="button" class="driver-consistency-summary" :class="{inline}"
          :title="PhoneEditorText.OPEN_EDITOR_TO_FIX" @click="$emit('open')">⚠ {{ PhoneEditorText.disagreeHeading(count) }}</button>
</template>

<style scoped>
.driver-consistency-summary { font: inherit; font-weight: 600; margin: 0; padding: 0; border: 0; background: none; color: #a02020; cursor: pointer; text-align: left; }
.driver-consistency-summary:hover, .driver-consistency-summary:focus-visible { text-decoration: underline; }
.driver-consistency-summary.inline { font-size: 12px; font-style: normal; line-height: normal; flex: none; white-space: nowrap; padding-right: 6px; }
.driver-consistency-summary:not(.inline) { display: block; margin: 8px 0; padding: 8px; font-size: 14px; }
</style>
