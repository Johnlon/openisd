<script setup lang="ts">
/**
 * Original shell — the fuller WinISD 0.7.0.950 recreation, ported from the `mock/`
 * prototype (mock/index.html + script.js). Unlike the mock, NOTHING here fakes state
 * or physics: the chart is the shared GraphPanel, box volumes/losses bind to the shared
 * store, and box resonances are computed live from the engine. The mock's distinctive
 * look — six box types, per-type cut-through diagrams, single/dual-chamber layouts — is
 * ported as presentation only; the logic is the same store + engine every skin shares.
 *
 * Box-type scope: the engine solver (packages/engine/src/circuit.ts) models four types
 * (sealed, vented, pr, bandpass4). 6th-order bandpass and ABC are ported here as UI
 * (diagram + chamber fields) but their response model is not implemented yet, so they
 * show an explicit "response model pending" state rather than a fabricated curve. When
 * the engine gains those branches, `SUPPORTED_BOX` grows and the pending state clears.
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import { state, driver, driverRaw, driverShort, pinCompare } from '../../store.js';
import type { BoxType } from '@openisd/engine';
import { TABS } from '../../utils/series.js';
import { createToneGenerator, type ToneGenerator } from '../../utils/toneGenerator.js';
import { useDesignIO } from '../../composables/useDesignIO.js';
import GraphPanel from '../../components/GraphPanel.vue';
import SkinPicker from '../../components/SkinPicker.vue';
import NumInput from '../../components/NumInput.vue';
import FiltersPanel from '../../components/FiltersPanel.vue';
import DriverWhatIfPanel from '../../components/DriverWhatIfPanel.vue';

const { exportDesign, about } = useDesignIO();

// The Original skin's default trace colour — WinISD's yellow-green plot line.
const WINISD_TRACE = '#c9c92e';

// ---- Box types -----------------------------------------------------------------
// Display list (mock order) mapped onto the engine's BoxType where one exists.
// 6th-order bandpass and ABC have no engine model yet → not in SUPPORTED_BOX.
type OgBox = 'sealed' | 'vented' | 'pr' | 'bandpass4' | 'bandpass6' | 'abc';
const BOX_OPTIONS: { id: OgBox; label: string }[] = [
  { id: 'sealed',    label: 'Closed' },
  { id: 'vented',    label: 'Vented' },
  { id: 'pr',        label: 'Passive Radiator' },
  { id: 'bandpass4', label: '4th Order Bandpass' },
  { id: 'bandpass6', label: '6th Order Bandpass' },
  { id: 'abc',       label: 'ABC (Aperiodic Bi-Chamber)' },
];
const SUPPORTED_BOX = new Set<OgBox>(['sealed', 'vented', 'pr', 'bandpass4']);
const DUAL_CHAMBER = new Set<OgBox>(['bandpass4', 'bandpass6', 'abc']);

// selectedBox is the Box tab's source of truth: it can hold values (bandpass6/abc) the
// engine BoxType cannot yet represent. Supported selections mirror into the shared store;
// unsupported ones leave state.box on its last valid value and raise `pending`.
const selectedBox = ref<OgBox>(state.box);
watch(selectedBox, (b) => { if (SUPPORTED_BOX.has(b)) state.box = b as BoxType; });
// Follow any EXTERNAL change to the store's box — e.g. a design loaded via App.vue's
// hashchange path (`state.box = o.box`) — even while a pending type is selected. This
// watcher fires only on a real store change; the one above only writes state.box when it
// differs, so the two never ping-pong. Unconditional sync here fixes the desync where a
// loaded, curve-producing box was hidden behind a stale ABC/pending view.
watch(() => state.box, (b) => { if (selectedBox.value !== b) selectedBox.value = b; });

const pending = computed(() => !SUPPORTED_BOX.has(selectedBox.value));
const isDual = computed(() => DUAL_CHAMBER.has(selectedBox.value));

// The single-chamber second readout label tracks the box type. These are the mock's own
// WinISD labels (mock/index.html SINGLE_CHAMBER_FIELDS): 'Fsc' for a closed box, 'Fh' for
// a passive-radiator rear chamber — kept verbatim for skin fidelity, hence the divergence
// from BoxPanel.vue's 'Fc'/'Fh'.
const singleF2Label = computed(() => (selectedBox.value === 'sealed' ? 'Fsc' : 'Fh'));

// Live resonances from the engine's own closed forms — never faked literals.
// Sealed/PR rear-chamber resonance: Fc = Fs·√(1 + Vas/Vb).
const rearResonance = computed<number | null>(() => {
  const d = driver.value;
  if (!d || !(state.P.Vb > 0)) return null;
  return d.Fs * Math.sqrt(1 + d.Vas / state.P.Vb);
});

// ---- Chart selector (persisted in state.ui) ------------------------------------
const chartTab = computed({
  get: () => state.ui.originalChartTab ?? 'SPL',
  set: (v: string) => { state.ui.originalChartTab = v; },
});
const chartMeta = computed(() => TABS.find(t => t.id === chartTab.value));

// ---- Tab rail (persisted) ------------------------------------------------------
const PROJECT_TABS = ['Box', 'Driver', 'Vents', 'Filters', 'Signal', 'Advanced', 'Project'] as const;
type ProjectTab = typeof PROJECT_TABS[number];
const projectTab = computed<ProjectTab>({
  get: () => (state.ui.originalProjectTab as ProjectTab) ?? 'Box',
  set: (v: ProjectTab) => { state.ui.originalProjectTab = v; },
});

// ---- Projects list -------------------------------------------------------------
function removeCompare(i: number) { state.compare.splice(i, 1); }

const brand = computed(() => driverRaw.value.brand || '');
const model = computed(() => driverRaw.value.model || driverShort(driverRaw.value));

// ---- Signal Generator ----------------------------------------------------------
// The mock's Signal Generator plays a real audible sine tone out of the machine's audio
// output for testing speakers — Generate on/off + frequency in Hz. Uses the shared,
// gesture-gated tone util (same as the Classic skin); NOT a power/voltage control.
const genOn = ref(false);
const genHz = ref(1000);
let tone: ToneGenerator | null = null;
function toggleGenerate() { tone ??= createToneGenerator(); if (genOn.value) tone.start(genHz.value); else tone.stop(); }
watch(genHz, v => { if (genOn.value) tone?.setFrequency(v); });
onUnmounted(() => tone?.stop());

// Signal tab: drive voltage = √(Pin × Re) per driver (WinISD: "Driver input voltage").
const driveV = computed(() => Math.sqrt((state.P.Pin ?? 1) * (driver.value?.Re || 8)));
</script>

<template>
  <div class="original-root">
    <!-- title bar -->
    <div class="og-title">
      <span class="og-app" aria-hidden="true"></span>
      <span class="og-tt">OpenISD — WinISD Original Mode</span>
      <span class="og-wc">&#8211;</span><span class="og-wc">&#9633;</span><span class="og-wc og-x">&#10005;</span>
    </div>

    <!-- toolbar -->
    <div class="og-toolbar">
      <button class="og-btn" title="Choose a driver from the library" @click="state.browseOpen = true">Drivers…</button>
      <button class="og-btn" title="Save the design as a .json project" @click="exportDesign">Save</button>
      <span class="og-sep"></span>
      <label class="og-chartsel" title="Choose which curve the graph shows">
        <select v-model="chartTab" title="Select the graph curve">
          <option v-for="t in TABS" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </label>
      <button class="og-btn" title="About OpenISD" @click="about">Info</button>
      <SkinPicker />
    </div>

    <!-- 2×2 body -->
    <div class="og-main">
      <!-- top-left: projects + signal generator -->
      <div class="og-tl">
        <div class="og-ptitle">Projects</div>
        <div class="og-projects">
          <div class="og-prow selected" :title="'Current design — ' + driverShort(driverRaw)">
            <span class="og-cbx on">&#10003;</span>{{ driverShort(driverRaw) }}
          </div>
          <div v-for="(d, i) in state.compare" :key="i" class="og-prow" :title="'Comparison overlay — untick to remove ' + d.name">
            <span class="og-cbx on" role="button" tabindex="0" @click="removeCompare(i)" @keydown.enter="removeCompare(i)">&#10003;</span>{{ d.name }}
          </div>
        </div>
        <button class="og-pin" title="Snapshot the current design and overlay it for comparison" @click="pinCompare">＋ Compare</button>

        <div class="og-ptitle" style="margin-top:10px">Signal Generator</div>
        <div class="og-sig">
          <label class="og-check" title="Play a real sine tone out of your machine's audio output at the set frequency — for testing speakers. Starts on click; stops when unticked.">
            <input type="checkbox" v-model="genOn" @change="toggleGenerate"> Generate
          </label>
          <input class="og-hz" type="number" min="20" max="20000" step="1" v-model.number="genHz"
                 title="Tone frequency in Hz (audible range 20–20000)">
          <span class="og-u">Hz</span>
        </div>
      </div>

      <!-- top-right: graph -->
      <div class="og-tr">
        <div class="og-ptitle">Graph</div>
        <div class="og-chart">
          <GraphPanel v-if="!pending" :tabId="chartTab" :bare="true" :primaryColor="WINISD_TRACE" />
          <div v-else class="og-chart-pending">
            <div class="og-pend-h">{{ BOX_OPTIONS.find(o => o.id === selectedBox)?.label }}</div>
            <p>Response model pending — this enclosure type isn't modelled by the engine yet, so no curve is drawn.</p>
            <p class="og-pend-sub">{{ chartMeta?.name }} will appear here once the {{ selectedBox === 'abc' ? 'ABC' : '6th-order bandpass' }} model lands.</p>
          </div>
        </div>
      </div>

      <!-- bottom-left: tab rail -->
      <div class="og-bl">
        <div class="og-ptitle">Project</div>
        <ul class="og-nav">
          <li v-for="t in PROJECT_TABS" :key="t" :class="{ active: projectTab === t }"
              :title="'Edit the ' + t + ' settings'" @click="projectTab = t">{{ t }}</li>
        </ul>
        <div class="og-color" title="The current design's curve colour on the graph">
          <span class="og-sw" :style="{ background: WINISD_TRACE }"></span>Color
        </div>
      </div>

      <!-- bottom-right: tab content -->
      <div class="og-br">
        <!-- ===== Box tab ===== -->
        <section v-if="projectTab === 'Box'" class="og-tab">
          <div class="og-field-row">
            <label class="og-lbl-auto">Box Type</label>
            <select id="og-box-type" v-model="selectedBox" style="width:240px" title="Enclosure type">
              <option v-for="o in BOX_OPTIONS" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
          </div>

          <div class="og-box-layout">
            <div class="og-box-fields">
              <!-- single chamber (sealed / vented / pr) -->
              <template v-if="!isDual">
                <div class="og-shdr">Rear chamber</div>
                <div class="og-field"><label>Volume</label><NumInput v-model="state.P.Vb" :scale="1000" :precision="2" /><span class="og-u">l</span></div>
                <div class="og-field"><label>{{ singleF2Label }}</label>
                  <span class="og-calc">{{ rearResonance != null ? rearResonance.toFixed(2) : '—' }}</span><span class="og-u">Hz</span>
                </div>
              </template>
              <!-- dual chamber (bandpass4 / bandpass6 / abc) -->
              <template v-else>
                <div class="og-dual">
                  <div>
                    <div class="og-shdr">Rear chamber</div>
                    <div class="og-field"><label>Volume</label><NumInput v-model="state.P.Vb" :scale="1000" :precision="2" /><span class="og-u">l</span></div>
                  </div>
                  <div>
                    <div class="og-shdr">Front chamber</div>
                    <div class="og-field"><label>Volume</label><NumInput v-model="state.P.Vf" :scale="1000" :precision="2" /><span class="og-u">l</span></div>
                  </div>
                </div>
              </template>
            </div>

            <!-- per-type cut-through diagram (ported from the mock, house style) -->
            <div class="og-diagram">
              <svg v-show="selectedBox === 'sealed'" id="og-box-diagram-sealed" viewBox="0 0 200 300" height="120">
                <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="40" x2="160" y2="110" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="190" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <path d="M160,110 L130,130 L130,170 L160,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="110" y="140" width="20" height="20" fill="#0F4761"/>
              </svg>
              <svg v-show="selectedBox === 'vented'" id="og-box-diagram-vented" viewBox="0 0 200 300" height="120">
                <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="40" x2="160" y2="70" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="150" x2="160" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="200" x2="100" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="100" y2="230" stroke="#0F4761" stroke-width="4"/>
                <path d="M160,70 L130,90 L130,130 L160,150" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="110" y="100" width="20" height="20" fill="#0F4761"/>
              </svg>
              <svg v-show="selectedBox === 'pr'" id="og-box-diagram-pr" viewBox="0 0 200 300" height="120">
                <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="40" x2="160" y2="60" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="130" x2="160" y2="170" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="240" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <path d="M160,60 L130,75 L130,115 L160,130" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="110" y="85" width="20" height="20" fill="#0F4761"/>
                <path d="M160,170 L130,185 L130,225 L160,240" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
              </svg>
              <svg v-show="selectedBox === 'bandpass4'" id="og-box-diagram-bandpass4" viewBox="0 0 200 300" height="130">
                <polyline points="160,200 160,40 40,40 40,260 160,260 160,230" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="100" y1="40" x2="100" y2="110" stroke="#0F4761" stroke-width="4"/>
                <line x1="100" y1="190" x2="100" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="200" x2="120" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="120" y2="230" stroke="#0F4761" stroke-width="4"/>
                <path d="M100,110 L70,130 L70,170 L100,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="50" y="140" width="20" height="20" fill="#0F4761"/>
              </svg>
              <svg v-show="selectedBox === 'bandpass6'" id="og-box-diagram-bandpass6" viewBox="0 0 200 300" height="130">
                <line x1="40" y1="40" x2="160" y2="40" stroke="#0F4761" stroke-width="4"/>
                <line x1="40" y1="260" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="40" x2="160" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="40" y1="40" x2="40" y2="70" stroke="#0F4761" stroke-width="4"/>
                <line x1="40" y1="100" x2="40" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="200" x2="120" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="120" y2="230" stroke="#0F4761" stroke-width="4"/>
                <line x1="40" y1="70" x2="80" y2="70" stroke="#0F4761" stroke-width="4"/>
                <line x1="40" y1="100" x2="80" y2="100" stroke="#0F4761" stroke-width="4"/>
                <line x1="100" y1="40" x2="100" y2="110" stroke="#0F4761" stroke-width="4"/>
                <line x1="100" y1="190" x2="100" y2="260" stroke="#0F4761" stroke-width="4"/>
                <path d="M100,110 L70,130 L70,170 L100,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="50" y="140" width="20" height="20" fill="#0F4761"/>
              </svg>
              <svg v-show="selectedBox === 'abc'" id="og-box-diagram-abc" viewBox="0 0 200 300" height="130">
                <path d="M 100,20 L 100,140 M 75,140 L 125,140 M 100,180 L 100,280 M 75,180 L 125,180" fill="none" stroke="#0F4761" stroke-width="4"/>
                <path d="M 100,20 L 40,20 L 40,70 L 80,70" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
                <path d="M 80,100 L 40,100 L 40,280 L 100,280" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
                <path d="M 100,20 L 160,20 L 160,60" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
                <path d="M 160,130 L 160,210 L 120,210" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
                <path d="M 120,240 L 160,240 L 160,280 L 100,280" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
                <path d="M 160,60 L 130,75 L 130,115 L 160,130 Z" fill="#A0B8C6" stroke="#0F4761" stroke-width="3" stroke-linejoin="round"/>
                <rect x="115" y="80" width="15" height="30" fill="#0F4761"/>
                <rect x="100" y="88" width="15" height="14" fill="#0F4761"/>
              </svg>
            </div>
          </div>

          <p v-if="selectedBox === 'abc'" class="og-hint">
            ABC's driver mounts on the outer baffle, firing straight into the room — unlike 4th/6th order bandpass, where the driver is fully enclosed and fires only into the two internal chambers.
          </p>
          <p v-if="pending" class="og-pending-note">
            <b>Response model pending.</b> The engine doesn't model this enclosure type yet — the diagram and chamber volumes are editable, but no SPL/impedance curve is computed. Tracked for a future engine phase.
          </p>
        </section>

        <!-- ===== Driver tab ===== -->
        <section v-else-if="projectTab === 'Driver'" class="og-tab">
          <div class="og-field-row">
            <div class="og-field"><label>Brand</label><input :value="brand" readonly></div>
            <div class="og-field"><label>Model</label><input :value="model" readonly></div>
          </div>
          <button class="og-btn" title="Choose or replace the driver from the library" @click="state.browseOpen = true">Choose driver…</button>
          <DriverWhatIfPanel v-if="state.editDriver" />
          <button v-else class="og-linkbtn" @click="state.editDriver = true">What-If? ✎</button>
        </section>

        <!-- ===== Filters tab ===== -->
        <FiltersPanel v-else-if="projectTab === 'Filters'" />

        <!-- ===== Signal tab ===== -->
        <section v-else-if="projectTab === 'Signal'" class="og-tab">
          <div class="og-shdr">Signal source</div>
          <div class="og-field"><label>System input power</label><NumInput v-model="state.P.Pin" :scale="1" :precision="1" /><span class="og-u">W</span></div>
          <div class="og-field"><label>Driver input voltage</label><span class="og-calc">{{ driveV.toFixed(1) }}</span><span class="og-u">V</span></div>
          <div class="og-field"><label>Series resistance</label><NumInput v-model="state.P.Rs" :scale="1" :precision="3" /><span class="og-u">ohm</span></div>
        </section>

        <!-- ===== Project tab ===== -->
        <section v-else-if="projectTab === 'Project'" class="og-tab">
          <div class="og-field"><label>Creator</label><input type="text" v-model="state.project.creator" placeholder="Your name"></div>
          <div class="og-field"><label>Created</label><input type="text" v-model="state.project.created" placeholder="DD/MM/YYYY"></div>
          <div class="og-field"><label>Modified</label><input type="text" v-model="state.project.modified" placeholder="DD/MM/YYYY"></div>
          <div class="og-shdr" style="margin-top:8px">Description</div>
          <textarea class="og-desc" v-model="state.project.description" placeholder="Notes about this project…"></textarea>
        </section>

        <!-- ===== Not-yet-ported tabs ===== -->
        <section v-else class="og-tab og-todo">
          The <b>{{ projectTab }}</b> tab is ported in a later phase of the Original skin.
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* WinISD-light palette + chart theming — overriding the shared custom properties makes
   every reused panel AND the shared canvas render light with no fork. */
.original-root {
  --bg:#f2f2f2; --panel:#f7f7f7; --panel2:#ececec; --line:#bbb;
  --fg:#1b1b1b; --mut:#555; --acc:#1868d1; --acc2:#b8790f; --good:#2e8b57; --bad:#c62828;
  --chart-bg:#ffffff; --chart-grid:#dde3ea; --chart-text:#5a6b7b;
  --chart-cross:#00000055; --chart-band:rgba(0,0,0,0.05); --chart-band-line:rgba(0,0,0,0.3);
  --readout-bg:rgba(248,250,252,0.92);
  height:100vh; display:flex; flex-direction:column;
  background:var(--bg); color:var(--fg);
  font:13px/1.35 "Segoe UI", Tahoma, system-ui, sans-serif;
}

/* title bar */
.og-title { display:flex; align-items:center; gap:8px; height:28px; padding:0 8px; background:#e9e9e9; flex-shrink:0; }
.og-app { width:14px; height:14px; border-radius:50%; background:radial-gradient(circle at 35% 35%, #888, #333 70%); }
.og-tt { flex:1; font-size:13px; color:#2a2a2a; }
.og-wc { padding:2px 6px; color:#555; cursor:default; }
.og-x:hover { background:#e64545; color:#fff; }

/* toolbar */
.og-toolbar { display:flex; align-items:center; gap:6px; height:40px; padding:0 10px; background:#eee; border-bottom:1px solid var(--line); flex-shrink:0; }
.og-btn { font:inherit; font-size:12px; padding:4px 10px; background:#f7f7f7; border:1px solid #bbb; border-radius:4px; cursor:pointer; color:#1b1b1b; }
.og-btn:hover { background:#dbeaff; border-color:#7fb3ff; }
.og-sep { width:1px; align-self:stretch; background:#ccc; margin:6px 4px; }
.og-chartsel select { font:inherit; font-size:13px; padding:3px 6px; border:1px solid #c4c4c4; border-radius:4px; background:#fff; cursor:pointer; }
.og-toolbar .skin-picker { margin-left:auto; }

/* 2×2 body */
.og-main { flex:1; display:grid; grid-template-columns:250px 1fr; grid-template-rows:minmax(0,1fr) minmax(150px,290px); min-height:0; gap:6px; padding:6px; }
.og-tl { display:flex; flex-direction:column; min-height:0; }
.og-tr { display:flex; flex-direction:column; min-height:0; }
.og-bl { display:flex; flex-direction:column; min-height:0; overflow:hidden; }
.og-br { min-height:0; overflow-y:auto; background:#f7f7f7; border:1px solid var(--line); border-radius:4px; padding:8px 12px; }
.og-ptitle { color:var(--acc); font-weight:600; font-size:14px; margin:2px 0 5px; }

/* projects */
.og-projects { flex:1; border:1px solid var(--line); background:#fff; overflow-y:auto; min-height:60px; }
.og-prow { display:flex; align-items:center; gap:8px; padding:5px 8px; font-size:13px; }
.og-prow:hover { background:#eef4ff; }
.og-prow.selected { background:#1868d1; color:#fff; }
.og-cbx { width:15px; height:15px; border:1px solid #8aa; background:#fff; border-radius:2px; display:grid; place-items:center; font-size:11px; color:#1868d1; }
.og-cbx.on { cursor:pointer; }
.og-pin { margin-top:8px; font-size:12px; padding:5px 8px; background:#f0f0f0; border:1px solid var(--line); border-radius:4px; color:#1b1b1b; cursor:pointer; }
.og-pin:hover { border-color:var(--acc); }
.og-sig { display:flex; align-items:center; gap:10px; }
.og-check { display:flex; align-items:center; gap:6px; font-size:13px; }
.og-hz { width:64px; padding:3px 5px; border:1px solid #c4c4c4; border-radius:2px; font:inherit; }
.og-u { font-size:12px; color:#333; }

/* chart */
.og-chart { flex:1; min-height:220px; border:1px solid #999; border-radius:4px; overflow:hidden; position:relative; display:flex; background:#fff; }
.og-chart :deep(.gpanel) { flex:1; height:100%; min-height:0; border:none; border-radius:0; }
.og-chart-pending { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:24px; color:var(--mut); gap:6px; }
.og-pend-h { font-size:16px; font-weight:600; color:#1b1b1b; }
.og-pend-sub { font-size:12px; font-style:italic; }

/* tab rail */
.og-nav { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:2px; flex:none; }
.og-nav li { padding:5px 10px; font-size:13px; background:#ececec; border:1px solid #d5d5d5; border-radius:3px; cursor:pointer; }
.og-nav li:hover { background:#dbeaff; }
.og-nav li.active { background:#f7f7f7; font-weight:600; border-color:var(--acc); }
.og-color { display:flex; align-items:center; justify-content:center; gap:8px; margin-top:8px; padding:5px 10px; background:#c9c92e; border-radius:4px; font-size:13px; flex:none; }
.og-sw { width:22px; height:13px; border:1px solid #999; }

/* tab content */
.og-tab { font-size:13px; }
.og-field-row { display:flex; gap:16px; align-items:flex-end; margin-bottom:6px; }
.og-field { display:flex; align-items:center; gap:6px; margin:4px 0; }
.og-field label { width:150px; font-size:12px; color:#333; }
.og-lbl-auto { width:auto !important; margin-right:6px; }
.og-field input { padding:3px 7px; border:1px solid #c4c4c4; border-radius:2px; font:inherit; background:#fff; width:150px; }
.og-field input[readonly] { background:#f0f0f0; color:#555; }
.og-calc { display:inline-block; min-width:80px; padding:3px 7px; border:1px solid #c4c4c4; border-radius:2px; background:#eef2f7; color:#1868d1; font-variant-numeric:tabular-nums; }
.og-shdr { background:#e2e2e2; text-align:center; font-size:12px; padding:3px 0; border-radius:2px; margin:6px 0 5px; color:#333; }
.og-box-layout { display:flex; gap:24px; align-items:flex-start; }
.og-box-fields { flex:1; }
.og-dual { display:flex; gap:24px; }
.og-diagram { flex:none; width:130px; display:grid; place-items:center; }
.og-hint, .og-pending-note { font-size:12px; color:var(--mut); margin-top:8px; line-height:1.5; }
.og-pending-note { background:#fff6e5; border:1px solid #e0c48a; border-radius:4px; padding:8px 10px; color:#7a5b1a; }
.og-linkbtn { background:none; border:none; color:var(--acc2); font-size:11px; cursor:pointer; text-decoration:underline; padding:2px 0; }
.og-linkbtn:hover { color:var(--acc); }
.og-desc { width:100%; min-height:120px; padding:6px 8px; border:1px solid #c4c4c4; border-radius:2px; font:inherit; resize:vertical; }
.og-todo { color:#666; font-style:italic; padding:10px 2px; }
</style>
