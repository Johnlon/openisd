<script setup lang="ts">
import {PhoneRowColumns, PhoneRowSizes} from '@openisd/design/fields';

/** Every phone page takes the one column set, PhoneRowColumns.STANDARD; a page cannot choose its own. */
const vars = Object.fromEntries([...PhoneRowSizes.CLASSIC.cssVars(), ...PhoneRowColumns.STANDARD.cssVars()]);
</script>

<template>
  <div class="mob-classic" :style="vars"><slot /></div>
</template>
