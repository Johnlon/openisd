<script setup lang="ts">
/** A field row bound to a cell that always holds a number (a box loss): an emptied box is refused,
 *  never stored. See `UIFieldBody`. */
import UIFieldBody from './UIFieldBody.vue';
import type {FixedUICell, UIFieldCommon} from './uiFieldBinding.js';

defineProps<UIFieldCommon & {cell: FixedUICell}>();
</script>

<template>
  <UIFieldBody v-bind="$props" :binding="{kind: 'fixed', cell}" />
</template>
