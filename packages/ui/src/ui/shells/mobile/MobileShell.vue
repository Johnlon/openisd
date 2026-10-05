<script setup lang="ts">
// The mobile shell — routes between the Design tabs and the full-screen Graph destination.
// Holds NO logic: every ref/computed/write lives in `useMobileShell()`
// (src/hooks/MobileShell-hooks.ts), mirroring OriginalShell.vue's own 1-to-1 hook rule.
import MobileTabBar from './MobileTabBar.vue';
import MobileBoxTab from './MobileBoxTab.vue';
import MobileDriverTab from './MobileDriverTab.vue';
import MobileSignalTab from './MobileSignalTab.vue';
import MobileChartView from './MobileChartView.vue';
import MobileProjectTab from './MobileProjectTab.vue';
import MobileFiltersTab from './MobileFiltersTab.vue';
import MobileEnclosureTab from './MobileEnclosureTab.vue';
import MobileAdvancedTab from './MobileAdvancedTab.vue';
import MobileManageDriversTab from './MobileManageDriversTab.vue';
import ExportMenu from '../../components/ExportMenu.vue';
import ToolbarIcon from '../../components/ToolbarIcon.vue';
import MobilePaneDialog from './MobilePaneDialog.vue';
import OptionsModal from '../../components/OptionsModal.vue';
import {injectWinisdDifferencesModal} from '../../../hooks/WinisdDifferencesModal-hooks.js';
import { useMobileShell } from '../../../hooks/MobileShell-hooks.js';
import {OpenableFiles} from '../../../fileFormat.js';
import {inputChecked} from '../../../logic/domEvents.js';

const {
  projectOpen, destination, fileInput, openImportedFile, openNewProject, switchToDesktop,
  menuOpen, toggleMenu, closeMenu, openFromDisk, isModified, saveProject, saveAllProjects, anyUnsaved, updateBannerVisible, reloadForUpdate, dismissUpdateBanner, revertProject, projectTitle,
  browseDrivers, optionsOpen, openOptions, about, goToProject, goToAdvanced, pane, closePane, viewportHeightPx,
  showEnclosureTab, enclosureNavLabel, contentEl, canScrollUp, canScrollDown, updateScrollEdges,
  username, appVersion, openDialogOpen, storedProjects, openProjectDialog, openStoredProject,
  openProjectRows, selectOpenProject, setOpenProjectTraceVisible, cycleOpenProjectColour, closeOpenProject,
} = useMobileShell();
const winisdDifferences = injectWinisdDifferencesModal();
</script>

<template>
  <div class="mobile-root" :style="{ height: viewportHeightPx ? viewportHeightPx + 'px' : undefined }">
    <input ref="fileInput" type="file" :accept="OpenableFiles.ACCEPT" style="display:none" @change="openImportedFile">

    <div v-if="!projectOpen" class="mob-empty">
      <div class="mob-empty-brand">
        <img src="/icon.svg" alt="" aria-hidden="true">
        <span>OpenISD</span>
      </div>
      <p class="mob-empty-title">No project open</p>
      <!-- Same three actions, words and icons as desktop's empty chart (OriginalShell.vue). -->
      <button type="button" class="mob-cta" @click="openNewProject"><ToolbarIcon name="new" /> <span>New project</span></button>
      <button type="button" class="mob-cta mob-cta-secondary" @click="openProjectDialog"><ToolbarIcon name="open" /> <span>Open project</span></button>
      <button type="button" class="mob-cta mob-cta-secondary" @click="fileInput?.click()"><ToolbarIcon name="import" /> <span>Import project</span></button>
      <button type="button" class="mob-link" @click="switchToDesktop">Switch to Desktop view</button>
    </div>

    <template v-else>
      <!-- No top bar over the Graph destination — it's deliberately full-screen (see
           MobileChartView.vue); the hamburger stays reachable from the other three tabs. -->
      <div v-if="destination !== 'graph'" class="mob-topbar" :class="{ 'mob-shadow-below': canScrollUp }">
        <button type="button" class="mob-hamburger" title="Menu" aria-label="Menu" @click.stop="toggleMenu">
          <span></span><span></span><span></span>
        </button>
        <div class="mob-brand">
          <img src="/icon.svg" alt="" aria-hidden="true">
          <span>OpenISD</span>
        </div>
        <div v-if="projectTitle" class="mob-project-title" :title="projectTitle">{{ projectTitle }}</div>
      </div>

      <main ref="contentEl" class="mob-content" @scroll="updateScrollEdges">
        <MobileChartView v-if="destination === 'graph'" @menu="toggleMenu" />
        <MobileBoxTab v-else-if="destination === 'box'" />
        <MobileDriverTab v-else-if="destination === 'driver'" />
        <MobileSignalTab v-else-if="destination === 'signal'" />
        <MobileFiltersTab v-else-if="destination === 'filters'" />
        <MobileEnclosureTab v-else-if="destination === 'enclosure'" />
      </main>
      <MobilePaneDialog v-if="pane === 'drivers'" title="Manage drivers" @close="closePane">
        <MobileManageDriversTab @chosen="destination = 'driver'; closePane()" />
      </MobilePaneDialog>
      <MobilePaneDialog v-else-if="pane === 'project'" title="Project" @close="closePane">
        <MobileProjectTab />
      </MobilePaneDialog>
      <MobilePaneDialog v-else-if="pane === 'advanced'" title="Advanced" @close="closePane">
        <MobileAdvancedTab />
      </MobilePaneDialog>
      <div v-if="updateBannerVisible" class="mob-update-banner" role="status">
        <span>A new version of OpenISD is available.</span>
        <button type="button" class="mob-update-reload" @click="reloadForUpdate">Reload</button>
        <button type="button" class="mob-update-later" aria-label="Dismiss" @click="dismissUpdateBanner">&#10005;</button>
      </div>
      <MobileTabBar v-model="destination" :show-enclosure="showEnclosureTab" :enclosure-label="enclosureNavLabel"
        :shadow-above="canScrollDown" />

      <div v-if="menuOpen" class="mob-menu-overlay" @click="closeMenu">
        <div class="mob-menu" @click.stop>
          <div class="mob-menu-brand">
            <img src="/icon.svg" alt="" aria-hidden="true">
            <div class="mob-menu-brand-text">
              <span class="mob-menu-brand-line">
                <span class="mob-menu-brand-name">OpenISD</span>
                <span v-if="appVersion" class="mob-menu-version" data-testid="app-version">{{ appVersion }}</span>
              </span>
              <span v-if="username" class="mob-menu-username">{{ username }}</span>
            </div>
          </div>
          <!-- Project: what changes or files the open projects. App: the app and its library. -->
          <section class="mob-menu-section" aria-labelledby="mob-menu-head-project">
            <div id="mob-menu-head-project" class="mob-menu-section-head">Project</div>
            <button type="button" class="mob-menu-item" @click="openNewProject">New project</button>
            <button type="button" class="mob-menu-item" @click="openProjectDialog">Open project…</button>
            <button type="button" class="mob-menu-item" @click="openFromDisk">Open a file</button>
            <div class="mob-menu-sep"></div>
            <button type="button" class="mob-menu-item" :class="{ dirty: isModified }" @click="saveProject(); closeMenu()">Save</button>
            <button type="button" class="mob-menu-item" :disabled="!anyUnsaved" @click="saveAllProjects(); closeMenu()">Save all</button>
            <ExportMenu class="mob-menu-item mob-menu-export">Save As / Export</ExportMenu>
            <div class="mob-menu-sep"></div>
            <button type="button" class="mob-menu-item" :disabled="!isModified" @click="revertProject">Revert unsaved changes</button>
            <div class="mob-menu-sep"></div>
            <button type="button" class="mob-menu-item" @click="goToProject">Project details</button>
            <button type="button" class="mob-menu-item" @click="goToAdvanced">Advanced</button>
            <div class="mob-menu-sep"></div>
            <div class="mob-menu-heading">Open projects</div>
            <div v-for="(row, i) in openProjectRows" :key="i" class="mob-open-project" :class="{ focused: row.focused }">
              <input type="checkbox" class="mob-open-project-show" :checked="row.traceVisible"
                     :aria-label="'Show ' + row.name + ' on the graphs'" title="Show/hide this project's trace on the graphs"
                     @change="setOpenProjectTraceVisible(row, inputChecked($event))">
              <button type="button" class="mob-open-project-colour" :style="{ background: row.colour }"
                      :aria-label="'Change the colour of ' + row.name" title="Tap to change this project's curve colour"
                      @click="cycleOpenProjectColour(row)"></button>
              <button type="button" class="mob-open-project-name" :title="row.name" @click="selectOpenProject(row)">
                <span v-if="row.unsaved" class="mob-open-project-dot" title="Unsaved changes"></span>{{ row.name }}
              </button>
              <button type="button" class="mob-open-project-close" :aria-label="'Close ' + row.name" @click="closeOpenProject(row)">&#10005;</button>
            </div>
          </section>
          <section class="mob-menu-section" aria-labelledby="mob-menu-head-app">
            <div id="mob-menu-head-app" class="mob-menu-section-head">App</div>
            <button type="button" class="mob-menu-item" @click="browseDrivers">Manage Drivers</button>
            <button type="button" class="mob-menu-item" @click="openOptions">Options</button>
            <button type="button" class="mob-menu-item" @click="winisdDifferences.show(); closeMenu()">OpenISD and WinISD differences</button>
            <button type="button" class="mob-menu-item" @click="about(); closeMenu()">About OpenISD</button>
            <button type="button" class="mob-menu-item" @click="switchToDesktop">Switch to Desktop view</button>
          </section>
        </div>
      </div>
    </template>

    <!-- Outside the project template: the empty state opens it too. -->
    <MobilePaneDialog v-if="openDialogOpen" class="mob-open-project-sheet" title="Open project" @close="openDialogOpen = false">
      <p v-if="storedProjects.length === 0" class="mob-hint">No saved project yet.</p>
      <button v-for="p in storedProjects" :key="p.id" type="button" class="mob-stored-project-row"
        @click="openStoredProject(p.id)">
        <span class="mob-stored-project-name">{{ p.name }}</span>
        <span class="mob-stored-project-summary">{{ p.summary }}</span>
        <span class="mob-stored-project-modified">{{ new Date(p.modified).toLocaleString() }}</span>
      </button>
    </MobilePaneDialog>

    <OptionsModal v-if="optionsOpen" class="mob-options" @close="optionsOpen = false" />
  </div>
</template>

<style scoped>
/* Re-declares the shared tokens, exactly as `.original-root` does in style.css, so the two
   skins can diverge later without one silently inheriting the other's values. The provenance
   colours (--good/--acc/--bad/--acc2) stay byte-identical to :root — that's what keeps the
   Entered/Calculated/Not-available legend meaning the same thing in both skins.
   Instrument-panel palette (brushed-aluminium grey-green, not paper-cream): --m-bg is the
   panel body a phone user holds, --m-panel the raised control-row surface. */
.mobile-root {
  --bg: #EEF1F0; --panel: #F9FAF9; --panel2: #E3E8E6; --line: #C7CDCB;
  --fg: #1B2120; --mut: #59635F; --acc: #1868d1; --acc2: #b8790f; --good: #1b7d1b; --bad: #b02a2a;
  /* Chart readout popup (GraphPanel's .gread) — without this it falls back to style.css's
     dark default, rendered with the near-black --fg text above: an invisible "black box". */
  --readout-bg: rgba(248, 250, 252, 0.92);
  /* A hard cap (height), not a floor (min-height): with min-height, any tab whose content is
     taller than the screen made the WHOLE page grow and scroll together, carrying the tab bar
     off the bottom with it. Capping the root's height forces .mob-content's flex:1 + its own
     overflow-y:auto to actually contain that scrolling, so the topbar and tab bar stay pinned.
     100vh on a real phone browser is also often taller than what's actually visible (it doesn't
     shrink for the address bar) — 100dvh tracks the visible viewport; vh is the fallback for
     browsers that don't support dvh. */
  height: 100vh;
  height: 100dvh;
  /* Width/centering for the phone-pane look, and the fixed-position containing block for every
     overlay app-wide, both live on App.vue's .app-root-mobile (a common ancestor of this AND
     every modal/wizard, which this element alone is not). This element only needs its own
     height (above) and position:relative, for ITS OWN .mob-menu-overlay drawer below. */
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--fg);
  font: 15px/1.5 "Inter", system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}
.mob-content {
  flex: 1;
  /* display:flex here too (not just flex:1) so a full-screen child (the Graph destination) can
     use flex:1 itself to fill this exactly — a block child's height:100% does not reliably
     resolve against a flex ITEM's own implicit height, only against an explicit flex container. */
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-bottom: 8px;
}
/* Every direct child here is a mounted tab's ROOT (`.mob-panel` blocks, `.mob-hint` paragraphs,
   …) — a flex ITEM with the column-flex default `flex-shrink: 1`. Any `.mob-panel` also sets
   `overflow: hidden`, and a flex item with overflow other than visible gets an automatic MINIMUM
   size of 0 (flexbox spec) — so once a tall tab's content exceeds this container, the shrink
   algorithm was silently squashing every panel down to fit and clipping its content, rather than
   letting `.mob-content` overflow so `overflow-y: auto` above could actually scroll (the bug:
   "Environment view truncated instead of scrolling", 2026-09-29 — the Advanced tab was simply
   the first one tall enough to expose it; Box and Enclosure were clipped too). `:deep()` because
   these roots belong to child components, not this one. */
.mob-content > :deep(*) {
  flex-shrink: 0;
}
.mob-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
}
.mob-topbar.mob-shadow-below {
  box-shadow: 0 4px 6px -4px rgba(0, 0, 0, 0.3);
}
.mob-hamburger {
  width: 40px;
  height: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
}
.mob-brand { display: flex; align-items: center; gap: 8px; margin-left: 4px; font-weight: 600; font-size: 17px; }
.mob-brand img { width: 24px; height: 24px; display: block; }
/* The focused project's name: takes the rest of the bar, cut with an ellipsis when long. */
.mob-project-title {
  flex: 1; min-width: 0; margin-left: 12px; text-align: right;
  font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mob-hamburger span { display: block; width: 20px; height: 2px; background: var(--fg); border-radius: 1px; }
.mob-menu-overlay {
  /* absolute, not fixed: covers .mobile-root (its containing block — see .mobile-root's own
     position:relative) rather than the real browser window, so the drawer stays within the
     phone pane instead of spanning/sliding out from the actual (possibly much wider) window. */
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  z-index: 200;
}
.mob-menu {
  position: absolute;
  top: 0;
  left: 0;
  min-width: 240px;
  /* % of the phone pane, not vw: on a wide window the pane is narrower than the window, and an
     80vw drawer covered the whole pane, leaving no overlay to tap to close the menu. */
  max-width: 80%;
  background: var(--panel);
  border-right: 1px solid var(--line);
  box-shadow: 3px 0 12px rgba(0, 0, 0, 0.25);
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}
.mob-menu-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 18px 4px;
}
.mob-menu-brand img { width: 28px; height: 28px; display: block; flex-shrink: 0; }
.mob-menu-brand-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mob-menu-brand-name { font-weight: 600; font-size: 17px; color: var(--fg); }
.mob-menu-brand-line { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.mob-menu-version { font-size: 12px; color: var(--mut); font-variant-numeric: tabular-nums; }
.mob-menu-username { font-size: 13px; color: var(--mut); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mob-menu-item {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  padding: 6px 18px;
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  cursor: pointer;
}
.mob-menu-item:disabled { color: var(--mut); cursor: default; }
.mob-menu-item.dirty { color: var(--acc2); font-weight: 600; }
/* .mob-menu-item's own padding lands on THIS element too (its class list includes both) — zero
   it here so the trigger button below isn't double-indented (12px+12px) relative to every plain
   `<button class="mob-menu-item">` sibling. */
.mob-menu-export { padding: 0; }
.mob-menu-export :deep(.export-menu-trigger) {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  display: block;
  padding: 7px 18px;
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  cursor: pointer;
}
.mob-menu-export :deep(.export-menu-trigger:disabled) { color: var(--mut); cursor: default; }
.mob-menu-export :deep(.export-menu-list) { position: static; box-shadow: none; border: none; border-top: 1px solid var(--line); border-radius: 0; margin-top: 0; }
.mob-menu-export :deep(.export-menu-list button) { padding: 7px 28px; font-size: 14px; }
.mob-menu-sep { height: 1px; background: var(--line); margin: 3px 0; }
.mob-menu-section { border-top: 2px solid var(--line); padding: 2px 0; }
.mob-menu-section-head { padding: 2px 18px 0; font-size: 13px; font-weight: 700; color: var(--acc); }
.mob-menu-heading { padding: 2px 18px; font-size: 12px; color: var(--mut); text-transform: uppercase; letter-spacing: 0.04em; }
.mob-open-project { display: flex; align-items: center; }
.mob-open-project-show { flex: none; margin: 0 0 0 18px; width: 18px; height: 18px; }
.mob-open-project-colour { all: unset; box-sizing: border-box; flex: none; width: 18px; height: 18px; margin-left: 10px; border-radius: 4px; border: 1px solid var(--line); cursor: pointer; }
.mob-open-project.focused { background: var(--panel2); }
.mob-open-project-name {
  all: unset;
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 4px 6px 10px;
  font-size: 14px;
  color: var(--fg);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mob-open-project.focused .mob-open-project-name { font-weight: 600; }
.mob-open-project-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--acc2); }
.mob-open-project-close { all: unset; box-sizing: border-box; flex: none; padding: 6px 14px; font-size: 13px; color: var(--mut); cursor: pointer; }

.mob-hint { margin: 8px 16px; font-size: 12.5px; color: var(--mut); line-height: 1.4; }
.mob-stored-project-row {
  all: unset;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 10px 16px;
  border-top: 1px solid var(--line);
  cursor: pointer;
}
.mob-stored-project-row:first-of-type { border-top: none; }
.mob-stored-project-name { font-size: 15px; color: var(--fg); }
.mob-stored-project-summary { font-size: 13px; color: var(--mut); }
.mob-stored-project-modified { font-size: 12px; color: var(--mut); }

.mob-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}
.mob-empty-brand { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 24px; }
.mob-empty-brand img { width: 40px; height: 40px; display: block; }
.mob-empty-title { font-size: 16px; color: var(--mut); margin: 0 0 8px; }
.mob-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 220px;
  padding: 12px 16px;
  border: 1px solid var(--acc);
  border-radius: 4px;
  background: var(--acc);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.mob-cta-secondary {
  background: var(--panel);
  color: var(--acc);
}
.mob-link {
  margin-top: 12px;
  background: none;
  border: none;
  color: var(--mut);
  text-decoration: underline;
  font: inherit;
  cursor: pointer;
}

/* Bug (John, live on his phone, 2026-09-29): "options appears as an overlay popup and should be
   a regular pane". OptionsModal.vue is one monolithic file (no separable body the way
   DriverLibrary is for DriverBrowser) with desktop specs pinned to its own centred/fixed-width
   layout, so it stays untouched — this makes it fill the phone screen edge-to-edge and scroll
   as a single column instead, from here only. */
.mob-options :deep(.opt-overlay) {
  background: var(--bg);
  align-items: stretch;
  justify-content: stretch;
}
.mob-options :deep(.opt-modal) {
  width: 100%;
  max-width: none;
  max-height: none;
  height: 100%;
  border-radius: 0;
  border: none;
}
.mob-options :deep(.opt-env-grid),
.mob-options :deep(.opt-color-grid) {
  grid-template-columns: 1fr;
}
.mob-options :deep(.opt-body) {
  flex: 1;
}
.mob-update-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #e8f1fb; border-top: 1px solid #b8d4f8; color: #224466; font-size: 14px; }
.mob-update-banner span { flex: 1; }
.mob-update-reload { min-height: 40px; padding: 0 16px; border: 1px solid var(--acc); border-radius: 4px; background: var(--acc); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.mob-update-later { min-height: 40px; min-width: 40px; border: none; background: none; color: #224466; font-size: 16px; cursor: pointer; }
</style>
