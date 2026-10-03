<script setup lang="ts">
// The group the error switches sit in, in both shells: a heading and a tooltip saying what the
// group is. Which controls belong in it is decided in the design package (`OpenISDProject
// .errorSwitches`), not here.
const GROUP_TITLE = 'WinISD errors: each switch makes OpenISD reproduce a known WinISD calculation error. '
  + 'Off, OpenISD does the correct calculation. On, WinISD\'s own result comes back. '
  + 'A switch whose WinISD default is itself the error is on until you turn it off. '
  + 'The yellow look marks them.';
</script>

<template>
  <div class="error-switch-group" :title="GROUP_TITLE">
    <div class="error-switch-group-head">WinISD errors</div>
    <slot />
  </div>
</template>

<style>
.error-switch-group { display: flex; flex-direction: column; gap: 1px; }
.error-switch-group-head { font-size: 11px; font-weight: 600; color: #8a6500; }
</style>
