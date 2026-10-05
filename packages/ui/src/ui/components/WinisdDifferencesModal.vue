<script setup lang="ts">
// The help page "OpenISD and WinISD differences", in both skins: a centred dialog on desktop, full
// screen on a phone (App.vue's mobile rules). The design package decides what it lists
// (`WinisdDifferenceSection`, `WinisdDifference`); the hook decides where it opens. This component
// renders them and scrolls the target into view.
import {nextTick, watch} from 'vue';
import {injectWinisdDifferencesModal} from '../../hooks/WinisdDifferencesModal-hooks.js';
import {useEscToClose} from '../../logic/useEscToClose.js';

const {open, sections, target, close} = injectWinisdDifferencesModal();

useEscToClose(() => open.value, close);

watch([open, target], async ([isOpen, t]) => {
  if (!isOpen || t === null) return;
  await nextTick();
  document.getElementById(t.anchor)?.scrollIntoView({block: 'start'});
});
</script>

<template>
  <div v-if="open" class="wd-overlay" @click.self="close">
    <div class="wd-modal" role="dialog" aria-label="OpenISD and WinISD differences">
      <h2 class="wd-head">OpenISD and WinISD differences<button type="button" class="wd-x" title="Close" aria-label="Close" @click="close">✕</button></h2>
      <div class="wd-body">
        <p class="wd-lead">OpenISD behaves as WinISD by default. These are the places it differs, or lets you choose.</p>
        <section v-for="s in sections" :id="s.anchor" :key="s.anchor" class="wd-section" :class="[s.tone, { current: target === s }]">
          <h3>{{ s.heading }}</h3>
          <p class="wd-intro">{{ s.intro }}</p>
          <article v-for="e in s.entries" :id="e.anchor" :key="e.anchor" class="wd-entry" :class="{ current: target === e }">
            <h4>{{ e.title }}</h4>
            <dl>
              <dt>WinISD</dt><dd>{{ e.winisd }}</dd>
              <dt>OpenISD</dt><dd>{{ e.openisd }}</dd>
              <dt>Seen in</dt><dd>{{ e.seenIn }}</dd>
              <dt>Size</dt><dd>{{ e.size }}</dd>
              <template v-if="e.control !== null"><dt>Switch</dt><dd>"{{ e.control }}"</dd></template>
            </dl>
          </article>
        </section>
      </div>
      <div class="wd-footer"><button type="button" @click="close">Close</button></div>
    </div>
  </div>
</template>

<style>
.wd-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(4, 8, 14, 0.66); display: flex; align-items: center; justify-content: center; padding: 24px; }
.wd-modal { width: min(760px, 94vw); max-height: 88vh; display: flex; flex-direction: column; background: var(--panel, #fff); color: var(--fg, #222); border: 1px solid var(--line, #999); border-radius: 9px; overflow: hidden; }
.wd-head { margin: 0; font-size: 14px; padding: 11px 14px; border-bottom: 1px solid var(--line, #ccc); display: flex; align-items: center; gap: 8px; }
.wd-x { margin-left: auto; background: none; border: none; cursor: pointer; color: var(--mut, #666); font-size: 18px; line-height: 1; }
.wd-body { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 14px 12px; font-size: 12px; line-height: 1.45; }
.wd-lead { margin: 8px 0; }
.wd-section { margin: 12px 0; padding: 6px 10px; border-left: 3px solid var(--line, #ccc); }
.wd-section.bug { border-left-color: #e0b000; background: #fff8db; color: #222; }
.wd-section.bug h3 { color: #8a6500; }
.wd-section h3 { margin: 4px 0; font-size: 13px; }
.wd-intro { margin: 4px 0 8px; }
.wd-entry { margin: 8px 0; padding: 6px 8px; border: 1px solid transparent; border-radius: 4px; scroll-margin-top: 8px; }
.wd-section.current, .wd-entry.current { outline: 2px solid #3a6fb0; outline-offset: 1px; }
.wd-entry h4 { margin: 0 0 4px; font-size: 12px; }
.wd-entry dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 2px 10px; }
.wd-entry dt { font-weight: 600; }
.wd-entry dd { margin: 0; }
.wd-footer { display: flex; justify-content: flex-end; padding: 10px 14px; border-top: 1px solid var(--line, #ccc); }
.wd-footer button { font: inherit; padding: 4px 18px; cursor: pointer; }
</style>
