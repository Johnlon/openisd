<script setup lang="ts">
// The frame of a classic phone page: gives its rows the classic sizes (PhoneRowSizes.CLASSIC) and
// column widths (PhoneRowColumns.STANDARD) from packages/design, as CSS variables for the rules in style.css.
import {PhoneRowColumns, PhoneRowSizes} from '@openisd/design/fields';

const sizeVars = Object.fromEntries([...PhoneRowSizes.CLASSIC.cssVars(), ...PhoneRowColumns.STANDARD.cssVars()]);
</script>

<template>
  <div class="mob-classic" :style="sizeVars"><slot /></div>
</template>
