<script setup lang="ts">
import { ref } from 'vue';
defineProps<{ text: string }>();
const open = ref(false);
</script>

<template>
  <span class="htip-wrap">
    <button class="htip" :title="text" @click.stop="open = !open">?</button>
    <span v-if="open" class="htip-pop" @click.stop>
      {{ text }}
      <button class="htip-x" @click.stop="open = false" title="Close">✕</button>
    </span>
  </span>
</template>

<style scoped>
.htip-wrap { position: relative; display: inline-flex; align-items: center; }
.htip {
  width: 15px; height: 15px; border-radius: 50%;
  border: 1px solid var(--mut); background: none;
  color: var(--mut); font-size: 10px; font-weight: 700;
  cursor: pointer; padding: 0; line-height: 1; flex-shrink: 0; min-height: unset;
}
.htip:hover { border-color: var(--acc); color: var(--acc); }
.htip-pop {
  position: absolute; left: 20px; top: -4px; z-index: 50;
  background: var(--panel2); border: 1px solid var(--line);
  border-radius: 5px; padding: 7px 26px 7px 9px;
  font-size: 11px; color: var(--fg); line-height: 1.5;
  width: 260px; box-shadow: 0 4px 16px #0006;
  white-space: normal; pointer-events: all;
}
.htip-x {
  position: absolute; top: 4px; right: 4px;
  background: none; border: none; color: var(--mut);
  cursor: pointer; font-size: 11px; padding: 0; line-height: 1; min-height: unset;
}
.htip-x:hover { color: var(--fg); }
</style>
