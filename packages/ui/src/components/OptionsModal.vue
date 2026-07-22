<script setup lang="ts">
// Options dialog — recreates WinISD's "Options" modal (docs/winisd/options_general.png,
// options_plot_window.png), opened via the wrench/tools toolbar icon on every skin.
//
// General tab: WinISD's "Units" group box has a single button, "Reset to Metric (l, mm, …)" —
// a one-click GLOBAL unit-system reset, distinct from the per-field unit-cycling behaviour
// (WINISD.md §14). That is exactly store.resetUnitTokens() (clears state.ui.unitTokens, so
// every field reverts to its own default display unit — never touches the stored SI design).
//
// WinISD's General tab also has a Username field and an "Environment" group (Temperature/Air
// pressure/Relative humidity/Sound velocity) that seed new projects' Advanced-pane defaults —
// not modelled here yet (OpenISD's Advanced pane only has per-project values today, no
// app-level defaults concept); tracked in BACKLOG.md rather than fabricated. The Plot Window
// tab (chart colours + per-chart axis limits) is likewise a real WinISD tab not yet built —
// shown as an explicit "not yet in OpenISD" stub, never a fake control.
import { ref } from 'vue';
import { resetUnitTokens } from '../store.js';
import { useEscToClose } from '../composables/useEscToClose.js';

const emit = defineEmits<{ close: [] }>();
function close() { emit('close'); }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }
useEscToClose(() => true, close);

type Tab = 'General' | 'Plot Window';
const tab = ref<Tab>('General');
</script>

<template>
  <div class="opt-overlay" @click="onBackdrop">
    <div class="opt-modal">
      <h2 class="opt-h2">Options<button class="opt-x" @click="close" title="Close">✕</button></h2>

      <div class="opt-tabs">
        <button class="opt-tab" :class="{ on: tab === 'General' }" @click="tab = 'General'">General</button>
        <button class="opt-tab" :class="{ on: tab === 'Plot Window' }" @click="tab = 'Plot Window'">Plot Window</button>
      </div>

      <div class="opt-body">
        <template v-if="tab === 'General'">
          <fieldset class="opt-group">
            <legend>Units</legend>
            <button class="opt-reset-btn" title="Reset every field's display unit back to its default (cm, L, g, Hz, K, Pa…) — undoes any unit clicking. The stored design is never affected." @click="resetUnitTokens">
              Reset to Metric (l, mm, …)
            </button>
          </fieldset>
        </template>
        <template v-else>
          <p class="opt-pending">Plot Window options (chart colours, per-chart axis limits) — not yet in OpenISD.</p>
        </template>
      </div>

      <div class="opt-footer">
        <button class="opt-ok" @click="close">OK</button>
        <button @click="close">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Fully self-contained (own overlay/modal shell, not the shared global .overlay/.modal) —
   deliberately unique class names. Original/Classic each define their OWN unscoped `.overlay`/
   `.modal` rules for their native-style dialogs (e.g. Original's centers-at-top variant); Vue
   applies a parent's scoped-style attribute to a child component's ROOT element too, so reusing
   those same class names here would leak the shell's positioning/sizing onto this modal. */
.opt-overlay { position: fixed; inset: 0; background: rgba(4, 8, 14, 0.66); display: flex;
  align-items: center; justify-content: center; z-index: 200; }
.opt-modal { width: min(420px, 92vw); max-height: 86vh; display: flex; flex-direction: column;
  background: var(--panel); border: 1px solid var(--line); border-radius: 9px; overflow: hidden;
  color: var(--fg); }
.opt-h2 { margin: 0; font-size: 14px; padding: 11px 14px; border-bottom: 1px solid var(--line);
  display: flex; align-items: center; gap: 8px; }
.opt-x { margin-left: auto; cursor: pointer; color: var(--mut); font-size: 18px; line-height: 1;
  background: none; border: none; padding: 0; }
.opt-tabs { display: flex; gap: 2px; padding: 8px 14px 0; }
.opt-tab { font-size: 12px; padding: 6px 12px; border: 1px solid var(--line);
  border-radius: 4px 4px 0 0; background: var(--panel2); color: var(--mut); cursor: pointer; }
/* The active tab must look physically attached to the panel below, not a separate chip sitting
   above a visible seam. Two things are both required — colour-matching the border alone still
   anti-aliases into a thin visible line at a sub-pixel boundary:
   1. Drop the border-bottom entirely (padding-bottom +1px keeps the same overall height as the
      inactive tab, so tabs don't jump/misalign when switching).
   2. Overlap 1px into .opt-body (margin-bottom:-1px) and paint above it (position+z-index) —
      .opt-body's own border-top still draws under the tab's width unless covered like this. */
.opt-tab.on { background: var(--panel); color: var(--fg); font-weight: 600;
  border-bottom: none; padding-bottom: 7px; margin-bottom: -1px; position: relative; z-index: 2; }
.opt-body { min-height: 90px; border-top: 1px solid var(--line); padding: 12px 14px; overflow-y: auto; }
.opt-group { border: 1px solid var(--line); border-radius: 5px; padding: 10px 12px; margin: 0; }
.opt-group legend { padding: 0 6px; font-size: 11px; color: var(--mut); }
.opt-reset-btn { width: 100%; padding: 6px 0; cursor: pointer; }
.opt-pending { color: var(--mut); font-size: 12px; margin: 8px 0; }
.opt-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--line); }
.opt-ok { font-weight: 600; }
</style>
