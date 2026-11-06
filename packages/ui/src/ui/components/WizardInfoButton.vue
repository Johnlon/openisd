<script setup lang="ts">
/** The button in a wizard row that opens that row's popup: the phone's ⓘ, or with `question` the desktop skin's ? (the band help button, DesktopBand.vue). */
defineProps<{ label: string; question?: boolean }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button v-if="question" type="button" class="desk-band-help" :aria-label="label" @click="$emit('click')">?</button>
  <button v-else type="button" class="mob-np-info" :aria-label="label" @click="$emit('click')">
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="6" r="1.2" fill="currentColor"/><path d="M10 9 V14.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
  </button>
</template>

<style scoped>
/* The glyph is centred in the button on every skin; each skin only sets the button's size. */
.mob-np-info { display: grid; place-items: center; padding: 0; }
</style>
