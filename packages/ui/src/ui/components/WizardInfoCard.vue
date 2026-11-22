<script setup lang="ts">
/** A wizard ⓘ popup: a white card over a dimmed page, with a title, paragraphs and an optional grey note. */
import type {WizardInfoCard} from '@openisd/design/fields';
import {PhoneWizardText} from '@openisd/design/fields';

defineProps<{ card: WizardInfoCard }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <div class="mob-np-dim" @click="$emit('close')"></div>
  <div class="mob-np-icard" role="dialog" :aria-label="card.title">
    <div class="mob-np-ich">{{ card.title }}<button type="button" :aria-label="PhoneWizardText.CLOSE" @click="$emit('close')">&#10005;</button></div>
    <p v-for="p in card.paragraphs" :key="p">{{ p }}</p>
    <p v-if="card.note !== null" class="mob-np-inote">{{ card.note }}</p>
  </div>
</template>

<style scoped>
.mob-np-dim { position: absolute; inset: 0; z-index: 5; background: rgba(0, 0, 0, 0.25); }
.mob-np-icard { position: absolute; z-index: 6; left: 16px; right: 16px; bottom: 60px; background: #fff; border: 1px solid #999; border-radius: 8px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25); padding: 0 16px 12px; font-size: 14px; line-height: 20px; color: #1a1a1a; }
.mob-np-ich { display: flex; align-items: center; height: 44px; font-weight: 600; font-size: 15px; margin: 0 -16px 4px 0; }
.mob-np-ich button { margin-left: auto; width: 44px; height: 44px; border: none; background: none; font-size: 16px; color: #555; cursor: pointer; }
.mob-np-icard p { margin: 0 0 6px; }
.mob-np-icard .mob-np-inote { color: #555; margin: 0; }
</style>
