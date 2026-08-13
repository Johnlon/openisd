<script setup lang="ts">
import { useApp } from '../../logic/app.js';

const { logging } = useApp();
</script>
<template>
  <div v-if="logging.message.value" class="flash">{{ logging.message.value }}</div>
</template>
