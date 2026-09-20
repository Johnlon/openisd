<script setup lang="ts">
// The shell — a faithful recreation of WinISD 0.7.0.950's window, holding NO logic.
//
// Architecture (human ruling): 1-to-1 correspondence between Vue and hook — every ref,
// computed, watcher, lifecycle hook and store/domain write this component needs lives in
// src/hooks/OriginalShell-hooks.ts (`useOriginalShell`), where it is a plain composable that
// gets unit-tested without a DOM. This `<script setup>` is nothing but a hook call plus the
// child-component imports; the template reads the destructured API surface only.
import UnitToggle from '../../components/UnitToggle.vue';
import NumInput from '../../components/NumInput.vue';
import GraphPanel from '../../components/GraphPanel.vue';
import ExportMenu from '../../components/ExportMenu.vue';
import ToolbarIcon from '../../components/ToolbarIcon.vue';
import OgFilters from './OgFilters.vue';
import PRBrowser from '../../components/PRBrowser.vue';
import PREditModal from '../../components/PREditModal.vue';
import OptionsModal from '../../components/OptionsModal.vue';
import AdvancedOptions from '../../components/AdvancedOptions.vue';
import BoxTypeDiagram from '../../components/BoxTypeDiagram.vue';
import {useOriginalShell} from '../../../hooks/OriginalShell-hooks.js';

const {
  version, toggleDropdown, openDd, openClick, closeDropdown, presentationState, isModified,
  openDialogOpen, storedProjects, openFromDisk, openStoredProject,
  saveProject, resetProjectToGround, confirmDiscard, about, optionsOpen,
  chartLabel, CHART_ITEMS, selectChart,
  hzInputText, inputValue, onHzInputFocus, onHzInputBlur, onHzKeydown, onHzWheel,
  startNudge, stopNudge, cursorHz, cursorVal, chartMeta, inputChecked, selectedOption,
  WINISD_TRACE, cycleColor, resetChartView, chartMax,
  mainEl, navCollapsed, bottomCollapsed, mainStyle, onNavSplitDown, onBottomSplitDown,
  projectList, isRowVisible, setRowVisible, rowName, selectProject, project, focused, projectOpen, whatIfActive,
  copyCurrentProject, requestCloseProject, closeChallenge, saveThenClose, closeProject,
  genOn, toggleGenerate, genHz, limits,
  boxLabel, pending, chartTab, overlays, chartUnavailable, activeTab,
  showEnclosureTab, enclosureNavLabel,
  selectedBox, BOX_TYPE_OPTIONS, LOSS_MODE_OPTIONS, ARRAY_WIRING_OPTIONS, N_DRIVERS_OPTIONS,
  boxVolume_m3, setBoxVolume_m3, fieldDp, sealedAlignmentEditor, sealedAlignmentOpen,
  sealedAlignmentOptions, sealedAlignmentSelected, sealedAlignmentVolume_L, sealedAlignmentEbp,
  sealedAlignmentSuitability, sealedAlignmentSuitabilityLabel,
  fbState, FB_TARGET_TIP, fmtU, clearVentFieldOn, enterVentFieldOn,
  boxResonance, rearQtc, prSystemTuning,
  fbUnreachable, fbUnreachableMsg, boxLossesOpen, isDual,
  frontVolume_m3, setFrontVolume_m3, frcHz, setFrcHz, rearResonance, frontChamberTuningLabel,
  model, startEdit, startTune, placement,
  activeVent, END_CORRECTION_OPTIONS, VENT_SHAPE_OPTIONS, VENT_COUNT_OPTIONS, ventLState, portPipeResonance_hz,
  prBrowseOpen, prEditOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
  prAddedMassCell, prTuningCell, prResonanceMass, prFsMass_hz, dqOfCell, fmt,
  driveV, rsOhm, advTemp, advHumidity, advPressure, advAir,
  envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
  commitAirTemp, commitAirHumidity, commitAirPressure, resetAirToAppDefaults,
  reconcileDriveV,
  projectName, projectCreator, projectCreated, projectModified, projectDescription,
  boxQl, setBoxQl, boxQa, setBoxQa, boxQp, setBoxQp,
  onFile, fileInput,
} = useOriginalShell();
</script>

<template>
  <div class="original-root">
    <!-- ================= Toolbar ================= -->
    <div class="toolbar">
      <div class="tb-icons">
        <div class="tb-btn" title="Open project" @click="openClick">
          <ToolbarIcon name="open" />
        </div>
        <div class="tb-btn" title="New project — choose box type + starting volume, then a driver." @click="presentationState.newProjectOpen = true">
          <ToolbarIcon name="new" />
        </div>
        <div class="tb-btn" :class="{ dirty: isModified, disabled: !projectOpen }" title="Save - saves the file to browser storage. Use Export to save as file" @click="saveProject">
          <ToolbarIcon name="save" />
        </div>
        <div class="tb-btn" :class="{ disabled: !isModified }" :title="isModified ? 'Revert — discard all unsaved changes and return to the last saved version.' : 'Revert — no unsaved changes to discard.'" @click="isModified && resetProjectToGround(confirmDiscard)">
          <ToolbarIcon name="revert" />
        </div>
        <ExportMenu class="tb-btn" :disabled="!projectOpen" title="Save As / Export — OpenISD project, WinISD project, driver file, or a share link.">
          <ToolbarIcon name="saveAs" />
        </ExportMenu>
        <div class="tb-sep"></div>
        <div class="tb-btn" title="Manage Drivers — browse the library." @click="presentationState.browseOpen = true">
          <ToolbarIcon name="drivers" />
        </div>
        <div class="tb-btn" title="Options" @click="optionsOpen = true">
          <ToolbarIcon name="options" />
        </div>
        <div class="tb-btn has-menu" title="Info" style="position:relative" @click.stop="toggleDropdown('info-dropdown')">
          <ToolbarIcon name="info" />
          <span class="caret" style="position:absolute;bottom:2px;right:2px;">&#9662;</span>
          <div class="dropdown-menu" :class="{ open: openDd === 'info-dropdown' }" @click.stop>
            <div class="menu-item" @click="about(); closeDropdown()">About OpenISD</div>
          </div>
        </div>
        <div class="tb-sep"></div>
        <div class="chart-select" @click.stop="toggleDropdown('chart-dropdown')" title="Choose which curve the graph shows">
          <ToolbarIcon name="chart" />
          <span class="chart-name">{{ chartLabel }}</span>
          <span class="caret">&#9662;</span>
          <div class="dropdown-menu" :class="{ open: openDd === 'chart-dropdown' }" @click.stop>
            <template v-for="item in CHART_ITEMS" :key="item.label">
              <hr v-if="item.sep">
              <div class="menu-item" :class="{ current: item.label === chartLabel }" @click="selectChart(item)">{{ item.label }}</div>
            </template>
          </div>
        </div>
      </div>
      <div class="app-brand" title="OpenISD">
        <img class="brand-icon" src="/icon.svg" alt="" aria-hidden="true">
        <span>OpenISD</span>
        <span v-if="version" class="version-chip">({{ version }})</span>
      </div>
      <div class="cursor-readout">
        <span class="ro-hz">
          <button class="nudge-btn"
                  @pointerdown="startNudge(-1)"
                  @pointerup="stopNudge"
                  @pointerleave="stopNudge"
                  title="Spin frequency down logarithmically within chart limits (hold to spin)">◄</button>
          <input class="ro-hz-input"
                 type="text"
                 :value="hzInputText"
                 @input="hzInputText = inputValue($event)"
                 @focus="onHzInputFocus"
                 @blur="onHzInputBlur"
                 @keydown="onHzKeydown"
                 @wheel.prevent="onHzWheel"
                 placeholder="—"
                 title="Cursor frequency in Hz (XXXXX.XX). Type or use ArrowUp/ArrowDown/wheel/◄► to spin logarithmically." />
          <button class="nudge-btn"
                  @pointerdown="startNudge(1)"
                  @pointerup="stopNudge"
                  @pointerleave="stopNudge"
                  title="Spin frequency up logarithmically within chart limits (hold to spin)">►</button>
          <span class="ro-hz-unit">Hz</span>
          <span style="display:none">{{ cursorHz != null ? cursorHz.toFixed(2) + ' Hz' : '— Hz' }}</span>
        </span>
        <span class="ro-val">{{ cursorVal != null ? cursorVal.toFixed(3) + ' ' + (chartMeta?.unit ?? '') : '— ' + (chartMeta?.unit ?? 'dB') }}</span>
        <button class="chart-max-btn" title="Reset all charts — clears the shared frequency-range zoom and every chart's Y-axis zoom back to the default range."
                @click="resetChartView">⟲</button>
        <button class="chart-max-btn" :title="chartMax ? 'Restore the normal layout (bring back the side and bottom panels)' : 'Maximise the chart over the whole page — the toolbar stays, so the chart type can still be changed'"
                @click="chartMax = !chartMax">{{ chartMax ? '⤡' : '⛶' }}</button>
<div class="color-btn chart-color-btn" :style="{ background: WINISD_TRACE }" title="Click to cycle the current design's curve colour" @click="cycleColor">Color</div>
        </div>
    </div>

    <!-- ================= Main: 2×2 quadrants + splitters ================= -->
    <div ref="mainEl" class="main" :class="{ 'chart-max': chartMax, 'nav-collapsed': navCollapsed, 'bottom-collapsed': bottomCollapsed }" :style="mainStyle">
      <!-- top-left quadrant -->
      <div class="quad-topleft">
        <div class="quad-projects-wrap">
          <div class="panel-title">Projects</div>
          <div class="projects-list">
            <div v-if="projectList.length === 0" class="project-empty-row" style="padding: 12px 10px; color: var(--mut, #888); font-style: italic; font-size: 12px; text-align: center;">
              No projects open
            </div>
            <div v-else v-for="(p, i) in projectList" :key="i" class="project-row"
                 :class="{ selected: p === focused, 'trace-hidden': !isRowVisible(p), 'is-unsaved': p === focused && isModified }"
                 :title="'Project — ' + rowName(p) + (p === focused ? ' (Active)' : ' (Click to select)')"
                 @click="selectProject(p)">
              <input type="checkbox" :checked="isRowVisible(p)"
                     @click.stop
                     @change.stop="setRowVisible(p, inputChecked($event))"
                     title="Show/hide this project's trace on the graph">
              <span>{{ rowName(p) }}</span>
            </div>
          </div>
          <div class="proj-actions">
            <button class="link-btn" :disabled="!projectOpen" title="Copy this project — adds &quot;Copy of &lt;project&gt;&quot; to the list and overlays its curves on the graph for comparison" @click="copyCurrentProject">＋ Copy</button>
            <button class="link-btn close-btn"
                    title="Close the selected project. Unsaved work is not discarded silently — you are asked first."
                    @click="requestCloseProject(focused)">✕ Close</button>
          </div>
        </div>

        <div class="quad-signalgen-wrap">
          <div class="panel-title">Signal Generator</div>
          <div class="signal-gen-row" title="Play a real sine tone out of the audio output for testing speakers.">
            <label><input type="checkbox" v-model="genOn" @change="toggleGenerate"> Generate</label>
            <input v-expo-step type="number" step="1" v-limits="limits('genHz')" v-model.number="genHz"> <span class="unit">Hz</span>
          </div>
        </div>
      </div>

      <!-- vertical splitter: drag to resize the left panel; toggle collapses it -->
      <div class="split-v" title="Drag to resize the left panel" @pointerdown="onNavSplitDown" @dblclick="navCollapsed = !navCollapsed">
        <button class="split-toggle" :title="navCollapsed ? 'Expand the left panel (Projects / Signal Generator)' : 'Collapse the left panel to give the graph more width'"
                @pointerdown.stop @click="navCollapsed = !navCollapsed">{{ navCollapsed ? '›' : '‹' }}</button>
      </div>

      <!-- top-right quadrant: graph -->
      <div class="graph-area">
        <div class="graph-wrap">
          <GraphPanel v-if="projectOpen && !pending && !chartUnavailable" :tabId="chartTab" :bare="true" :primaryColor="WINISD_TRACE" :overlays="overlays" />
          <div v-else-if="projectOpen" class="graph-empty">
            <template v-if="pending">
              <div class="graph-empty-h">{{ boxLabel }}</div>
              <p>Response model pending — this enclosure type isn't modelled by the engine yet, so no curve is drawn.</p>
            </template>
            <template v-else>
              <div class="graph-empty-h">{{ chartLabel }}</div>
              <p>This chart isn't available in the engine yet.</p>
            </template>
          </div>
          <div v-else class="graph-empty">
            <div class="graph-empty-h">Open or Create a project for charts</div>
            <div class="graph-empty-actions">
              <button class="graph-empty-link" @click="presentationState.newProjectOpen = true"><ToolbarIcon name="new" /> <span>New project</span></button>
              <button class="graph-empty-link" @click="openClick"><ToolbarIcon name="open" /> <span>Open project</span></button>
              <button class="graph-empty-link" @click="openFromDisk"><ToolbarIcon name="import" /> <span>Import project</span></button>
            </div>
          </div>
        </div>
      </div>

      <!-- horizontal splitter: drag to resize the bottom section; toggle collapses it -->
      <div class="split-h" title="Drag to resize the bottom section" @pointerdown="onBottomSplitDown" @dblclick="bottomCollapsed = !bottomCollapsed">
        <button class="split-toggle" :title="bottomCollapsed ? 'Expand the bottom section (project tabs)' : 'Collapse the bottom section to give the graph more height'"
                @pointerdown.stop @click="bottomCollapsed = !bottomCollapsed">{{ bottomCollapsed ? '˄' : '˅' }}</button>
      </div>

      <!-- bottom-left quadrant: tab rail -->
      <div class="quad-bottomleft">
        <div class="panel-title">Project</div>
        <ul class="project-nav">
          <li :class="{ active: activeTab === 'box' }" @click="activeTab = 'box'">Box</li>
          <li :class="{ active: activeTab === 'driver' }" @click="activeTab = 'driver'">Driver</li>
          <li v-if="showEnclosureTab" :class="{ active: activeTab === 'enclosure' }" @click="activeTab = 'enclosure'">{{ enclosureNavLabel }}</li>
          <li :class="{ active: activeTab === 'filters' }" @click="activeTab = 'filters'">Filters</li>
          <li :class="{ active: activeTab === 'signal' }" @click="activeTab = 'signal'">Signal</li>
          <li :class="{ active: activeTab === 'advanced' }" @click="activeTab = 'advanced'">Advanced</li>
          <li :class="{ active: activeTab === 'project' }" @click="activeTab = 'project'">Project</li>
        </ul>
      </div>

      <!-- bottom-right quadrant: 7 tabs -->
      <div class="content-panel">
        <template v-if="projectOpen">
        <div class="content-tabs">

        <!-- ===== Box tab ===== -->
        <section v-show="activeTab === 'box'" class="tab-section" :class="{ active: activeTab === 'box' }">
          <div class="box-tab-row">
          <div class="box-tab-main">
          <div class="field-row" style="flex-wrap: nowrap;">
            <div class="field" style="gap:8px;"><label style="width:auto;">Box Type</label>
              <select id="og-box-type" :value="selectedBox" @change="e => { const b = selectedOption(e, BOX_TYPE_OPTIONS); if (b !== null) selectedBox = b; }" style="width:170px">
                <option v-for="o in BOX_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
            <div v-if="selectedBox === 'sealed'" class="field" style="gap:8px;"
              title="Sealed resonance (Fsc) and system Q (Qtc) loss model. Lossless = fs·√(1+Vas/Vb). Conventional Lossy folds Ql/Qa into Qtc only, leaving the frequency fixed (Small/Thiele). WinISD Lossy reports the pole of the lossy 3rd-order model, so Fsc rises as Ql falls — this matches WinISD's own readout. Default: WinISD Lossy.">
              <label style="width:auto;">Model</label>
              <select id="lossmode" :value="presentationState.lossMode" @change="e => { const m = selectedOption(e, LOSS_MODE_OPTIONS); if (m !== null) presentationState.lossMode = m; }" style="width:130px">
                <option v-for="m in LOSS_MODE_OPTIONS" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </div>
          </div>

          <div class="box-layout">
            <div v-if="!isDual" class="box-fields-col" style="width: 412px;">
              <div class="section-header">Rear chamber</div>
              <div class="field-row">
                <div class="field entered"><label>Volume</label><NumInput :model-value="boxVolume_m3" @update:model-value="(v: number | null) => setBoxVolume_m3(v ?? 0)" field="Vb" group="volume" base="L" :precision="fieldDp('Vb')" /><UnitToggle field="Vb" group="volume" base="L" unit-class="unit unit-cyc" /></div>
                <button v-if="selectedBox === 'sealed'" class="link-btn" title="Choose a sealed-box alignment and calculate its volume" @click="sealedAlignmentEditor.openEditor">Alignment</button>
              </div>
              <div class="field-row" style="flex-wrap: nowrap;">
                <!-- A vented chamber's tuning is a real design choice (the port is an extra
                     degree of freedom), so WinISD makes it entered and solves the vent LENGTH
                     from it. A sealed chamber has no port, so Fsc is fully determined by Vb
                     and the driver — calculated, nothing to type. Per-chamber, not per-box. -->
                <template v-if="selectedBox === 'vented'">
                  <div v-if="fbState === 'E'" id="og-fb-target-field" class="field entered" :title="FB_TARGET_TIP"><label>Target Tuning Freq</label><NumInput id="og-fb-target" :model-value="project.box.vented.tuning_hz.get().value" @update:model-value="(v: number | null) => { if (v == null || isNaN(v) || v <= 0) clearVentFieldOn(project, 'Fb'); else enterVentFieldOn(project, 'Fb', v); }" field="Fb" group="freq" base="Hz" :precision="fieldDp('Fb')" /><UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
                  <div v-else id="og-fb-target-field" class="field" :title="FB_TARGET_TIP"><label>Target Tuning Freq</label><input class="calculated greyed" :value="fmtU(project.box.vented.tuning_hz.get().value, 'Fb', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
                </template>
                <template v-else-if="selectedBox === 'sealed'">
                  <div class="field"><label>Fsc</label><input id="og-box-resonance" class="calculated greyed" :value="fmtU(boxResonance, 'boxResonance', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="boxResonance" group="freq" base="Hz" unit-class="unit unit-cyc" style="min-width: auto;" /></div>
                  <div class="field" style="margin-left: 4px; gap: 4px;"><label style="width: auto; margin-right: 4px;">Qtc</label><input class="calculated greyed" :value="rearQtc != null ? rearQtc.toFixed(3) : ''" readonly></div>
                </template>
                <div v-else :class="['field', { 'dq-flag': selectedBox === 'box-passive-radiator' && prSystemTuning.dq.length > 0 }]" :title="selectedBox === 'box-passive-radiator' && prSystemTuning.dq.length > 0 ? prSystemTuning.dq.join('; ') : ''"><label>Fh</label><input id="og-box-resonance" class="calculated greyed" :value="fmtU(boxResonance, 'boxResonance', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="boxResonance" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
              </div>
              <p v-if="selectedBox === 'vented' && fbUnreachable" id="og-fb-unreachable" class="hint" style="color:#a11;">{{ fbUnreachableMsg }}</p>
              <button class="link-btn" @click="boxLossesOpen = true">Advanced-&gt;</button>
            </div>

            <template v-else>
              <div class="box-fields-col">
                <div class="section-header">Rear chamber</div>
                <div class="field-row"><div class="field entered"><label>Volume</label><NumInput :model-value="boxVolume_m3" @update:model-value="(v: number | null) => setBoxVolume_m3(v ?? 0)" field="Vb" group="volume" base="L" :precision="fieldDp('Vb')" /><UnitToggle field="Vb" group="volume" base="L" unit-class="unit unit-cyc" /></div></div>
                <div class="field-row">
                  <div v-if="selectedBox === 'bandpass6' || selectedBox === 'abc'" class="field entered">
                    <label>Tuning freq (Frc)</label>
                    <NumInput :model-value="frcHz" @update:model-value="(v: number | null) => setFrcHz(v ?? 0)" field="Frc" group="freq" base="Hz" :precision="fieldDp('Fb')" />
                    <UnitToggle field="Frc" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                  <div v-else class="field">
                    <label>{{ selectedBox === 'bandpass4' ? 'Frc' : 'Tuning freq' }}</label>
                    <input class="calculated greyed" :value="fmtU(rearResonance, 'rearResonance', 'freq', 'Hz', fieldDp('Fb'))" readonly>
                    <UnitToggle field="rearResonance" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                </div>
                <div v-if="selectedBox === 'bandpass4'" class="field-row">
                  <div class="field"><label>Qtc</label><input class="calculated greyed" :value="rearQtc != null ? rearQtc.toFixed(3) : ''" readonly></div>
                </div>
                <button class="link-btn" @click="boxLossesOpen = true">Advanced-&gt;</button>
              </div>
              <div class="box-fields-col">
                <div class="section-header">Front chamber</div>
                <div class="field-row"><div class="field entered"><label>Volume</label><NumInput :model-value="frontVolume_m3" @update:model-value="(v: number | null) => setFrontVolume_m3(v ?? 0)" field="Vf" group="volume" base="L" :precision="fieldDp('Vf')" /><UnitToggle field="Vf" group="volume" base="L" unit-class="unit unit-cyc" /></div></div>
                <div class="field-row">
                  <div v-if="fbState === 'E'" id="og-ffc-target-field" class="field entered" :title="FB_TARGET_TIP">
                    <label>{{ frontChamberTuningLabel }}</label>
                    <NumInput id="og-ffc-target" :model-value="project.box.vented.tuning_hz.get().value" @update:model-value="(v: number | null) => { if (v == null || isNaN(v) || v <= 0) clearVentFieldOn(project, 'Fb'); else enterVentFieldOn(project, 'Fb', v); }" field="Fb" group="freq" base="Hz" :precision="fieldDp('Fb')" />
                    <UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                  <div v-else id="og-ffc-target-field" class="field" :title="FB_TARGET_TIP">
                    <label>{{ frontChamberTuningLabel }}</label>
                    <input class="calculated greyed" :value="fmtU(project.box.vented.tuning_hz.get().value, 'Fb', 'freq', 'Hz', fieldDp('Fb'))" readonly>
                    <UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                </div>
                <p v-if="fbUnreachable" id="og-ffc-unreachable" class="hint" style="color:#a11;">{{ fbUnreachableMsg }}</p>
              </div>
            </template>

          </div>
          </div>
          <div class="box-diagram-col">
              <BoxTypeDiagram :box-type="selectedBox" />
            </div>
            <!-- Notes sit BESIDE the diagram, not under the row: stacked below, they grew the
                 pane (and so the whole bottom track, which is auto-sized) whenever a box type
                 with notes was picked, shifting the chart above. -->
            <div class="box-notes-col">
              <p class="hint"><b>Rear chamber</b> is the chamber behind the driver, <b>front chamber</b> the one in front of it. Closed, vented and PR have a rear chamber only.</p>
              <p v-if="selectedBox === 'sealed'" class="hint"><b>Sealed (Fsc):</b> System resonance frequency where the speaker impedance peaks and below which the response rolls off at 12 dB/octave. Solved from the box volume Vb.</p>
              <p v-if="selectedBox === 'vented'" class="hint"><b>Vented (Fb):</b> Helmholtz resonance of the box volume and port. At Fb, port output is maximized and driver cone excursion is minimized.</p>
              <p v-if="selectedBox === 'box-passive-radiator'" class="hint"><b>PR (Fp):</b> Helmholtz-like tuning frequency of the passive radiator and Vb. Lowered by adding mass (Madd) to the radiator cone.</p>
              <p v-if="selectedBox === 'bandpass4'" class="hint"><b>Bandpass 4th order:</b> Uses sealed rear chamber resonance (Frc) for low-end control, and front chamber port tuning (Fb) to bandpass-filter the output.</p>
              <p v-if="selectedBox === 'bandpass6'" class="hint"><b>Bandpass 6th order:</b> Dual-tuned bandpass filter. Front and rear chambers are both tuned to separate port frequencies to shape the passband.</p>
              <p v-if="selectedBox === 'abc'" class="hint">ABC's driver mounts on the outer baffle, firing straight into the room — unlike 4th/6th order bandpass, where the driver is fully enclosed and fires only into the two internal chambers.</p>
              <p v-if="pending" class="hint pending-note"><b>Response model pending.</b> The engine doesn't model this enclosure type yet — the diagram and chamber volumes are editable, but no curve is computed.</p>
            </div>
          </div>
        </section>

        <!-- ===== Driver tab ===== -->
        <section v-show="activeTab === 'driver'" class="tab-section" :class="{ active: activeTab === 'driver' }">
          <div class="field-row driver-id-row">
            <div class="field tight"><label>Brand</label><input type="text" style="width:130px" :value="project.driver.brand.get().value" readonly></div>
            <div class="field tight"><label>Model</label><input type="text" style="width:140px" :value="model" readonly></div>
            <button class="edit-btn" title="Swap in a different driver for this project." @click="presentationState.browseOpen = true">Select Driver</button>
            <button class="edit-btn" title="Full editor for this driver in the current project." @click="startEdit">&#9998; Edit</button>
          </div>
          <div class="two-col" style="margin-top:10px;">
            <div style="--label-w:150px;">
              <div class="section-header">Placement</div>
              <div class="field-row">
                <div class="field"><label>Num. of drivers</label>
                  <select :value="project.nDrivers.get()" @change="e => { const n = selectedOption(e, N_DRIVERS_OPTIONS); if (n !== null) project.nDrivers.set(n); }"><option v-for="o in N_DRIVERS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option></select>
                  <span>driver(s)</span>
                </div>
              </div>
              <div class="radio-group field-row">
                <label><input type="radio" name="og-placement" value="standard" v-model="placement"> Standard</label>
                <label><input type="radio" name="og-placement" value="iso" v-model="placement" disabled> Iso-Barik <em style="color:#999">(not modelled)</em></label>
              </div>
              <div class="field-row">
                <div class="field"><label>Voice coil connection</label>
                  <select :value="project.wiring.get()" @change="e => { const w = selectedOption(e, ARRAY_WIRING_OPTIONS); if (w !== null) project.wiring.set(w); }"><option v-for="o in ARRAY_WIRING_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option></select>
                </div>
              </div>
            </div>
            <div style="--label-w:172px;">
              <div class="section-header">Advanced options</div>
              <div class="beside-hint">
                <div>
                  <div class="field-row"><div class="field entered"><label>Voice coil temp rise</label><NumInput :model-value="project.vcTempRise_K.get()" @update:model-value="(v: number | null) => project.vcTempRise_K.set(v ?? 0)" field="vcTempRise" group="tempDiff" base="K" :precision="fieldDp('vcTempRise')" /><UnitToggle field="vcTempRise" group="tempDiff" base="K" unit-class="unit" /></div></div>
                  <div class="field-row"><div class="field entered"><label>Voice coil resistance TC</label><NumInput :model-value="project.alfaVC_per_K.get()" @update:model-value="(v: number | null) => project.alfaVC_per_K.set(v ?? 0)" field="alfaVC_per_K" group="tempCoeff" base="perMilliK" :precision="fieldDp('alfaVC_per_K')" /><UnitToggle field="alfaVC_per_K" group="tempCoeff" base="perMilliK" unit-class="unit" /></div></div>
                  <div class="field-row"><div class="field entered"><label>Added mass to cone</label><NumInput :model-value="project.driverAddedMass_kg.get()" @update:model-value="(v: number | null) => project.driverAddedMass_kg.set(v ?? 0)" field="driverAddedMass" group="mass" base="g" :precision="fieldDp('driverAddedMass')" /><UnitToggle field="driverAddedMass" group="mass" base="g" unit-class="unit" /></div></div>
                </div>
                <p class="hint side-hint">Temp rise × resistance TC model voice-coil power compression; added mass raises Mms (lowers Fs). WinISD parity.</p>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== Enclosure / Vents tab ===== -->
        <section v-show="activeTab === 'enclosure'" class="tab-section" :class="{ active: activeTab === 'enclosure' }">
          <!-- The alignment (box type) stays selectable here, not just on the wizard / Box tab:
               the enclosure content changes per box type, so the selector belongs beside it. -->
          <div class="field-row" style="flex-wrap: nowrap;">
            <div class="field" style="gap:8px;"><label style="width:auto;">Box Type</label>
              <select id="og-box-type-enclosure" :value="selectedBox" @change="e => { const b = selectedOption(e, BOX_TYPE_OPTIONS); if (b !== null) selectedBox = b; }" style="width:170px">
                <option v-for="o in BOX_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
          </div>
          <!-- vented / bandpass4 -->
          <div v-if="selectedBox === 'vented' || selectedBox === 'bandpass4'">
            <div class="section-header">Vents</div>
            <div class="two-col">
              <!-- Column 1: Config -->
              <div class="vent-config-col">
                <div class="field-row">
                  <div class="field">
                    <label>Number of Vents</label>
                    <select id="vent-count" :value="activeVent.count.get().value" @change="e => { const n = selectedOption(e, VENT_COUNT_OPTIONS); if (n !== null) activeVent.count.set(n); }">
                      <option v-for="o in VENT_COUNT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                    </select>
                  </div>
                </div>
                <div class="field-row">
                  <div class="field">
                    <label>Shape</label>
                    <select :value="activeVent.shape.get()" @change="e => { const shape = selectedOption(e, VENT_SHAPE_OPTIONS); if (shape !== null) activeVent.shape.set(shape); }">
                      <option v-for="o in VENT_SHAPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                    </select>
                  </div>
                </div>
                <div class="field-row">
                  <div class="field entered">
                    <label>End Correction</label>
                    <select :value="activeVent.endCorrection_m.get()" @change="e => { const k = selectedOption(e, END_CORRECTION_OPTIONS); if (k !== null) activeVent.endCorrection_m.set(k); }" style="width:190px">
                      <option v-for="o in END_CORRECTION_OPTIONS" :key="o.value" :value="o.value">{{ o.label }} ({{ o.value }})</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Column 2: Dimensions -->
              <div class="vent-dims-col">
                <div v-if="activeVent.shape.get() === 'slotted'">
                  <div class="field-row">
                    <div class="field entered">
                      <label>Slot width</label>
                      <NumInput :model-value="activeVent.width_m.get().value" @update:model-value="(v: number | null) => enterVentFieldOn(project, 'ventW', v ?? 0)" field="ventW" group="length" base="cm" :precision="fieldDp('ventW')" />
                      <UnitToggle field="ventW" group="length" base="cm" unit-class="unit unit-cyc" />
                    </div>
                  </div>
                  <div class="field-row">
                    <div class="field entered">
                      <label>Slot height</label>
                      <NumInput :model-value="activeVent.height_m.get().value" @update:model-value="(v: number | null) => enterVentFieldOn(project, 'ventH', v ?? 0)" field="ventH" group="length" base="cm" :precision="fieldDp('ventH')" />
                      <UnitToggle field="ventH" group="length" base="cm" unit-class="unit unit-cyc" />
                    </div>
                  </div>
                </div>
                <div v-else>
                  <div class="field-row">
                    <div class="field entered">
                      <label>Vent diameter</label>
                      <NumInput :model-value="activeVent.diameter_m.get().value" @update:model-value="(v: number | null) => enterVentFieldOn(project, 'ventD', v ?? 0)" field="ventD" group="length" base="cm" :precision="fieldDp('ventD')" />
                      <UnitToggle field="ventD" group="length" base="cm" unit-class="unit unit-cyc" />
                    </div>
                  </div>
                </div>

                <div class="field-row">
                  <div v-if="ventLState === 'E'" class="field entered">
                    <label>Vent length</label>
                    <NumInput :model-value="activeVent.length_m.get().value" @update:model-value="(v: number | null) => { if (v == null || isNaN(v) || v <= 0) clearVentFieldOn(project, 'ventL'); else enterVentFieldOn(project, 'ventL', v); }" field="ventL" group="length" base="cm" :precision="fieldDp('ventL')" />
                    <UnitToggle field="ventL" group="length" base="cm" unit-class="unit unit-cyc" />
                  </div>
                  <div v-else class="field">
                    <label>Vent length</label>
                    <!-- Shown exactly as solved, negative included: a target above the L = 0
                         ceiling has no buildable port, and the honest readout says so instead
                         of a floored length that tunes somewhere else. -->
                    <input id="og-vent-length-ro" class="calculated greyed" :class="{ impossible: (activeVent.length_m.get().value ?? 0) <= 0 }" :value="fmtU(activeVent.length_m.get().value, 'ventL', 'length', 'cm', fieldDp('ventL'))" readonly>
                    <UnitToggle field="ventL" group="length" base="cm" unit-class="unit unit-cyc" />
                  </div>
                </div>
              </div>

              <!-- Column 3: the solver's target, then what the geometry yields -->
              <div>
                <!-- The target tuning is the port solver's INPUT, so it belongs on this pane as
                     well as the Box tab — you are sizing a vent, and this is the number it is
                     sized to (human ruling QO11). WinISD shows it only on its Box screen
                     (docs/winisd_screenshots/view_3_ported.png has no tuning field); carrying it here is
                     deliberately ours. Same tuning target, same E/C state and same setter as the
                     Box tab: ONE stored value with two places to see and edit it.
                     It sits in this column, not beside the other config fields, because the
                     pane's height is set by its tallest column: a fourth row in either of the
                     first two overflows the panel for the round or the slotted shape
                     (test/ui/bottom-scroll.browser.spec.ts). Here every shape stays at three. -->
                <div class="field-row">
                  <div v-if="fbState === 'E'" id="og-vent-fb-target-field" class="field entered" :title="FB_TARGET_TIP">
                    <label>Target Tuning Freq</label>
                    <NumInput id="og-vent-fb-target" :model-value="project.box.vented.tuning_hz.get().value" @update:model-value="(v: number | null) => { if (v == null || isNaN(v) || v <= 0) clearVentFieldOn(project, 'Fb'); else enterVentFieldOn(project, 'Fb', v); }" field="Fb" group="freq" base="Hz" :precision="fieldDp('Fb')" />
                    <UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                  <div v-else id="og-vent-fb-target-field" class="field" :title="FB_TARGET_TIP">
                    <label>Target Tuning Freq</label>
                    <input id="og-vent-fb-target" class="calculated greyed" :value="fmtU(project.box.vented.tuning_hz.get().value, 'Fb', 'freq', 'Hz', fieldDp('Fb'))" readonly>
                    <UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                </div>
                <div class="field-row">
                  <div class="field"><label>Cross area</label><input class="calculated greyed" :value="fmtU(activeVent.area_m2(), 'ventArea', 'area', 'm2', fieldDp('ventCrossArea'))" readonly><UnitToggle field="ventCrossArea" group="area" base="m2" unit-class="unit" /></div>
                </div>
                <div class="field-row">
                  <div class="field"><label>1st port resonance</label><input class="calculated greyed" :value="fmtU(portPipeResonance_hz, 'portResonance', 'freq', 'Hz', fieldDp('portResonance'))" readonly><UnitToggle field="portResonance" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
                </div>
              </div>
            </div>
            <!-- No trailing hint here: the pane must fit the fixed bottom panel without
                 scrolling (bottom-scroll.browser.spec.ts), and the target-tuning guidance already
                 lives in the field's own tooltip (FB_TARGET_TIP). -->
            <p v-if="fbUnreachable" id="og-vent-unreachable" class="hint" style="color:#a11;">{{ fbUnreachableMsg }}</p>
          </div>

          <!-- passive radiator -->
          <div v-else-if="selectedBox === 'box-passive-radiator'">
            <div class="field-row driver-id-row" style="--label-w:36px; margin-bottom:8px;">
              <div class="field tight"><label>PR</label><input type="text" style="width:220px" :value="(project.box.passiveRadiator.radiator.model.get().value) || 'Custom PR'" readonly></div>
              <button class="edit-btn" title="Browse bundled + saved passive radiators — click one to load it into this project." @click="prBrowseOpen = true">Select PR</button>
              <button class="edit-btn" title="Edit this passive radiator's own specs — Sd/Fs/Qms/Vas/Xmax." @click="prEditOpen = true">&#9998; Edit</button>
            </div>
            <PRBrowser v-if="prBrowseOpen" @close="prBrowseOpen = false"
              @load="loadPREntry" @load-bundled="loadBundledPassiveRadiatorEntry" @define="defineNewPREntry" />
            <PREditModal v-if="prEditOpen" @close="prEditOpen = false" />
            <div class="two-col">
              <div style="--label-w:44px;">
                <div class="section-header">Passive radiator parameters</div>
                <div class="field-row">
                  <div class="field"><label>Vas</label><input class="calculated greyed" :value="fmtU(project.box.passiveRadiator.radiator.spec.Vas_m3.get().value, 'prVas', 'volume', 'L', fieldDp('prVas'))" readonly><UnitToggle field="prVas" group="volume" base="L" unit-class="unit unit-cyc" /></div>
                  <div class="field"><label>Qms</label><input class="calculated greyed" :value="fmt(project.box.passiveRadiator.radiator.spec.Qms.get().value, fieldDp('prQms'))" readonly></div>
                </div>
                <div class="field-row">
                  <!-- The RADIATOR's own free-air resonance, 1/(2π√(Mmd·Cms)) — no box in it.
                       WinISD labels this "Fs" on its PR screen (docs/winisd_screenshots/view_3_passive_
                       radiator.png: 30.00 Hz), which collides with the DRIVER's Fs; `Fpr` is
                       this app's symbol for it. Distinct from the SYSTEM tuning on the Box tab
                       (view_2_box.png "Fh": 40.25 Hz on that same project), which is the box
                       compliance in series with the PR's own — two quantities, two readouts. -->
                  <div class="field entered"><label>Fpr</label><NumInput id="og-pr-fs" :model-value="project.box.passiveRadiator.radiator.spec.Fs_hz.get().value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Fs_hz.set(v ?? 0)" field="prFs" group="freq" base="Hz" :precision="fieldDp('prFs')" /><UnitToggle field="prFs" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
                  <div class="field entered"><label>Sd</label><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Sd_m2.get().value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Sd_m2.set(v ?? 0)" field="prSd" group="area" base="cm2" :precision="fieldDp('prSd')" /><UnitToggle field="prSd" group="area" base="cm2" unit-class="unit unit-cyc" /></div>
                </div>
                <div class="field-row">
                  <div class="field entered"><label>Xmax</label><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Xmax_m.get().value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Xmax_m.set(v ?? 0)" field="prXmax" group="length" base="mm" :precision="fieldDp('prXmax')" /><UnitToggle field="prXmax" group="length" base="mm" unit-class="unit unit-cyc" /></div>
                </div>
              </div>
              <div style="--label-w:150px;">
                <div class="section-header">User options</div>
                <div class="field-row"><div class="field entered"><label>Num. of PRs:</label><NumInput :model-value="project.box.passiveRadiator.count.get()" @update:model-value="(v: number | null) => project.box.passiveRadiator.count.set(v ?? 0)" field="prNum" :precision="fieldDp('prNum')" /></div></div>
                <div class="field-row">
                  <div :class="['field', 'entered', { 'dq-flag': prAddedMassCell.dq().length > 0 }]"><label>Added mass to cone:</label><NumInput id="og-pr-madd" :model-value="project.box.passiveRadiator.addedMass_kg.get().value" @update:model-value="(v: number | null) => project.box.passiveRadiator.addedMass_kg.set(v ?? 0)" field="prMadd" group="mass" base="g" :precision="fieldDp('prMadd')" v-bind="dqOfCell(prAddedMassCell)" /><UnitToggle field="prMadd" group="mass" base="g" unit-class="unit" /></div>
                </div>
                <div class="field-row">
                  <div :class="['field', 'entered', { 'dq-flag': prTuningCell.dq().length > 0 }]"><label>Target tuning freq (Fp):</label><NumInput id="og-pr-fp" :model-value="project.box.passiveRadiator.tuning_hz.get().value" @update:model-value="(v: number | null) => project.box.passiveRadiator.tuning_hz.set(v ?? 0)" field="Fp" group="freq" base="Hz" :precision="fieldDp('Fp')" v-bind="dqOfCell(prTuningCell)" /><UnitToggle field="Fp" group="freq" base="Hz" unit-class="unit" /></div>
                </div>
                <div class="field-row"><div :class="['field', { 'dq-flag': prResonanceMass.dq.length > 0 }]" :title="prResonanceMass.dq.length > 0 ? prResonanceMass.dq.join('; ') : ''"><label>Fpr (with added mass):</label><input id="og-pr-fs-mass" class="calculated greyed" :value="fmtU(prFsMass_hz, 'prFsMass', 'freq', 'Hz', fieldDp('prFsMass'))" readonly><UnitToggle field="prFsMass" group="freq" base="Hz" unit-class="unit" /></div></div>
              </div>
            </div>
          </div>


<!-- Closed (sealed) has NO enclosure pane: the Box tab is the single home of
               Volume + Fsc, and showEnclosureTab drops the nav entry for sealed. -->
          <div v-else-if="selectedBox === 'bandpass6' || selectedBox === 'abc'">
            <div class="section-header">Vents</div>
            <p class="hint" style="margin-bottom:8px; color:#7a5b1a;"><b>Response model pending.</b> These vent fields are shown for parity but are not yet wired to the engine for this enclosure type.</p>
            <div class="vent-groups">
              <div class="vent-col">
                <div class="vent-col-title">Rear chamber</div>
                <div class="field-row"><div class="field"><label>Diameter</label><input type="text" class="greyed" value="8.00" disabled><span class="unit">cm</span></div></div>
              </div>
              <div class="vent-col">
                <div class="vent-col-title">Front chamber</div>
                <div class="field-row"><div class="field"><label>Diameter</label><input type="text" class="greyed" value="9.00" disabled><span class="unit">cm</span></div></div>
              </div>
              <div v-if="selectedBox === 'abc'" class="vent-col">
                <div class="vent-col-title">Intrachamber</div>
                <div class="vent-col-hint">Connects the chambers — not open to the outside.</div>
                <div class="field-row"><div class="field"><label>Diameter</label><input type="text" class="greyed" value="6.00" disabled><span class="unit">cm</span></div></div>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== Filters tab — OgFilters, wired to the project's filter chain ===== -->
        <section v-show="activeTab === 'filters'" class="tab-section" :class="{ active: activeTab === 'filters' }">
          <OgFilters />
        </section>

        <!-- ===== Signal tab ===== -->
        <section v-show="activeTab === 'signal'" class="tab-section" :class="{ active: activeTab === 'signal' }">
          <div class="two-col">
            <div style="--label-w:60px;">
              <div class="section-header">Listening place</div>
              <div class="field-row"><div class="field"><label>Distance</label><input type="text" class="greyed" value="1.000" disabled><span class="unit">m</span></div></div>
              <div class="field-row"><div class="field"><label>Angle</label><input type="text" class="greyed" value="0.0000" disabled><span class="unit">rad</span></div></div>
              <p class="hint">Listening distance/angle are not modelled yet.</p>
            </div>
            <div style="--label-w:186px;">
              <div class="section-header">Signal source</div>
              <div class="field-row"><div :class="['field', 'entered', { 'dq-flag': project.powerDrive_W.get().dq().length > 0 }]"><label>System input power</label><NumInput field="Pin" :model-value="project.powerDrive_W.value" @update:model-value="(v: number | null) => v == null ? project.powerDrive_W.clear() : project.powerDrive_W.set(v)" :precision="fieldDp('Pin')" v-bind="dqOfCell(project.powerDrive_W.get())" /><span class="unit">W</span></div></div>
              <div class="field-row"><div :class="['field', 'entered', { 'dq-flag': project.driveVoltage_V.get().dq().length > 0 }]"><label>Driver input voltage (each)</label><NumInput field="driveV" v-model="driveV" :precision="fieldDp('driveV')" v-bind="dqOfCell(project.driveVoltage_V.get())" @blur-notify="reconcileDriveV" /><span class="unit">V</span></div></div>
              <div class="field-row"><div class="field entered"><label>Series resistance</label><NumInput v-model="rsOhm" :precision="fieldDp('Rs')" /><span class="unit">ohm</span></div></div>
            </div>
          </div>
        </section>

        <!-- ===== Advanced tab ===== -->
        <section v-show="activeTab === 'advanced'" class="tab-section" :class="{ active: activeTab === 'advanced' }">
          <div class="two-col adv-two-col">
            <div class="adv-air-fields" style="--label-w:118px;">
              <div class="field-row"><div :class="['field', 'adv-air-field', envTempStored ? 'entered' : '', { 'dq-flag': envTempDq.length > 0 }]" :title="envTempDq.join('; ')"><label>Temperature</label><NumInput v-model="advTemp" :class="{ calculated: !envTempStored }" field="advTemp" group="temp" base="K" :precision="2" :allow-out-of-range="true" :dq="envTempDq" dq-state="entered" @blur="commitAirTemp" /><UnitToggle field="advTemp" group="temp" base="K" unit-class="unit unit-cyc" /></div></div>
              <div class="field-row"><div :class="['field', 'adv-air-field', envHumidityStored ? 'entered' : '', { 'dq-flag': envHumidityDq.length > 0 }]" :title="envHumidityDq.join('; ')"><label>Relative humidity</label><NumInput v-model="advHumidity" :class="{ calculated: !envHumidityStored }" field="advHumidity" :precision="2" :allow-out-of-range="true" :dq="envHumidityDq" dq-state="entered" @blur="commitAirHumidity" /><span class="unit">%</span></div></div>
              <div class="field-row"><div :class="['field', 'adv-air-field', envPressureStored ? 'entered' : '', { 'dq-flag': envPressureDq.length > 0 }]" :title="envPressureDq.join('; ')"><label>Air pressure</label><NumInput v-model="advPressure" :class="{ calculated: !envPressureStored }" field="advPressure" group="pressure" base="Pa" :precision="1" :allow-out-of-range="true" :dq="envPressureDq" dq-state="entered" @blur="commitAirPressure" /><UnitToggle field="advPressure" group="pressure" base="Pa" unit-class="unit unit-cyc" /></div></div>
              <div class="field-row"><div class="field"><label>Sound velocity</label><input class="calculated greyed" :value="fmt(advAir.c, fieldDp('advSoundVelocity'))" readonly><span class="unit">m/s</span></div></div>
              <div class="field-row"><div class="field"><label>Air density</label><input class="calculated greyed" :value="advAir.rho.toFixed(fieldDp('advAirDensity'))" readonly><span class="unit">kg/m³</span></div></div>
              <button class="reset-air-btn" @click="resetAirToAppDefaults">Reset to app levels</button>
            </div>
            <div class="checkbox-col">
              <AdvancedOptions />
            </div>
          </div>
        </section>

        <!-- ===== Project tab ===== -->
        <section v-show="activeTab === 'project'" class="tab-section project-tab" :class="{ active: activeTab === 'project' }">
          <div class="two-col">
            <div>
              <div class="field-row"><div class="field"><label>Name</label><input type="text" style="width:200px" v-model="projectName"></div></div>
              <div class="field-row"><div class="field"><label>Creator</label><input type="text" style="width:200px" v-model="projectCreator"></div></div>
              <div class="field-row"><div class="field"><label>Created</label><input type="text" style="width:120px" v-model="projectCreated"></div></div>
              <div class="field-row"><div class="field"><label>Modified</label><input type="text" style="width:120px" v-model="projectModified"></div></div>
            </div>
            <div class="description-col">
              <label>Description</label>
              <textarea class="description" rows="6" v-model="projectDescription"></textarea>
            </div>
          </div>
        </section>
        </div>

        <!-- Save rail — stacked on the right edge so the buttons consume no vertical space. -->
        <div class="save-rail">
          <span v-if="isModified" class="unsaved-label" title="This project has unsaved changes."><span class="unsaved-dot"></span>Unsaved changes</span>
          <div class="value-legend" title="Field colours used throughout the application">
            <span><i class="legend-swatch legend-entered"></i>Entered</span>
            <span><i class="legend-swatch legend-calculated"></i>App level / calculated</span>
            <span><i class="legend-swatch legend-normal"></i>Normal</span>
          </div>
          <button v-if="projectOpen" class="edit-btn tune-btn" :title="whatIfActive ? 'What-if is active — reopen the transient tuning layer.' : 'Open a transient what-if tuning layer.'" @click="startTune">&#9835; {{ whatIfActive ? 'What-if' : 'Tune' }}</button>
        </div>
        </template>
        <!-- No project open: the tab pane says so plainly. -->
        <div v-else class="no-project-tabmsg">
          <p>No projects open</p>
        </div>
      </div>
    </div>

    <!-- ===== Box losses modal (real: Ql / Qa / Qp) ===== -->
    <div class="overlay" :class="{ open: boxLossesOpen }" @click.self="boxLossesOpen = false">
      <div class="modal narrow">
        <div class="modal-titlebar">
          <div class="tb-left"><span class="app-icon"></span><span>Box losses</span></div>
          <div class="win-controls"><span class="close-btn" @click="boxLossesOpen = false">&#10005;</span></div>
        </div>
        <div class="modal-body">
          <div class="field-row"><div class="field entered" style="--label-w:130px"><label>Leakage Ql</label><NumInput :model-value="boxQl" @update:model-value="(v: number | null) => setBoxQl(v ?? 0)" :precision="fieldDp('Ql')" /></div></div>
          <div class="field-row"><div class="field entered" style="--label-w:130px"><label>Absorption Qa</label><NumInput :model-value="boxQa" @update:model-value="(v: number | null) => setBoxQa(v ?? 0)" :precision="fieldDp('Qa')" /></div></div>
          <div class="field-row" v-if="selectedBox === 'vented' || selectedBox === 'bandpass4'"><div class="field entered" style="--label-w:130px"><label>Port Qp</label><NumInput :model-value="boxQp" @update:model-value="(v: number | null) => setBoxQp(v ?? 0)" :precision="fieldDp('Qp')" /></div></div>
          <p class="hint">100 = no stuffing · 20–50 = light · 5–10 = heavy. WinISD defaults: Ql=10, Qa=100, Qp=100.</p>
        </div>
        <div class="modal-footer">
          <span class="hint">Changes apply live to the graph.</span>
          <div class="footer-buttons"><button class="ok-btn" @click="boxLossesOpen = false">OK</button></div>
        </div>
      </div>
    </div>

    <!-- ===== Close an unsaved project: three named outcomes ===== -->
    <!-- A confirm() cannot express three, so its "Cancel" would have had to secretly mean
         "discard my work". Each button here says what it does to the work. -->
    <div v-if="closeChallenge" class="overlay on">
      <div class="modal narrow">
        <div class="modal-titlebar">
          <div class="tb-left"><span class="app-icon"></span><span>Close project</span></div>
          <div class="win-controls"><span class="close-btn" @click="closeChallenge = null">&#10005;</span></div>
        </div>
        <div class="modal-body">
          <p><b>{{ (closeChallenge && rowName(closeChallenge)) || 'This project' }}</b> has unsaved changes.</p>
          <div class="close-actions">
            <button class="btn" title="Save the project to its file, then close it" @click="saveThenClose(closeChallenge)">Save and close</button>
            <button class="btn" title="Close the project and lose the changes made since it was last saved" @click="closeProject(closeChallenge)">Close without saving</button>
            <button class="btn" title="Leave the project open exactly as it is" @click="closeChallenge = null">Keep it open</button>
          </div>
        </div>
      </div>
    </div>

    <!-- The Tune panel (`<OgTune>`) is rendered by App.vue, not here, so it survives a box-type
         change that re-renders this shell's enclosure pane (QO134). Its open/close state and
         refresh persistence stay on `presentationState.editDriver`, watched below. -->
    <div v-if="sealedAlignmentOpen" class="overlay on alignment-overlay">
      <div class="modal alignment-modal">
        <div class="modal-titlebar">
          <div class="tb-left"><span class="app-icon"></span><span>Choose Sealed Alignment</span></div>
          <div class="win-controls"><span class="close-btn" @click="sealedAlignmentEditor.cancel">&#10005;</span></div>
        </div>
        <div class="modal-body">
          <p class="hint">WinISD uses numeric target Qtc choices. Select one to calculate the sealed box volume for the current driver.</p>
          <div class="field-row"><div class="field alignment-field"><label>Alignment</label>
            <select class="alignment-select" :value="sealedAlignmentSelected?.value ?? ''" @change="e => { const qtc = selectedOption(e, sealedAlignmentOptions); if (qtc !== null) sealedAlignmentEditor.selectQtc(qtc); }">
              <option v-for="option in sealedAlignmentOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div></div>
          <div class="field-row"><div class="field"><label>Volume</label><input type="number" min="0" step="0.01" :value="sealedAlignmentVolume_L == null ? '' : sealedAlignmentVolume_L.toFixed(2)" @input="sealedAlignmentVolume_L = Number(($event.target as HTMLInputElement).value)"><span class="unit">L</span></div></div>
          <div class="alignment-readout"><span class="alignment-icon" :class="sealedAlignmentSuitability ?? 'unknown'">●</span>
            <span>EBP {{ sealedAlignmentEbp == null ? '—' : sealedAlignmentEbp.toFixed(1) }} Hz — {{ sealedAlignmentSuitabilityLabel }}</span>
          </div>
          <p class="hint">EBP is Fs ÷ Qes. It is a rule-of-thumb suitability guide: below 50 generally favors sealed, above 100 generally favors vented, and the middle range can use either.</p>
          <p class="hint">The volume uses the driver's Qts and Vas. Editing Volume changes the resulting Qtc and selects the closest numeric alignment.</p>
        </div>
        <div class="modal-footer"><div></div><div class="footer-buttons"><button class="cancel-btn" @click="sealedAlignmentEditor.cancel">Cancel</button><button class="ok-btn" @click="sealedAlignmentEditor.accept">Accept</button></div></div>
      </div>
    </div>

    <OptionsModal v-if="optionsOpen" @close="optionsOpen = false" />

    <div v-if="openDialogOpen" class="overlay on open-project-dialog" @click.self="openDialogOpen = false">
      <div class="modal narrow">
        <div class="modal-titlebar">
          <div class="tb-left"><span class="app-icon"></span><span>Open project</span></div>
          <div class="win-controls"><span class="close-btn" @click="openDialogOpen = false">&#10005;</span></div>
        </div>
        <div class="modal-body open-project-body">
          <button class="open-from-disk" @click="openFromDisk">Import from disk</button>
          <div class="open-project-list">
            <p v-if="storedProjects.length === 0" class="hint">No saved project yet</p>
            <button v-for="projectEntry in storedProjects" :key="projectEntry.id" class="stored-project-row" @click="openStoredProject(projectEntry.id)">
              <span>{{ projectEntry.name }}</span>
              <small>{{ new Date(projectEntry.modified).toLocaleString() }}</small>
            </button>
          </div>
        </div>
      </div>
    </div>

    <input ref="fileInput" type="file" accept=".owpr,.wpr,.owdr,.wdr,.json" style="display:none" @change="onFile">
  </div>
</template>

<style scoped>
/* Class names, layout and chrome follow WinISD's own window. The WinISD-light palette and
   the --chart-* custom properties keep the shared GraphPanel/canvas rendering light without
   a fork, and the `:deep(input)` rules give the shared NumInput's inner <input> the same
   `.field` styling as every other field here. */
.original-root *, .original-root *::before, .original-root *::after { box-sizing: border-box; }
.original-root {
  /* Light-theme palette overrides — like .classic-root. Without these, reused
     components + the global `button { color: var(--fg) }` reset inherit the app's
     dark-theme --fg (near-white) and render invisibly on the skin's light fills. */
  --bg:#f2f2f2; --panel:#f7f7f7; --panel2:#ececec; --line:#bbb;
  --fg:#1a1a1a; --mut:#555; --acc:#1868d1; --acc2:#b8790f; --good:#1b7d1b; --bad:#b02a2a;
  --chart-bg:#ffffff; --chart-grid:#dde3ea; --chart-text:#5a6b7b;
  --chart-cross:#00000055; --chart-band:rgba(0,0,0,0.05); --chart-band-line:rgba(0,0,0,0.3);
  --readout-bg:rgba(248,250,252,0.92);
  display:flex; flex-direction:column; width:100%; height:100vh; background:#f2f2f2;
  overflow:hidden; color:#1a1a1a; font-family:"Segoe UI", Tahoma, Arial, sans-serif; font-size:14px;
}
.original-root button, .original-root select, .original-root input, .original-root textarea { font-family:inherit; font-size:14px; }

.app-icon { width:20px; height:20px; border-radius:50%; background:radial-gradient(circle at 35% 35%, #888, #333 70%); display:inline-block; }
.app-brand { display:flex; align-items:center; gap:6px; flex:none; white-space:nowrap; font-weight:600; }
.brand-icon { width:20px; height:20px; display:block; }

/* ---------- Toolbar ---------- */
.toolbar { display:flex; align-items:center; gap:12px; background:#eee; border-bottom:1px solid #bbb; padding:4px 12px; }
.tb-icons { display:flex; align-items:center; gap:6px; min-width:0; flex:1 1 0; }
.tb-btn { display:flex; align-items:center; justify-content:center; width:34px; height:30px; background:#f7f7f7; border:1px solid #bbb; border-radius:3px; cursor:pointer; position:relative; }
.tb-btn:hover { background:#dbeaff; border-color:#7fb3ff; }
.tb-btn.disabled { opacity:.4; cursor:default; pointer-events:none; }
.tb-btn.disabled:hover { background:#f7f7f7; border-color:#bbb; }
.tb-btn.dirty { border-color:#d9a441; background:#fff3e0; }
.tb-btn.dirty:hover { background:#ffe4b0; border-color:#c9971b; }
.tb-sep { width:1px; align-self:stretch; background:#ccc; margin:0 4px; }
.tb-btn svg { display:block; }
.caret { font-size:10px; margin-left:2px; color:#555; }
.chart-select { display:flex; align-items:center; gap:6px; border:1px solid #bbb; border-radius:3px; background:#fff; padding:4px 8px; cursor:pointer; position:relative; user-select:none; }
.chart-select:hover { border-color:#7fb3ff; }
.chart-select .chart-name { font-weight:600; }
.cursor-readout { line-height:1; color:#222; font-size:14px; cursor:default; display:flex; flex-direction:row; align-items:center; justify-content:flex-end; gap:12px; white-space:nowrap; min-width:0; flex:1 1 0; }
.version-chip { font-size:12px; color:#555; line-height:1.1; font-weight:400; }
.cursor-readout .ro-hz, .cursor-readout .ro-val { font-variant-numeric:tabular-nums; display:inline-flex; align-items:center; }
.ro-hz-input {
  width: 82px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  padding: 2px 6px;
  border: 1px solid var(--line, #bbb);
  border-radius: 3px;
  background: var(--panel, #fff);
  color: var(--fg, #222);
}
.ro-hz-input:focus {
  outline: none;
  border-color: var(--acc, #1868d1);
}
.ro-hz .nudge-btn {
  font-size: 10px;
  padding: 1px 4px;
  background: none;
  border: 1px solid var(--line, #bbb);
  border-radius: 3px;
  color: var(--mut, #666);
  cursor: pointer;
  margin: 0 2px;
}
.ro-hz .nudge-btn:hover {
  color: var(--fg, #222);
  border-color: var(--acc, #1868d1);
}
.ro-hz-unit {
  font-size: 12px;
  color: var(--mut, #666);
  margin-left: 3px;
}
.cursor-readout .ro-val { min-width:76px; text-align:right; }

/* dropdown menus */
.dropdown-menu { display:none; position:absolute; top:34px; left:0; background:#fdfdfd; border:1px solid #999; box-shadow:2px 3px 8px rgba(0,0,0,.25); z-index:50; min-width:260px; padding:4px 0; max-height:calc(100vh - 90px); overflow-y:auto; }
.dropdown-menu.open { display:block; }
.dropdown-menu .menu-item { padding:6px 14px; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:6px; }
.dropdown-menu .menu-item:hover { background:#dbeaff; }
.dropdown-menu .menu-item.current::before { content:"\25CF"; font-size:8px; color:#222; width:10px; display:inline-block; }
.dropdown-menu .menu-item:not(.current)::before { content:""; width:10px; display:inline-block; }
.dropdown-menu hr { border:none; border-top:1px solid #ddd; margin:4px 0; }
.dropdown-menu .menu-item.has-submenu { position:relative; display:flex; justify-content:space-between; align-items:center; }
.dropdown-menu .submenu { display:none; position:absolute; left:100%; top:0; background:#fdfdfd; border:1px solid #999; box-shadow:2px 3px 8px rgba(0,0,0,.25); padding:4px 0; z-index:100; min-width:200px; }
.dropdown-menu .menu-item.has-submenu:hover .submenu { display:block; }

/* ---------- Main: 2x2 quadrants + draggable splitters ---------- */
/* Track sizes come from the inline mainStyle (presentationState.ui.originalNavW/originalBottomH,
   0px when a panel is collapsed); these template values are only the no-JS fallback. */
.main { display:grid; grid-template-columns:175px 7px 1fr; grid-template-rows:1fr 7px auto;
  grid-template-areas:"nav vsplit graph" "hsplit hsplit hsplit" "rail rail content";
  flex:1 1 auto; min-height:0; overflow:hidden; }
.quad-topleft { grid-area:nav; background:#f7f7f7; display:flex; flex-direction:column; padding:10px; gap:10px; overflow-y:auto; overflow-x:hidden; min-height:0; min-width:0; }
/* splitters — the drag handles between the panels; each carries a collapse toggle */
/* The collapse toggle is a small rounded chevron tab protruding from the splitter,
   near its START edge (top / left) — away from the middle where a resize drag
   naturally grabs (a centred toggle would swallow the drag). */
.split-v { grid-area:vsplit; cursor:col-resize; background:#e6e6e6; border-left:1px solid #ccc; border-right:1px solid #ccc; position:relative; z-index:4; touch-action:none; }
.split-h { grid-area:hsplit; cursor:row-resize; background:#e6e6e6; border-top:1px solid #ccc; border-bottom:1px solid #ccc; position:relative; z-index:4; touch-action:none; }
.split-v:hover, .split-h:hover { background:#cfe0f5; }
.split-toggle { position:absolute; display:grid; place-items:center; background:#f0f0f0; border:1px solid #aaa; color:#555; border-radius:4px; cursor:pointer; font-size:9px; line-height:1; padding:0; }
.split-v .split-toggle { top:8px; left:50%; transform:translateX(-50%); width:15px; height:34px; }
.split-h .split-toggle { left:8px; top:50%; transform:translateY(-50%); height:15px; width:34px; }
.split-toggle:hover { background:#dbeaff; border-color:#7fb3ff; color:#1868d1; }
/* collapsed panels: the grid track is 0px (mainStyle); hide the content so padding
   doesn't leave a sliver. The splitter (with its expand toggle) stays visible. */
.main.nav-collapsed .quad-topleft, .main.nav-collapsed .quad-bottomleft { display:none; }
.main.bottom-collapsed .quad-bottomleft, .main.bottom-collapsed .content-panel { display:none; }
/* chart maximised: only the graph area renders; the toolbar above is untouched so the
   chart type can still be changed while maximised. */
.main.chart-max { grid-template-columns:1fr; grid-template-rows:1fr; grid-template-areas:"graph"; }
.main.chart-max .quad-topleft, .main.chart-max .quad-bottomleft, .main.chart-max .content-panel,
.main.chart-max .split-v, .main.chart-max .split-h { display:none; }
/* Chart maximise/restore lives in the toolbar's right cluster (never over the chart's
   own cursor readout, and still reachable while maximised). */
.chart-max-btn { width:30px; height:28px; background:#f7f7f7; border:1px solid #bbb; border-radius:3px;
  cursor:pointer; font-size:13px; line-height:1; display:grid; place-items:center; }
.chart-max-btn:hover { background:#dbeaff; border-color:#7fb3ff; }
/* overflow:visible + a stacking context ABOVE the content panel lets the active
   tab extend past the column edge and paint over the panel's left spine, so it
   reads as one continuous shape with the panel (the break-through notch). */
.quad-bottomleft {
  grid-area: rail;
  background: #fcfcfc;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 6px;
  border-right: none;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  z-index: 3;
}
.quad-bottomleft .panel-title {
  color: #1a5fa6;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 4px;
  margin-right: 0;
}
.panel-title { color:#7d9fc9; font-weight:600; margin-bottom:2px; }
.quad-projects-wrap { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; }
.quad-signalgen-wrap { flex:none; }
.projects-list { flex:1 1 auto; min-height:60px; border:1px solid #bbb; background:#fff; overflow-y:auto; }
.project-row { display:flex; align-items:center; gap:6px; padding:5px 6px; cursor:pointer; border-bottom:1px solid #eee; }
.project-row:hover { background:#eef4ff; }
.project-row.selected { background:#1868d1; color:#fff; }
.project-row.is-unsaved { background: #fff3b3; border-left: 4px solid #f2994a; padding-left: 3px; }
.project-row.is-unsaved:hover { background: #ffe680; }
.project-row.is-unsaved.selected { background: #1868d1; border-left-color: #ffd07d; }
.project-row input[type=checkbox] { accent-color:#1868d1; }
.project-row span { flex:1; min-width:0; word-break:break-word; overflow-wrap:anywhere; }
.project-row.is-unsaved span { font-style: italic; }
.project-row.trace-hidden span { opacity:.45; text-decoration:line-through; }
/* Action row under the list — stands in for WinISD's right-click project menu. */
.close-actions { display:flex; flex-direction:column; gap:6px; margin-top:10px; }
.close-actions .btn { width:100%; }
.proj-actions { display:flex; gap:16px; margin-top:6px; }
.close-btn { color:#b02a2a; }
.close-btn:disabled { color:#999; cursor:default; text-decoration:none; opacity:.6; }
.signal-gen-row { display:flex; align-items:center; gap:8px; }
.signal-gen-row input[type=number] { width:70px; }
.project-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex-shrink: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
  width: 100%;
}
.project-nav li {
  padding: 3px 8px;
  text-align: center;
  font-size: 13px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #1b1b1b;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s ease;
  list-style-type: none;
  line-height: 1.25;
}
.project-nav li:hover {
  background: #eef2f7;
}
.project-nav li.active {
  background: #cfe4f7;
  font-weight: 600;
}
.color-btn { border:1px solid #999; text-align:center; cursor:pointer; font-weight:600; }
.color-btn:hover { filter:brightness(1.05); }
/* Docked in the toolbar's cursor-readout, beside the chart-max button. */
.chart-color-btn { padding:3px 12px; font-size:11px; border-radius:3px; color:#fff; text-shadow:0 0 2px rgba(0,0,0,.55); }
.graph-area { grid-area:graph; position:relative; flex:1 1 auto; min-width:0; min-height:0; padding:8px 14px; display:flex; flex-direction:column; }
.graph-wrap { flex:1 1 auto; min-height:0; border:1px solid #999; background:#fff; position:relative; display:flex; }
.graph-wrap :deep(.gpanel) { flex:1; height:100%; min-height:0; border:none; border-radius:0; }
.graph-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:24px; color:#777; gap:6px; }
.graph-empty-h { font-size:16px; font-weight:600; color:#333; }
.graph-empty-actions { display:flex; gap:12px; margin-top:4px; }
.graph-empty-link { display:inline-flex; align-items:center; gap:5px; border:0; padding:2px 4px; background:transparent; color:var(--acc); text-decoration:underline; cursor:pointer; }
.graph-empty-link:hover { color:#0b4f9e; }

/* ---------- Content panel ---------- */
.content-panel { grid-area:content; background:#f7f7f7; border:1px solid #888; border-left:none; border-top:none; border-radius:0 6px 6px 0; padding:10px 16px; overflow:hidden; display:flex; flex-direction:row; gap:12px; min-height:0; min-width:0; position:relative; z-index:0; }
.content-tabs { flex:1 1 auto; min-width:0; min-height:0; display:flex; flex-direction:column; }
.save-rail { flex:none; display:flex; flex-direction:column; align-items:flex-start; gap:6px; align-self:flex-start; }
.tab-section { display:none; }
/* Real WinISD is a Win32 window: child controls sit at fixed offsets and the client area
   CLIPS when the window shrinks — nothing reflows, nothing overlaps. The pane reproduces
   that by keeping every control at its natural width (the `flex:none` rules below) and
   letting the PANE scroll when the sum no longer fits. `overflow:auto` on both axes is
   what makes the clipped content still reachable, which a Win32 window cannot offer. */
.tab-section.active { display:block; flex:1 1 auto; min-height:0; overflow-x:auto; overflow-y:hidden; }
.section-header { background:#e2e2e2; border:1px solid #ccc; padding:4px 10px; font-weight:600; margin-bottom:8px; }
/* Columns keep their natural width and never shrink below their contents. A shrinking
   column (`flex:0 1 auto` with `min-width:0`) let the next column's origin slide left
   while this one's controls kept their own width, so the two painted on top of each
   other — the exact overlap `original-narrow.browser.spec.ts` locks out. */
.two-col { display:flex; gap:24px; align-items:flex-start; justify-content:flex-start; }
.two-col > div { flex:none; }
.box-layout { display:flex; gap:var(--box-col-gap); align-items:flex-start; }
.box-fields-col { flex:none; width:var(--box-col-w); --label-w:62px; }
/* The field span is fixed at the WIDEST box layout (the dual-chamber types: two field
   columns + the gap), so the diagram column starts at the same x for every box type
   instead of being pushed to the far right whenever the fields need less room. */
.box-tab-row { display:flex; gap:24px; align-items:flex-start; --box-col-w:194px; --box-col-gap:24px; }
.box-tab-row .field-row { margin-bottom: 4px; }
.box-tab-row .section-header { margin-bottom: 4px; padding: 2px 10px; }
.box-tab-main { flex:none; width:calc(var(--box-col-w) * 2 + var(--box-col-gap)); }
/* Width tracks the diagrams' own scale (each SVG height is 0.7 of its drawn size), so the
   column stays snug around the widest cut-through rather than padding it with slack. */
.box-diagram-col { flex:none; width:119px; display:flex; align-items:flex-start; justify-content:center; }
/* Third span, right of the diagram. Text WRAPS rather than overflowing, so unlike the
   fixed-width control columns this one may shrink without reintroducing the overlap. */
.box-notes-col { flex:1 1 240px; min-width:170px; max-width:340px; display:flex; flex-direction:column; gap:8px; }
.box-notes-col .hint { margin:0; }
.pending-note { color:#7a5b1a; }
.vent-groups { display:flex; gap:20px; }
.vent-col { flex:none; }
.vent-col-title { font-weight:600; color:#444; margin-bottom:4px; }
.vent-col-hint { color:#888; font-size:11px; font-style:italic; margin-bottom:4px; }
.vent-col .field label { width:110px; }
.project-tab .field label { width: 70px; }
.vent-config-col .field label {
  width: 130px;
  margin-right: 6px;
}
.vent-dims-col .field label {
  width: 110px;
  margin-right: 6px;
}
.field-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap; justify-content:flex-start; }
.field { display:flex; align-items:center; gap:6px; justify-content:flex-start; flex:none; }
.field label { color:#333; display:inline-block; width:var(--label-w, 150px); text-align:left; flex:none; }
.field input[type=text], .field input[type=number], .field select,
.field :deep(input) { border:1px solid #999; padding:4px 6px; border-radius:2px; background:#fff; width:90px; flex:none; }
.field.tight label { width:auto; margin-right:2px; }
.driver-id-row { align-items:center; gap:10px; }
.field input.greyed { background:#e9e9e9; color:#777; }
.field input.calculated { color:#1868d1; border-color:#1868d1; }
 .adv-air-field :deep(input) { width:94px; }
.adv-air-fields { display:grid; grid-template-columns:max-content max-content; column-gap:18px; align-items:start; }
.adv-air-fields .field-row:nth-child(-n+3) { grid-column:1; }
.adv-air-fields .field-row:nth-child(4),
.adv-air-fields .field-row:nth-child(5) { grid-column:2; }
.adv-air-fields .field-row:nth-child(4) { grid-row:1; }
.adv-air-fields .field-row:nth-child(5) { grid-row:2; }
 .adv-air-fields .reset-air-btn { grid-column:2; grid-row:3; justify-self:start; }
.reset-air-btn { border:1px solid #999; background:#f0f0f0; border-radius:3px; padding:4px 8px; cursor:pointer; color:#333; }
.reset-air-btn:hover { background:#dbeaff; border-color:#7fb3ff; }
/* A solved length of zero or less is not a port that can be built — it reads as the failure it
   is, matching the red unreachable notice below the pane rather than looking like a dimension. */
.field input.calculated.impossible { color:#a11; border-color:#a11; }
.field.entered :deep(input), .field.entered input { color:#1b7d1b; border-color:#1b7d1b; }
/* DQ — the generic "flagged field" rule: redline every field whose cell carries a data-quality
   flag. The entered one (the cause) gets the attention ring; the calculated ones (the symptom)
   are redlined too but stay calmer. Overrides the entered/calculated green/blue borders. */
.field.dq-flag input, .field.dq-flag :deep(input) {
  border-color: var(--bad);
  color: var(--bad);
}
.field.dq-flag { border-color: var(--bad); }
.field.dq-flag :deep(.dq-note) { margin-left: 2px; }
.field .unit { color:#555; min-width:3.5em; }
textarea.comment, textarea.description { width:100%; border:1px solid #999; border-radius:2px; padding:6px; resize:vertical; }
.radio-group { display:flex; align-items:center; gap:14px; }
.radio-group label { display:flex; align-items:center; gap:4px; }
.edit-btn, .link-btn, .action-btn { background:#f0f0f0; border:1px solid #999; border-radius:3px; padding:4px 10px; cursor:pointer; }
.edit-btn:hover, .link-btn:hover, .action-btn:hover { background:#dbeaff; border-color:#7fb3ff; }
.link-btn { background:none; border:none; color:#1868d1; text-decoration:underline; padding:2px 0; }
.link-btn:disabled { color:#999; cursor:default; text-decoration:none; opacity:.6; }
/* The tab pane's no-project placeholder — the lower-right quadrant stays in the grid and
   the tab RAIL keeps its place, only the panel content swaps to this message. */
.no-project-tabmsg { flex:1 1 auto; min-width:0; display:flex; align-items:center; justify-content:center; color:#777; font-style:italic; font-size:13px; }
.alignment-modal { width:520px; max-width:92vw; }
.alignment-modal .field-row { width:100%; }
.alignment-field { width:100%; }
.alignment-modal .alignment-select { flex:1; min-width:0; width:100%; }
.alignment-readout { display:flex; align-items:center; gap:7px; margin:10px 0 4px; font-weight:600; color:#444; }
.alignment-icon { font-size:18px; line-height:1; }
.alignment-icon.sealed { color:#2f9e44; }
.alignment-icon.either { color:#d08a00; }
.alignment-icon.vented { color:#2878c8; }
.alignment-icon.unknown { color:#888; }
.hint { color:#888; font-size:12px; font-style:italic; }
/* Hints beside (not below) their fields keep the pane shallow so the chart stays tall. */
.beside-hint { display:flex; gap:16px; align-items:flex-start; }
.side-hint { flex:none; width:220px; margin:0; }
.env-arrow { align-self:flex-start; margin:6px 0 0; }
/* > .two-col beats the .two-col > div flex:0 default so the description fills the width */
.two-col > .description-col { flex:1 1 auto; display:flex; flex-direction:column; gap:4px; }
/* Fixed width, not shrink-to-fit: without it the column collapsed under pressure and the
   longest option wrapped to one word per line. */
.checkbox-col { display:flex; flex-direction:column; gap:8px; margin-left:24px; flex:none; width:290px; }
.checkbox-col label { display:flex; align-items:center; gap:6px; }
.checkbox-col label input[type=checkbox] { flex:none; }

.adv-two-col { gap: 10px; }
.adv-two-col .checkbox-col { margin-left: 0; width: 285px; }
.adv-two-col .side-hint { width: 190px; }

/* filters tab fills the panel */
.tab-section.active :deep(.fpanel), .tab-section.active :deep(.filters) { min-height:0; }

/* unit-cycling label */
.unit-cyc { cursor:pointer; text-decoration:underline dotted; text-underline-offset:2px; }
.unit-cyc:hover { color:#1868d1; }

/* ---------- parstate legend + save bar ---------- */
/* OpenISD-only actions (not a WinISD feature) — kept deliberately small and muted
   so they don't dominate the panel like a native WinISD control would. */
.save-btn { border:1px solid #ccc; background:#f4f4f4; color:#666; font-weight:400; border-radius:3px; padding:1px 7px; cursor:pointer; font-size:11px; }
.save-btn:hover:not(:disabled) { background:#e9e9e9; color:#333; border-color:#aaa; }
.save-btn:disabled { opacity:.45; cursor:default; }
.save-btn.dirty { border-color:#d9a441; background:#fff3e0; color:#8a5a00; font-weight:600; }
.save-btn.dirty:hover:not(:disabled) { background:#ffe4b0; }
.unsaved-label { display:flex; align-items:center; justify-content:flex-start; gap:6px; color:#8a5a00; font-weight:600; font-size:11px; }
.unsaved-dot { width:8px; height:8px; border-radius:50%; background:#e0a800; display:inline-block; animation:unsaved-pulse 1.6s ease-in-out infinite; }
.value-legend { display:flex; flex-direction:column; gap:4px; color:#555; font-size:10px; white-space:nowrap; }
.value-legend span { display:flex; align-items:center; gap:4px; }
.legend-swatch { width:9px; height:9px; border:1px solid #777; display:inline-block; }
.legend-entered { background:#1b7d1b; border-color:#1b7d1b; }
.legend-calculated { background:#1868d1; border-color:#1868d1; }
.legend-normal { background:#333; border-color:#333; }
@keyframes unsaved-pulse { 0%, 100% { opacity:1; } 50% { opacity:.35; } }

/* ---------- Modal overlay ---------- */
.overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.18); z-index:100; align-items:flex-start; justify-content:center; }
.overlay.open { display:flex; }
.modal { margin-top:8vh; background:#f7f7f7; border:1px solid #888; box-shadow:3px 6px 18px rgba(0,0,0,.35); width:620px; max-width:92vw; }
.modal.narrow { width:460px; }
.modal-titlebar { display:flex; align-items:center; justify-content:space-between; background:#e9e9e9; border-bottom:1px solid #bbb; padding:8px 12px; font-size:15px; }
.modal-titlebar .tb-left { display:flex; align-items:center; gap:8px; }
.modal-titlebar .win-controls { display:flex; gap:12px; color:#555; }
.modal-titlebar .win-controls span { cursor:pointer; padding:1px 6px; }
.modal-titlebar .win-controls .close-btn:hover { background:#e64545; color:#fff; }
.modal-body { padding:16px 20px; max-height:65vh; overflow:auto; }
.open-project-body { display:flex; flex-direction:column; gap:10px; }
.open-from-disk { align-self:stretch; text-align:left; padding:8px 10px; font-weight:600; }
.open-project-list { display:flex; flex-direction:column; gap:4px; max-height:42vh; overflow-y:auto; border-top:1px solid #ccc; padding-top:8px; }
.stored-project-row { display:flex; justify-content:space-between; gap:12px; border:0; background:transparent; padding:8px 6px; text-align:left; cursor:pointer; }
.stored-project-row:hover { background:#dbeafe; }
.stored-project-row small { color:#666; white-space:nowrap; }
.modal-footer { display:flex; align-items:center; justify-content:space-between; border-top:1px solid #ccc; padding:10px 20px; background:#eee; }
.footer-buttons { display:flex; gap:8px; }
.footer-buttons button { border:1px solid #999; background:#f0f0f0; border-radius:3px; padding:6px 14px; cursor:pointer; }
.footer-buttons button:hover { background:#dbeaff; border-color:#7fb3ff; }
.footer-buttons button.ok-btn { color:#1b7d1b; }

/* Style overrides to make shared modals look native in original Win32 skin */
.original-root :deep(.modal) {
  border-radius: 0;
  border: 1px solid #888;
  background: #f7f7f7;
  box-shadow: 3px 6px 18px rgba(0,0,0,.35);
}
.original-root :deep(.modal h2) {
  background: #e9e9e9;
  border-bottom: 1px solid #bbb;
  padding: 8px 12px;
  font-size: 15px;
  margin: 0;
  font-weight: normal;
  font-family: inherit;
}
.original-root :deep(.de-tabs) {
  border-bottom: none;
}
</style>
