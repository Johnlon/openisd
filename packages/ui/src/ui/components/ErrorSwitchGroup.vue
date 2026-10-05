<script setup lang="ts">
// The group the WinISD bug switches sit in, in both shells: a heading and a tooltip saying what the
// group is (`CompatSwitchGroup.BUGS`). Which controls belong in it is decided in the design package
// (`CompatSwitch.BUGS`, `OpenISDProject.errorSwitches`), not here.
import {CompatSwitchGroup} from '@openisd/design/fields';
import CompatGroupHelpLink from './CompatGroupHelpLink.vue';

const group = CompatSwitchGroup.BUGS;
</script>

<template>
  <div class="error-switch-group" :title="group.tooltip">
    <div class="error-switch-group-headrow"><div class="error-switch-group-head">{{ group.heading }}</div><CompatGroupHelpLink :group="group" /></div>
    <slot />
  </div>
</template>

<style>
.error-switch-group { display: flex; flex-direction: column; gap: 1px; }
.error-switch-group-headrow { display: flex; align-items: center; gap: 6px; }
.error-switch-group-head { font-size: 11px; font-weight: 600; color: #8a6500; }
</style>
