<script setup lang="ts">
/** A field row for a number that is always there (a box loss): an emptied box is refused, never
 *  stored. Takes the number and reports a new one; see `UIFieldBody`. */
import {computed} from 'vue';
import UIFieldBody from './UIFieldBody.vue';
import type {UIBinding, UIFieldCommon} from './uiFieldBinding.js';

const props = defineProps<UIFieldCommon & {value: number | null}>();
const emit = defineEmits<{'update:value': [v: number]}>();

const binding = computed<UIBinding>(() => ({
  kind: 'fixed',
  cell: {value: props.value, set: (v: number) => emit('update:value', v)} as any,
}));
</script>

<template>
  <UIFieldBody :field="field" :required="required" :input-id="inputId" :max="max" :stepper="stepper" :readonly="readonly" :binding="binding" :deviation="deviation" :dq="dq">
    <template v-for="(_, name) in $slots" #[name]="slotData"><slot :name="name" v-bind="slotData" /></template>
  </UIFieldBody>
</template>
