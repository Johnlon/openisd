<script setup lang="ts">
/** The ⓘ button in a wizard row: opens that row's popup. */
defineProps<{ label: string }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button type="button" class="mob-np-info" :aria-label="label" @click="$emit('click')">
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="6" r="1.2" fill="currentColor"/><path d="M10 9 V14.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
  </button>
</template>
