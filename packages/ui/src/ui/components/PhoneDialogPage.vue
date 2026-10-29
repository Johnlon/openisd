<script setup lang="ts">
// The body of a classic phone dialog (Options, Cloud sync, Diagnostics, Differences and the storage lists):
// gives its rows the classic sizes (PhoneRowSizes.CLASSIC) and the wide label column the dialogs use
// (PhoneRowColumns.WIDE_LABEL) from packages/design, and draws the few row shapes a dialog has that a
// project page does not: a hint line, a name-and-value line, a button row, a tick or radio line, a
// colour line, a from-to line, a report block. Display only; every word and value is the caller's.
import {computed} from 'vue';
import {PhoneRowColumns, PhoneRowSizes} from '@openisd/design/fields';

const props=withDefaults(defineProps<{columns?:PhoneRowColumns}>(),{columns:()=>PhoneRowColumns.WIDE_LABEL});
const sizeVars=computed(()=>Object.fromEntries([...PhoneRowSizes.CLASSIC.cssVars(),...props.columns.cssVars()]));
</script>

<template>
  <div class="mob-classic mob-dlgpage" :style="sizeVars"><slot /></div>
</template>

<style>
.mob-dlgpage { min-height: 100%; box-sizing: border-box; padding-bottom: 12px; }
.mob-dlgpage .mob-dhint { margin: 0; padding: 8px 16px 10px; font-size: 13px; line-height: 1.45; color: var(--mut); overflow-wrap: anywhere; }
.mob-dlgpage .mob-dhint p { margin: 0 0 6px; }
.mob-dlgpage .mob-dhint p:last-child { margin-bottom: 0; }
.mob-dlgpage .mob-dlink { padding: 0; border: none; background: none; font: inherit; color: var(--acc); text-decoration: underline; cursor: pointer; }
.mob-dlgpage .mob-dkv { display: flex; justify-content: space-between; align-items: center; gap: 12px; box-sizing: border-box; min-height: 32px; padding: 0 16px; border-bottom: 1px solid #eee; font-size: 14px; }
.mob-dlgpage .mob-dkv > span { color: var(--mut); }
.mob-dlgpage .mob-cbtns.mob-dbtns-one button { flex: 0 1 auto; padding: 0 16px; }
.mob-dlgpage .mob-cbtns button:disabled { color: #999; border-color: #ccc; background: #f6f6f6; cursor: default; }
.mob-dlgpage .mob-dcheck { display: flex; align-items: center; gap: 10px; box-sizing: border-box; min-height: 44px; padding: 6px 16px; border-bottom: 1px solid #e6e6e6; cursor: pointer; }
.mob-dlgpage .mob-dcheck input { width: 20px; height: 20px; margin: 0; flex: none; }
.mob-dlgpage .mob-dcheck > span { flex: 1; min-width: 0; font-size: 15px; line-height: 19px; color: var(--fg); overflow-wrap: anywhere; }
.mob-dlgpage .mob-dtext { flex: 1 1 auto; min-width: 0; box-sizing: border-box; height: var(--mob-input-h); padding: 0 var(--mob-col-gutter); border: 1px solid var(--mob-box-line); border-radius: 4px; background: #fff; font: inherit; font-size: 15px; color: inherit; }
.mob-dlgpage .mob-dcolor { flex: none; width: 56px; height: 32px; padding: 0 2px; border: 1px solid var(--mob-box-line); border-radius: 4px; background: #fff; }
.mob-dlgpage .mob-dreset { flex: none; width: 40px; height: 36px; margin-left: auto; border: 1px solid #aaa; border-radius: 6px; background: #fff; font-size: 16px; cursor: pointer; }
.mob-dlgpage .mob-dlim { display: flex; align-items: center; gap: 6px; box-sizing: border-box; height: var(--mob-row-min); padding: 0 16px; box-shadow: inset 0 -1px 0 #e6e6e6; }
.mob-dlgpage .mob-dlim .mob-crow-label { width: 100px; padding-right: 0; }
.mob-dlgpage .mob-dlim-range { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; }
.mob-dlgpage .mob-dlim-range input { flex: 1; width: 0; min-width: 0; box-sizing: border-box; height: var(--mob-input-h); padding: 0 6px; border: 1px solid var(--mob-box-line); border-radius: 4px; font: inherit; font-size: 15px; text-align: right; }
.mob-dlgpage .mob-dlim-range span:last-child { width: 34px; font-size: 12px; line-height: 13px; color: var(--mut); }
.mob-dlgpage .mob-dstate { display: flex; align-items: center; gap: 8px; padding: 10px 16px 2px; font-size: 16px; font-weight: 600; }
.mob-dlgpage .mob-dstate i { width: 10px; height: 10px; border-radius: 50%; }
.mob-dlgpage .mob-dpre { margin: 0; padding: 4px 16px 10px; font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; color: var(--fg); white-space: pre-wrap; overflow-wrap: anywhere; max-height: none; opacity: 1; }
.mob-dlgpage .mob-dcard { border-bottom: 1px solid #e6e6e6; }
.mob-dlgpage .mob-dcard.bug { box-shadow: inset 3px 0 0 #d4a514; }
.mob-dlgpage .mob-dcard-head { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 48px; box-sizing: border-box; padding: 6px 8px 6px 16px; border: none; background: #fff; font: inherit; text-align: left; color: var(--fg); cursor: pointer; }
.mob-dlgpage .mob-dcard.bug .mob-dcard-head { background: #fdf8e6; }
.mob-dlgpage .mob-dcard-head b { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; line-height: 19px; overflow-wrap: anywhere; }
.mob-dlgpage .mob-dcard-head small { display: block; margin-top: 2px; font-size: 12px; font-weight: 400; color: var(--mut); }
.mob-dlgpage .mob-dcard-head .ar { flex: none; width: 28px; text-align: center; color: var(--mut); }
.mob-dlgpage .mob-dcard-body { margin: 0; padding: 2px 16px 10px; }
.mob-dlgpage .mob-dcard-body > div { display: flex; gap: 10px; padding: 4px 0; font-size: 14px; line-height: 1.4; }
.mob-dlgpage .mob-dcard-body dt { flex: none; width: 64px; font-weight: 600; }
.mob-dlgpage .mob-dcard-body dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
</style>
