<script setup lang="ts">
/** A field row bound to a cell that can be emptied: an emptied box clears it. See `UIFieldBody`. */
import UIFieldBody from './UIFieldBody.vue';
import type {ClearableUICell, UIFieldCommon} from './uiFieldBinding.js';

defineProps<UIFieldCommon & {cell: ClearableUICell}>();
</script>

<template>
  <UIFieldBody v-bind="$props" :binding="{kind: 'clearable', cell}" />
</template>
