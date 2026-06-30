<script setup>
import { flashMsg } from '../utils/flash.js';
</script>
<template>
  <div v-if="flashMsg" class="flash">{{ flashMsg }}</div>
</template>
