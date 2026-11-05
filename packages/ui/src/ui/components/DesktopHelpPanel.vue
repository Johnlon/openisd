<script setup lang="ts">
// The help a desktop ? opens: a panel down the right side of the window, the page still visible
// beside it. For each section: its name, what it is for, then one line per row. The words come
// from packages/design; this draws them.
import {inject} from 'vue';
import type {PhoneHelpRow, PhoneHelpSection} from '@openisd/design/fields';
import {WinisdDifferencesModalKey} from '../../hooks/WinisdDifferencesModal-hooks.js';
import {useEscToClose} from '../../logic/useEscToClose.js';

const props = defineProps<{title: string; sections: readonly PhoneHelpSection[]}>();
const emit = defineEmits<{close: []}>();
useEscToClose(() => true, () => emit('close'));
// Only a line that links to a Differences entry needs the Differences page.
const differences = inject(WinisdDifferencesModalKey, null);

function showDifference(row: PhoneHelpRow): void {
  if (differences === null || row.difference === undefined) return;
  emit('close');
  differences.showEntry(row.difference);
}
</script>

<template>
  <aside class="desk-help" role="dialog" :aria-label="'Help: ' + props.title">
    <div class="desk-help-head">
      <span>{{ props.title }}</span>
      <button type="button" class="desk-help-close" aria-label="Close help" @click="emit('close')">&#10005;</button>
    </div>
    <div class="desk-help-body">
      <template v-for="section in props.sections" :key="section.title">
        <h4 v-if="props.sections.length > 1" class="desk-help-section">{{ section.title }}</h4>
        <p class="desk-help-intro">{{ section.intro }}</p>
        <p v-for="row in section.rows" :key="row.label" class="desk-help-row"><b>{{ row.label }}:</b> {{ row.text }}<template v-if="row.difference !== undefined"> <button type="button" class="desk-help-more" @click="showDifference(row)">More in Differences ›</button></template></p>
        <ul v-if="section.links.length > 0" class="desk-help-links">
          <li v-for="link in section.links" :key="link.url"><a :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.title }}</a></li>
        </ul>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.desk-help { position: absolute; z-index: 40; top: 0; right: 0; bottom: 0; width: 380px; max-width: 100%; display: flex; flex-direction: column; box-sizing: border-box; background: #fff; border-left: 1px solid #999; box-shadow: -6px 0 18px rgba(0, 0, 0, 0.18); font-size: 14px; line-height: 20px; color: #1a1a1a; }
.desk-help-head { flex: none; display: flex; align-items: center; justify-content: space-between; height: 44px; padding-left: 16px; border-bottom: 1px solid #e6e6e6; font-weight: 600; font-size: 15px; }
.desk-help-close { width: 44px; height: 44px; border: none; background: none; font-size: 16px; color: #555; cursor: pointer; }
.desk-help-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 16px 12px; }
.desk-help-section { margin: 10px 0 0; font-size: 14px; font-weight: 700; }
.desk-help-intro, .desk-help-row { margin: 0 0 4px; overflow-wrap: anywhere; }
.desk-help-intro { color: #555; }
.desk-help-links { margin: 0; padding-left: 18px; overflow-wrap: anywhere; }
.desk-help-links a { color: #1868d1; }
.desk-help-more { border: none; background: none; padding: 0; font: inherit; color: #1868d1; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; white-space: nowrap; }
</style>
