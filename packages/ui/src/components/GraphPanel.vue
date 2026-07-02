<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { state, driver, driverErrors, syncedP, curvesData, maxData } from '../store.js';
import { TABS, buildPlotData } from '../utils/series.js';
import { drawOne } from '../utils/canvas.js';
import { DPAL } from '../presets.js';

const props = defineProps({ tabId: String });

const canvasEl = ref(null);
const readEl   = ref(null);
const meta     = computed(() => TABS.find(t => t.id === props.tabId) || { name: props.tabId });

const currentDesign = computed(() => ({
  driver: driver.value, box: state.box, P: syncedP.value,
  curves: curvesData.value, maxCurves: maxData.value,
  name: 'Current', color: DPAL[0],
}));

// buildPlotData returns { value, errors }: value is the drawable bundle (null when the
// driver is invalid OR the sweep is mid-recompute), errors are the driver issues.
const plot        = computed(() =>
  buildPlotData(props.tabId, state.P.fmin, state.P.fmax, currentDesign.value, state.compare, driverErrors.value)
);
const plotData    = computed(() => plot.value.value);
const blockErrors = computed(() => plot.value.errors.filter(e => e.level === 'error'));
// Show the blocking message only when there is no plot AND the reason is a real error
// (a required T/S param). A transient null during sweep recompute has no errors → we
// simply don't redraw until the curves arrive, no message.
const blocked     = computed(() => !plotData.value && blockErrors.value.length > 0);

// Per-chart Y-axis (level) override — the vertical half of "zoom out/in". Absent =
// auto-scale to fit the data. When set, it replaces the auto ymin/ymax on the drawn
// plot only; series data and cursor stats are untouched.
const yOverride = computed(() => state.yRanges[props.tabId] || null);
const viewPlot  = computed(() => {
  const p = plotData.value;
  if (!p) return p;
  const ov = yOverride.value;
  if (ov && isFinite(ov.min) && isFinite(ov.max) && ov.min < ov.max && !(p.logy && ov.min <= 0))
    return { ...p, ymin: ov.min, ymax: ov.max };
  return p;
});
// Effective Y bounds currently drawn — seeds the input fields (auto or override).
const effY = computed(() => viewPlot.value ? { min: viewPlot.value.ymin, max: viewPlot.value.ymax } : null);
const fmtY = (v) => (v == null || !isFinite(v)) ? '' : String(Number(v.toFixed(2)));
function setY(min, max) { state.yRanges[props.tabId] = { min, max }; }
function onYMin(e) {
  const eff = effY.value; if (!eff) return;
  const v = parseFloat(e.target.value), logy = viewPlot.value.logy;
  if (isFinite(v) && v < eff.max && !(logy && v <= 0)) setY(v, eff.max);
  else e.target.value = fmtY(eff.min);  // reject → snap back to the applied value
}
function onYMax(e) {
  const eff = effY.value; if (!eff) return;
  const v = parseFloat(e.target.value);
  if (isFinite(v) && v > eff.min) setY(eff.min, v);
  else e.target.value = fmtY(eff.max);
}
function resetY() { delete state.yRanges[props.tabId]; }

const effectiveF = computed(() =>
  state.cursorLocked ? state.pinnedF : (state.cursorF ?? state.pinnedF)
);

let geoRef = null;
let dragOrigin = null; // { clientX, f } — set on pointerdown

function freqAt(clientX) {
  if (!geoRef) return null;
  const { m, pw, f0, f1 } = geoRef;
  const rect = canvasEl.value.getBoundingClientRect();
  const frac = (clientX - rect.left - m.l) / pw;
  if (frac < 0 || frac > 1) return null;
  return Math.pow(10, Math.log10(f0) + frac * (Math.log10(f1) - Math.log10(f0)));
}

function rangeStats(fLo, fHi) {
  const s = plotData.value?.series?.find(s => !s.dash && !s.phantom);
  if (!s) return null;
  let peakY = -Infinity, peakF = null, troughY = Infinity, sum = 0, n = 0;
  for (let i = 0; i < s.xs.length; i++) {
    if (s.xs[i] < fLo || s.xs[i] > fHi) continue;
    const y = s.ys[i];
    if (!isFinite(y)) continue;
    if (y > peakY) { peakY = y; peakF = s.xs[i]; }
    if (y < troughY) troughY = y;
    sum += y; n++;
  }
  if (!n) return null;
  return { peak: peakY, peakF, trough: troughY, ripple: peakY - troughY, avg: sum / n };
}

// Per-panel view of the shared frequency selection — stats come from this panel's series
const localDragRange = computed(() => {
  if (!state.dragRange) return null;
  const { fLo, fHi } = state.dragRange;
  return { fLo, fHi, stats: rangeStats(fLo, fHi) };
});

function redraw() {
  if (!canvasEl.value) return;
  if (blocked.value || !viewPlot.value) { geoRef = null; return; }
  geoRef = drawOne(canvasEl.value, viewPlot.value, localDragRange.value ? null : effectiveF.value, readEl.value, localDragRange.value);
}

function onPointerDown(e) {
  if (e.button !== 0 || !geoRef) return;
  const f = freqAt(e.clientX);
  if (f !== null) {
    state.dragRange = null; // clear previous selection
    dragOrigin = { clientX: e.clientX, f };
    canvasEl.value.setPointerCapture(e.pointerId);
  }
}

function onPointerMove(e) {
  e.preventDefault(); // prevent scroll/zoom on touch and stylus
  if (dragOrigin && (e.buttons & 1)) {
    if (Math.abs(e.clientX - dragOrigin.clientX) >= 5) {
      const f2 = freqAt(e.clientX);
      if (f2 !== null) {
        const fLo = Math.min(dragOrigin.f, f2), fHi = Math.max(dragOrigin.f, f2);
        state.dragRange = { fLo, fHi };
        redraw();
      }
      return;
    }
  }
  if (state.cursorLocked || !geoRef) return;
  const { m, pw, f0, f1 } = geoRef;
  const rect = canvasEl.value.getBoundingClientRect();
  const frac = (e.clientX - rect.left - m.l) / pw;
  if (frac < 0 || frac > 1) { if (state.cursorF !== null) state.cursorF = null; return; }
  state.cursorF = Math.pow(10, Math.log10(f0) + frac * (Math.log10(f1) - Math.log10(f0)));
}

function onPointerUp(e) {
  if (!dragOrigin || e.button !== 0) { dragOrigin = null; return; }
  const wasDrag = Math.abs(e.clientX - dragOrigin.clientX) >= 5;
  dragOrigin = null;
  if (wasDrag) return; // leave selection visible; cleared on next pointerdown
  state.dragRange = null;
  const f = freqAt(e.clientX);
  if (f !== null) { state.pinnedF = f; state.cursorLocked = true; }
}

function onPointerLeave() {
  dragOrigin = null;
  // Don't clear state.dragRange — selection persists across all panels
  if (!state.cursorLocked) state.cursorF = null;
}

function onPointerCancel() {
  dragOrigin = null; state.dragRange = null;
  if (!state.cursorLocked) state.cursorF = null;
}

// ── context menu ──────────────────────────────────────────────
const ctxMenu = ref({ visible: false, x: 0, y: 0, f: null });

function onContextMenu(e) {
  e.preventDefault();
  const f = state.cursorLocked ? state.pinnedF : state.cursorF;
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, f };
}

function closeMenu() { ctxMenu.value.visible = false; }

function snapAction(dir, type) {
  const s = plotData.value?.series?.find(s => !s.dash);
  if (!s) return closeMenu();
  const f = ctxMenu.value.f;
  const isMax = type === 'max';
  const candidates = [];
  for (let i = 1; i < s.ys.length - 1; i++) {
    if (!isFinite(s.ys[i])) continue;
    const peak   = s.ys[i] > s.ys[i-1] && s.ys[i] > s.ys[i+1];
    const trough = s.ys[i] < s.ys[i-1] && s.ys[i] < s.ys[i+1];
    if (isMax ? !peak : !trough) continue;
    if (f !== null) {
      if (dir === 'left'  && s.xs[i] >= f) continue;
      if (dir === 'right' && s.xs[i] <= f) continue;
    }
    candidates.push(i);
  }
  if (!candidates.length) return closeMenu();
  // pick nearest in log-frequency to cursor
  const ref = f ?? s.xs[Math.floor(s.xs.length / 2)];
  let best = candidates[0], bestD = Infinity;
  for (const i of candidates) {
    const d = Math.abs(Math.log10(s.xs[i]) - Math.log10(ref));
    if (d < bestD) { bestD = d; best = i; }
  }
  state.pinnedF = s.xs[best];
  state.cursorLocked = true;
  closeMenu();
}

function lockHere() {
  const f = ctxMenu.value.f;
  if (f) { state.pinnedF = f; state.cursorLocked = true; }
  closeMenu();
}

function onDocClick(_e) {
  if (ctxMenu.value.visible) closeMenu();
}

let ro;
onMounted(() => {
  ro = new ResizeObserver(redraw);
  ro.observe(canvasEl.value);
  document.addEventListener('click', onDocClick);
});
onUnmounted(() => {
  ro?.disconnect();
  document.removeEventListener('click', onDocClick);
});

watch([viewPlot, effectiveF, localDragRange, blocked], redraw, { flush: 'post' });
</script>

<template>
  <div class="gpanel">
    <canvas ref="canvasEl"
            @pointerdown="onPointerDown"
            @pointerup="onPointerUp"
            @pointermove="onPointerMove"
            @pointerleave="onPointerLeave"
            @pointercancel="onPointerCancel"
            @contextmenu="onContextMenu" />
    <div class="gtitle">{{ meta.name }}</div>
    <div ref="readEl" class="gread"></div>
    <div v-if="!blocked && effY" class="gyctl" :class="{ active: yOverride }">
      <span class="gyctl-lab" title="Y-axis (level) range. Edit to zoom the vertical scale; A resets to auto-fit.">Y</span>
      <input class="gy-in" type="number" step="any" :value="fmtY(effY.min)" @change="onYMin"
             title="Y-axis minimum (chart units)" />
      <span class="gy-dash">–</span>
      <input class="gy-in" type="number" step="any" :value="fmtY(effY.max)" @change="onYMax"
             title="Y-axis maximum (chart units)" />
      <span class="gy-unit">{{ viewPlot.unit }}</span>
      <button class="gy-auto" :class="{ on: !yOverride }" @click="resetY"
              title="Auto-scale the Y axis to fit the data">A</button>
    </div>
    <div v-if="blocked" class="gmsg">
      <div class="gmsg-title">Can’t plot {{ meta.name }}</div>
      <div v-for="e in blockErrors" :key="e.field" class="gmsg-line">{{ e.message }}</div>
      <div class="gmsg-foot">Fix the driver parameters to restore this chart.</div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="ctxMenu.visible"
         class="ctx-menu"
         :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
         @click.stop>
      <div class="ctx-item" @click="lockHere" title="Pin the cursor to this frequency — hover will no longer move it">Lock cursor here</div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" @click="snapAction('left',  'max')" title="Snap cursor left to the nearest peak (local maximum)">◄ Max to left</div>
      <div class="ctx-item" @click="snapAction('left',  'min')" title="Snap cursor left to the nearest trough (local minimum)">◄ Min to left</div>
      <div class="ctx-item" @click="snapAction('right', 'max')" title="Snap cursor right to the nearest peak (local maximum)">Max to right ►</div>
      <div class="ctx-item" @click="snapAction('right', 'min')" title="Snap cursor right to the nearest trough (local minimum)">Min to right ►</div>
    </div>
  </Teleport>
</template>

<style scoped>
canvas { touch-action: none; }

.gpanel { position: relative; }

/* Per-chart Y-axis range control — bottom-left, revealed on hover (or kept visible
   while an override is active so the manual scale is discoverable). */
.gyctl {
  position: absolute;
  left: 6px;
  bottom: 6px;
  z-index: 3;
  display: none;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  background: rgba(10, 14, 20, 0.82);
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 10.5px;
}
.gpanel:hover .gyctl,
.gyctl.active { display: flex; }
.gyctl-lab { color: var(--mut); font-weight: 600; }
.gy-in {
  width: 46px;
  font-size: 10.5px;
  padding: 0 3px;
  background: var(--panel2);
  border: 1px solid var(--mut);
  border-radius: 3px;
  color: var(--fg);
  text-align: right;
}
.gy-in:focus { outline: none; border-color: var(--acc); }
.gy-dash, .gy-unit { color: var(--mut); }
.gy-auto {
  font-size: 10px;
  font-weight: 600;
  padding: 0 5px;
  background: none;
  border: 1px solid var(--mut);
  border-radius: 3px;
  color: var(--mut);
  cursor: pointer;
}
.gy-auto:hover { color: var(--fg); border-color: var(--fg); }
.gy-auto.on { border-color: var(--acc); color: var(--acc); }

/* Blocking message shown in place of the chart when the driver has no derivable
   value (a core T/S parameter is missing). Opaque so any stale curve is hidden. */
.gmsg {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px;
  text-align: center;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
}
.gmsg-title { font-size: 13px; font-weight: 600; color: var(--fg); }
.gmsg-line  { font-size: 11px; color: var(--mut); line-height: 1.4; max-width: 90%; }
.gmsg-foot  { font-size: 11px; color: var(--mut); margin-top: 4px; font-style: italic; }

.ctx-menu {
  position: fixed;
  z-index: 9999;
  background: #1a2030;
  border: 1px solid #334;
  border-radius: 5px;
  padding: 3px 0;
  min-width: 160px;
  box-shadow: 0 4px 16px #0008;
  font-size: 12px;
  user-select: none;
}
.ctx-item {
  padding: 5px 14px;
  color: var(--fg);
  cursor: pointer;
}
.ctx-item:hover { background: #2a3a54; }
.ctx-sep {
  height: 1px;
  background: #334;
  margin: 3px 0;
}
</style>
