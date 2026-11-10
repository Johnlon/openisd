<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from 'vue';
import {PhoneRowColumns, PhoneRowSizes} from '@openisd/design/fields';
import {createPhoneLabelColumn, type PhoneLabelColumn} from '../../../hooks/phoneLabelColumn.js';

/** Every phone page takes the one column set, PhoneRowColumns.STANDARD; a page cannot choose its own. */
const vars = Object.fromEntries([...PhoneRowSizes.CLASSIC.cssVars(), ...PhoneRowColumns.STANDARD.cssVars()]);

const root = ref<HTMLElement | null>(null);
let labelColumn: PhoneLabelColumn | null = null;
onMounted(() => { if (root.value !== null) labelColumn = createPhoneLabelColumn(root.value); });
onBeforeUnmount(() => labelColumn?.stop());
</script>

<template>
  <div ref="root" class="mob-classic" :style="vars"><slot /></div>
</template>
