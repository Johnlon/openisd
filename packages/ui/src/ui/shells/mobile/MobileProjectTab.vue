<script setup lang="ts">
// The mobile Project tab — name, creator, created/modified dates, description. Thin: all state
// and domain reads/writes live in useMobileProjectTab() (src/hooks/MobileProjectTab-hooks.ts).
import {projectChanged} from '../../../logic/appState.js';
import {useFocusedProject} from '../../../logic/focusedProjectContext.js';
import {useMobileProjectTab} from '../../../hooks/MobileProjectTab-hooks.js';

const project = useFocusedProject();
const { name, creator, created, modified, description } = useMobileProjectTab({ project, changed: projectChanged });
</script>

<template>
  <div class="mob-panel">
    <div class="mob-card">
      <div class="mob-field">
        <label for="mob-proj-name">Name</label>
        <input id="mob-proj-name" type="text" v-model="name">
      </div>
      <div class="mob-field">
        <label for="mob-proj-creator">Creator</label>
        <input id="mob-proj-creator" type="text" v-model="creator">
      </div>
      <div class="mob-field">
        <label for="mob-proj-created">Created</label>
        <input id="mob-proj-created" type="text" v-model="created">
      </div>
      <div class="mob-field">
        <label for="mob-proj-modified">Modified</label>
        <input id="mob-proj-modified" type="text" v-model="modified">
      </div>
      <div class="mob-field mob-field-stack">
        <label for="mob-proj-description">Description</label>
        <textarea id="mob-proj-description" v-model="description"></textarea>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mob-panel { padding: 12px; }
.mob-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 4px 12px;
}
.mob-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.mob-field:last-child { border-bottom: none; }
.mob-field label { color: var(--mut); font-size: 14px; flex-shrink: 0; }
.mob-field input, .mob-field textarea {
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 8px 10px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  text-align: right;
  min-height: 38px;
}
.mob-field-stack {
  flex-direction: column;
  align-items: stretch;
}
.mob-field-stack label { margin-bottom: 6px; }
.mob-field-stack textarea { text-align: left; height: 90px; resize: vertical; }
</style>
