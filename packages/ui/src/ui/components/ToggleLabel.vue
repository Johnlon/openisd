<script setup lang="ts">
// A toggle's on-screen label, line by line as the field breaks it (`ToggleField.labelLines`), in both skins.
// The slot goes after the last line, so a cue there does not widen the label.
import type {ToggleField} from '@openisd/design/fields';

defineProps<{ field: ToggleField }>();
</script>

<template>
  <span class="toggle-label"><template v-for="(line, i) in field.labelLines" :key="i"><br v-if="i > 0">{{ line }}</template><slot /></span>
</template>
