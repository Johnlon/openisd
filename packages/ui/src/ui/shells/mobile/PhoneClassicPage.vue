<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from 'vue';
import {phoneClassicFieldVars} from './phoneClassicFieldVars.js';
import {createPhoneLabelColumn, type PhoneLabelColumn} from '../../../hooks/phoneLabelColumn.js';

const root = ref<HTMLElement | null>(null);
let labelColumn: PhoneLabelColumn | null = null;
onMounted(() => { if (root.value !== null) labelColumn = createPhoneLabelColumn(root.value); });
onBeforeUnmount(() => labelColumn?.stop());
</script>

<template>
  <div ref="root" class="mob-classic" :style="phoneClassicFieldVars"><slot /></div>
</template>
