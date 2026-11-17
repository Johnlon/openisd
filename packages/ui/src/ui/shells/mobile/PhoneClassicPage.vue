<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from 'vue';
import {phoneClassicPageVars} from './phoneClassicFieldVars.js';
import {createPhoneLabelColumn, type PhoneLabelColumn} from '../../../hooks/phoneLabelColumn.js';

/** Labels of rows that appear only for some content: the label column is wide enough for them always, so the page keeps its columns. */
const props = defineProps<{reserveLabels?: readonly string[]}>();
const root = ref<HTMLElement | null>(null);
let labelColumn: PhoneLabelColumn | null = null;
onMounted(() => { if (root.value !== null) labelColumn = createPhoneLabelColumn(root.value, props.reserveLabels ?? []); });
onBeforeUnmount(() => labelColumn?.stop());
</script>

<template>
  <div ref="root" class="mob-classic" :style="phoneClassicPageVars"><slot /></div>
</template>
