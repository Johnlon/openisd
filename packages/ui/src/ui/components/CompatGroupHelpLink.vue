<script setup lang="ts">
// The help link beside a WinISD Compatibility group heading ("WinISD bugs", "Options"), in both
// skins: it opens "OpenISD and WinISD differences" at that group's section.
import type {CompatSwitchGroup} from '@openisd/design/fields';
import {injectWinisdDifferencesModal} from '../../hooks/WinisdDifferencesModal-hooks.js';

const props = defineProps<{ group: CompatSwitchGroup }>();
const {showGroup} = injectWinisdDifferencesModal();
</script>

<template>
  <button type="button" class="compat-help-link" :aria-label="`Help: ${props.group.heading}`" :title="`What the ${props.group.heading} are: OpenISD and WinISD differences`"
          @click.stop="showGroup(props.group)">?</button>
</template>

<style>
.compat-help-link { font: 600 9px/1 sans-serif; width: 14px; height: 14px; padding: 0; border: 1px solid #3a6fb0; border-radius: 50%; background: #e6f0fb; color: #23548f; cursor: pointer; flex-shrink: 0; }
.compat-help-link:hover, .compat-help-link:focus-visible { background: #cfe2f8; }
</style>
