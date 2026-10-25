<script setup lang="ts">
// The one phone button (PHONE_CLASSIC_BUILD_SPEC §1, John 20-21 Oct 2026): every phone button is this
// one. It is style.css's .mob-btn, whose height is PhoneRowSizes.BUTTON_PX read as --mob-button-h.
// `primary` is the filled blue path forward (Next, Save, Apply), one per screen; every other button
// is the plain grey one.
defineProps<{primary?: boolean}>();
const emit = defineEmits<{click: [event: MouseEvent]}>();
</script>

<template>
  <button type="button" class="mob-btn phone-btn" :class="primary ? 'mob-btn-primary' : 'mob-btn-plain'" @click="emit('click', $event)"><slot /></button>
</template>
