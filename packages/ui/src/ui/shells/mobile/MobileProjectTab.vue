<script setup lang="ts">
// The mobile Project sheet — name, creator, created/modified dates, description, in classic rows
// under one "Project details" band. Thin: all state and domain reads/writes live in
// useMobileProjectTab() (src/hooks/MobileProjectTab-hooks.ts).
import {PhoneHelp} from '@openisd/design/fields';
import {useApp} from '../../../logic/app.js';
import {useFocusedProject} from '../../../logic/focusedProjectContext.js';
import {useMobileProjectTab} from '../../../hooks/MobileProjectTab-hooks.js';
import PhoneBand from './PhoneBand.vue';
import PhoneClassicPage from './PhoneClassicPage.vue';

const project = useFocusedProject();
const { projectChanged } = useApp().appState;
const { name, creator, created, modified, description, dateCommits } = useMobileProjectTab({ project, changed: projectChanged });
</script>

<template>
  <PhoneClassicPage class="project-details-page">
    <PhoneBand :section="PhoneHelp.PROJECT_DETAILS" />
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-proj-name">Name</label>
      <input id="mob-proj-name" class="mob-ctext" type="text" autocomplete="off" v-model="name">
    </div>
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-proj-creator">Creator</label>
      <input id="mob-proj-creator" class="mob-ctext" type="text" autocomplete="off" v-model="creator">
    </div>
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-proj-created">Created</label>
      <input id="mob-proj-created" class="mob-ctext" :key="dateCommits" type="text" autocomplete="off" v-model.lazy="created">
    </div>
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-proj-modified">Modified</label>
      <input id="mob-proj-modified" class="mob-ctext" :key="dateCommits" type="text" autocomplete="off" v-model.lazy="modified">
    </div>
    <div class="mob-crow mob-crow-notes">
      <label class="mob-crow-label" for="mob-proj-description">Description</label>
      <textarea id="mob-proj-description" class="mob-ctext mob-cnotes" v-model="description"></textarea>
    </div>
  </PhoneClassicPage>
</template>

<style scoped>
.project-details-page {display:flex;flex-direction:column;min-height:100%;}
.project-details-page > .mob-crow {flex-shrink:0;}
.mob-crow.mob-crow-notes {flex:1;}
/* Rows, labels and bands are the shared classic ones (style.css); only the text box and notes box live here. */
.mob-ctext {
  flex: 1 1 auto; min-width: 0; box-sizing: border-box; height: var(--mob-input-h);
  padding: 0 var(--mob-col-gutter); border: 1px solid var(--mob-box-line); border-radius: 4px;
  background: #fff; color: var(--fg); font: inherit; font-size: 15px; text-align: left;
}
.mob-ctext:focus { outline: none; border: 2px solid var(--acc); padding: 0 calc(var(--mob-col-gutter) - 1px); }
.mob-crow.mob-crow-notes { flex-direction: column; align-items: stretch; height: auto; gap: 4px; padding-top: 6px; padding-bottom: 8px; }
.mob-crow-notes .mob-crow-label { width: auto; }
.mob-cnotes { flex: 1; min-height: 96px; width:100%; height:auto; padding: 8px var(--mob-col-gutter); resize: none; }
.mob-cnotes:focus { padding: 7px calc(var(--mob-col-gutter) - 1px); }
</style>
