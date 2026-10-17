<script setup lang="ts">
/** A field row for a number that is always there: an emptied box is refused, never
 *  stored. Takes the number and reports a new one; see `UIFieldBody`. */
import {computed} from 'vue';
import UIFieldBody from './UIFieldBody.vue';
import type {UIBinding, UIFieldCommon} from './uiFieldBinding.js';

const props = withDefaults(defineProps<UIFieldCommon & {value: number | null}>(), {
  stepper: true,
  defaulted: undefined,
});
const emit = defineEmits<{'update:value': [v: number]}>();

const binding = computed<UIBinding>(() => ({
  kind: 'fixed',
  cell: {value: props.value, set: (v: number | null) => { if (v !== null) emit('update:value', v); }},
}));
</script>

<template>
  <UIFieldBody :field="field" :label="label" :required="required" :input-id="inputId" :max="max" :stepper="stepper" :readonly="readonly" :plain="plain" :binding="binding" :deviation="deviation" :dq-state="dqState" :allow-out-of-range="allowOutOfRange" :defaulted="defaulted" :dq="dq">
    <template v-for="(_, name) in $slots" #[name]="slotData"><slot :name="name" v-bind="slotData" /></template>
  </UIFieldBody>
</template>
