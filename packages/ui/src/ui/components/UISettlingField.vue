<script setup lang="ts">
/** A field row for a number that is always there but may be cleared: an emptied box asks for `clear`,
 *  which settles the value to its default (a box loss, T211). Takes the number, reports a new one or
 *  the clear; see `UIFieldBody`. */
import {computed} from 'vue';
import UIFieldBody from './UIFieldBody.vue';
import type {UIBinding, UIFieldCommon} from './uiFieldBinding.js';

const props = defineProps<UIFieldCommon & {value: number}>();
const emit = defineEmits<{'update:value': [v: number]; clear: []}>();

const binding = computed<UIBinding>(() => ({
  kind: 'settling',
  cell: {
    value: props.value,
    set: (v: number | null) => { if (v === null) emit('clear'); else emit('update:value', v); },
    clear: () => emit('clear'),
  },
}));
</script>

<template>
  <UIFieldBody :field="field" :required="required" :input-id="inputId" :max="max" :stepper="stepper" :readonly="readonly" :binding="binding" :deviation="deviation" :dq="dq">
    <template v-for="(_, name) in $slots" #[name]="slotData"><slot :name="name" v-bind="slotData" /></template>
  </UIFieldBody>
</template>
