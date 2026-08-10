<script setup lang="ts">
import { flashMsg } from '../../logging/flash.js';
</script>
<template>
  <div v-if="flashMsg" class="flash">{{ flashMsg }}</div>
</template>
