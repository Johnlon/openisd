<script setup lang="ts">
// The WinISD deviation cue, in both shells: a small button beside a control whose result differs
// from WinISD because OpenISD fixed a WinISD bug. Clicking it opens the help page "OpenISD and
// WinISD differences" centred in the window at this deviation's entry (John, 2026-10-05: a popup
// beside the cue made the page scroll). Its tooltip stays short: the page carries the detail. The
// design package decides what it says (`WinisdDeviation`) and whether it shows (the caller's
// hook); the app setting "Show WinISD difference markers (≠W)" hides every cue (`cuesShown`).
// This component only renders it.
import type {WinisdDeviation} from '@openisd/design/fields';
import {injectWinisdDifferencesModal} from '../../hooks/WinisdDifferencesModal-hooks.js';

const props = defineProps<{ deviation: WinisdDeviation }>();
const {showDeviation, cuesShown} = injectWinisdDifferencesModal();
</script>

<template>
  <span v-if="cuesShown" class="winisd-deviation">
    <button type="button" class="winisd-deviation-cue" aria-haspopup="dialog" :aria-label="`Differs from WinISD: ${props.deviation.title}`"
            :title="`Differs from WinISD: ${props.deviation.title}`" @click.stop="showDeviation(props.deviation)">≠W</button>
  </span>
</template>

<style>
.winisd-deviation { display: inline-flex; align-items: center; }
.winisd-deviation-cue { font: 600 9px/1 sans-serif; padding: 2px 3px; border: 1px solid #3a6fb0; border-radius: 3px; background: #e6f0fb; color: #23548f; cursor: pointer; }
.winisd-deviation-cue:hover, .winisd-deviation-cue:focus-visible { background: #cfe2f8; outline: 1px solid #3a6fb0; }
</style>
