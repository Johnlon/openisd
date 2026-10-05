<script setup lang="ts">
/**
 * A field's data-quality mark: ⚠, with its reason. A tap or click toggles the reason open beside
 * the mark. A `title` alone is never shown on a touch screen, and a passive span lets the browser
 * move a tap onto the nearest clickable neighbour (the unit toggle), which cycled the unit instead.
 * bugs/BUG_20261005_driver-editor-dq-tap-cycles-unit-and-fields-resize.md
 *
 * ONE root element, so the parent's scoped placement rules (`.de-fld > .de-dq`) still reach it.
 * The reason opens under the whole field row (the parent's positioned `.de-fld`), not under the
 * mark, so on a phone it never runs off the screen's left edge.
 */
import {ref} from 'vue';

defineProps<{ note: string }>();
const open = ref(false);
</script>

<template>
  <span class="de-dq">
    <button type="button" class="dq-mark-btn" :title="note" :aria-expanded="open" aria-label="Why this value is flagged"
      @click.stop="open = !open">&#9888;</button>
    <span v-if="open" class="dq-mark-note" role="note" @click.stop="open = false">{{ note }}</span>
  </span>
</template>

<style scoped>
.de-dq { display: inline-block; }
.dq-mark-btn {
  border: none; background: none; padding: 0 2px; margin: 0;
  font: inherit; font-size: 12px; line-height: 1; color: #d68a00; cursor: help;
}
.dq-mark-note {
  position: absolute; z-index: 20; top: 100%; left: 0; right: 0; margin-top: 2px;
  white-space: normal; overflow-wrap: anywhere;
  padding: 4px 6px; border: 1px solid var(--bad); border-radius: 4px;
  background: var(--panel); color: var(--fg); font-size: 11px; line-height: 1.3;
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.2);
}
</style>
