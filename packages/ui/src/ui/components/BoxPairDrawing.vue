<script setup lang="ts">
/** One box drawing with an Iso-Barik pair in it: tells the BoxTypeDiagram inside which pair to draw (see boxPairContext.ts). */
import {provide} from 'vue';
import type {BoxType} from '@openisd/design/engine';
import BoxTypeDiagram from './BoxTypeDiagram.vue';
import {BOX_PAIR} from './boxPairContext.js';

const props = defineProps<{ boxType: BoxType; variant: 'clamshell' | 'tandem'; idSuffix: string }>();
provide(BOX_PAIR, {variant: props.variant, idSuffix: props.idSuffix});
</script>

<template>
  <BoxTypeDiagram :box-type="boxType" />
</template>
