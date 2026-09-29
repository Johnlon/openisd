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
import ExportMenu from '../../components/ExportMenu.vue';
import OptionsModal from '../../components/OptionsModal.vue';
import { useMobileShell } from '../../../hooks/MobileShell-hooks.js';

const {
  projectOpen, destination, fileInput, openImportedFile, openNewProject, switchToDesktop,
  menuOpen, toggleMenu, closeMenu, openFromDisk, isModified, saveProject, revertProject,
  browseDrivers, optionsOpen, openOptions, about, goToProject, goToAdvanced, viewportHeightPx,
  showEnclosureTab, enclosureNavLabel,
} = useMobileShell();
</script>

<template>
  <div class="mobile-root" :style="{ height: viewportHeightPx ? viewportHeightPx + 'px' : undefined }">
    <input ref="fileInput" type="file" accept=".owpr,.wpr" style="display:none" @change="openImportedFile">

    <div v-if="!projectOpen" class="mob-empty">
      <p class="mob-empty-title">No project open</p>
      <button type="button" class="mob-cta" @click="openNewProject">New project</button>
      <button type="button" class="mob-cta mob-cta-secondary" @click="fileInput?.click()">Open a file</button>
      <button type="button" class="mob-link" @click="switchToDesktop">Switch to Desktop view</button>
    </div>

    <template v-else>
      <!-- No top bar over the Graph destination — it's deliberately full-screen (see
           MobileChartView.vue); the hamburger stays reachable from the other three tabs. -->
      <div v-if="destination !== 'graph'" class="mob-topbar">
        <button type="button" class="mob-hamburger" title="Menu" aria-label="Menu" @click.stop="toggleMenu">
          <span></span><span></span><span></span>
        </button>
      </div>

      <main class="mob-content">
        <MobileChartView v-if="destination === 'graph'" />
        <MobileBoxTab v-else-if="destination === 'box'" />
        <MobileDriverTab v-else-if="destination === 'driver'" />
        <MobileSignalTab v-else-if="destination === 'signal'" />
        <MobileProjectTab v-else-if="destination === 'project'" />
        <MobileFiltersTab v-else-if="destination === 'filters'" />
        <MobileEnclosureTab v-else-if="destination === 'enclosure'" />
        <MobileAdvancedTab v-else-if="destination === 'advanced'" />
      </main>
      <MobileTabBar v-model="destination" :show-enclosure="showEnclosureTab" :enclosure-label="enclosureNavLabel" />

      <div v-if="menuOpen" class="mob-menu-overlay" @click="closeMenu">
        <div class="mob-menu" @click.stop>
          <button type="button" class="mob-menu-item" @click="openNewProject">New project</button>
          <button type="button" class="mob-menu-item" @click="openFromDisk">Open a file</button>
          <button type="button" class="mob-menu-item" :class="{ dirty: isModified }" @click="saveProject(); closeMenu()">Save</button>
          <button type="button" class="mob-menu-item" :disabled="!isModified" @click="revertProject">Revert unsaved changes</button>
          <ExportMenu class="mob-menu-item mob-menu-export">Save As / Export</ExportMenu>
          <div class="mob-menu-sep"></div>
          <button type="button" class="mob-menu-item" @click="goToProject">Project details</button>
          <button type="button" class="mob-menu-item" @click="goToAdvanced">Advanced</button>
          <button type="button" class="mob-menu-item" @click="browseDrivers">Manage Drivers</button>
          <button type="button" class="mob-menu-item" @click="openOptions">Options</button>
          <button type="button" class="mob-menu-item" @click="about(); closeMenu()">About OpenISD</button>
          <div class="mob-menu-sep"></div>
          <button type="button" class="mob-menu-item" @click="switchToDesktop">Switch to Desktop view</button>
        </div>
      </div>
    </template>

    <OptionsModal v-if="optionsOpen" @close="optionsOpen = false" />
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
.mob-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
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
  max-width: 80vw;
  background: var(--panel);
  border-right: 1px solid var(--line);
  box-shadow: 3px 0 12px rgba(0, 0, 0, 0.25);
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}
.mob-menu-item {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  padding: 12px 18px;
  font: inherit;
  font-size: 15px;
  color: var(--fg);
  cursor: pointer;
}
.mob-menu-item:disabled { color: var(--mut); cursor: default; }
.mob-menu-item.dirty { color: var(--acc2); font-weight: 600; }
.mob-menu-export :deep(.export-menu-trigger) {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  display: block;
  padding: 12px 18px;
  font: inherit;
  font-size: 15px;
  color: var(--fg);
  cursor: pointer;
}
.mob-menu-export :deep(.export-menu-trigger:disabled) { color: var(--mut); cursor: default; }
.mob-menu-export :deep(.export-menu-list) { position: static; box-shadow: none; border: none; border-top: 1px solid var(--line); border-radius: 0; margin-top: 0; }
.mob-menu-export :deep(.export-menu-list button) { padding: 10px 28px; font-size: 14px; }
.mob-menu-sep { height: 1px; background: var(--line); margin: 6px 0; }
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
.mob-empty-title { font-size: 16px; color: var(--mut); margin: 0 0 8px; }
.mob-cta {
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
</style>
