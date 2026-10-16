<script setup lang="ts">
import {usePersistenceBanner} from '../../hooks/PersistenceBanner-hooks.js';

const {text, dismiss} = usePersistenceBanner();
</script>

<template>
  <div v-if="text" class="persist-banner" role="alert">
    <span class="persist-banner-text">{{ text }}</span>
    <button type="button" class="persist-banner-dismiss" aria-label="Dismiss" title="Dismiss" @click="dismiss">&#10005;</button>
  </div>
</template>

<style scoped>
.persist-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fdecc8;
  color: #5a3a00;
  font-size: 13px;
  line-height: 1.4;
  border-bottom: 1px solid #e6c98a;
}
.persist-banner-text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.persist-banner-dismiss {
  flex: none;
  min-width: 44px;
  min-height: 44px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 16px;
  cursor: pointer;
}
</style>
