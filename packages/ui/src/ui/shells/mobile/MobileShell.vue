<script setup lang="ts">
// The mobile shell — routes between the Design tabs and the full-screen Graph destination.
// Holds NO logic: every ref/computed/write lives in `useMobileShell()`
// (src/hooks/MobileShell-hooks.ts), mirroring OriginalShell.vue's own 1-to-1 hook rule.
import MobileSaveButton from './MobileSaveButton.vue';
import MobileTabBar from './MobileTabBar.vue';
import ProvenanceLegend from '../../components/ProvenanceLegend.vue';
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
import MobileProjectsPane from './MobileProjectsPane.vue';
import OptionsModal from '../../components/OptionsModal.vue';
import CloudSyncBadge from '../../components/CloudSyncBadge.vue';
import CloudSyncDialog from '../../components/CloudSyncDialog.vue';
import {injectWinisdDifferencesModal} from '../../../hooks/WinisdDifferencesModal-hooks.js';
import {injectDiagnosticsModal} from '../../../hooks/DiagnosticsModal-hooks.js';
import { useMobileShell } from '../../../hooks/MobileShell-hooks.js';
import {provideCellScope} from '../../components/cellScope.js';
import {useApp} from '../../../logic/app.js';
import {OpenableFiles} from '../../../fileFormat.js';
import {inputChecked} from '../../../logic/domEvents.js';
import {APP_UPDATE_TEXT, NO_PROJECT_OPEN} from '@openisd/design/fields';

const {
  projectOpen, destination, fileInput, openImportedFile, openNewProject, switchToDesktop, useAutomaticSkin, skinIsAutomatic,
  menuOpen, toggleMenu, closeMenu, exportProjectsArchive, openFromDisk, isModified, saveProject, saveAllProjects, anyUnsaved, flashMessage, updateBannerVisible, reloadForUpdate, dismissUpdateBanner, dismissReconnect, revertProject, projectTitle,
  browseDrivers, optionsOpen, openOptions, about, goToProject, goToAdvanced, pane, closePane, viewportHeightPx, viewportTopPx, pinSpacePx, onContentScroll,
  showEnclosureTab, enclosureNavLabel, contentEl, canScrollUp, canScrollDown,
  username, appVersion, projectsPaneOpen, openProjectsPane, closeProjectsPane, projectRows, openProjectRows, selectOpenProject, closeOpenProject, shownProjects, projectsFooter, searchOffered, projectQuery, projectOrder, projectOrders, storeLabel, chooseProject,
  setProjectTraceVisible, cycleProjectColour, closeProjectRow, duplicateProjectRow, exportProjectRow, renameProjectRow, resolveProjectRow,
  binRows, binTotal, binOpen, binLabel, moveToBin, restoreFromBin, deleteForever, emptyBin,
  cloudEnabled, cloudSyncDisplay, handleSyncTap, onSyncPointerDown, onSyncPointerUp, onSyncPointerCancel,
  openCloudSync, reconnectCloud, openConflictNotice, turnOnHint, dismissHint, connectCloud, syncNowCloud,
  disconnectCloud, openConflict,
} = useMobileShell();
// The project announces its own writes (`projectChanged`), so a UIField has nothing to add.
const { projectChanged } = useApp().appState;
provideCellScope({ revision: projectChanged, written: () => {} });
const winisdDifferences = injectWinisdDifferencesModal();
const diagnostics = injectDiagnosticsModal();
</script>

<template>
  <div class="mobile-root" :style="{ height: viewportHeightPx ? viewportHeightPx + 'px' : undefined, top: viewportTopPx + 'px' }">
    <input ref="fileInput" type="file" :accept="OpenableFiles.ACCEPT" style="display:none" @change="openImportedFile">

    <!-- No top bar over the Graph destination — it's deliberately full-screen (see
         MobileChartView.vue); the hamburger stays reachable from the other three tabs,
         and with no project open. -->
    <div v-if="!projectOpen || destination !== 'graph'" class="mob-topbar" :class="{ 'mob-shadow-below': canScrollUp }">
      <button type="button" class="mob-hamburger" title="Menu" aria-label="Menu" @click.stop="toggleMenu">
        <span></span><span></span><span></span>
      </button>
      <div class="mob-brand">
        <img src="/icon.svg" alt="" aria-hidden="true">
        <span>OpenISD</span>
      </div>
      <button v-if="projectTitle" type="button" class="mob-project-title" :title="projectTitle" @click="openProjectsPane">{{ projectTitle }}</button>
      <CloudSyncBadge
        v-if="cloudEnabled"
        class="mob-header-sync"
        :display="cloudSyncDisplay"
        @tap="handleSyncTap"
        @pointerdown="onSyncPointerDown"
        @pointerup="onSyncPointerUp"
        @pointercancel="onSyncPointerCancel"
      />
      <MobileSaveButton v-if="projectOpen" />
    </div>

    <div v-if="!projectOpen" class="mob-empty">
      <div class="mob-empty-brand">
        <img src="/icon.svg" alt="" aria-hidden="true">
        <span>OpenISD</span>
      </div>
      <p class="mob-empty-title">{{ NO_PROJECT_OPEN }}</p>
      <!-- Same three actions, words and icons as desktop's empty chart (OriginalShell.vue). -->
      <button type="button" class="mob-cta" @click="openNewProject"><ToolbarIcon name="new" /> <span>New project</span></button>
      <button type="button" class="mob-cta mob-cta-secondary" @click="openProjectsPane"><ToolbarIcon name="open" /> <span>Open project</span></button>
      <button type="button" class="mob-cta mob-cta-secondary" @click="fileInput?.click()"><ToolbarIcon name="import" /> <span>Import project</span></button>
      <button type="button" class="mob-link" @click="switchToDesktop">Switch to Desktop view</button>
      <button v-if="!skinIsAutomatic" type="button" class="mob-link" @click="useAutomaticSkin">Automatic view</button>
    </div>

    <template v-else>
      <main ref="contentEl" class="mob-content" @scroll="onContentScroll">
        <MobileChartView v-if="destination === 'graph'" @menu="toggleMenu" />
        <MobileBoxTab v-else-if="destination === 'box'" />
        <MobileDriverTab v-else-if="destination === 'driver'" />
        <MobileSignalTab v-else-if="destination === 'signal'" />
        <MobileFiltersTab v-else-if="destination === 'filters'" />
        <MobileEnclosureTab v-else-if="destination === 'enclosure'" />
        <div v-if="pinSpacePx > 0" class="mob-pin-space" :style="{ height: pinSpacePx + 'px' }" aria-hidden="true"></div>
      </main>
      <ProvenanceLegend v-if="destination === 'box' || destination === 'signal' || destination === 'enclosure'" />
      <MobilePaneDialog v-if="pane === 'project'" title="Project" @close="closePane">
        <MobileProjectTab />
      </MobilePaneDialog>
      <MobilePaneDialog v-else-if="pane === 'advanced'" title="Advanced" @close="closePane">
        <MobileAdvancedTab />
      </MobilePaneDialog>
      <div v-if="flashMessage" class="mob-update-banner mob-flash-banner" role="status" data-testid="flash-strip">
        <span>{{ flashMessage }}</span>
      </div>
      <div v-else-if="updateBannerVisible" class="mob-update-banner" role="status" data-testid="update-strip">
        <span>{{ APP_UPDATE_TEXT.offer }}</span>
        <button type="button" class="mob-update-reload" data-testid="update-reload" @click="reloadForUpdate">{{ APP_UPDATE_TEXT.reload }}</button>
        <button type="button" class="mob-update-later" data-testid="update-later" @click="dismissUpdateBanner">{{ APP_UPDATE_TEXT.later }}</button>
      </div>
      <div v-else-if="cloudEnabled && cloudSyncDisplay.strip !== null" class="mob-update-banner mob-reconnect-banner" role="status" data-testid="reconnect-strip">
        <span>{{ cloudSyncDisplay.strip.text }}</span>
        <button type="button" class="mob-update-reload" @click="reconnectCloud">{{ cloudSyncDisplay.strip.button }}</button>
        <button type="button" class="mob-update-later" data-testid="reconnect-later" @click="dismissReconnect">{{ cloudSyncDisplay.strip.dismiss }}</button>
      </div>
      <div v-else-if="cloudEnabled && cloudSyncDisplay.conflictNotice !== null" class="mob-update-banner mob-conflict-banner" role="status">
        <span>{{ cloudSyncDisplay.conflictNotice.text }}</span>
        <button type="button" class="mob-update-reload" @click="openConflictNotice">{{ cloudSyncDisplay.conflictNotice.button }}</button>
      </div>
      <div v-else-if="cloudEnabled && cloudSyncDisplay.hint !== null" class="mob-update-banner mob-hint-banner" role="status">
        <span>{{ cloudSyncDisplay.hint.text }}</span>
        <button type="button" class="mob-update-reload" @click="turnOnHint">{{ cloudSyncDisplay.hint.yes }}</button>
        <button type="button" class="mob-update-later" :aria-label="cloudSyncDisplay.hint.no" :title="cloudSyncDisplay.hint.no" @click="dismissHint">&#10005;</button>
      </div>
      <MobileTabBar v-model="destination" :show-enclosure="showEnclosureTab" :enclosure-label="enclosureNavLabel"
        :shadow-above="canScrollDown" />

    </template>

    <!-- App-level: reachable with no project open too (John, 16 Oct 2026). -->
    <MobilePaneDialog v-if="pane === 'drivers'" title="Manage drivers" @close="closePane">
      <MobileManageDriversTab @chosen="destination = 'driver'; closePane()" />
    </MobilePaneDialog>
    <MobilePaneDialog v-else-if="pane === 'cloudSync'" :title="cloudSyncDisplay.dialog.title" @close="closePane">
      <div class="mob-cloud-dialog-body">
        <CloudSyncDialog
          :model="cloudSyncDisplay.dialog"
          @connect="connectCloud"
          @syncNow="syncNowCloud"
          @reconnect="reconnectCloud"
          @disconnect="disconnectCloud"
          @openConflict="openConflict"
        />
      </div>
    </MobilePaneDialog>

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
        <!-- The open projects, one tap away: show on the graphs, colour, switch to, close. -->
        <section v-if="projectOpen" class="mob-menu-section" aria-labelledby="mob-menu-head-open">
          <div id="mob-menu-head-open" class="mob-menu-section-head">Open projects</div>
          <div v-for="row in openProjectRows" :key="row.key" class="mob-open-project" :class="{ focused: row.open.kind === 'open' && row.open.active }">
            <template v-if="row.open.kind === 'open'">
              <label class="mob-open-project-show-wrap">
                <input type="checkbox" class="mob-open-project-show" :checked="row.open.shown"
                       :aria-label="'Show ' + row.name + ' on the graphs'" title="Show/hide this project's trace on the graphs"
                       @change="setProjectTraceVisible(row, inputChecked($event))">
              </label>
              <button type="button" class="mob-open-project-colour-wrap" :aria-label="'Change the colour of ' + row.name" title="Tap to change this project's curve colour"
                      @click="cycleProjectColour(row)"><span class="mob-open-project-colour" :style="{ background: row.open.colour ?? undefined }"></span></button>
              <button type="button" class="mob-open-project-name" :title="row.name" @click="selectOpenProject(row)">
                <span v-if="row.open.unsaved" class="mob-open-project-dot" title="Unsaved changes"></span>{{ row.name }}
              </button>
            </template>
            <button type="button" class="mob-open-project-close" :aria-label="'Close ' + row.name" @click="closeOpenProject(row)">&#10005;</button>
          </div>
        </section>
        <!-- Project: what changes or files the open projects. App: the app and its library. -->
        <section class="mob-menu-section" aria-labelledby="mob-menu-head-project">
          <div id="mob-menu-head-project" class="mob-menu-section-head">Project</div>
          <button type="button" class="mob-menu-item" @click="openProjectsPane">Projects</button>
          <button type="button" class="mob-menu-item" @click="openNewProject">New project</button>
          <button type="button" class="mob-menu-item" @click="openFromDisk">Open a file</button>
          <!-- Project-level items: only with a project open (John, 16 Oct 2026). -->
          <template v-if="projectOpen">
            <div class="mob-menu-sep"></div>
            <button type="button" class="mob-menu-item" :class="{ dirty: isModified }" @click="saveProject(); closeMenu()">Save</button>
            <button type="button" class="mob-menu-item" :class="{ dirty: anyUnsaved }" :disabled="!anyUnsaved" @click="saveAllProjects(); closeMenu()">Save all</button>
            <ExportMenu class="mob-menu-item mob-menu-export">Save As / Export</ExportMenu>
            <div class="mob-menu-sep"></div>
            <button type="button" class="mob-menu-item" :disabled="!isModified" @click="revertProject">Revert unsaved changes</button>
            <div class="mob-menu-sep"></div>
            <button type="button" class="mob-menu-item" @click="goToProject">Project details</button>
            <button type="button" class="mob-menu-item" @click="goToAdvanced">Advanced</button>
          </template>
        </section>
        <section class="mob-menu-section" aria-labelledby="mob-menu-head-app">
          <div id="mob-menu-head-app" class="mob-menu-section-head">App</div>
          <button type="button" class="mob-menu-item" @click="browseDrivers">Manage Drivers</button>
          <button type="button" class="mob-menu-item" @click="openOptions">Options</button>
          <button v-if="cloudEnabled" type="button" class="mob-menu-item mob-menu-cloud" @click="openCloudSync">
            <span>{{ cloudSyncDisplay.dialog.title }}</span>
            <span class="mob-menu-cloud-status">
              <span>{{ cloudSyncDisplay.shortText }}</span>
              <ToolbarIcon :name="cloudSyncDisplay.glyph" />
            </span>
          </button>
          <button type="button" class="mob-menu-item" @click="winisdDifferences.show(); closeMenu()">OpenISD and WinISD differences</button>
          <button type="button" class="mob-menu-item" @click="diagnostics.show(); closeMenu()">Diagnostics</button>
          <button type="button" class="mob-menu-item" @click="about(); closeMenu()">About OpenISD</button>
          <button type="button" class="mob-menu-item" @click="switchToDesktop">Switch to Desktop view</button>
          <button v-if="!skinIsAutomatic" type="button" class="mob-menu-item" @click="useAutomaticSkin">Automatic view</button>
        </section>
      </div>
    </div>

    <!-- Full-screen Projects pane: lists every project, saved or open. -->
    <MobileProjectsPane
      v-if="projectsPaneOpen"
      v-model:query="projectQuery"
      v-model:order="projectOrder"
      v-model:binOpen="binOpen"
      :project-rows="projectRows"
      :shown-projects="shownProjects"
      :projects-footer="projectsFooter"
      :search-offered="searchOffered"
      :project-orders="projectOrders"
      :bin-rows="binRows"
      :bin-total="binTotal"
      :bin-label="binLabel"
      :store-label="storeLabel"
      :choose-project="chooseProject"
      :set-project-trace-visible="setProjectTraceVisible"
      :cycle-project-colour="cycleProjectColour"
      :close-project-row="closeProjectRow"
      :duplicate-project-row="duplicateProjectRow"
      :export-project-row="exportProjectRow"
      :rename-project-row="renameProjectRow"
      :resolve-project-row="resolveProjectRow"
      :move-to-bin="moveToBin"
      :restore-from-bin="restoreFromBin"
      :delete-forever="deleteForever"
      :empty-bin="emptyBin"
      :export-projects-archive="exportProjectsArchive"
      :open-new-project="openNewProject"
      :open-from-disk="openFromDisk"
      @close="closeProjectsPane"
    />

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
  padding-bottom: 4px;
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
  all: unset;
  box-sizing: border-box;
  flex: 1; min-width: 0; margin-left: 12px; text-align: right;
  font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  cursor: pointer;
  color: inherit;
}
.mob-hamburger span { display: block; width: 20px; height: 2px; background: var(--fg); border-radius: 1px; }
.mob-header-sync {
  flex: none;
  width: 40px;
  height: 40px;
  margin-left: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
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
  padding: 5px 18px;
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  cursor: pointer;
}
.mob-menu-item:disabled { color: var(--mut); cursor: default; }
.mob-menu-item.dirty { color: var(--acc2); font-weight: 600; }
.mob-menu-cloud {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.mob-menu-cloud-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--mut);
  font-size: 13px;
}
/* .mob-menu-item's own padding lands on THIS element too (its class list includes both) — zero
   it here so the trigger button below isn't double-indented (12px+12px) relative to every plain
   `<button class="mob-menu-item">` sibling. */
.mob-menu-export { padding: 0; }
.mob-menu-export :deep(.export-menu-trigger) {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  display: block;
  padding: 5px 18px;
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
.mob-open-project { display: flex; align-items: center; min-height: 48px; }
.mob-open-project-show-wrap { flex: none; width: 48px; min-height: 48px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.mob-open-project-show { width: 20px; height: 20px; margin: 0; }
.mob-open-project-colour-wrap { all: unset; box-sizing: border-box; flex: none; width: 40px; min-height: 48px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.mob-open-project-colour { width: 18px; height: 18px; border-radius: 4px; border: 1px solid var(--line); display: block; }
.mob-open-project.focused { background: var(--panel2); }
.mob-open-project-name {
  all: unset;
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px 0 6px;
  font-size: 14px;
  color: var(--fg);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mob-open-project.focused .mob-open-project-name { font-weight: 600; }
.mob-open-project-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--acc2); }
.mob-open-project-close { all: unset; box-sizing: border-box; flex: none; min-width: 48px; min-height: 48px; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--mut); cursor: pointer; }

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
.mob-update-reload { min-height: 44px; padding: 0 16px; border: 1px solid var(--acc); border-radius: 4px; background: var(--acc); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.mob-update-later { min-height: 44px; min-width: 44px; padding: 0 8px; border: none; background: none; color: #224466; font: inherit; cursor: pointer; }
.mob-cloud-dialog-body { padding: 16px; }
.mob-reconnect-banner {
  background: color-mix(in srgb, var(--acc2, #b8790f) 15%, var(--panel, #f9faf9));
  border-top-color: var(--acc2, #b8790f);
  color: color-mix(in srgb, var(--acc2, #b8790f) 60%, black);
}
.mob-reconnect-banner .mob-update-reload {
  background: var(--acc2, #b8790f);
  border-color: var(--acc2, #b8790f);
}
.mob-conflict-banner {
  background: color-mix(in srgb, var(--acc, #1868d1) 15%, var(--panel, #f9faf9));
  border-top-color: var(--acc, #1868d1);
  color: color-mix(in srgb, var(--acc, #1868d1) 60%, black);
}
.mob-hint-banner {
  background: var(--panel2, #e3e8e6);
  border-top-color: var(--line, #c7cdcb);
  color: var(--fg, #1b2120);
}
.mob-hint-banner .mob-update-later {
  color: var(--fg, #1b2120);
}
</style>
