<script setup lang="ts">
// The WinISD deviation cue, in both shells: a small button beside a control whose result differs
// from WinISD because OpenISD fixed a WinISD bug. It opens a dialog with the bug, its size and what
// brings WinISD's behaviour back (an error switch, or nothing for an input WinISD ignores). The design package decides what it says
// (`WinisdDeviation`) and whether it shows (the caller's hook); this component only renders it.
import {nextTick, ref} from 'vue';
import type {WinisdDeviation} from '@openisd/design/fields';

const props = defineProps<{ deviation: WinisdDeviation }>();

/** Whether the dialog is open — presentation state, this cue's alone. */
const open = ref(false);
const dialog = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);

async function show(): Promise<void> {
  open.value = true;
  await nextTick();
  dialog.value?.focus();
}
function hide(): void {
  open.value = false;
  button.value?.focus();
}
</script>

<template>
  <span class="winisd-deviation" @keydown.esc.stop="hide">
    <button ref="button" type="button" class="winisd-deviation-cue" :aria-label="`Differs from WinISD: ${props.deviation.title}`"
            :aria-expanded="open" :title="`Differs from WinISD: ${props.deviation.title}`" @click.stop="open ? hide() : show()">≠W</button>
    <div v-if="open" ref="dialog" class="winisd-deviation-dialog" role="dialog" :aria-label="props.deviation.title" tabindex="-1" @click.stop>
      <div class="winisd-deviation-title">{{ props.deviation.title }}</div>
      <p>{{ props.deviation.explanation }}</p>
      <p><b>Size:</b> {{ props.deviation.size }}</p>
      <p>{{ props.deviation.remedy }}</p>
      <button type="button" class="winisd-deviation-close" @click="hide">Close</button>
    </div>
  </span>
</template>

<style>
.winisd-deviation { position: relative; display: inline-flex; align-items: center; }
.winisd-deviation-cue { font: 600 9px/1 sans-serif; padding: 2px 3px; border: 1px solid #3a6fb0; border-radius: 3px; background: #e6f0fb; color: #23548f; cursor: pointer; }
.winisd-deviation-cue:hover, .winisd-deviation-cue:focus-visible { background: #cfe2f8; outline: 1px solid #3a6fb0; }
.winisd-deviation-dialog { position: absolute; z-index: 50; top: calc(100% + 4px); left: 0; width: min(320px, 80vw); padding: 8px 10px; background: #fff; border: 1px solid #3a6fb0; border-radius: 4px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); font-size: 12px; color: #222; text-align: left; white-space: normal; }
.winisd-deviation-dialog p { margin: 6px 0; }
.winisd-deviation-title { font-weight: 600; color: #23548f; }
.winisd-deviation-close { font: inherit; padding: 2px 8px; }
</style>
