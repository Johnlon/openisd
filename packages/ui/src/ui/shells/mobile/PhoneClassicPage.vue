<script setup lang="ts">
import {computed, provide} from 'vue';
import {PhoneRowColumns, PhoneRowSizes} from '@openisd/design/fields';
import {PHONE_COLUMNS_KEY} from '../../components/phoneColumnsKey.js';

/** The page's column widths: its rows and the fields inside them all take these. */
const props = withDefaults(defineProps<{columns?: PhoneRowColumns}>(), {columns: () => PhoneRowColumns.STANDARD});
const columns = computed(() => props.columns);
provide(PHONE_COLUMNS_KEY, columns);
const vars = computed(() => Object.fromEntries([...PhoneRowSizes.CLASSIC.cssVars(), ...columns.value.cssVars()]));
</script>

<template>
  <div class="mob-classic" :style="vars"><slot /></div>
</template>
