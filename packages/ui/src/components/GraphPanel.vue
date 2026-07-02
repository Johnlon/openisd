<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { state, driver, driverErrors, syncedP, curvesData, maxData } from '../store.js';
import { TABS, buildPlotData } from '../utils/series.js';
import { drawOne } from '../utils/canvas.js';
import { DPAL } from '../presets.js';
import type { Geo } from '../types.js';

const props = defineProps<{ tabId: string }>();

const canvasEl = ref<HTMLCanvasElement | null>(null);
const readEl   = ref<HTMLElement | null>(null);
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
// Reset a chart's Y scale to auto (invoked by double-clicking its axis).
function resetY() { delete state.yRanges[props.tabId]; }

const effectiveF = computed(() =>
  state.cursorLocked ? state.pinnedF : (state.cursorF ?? state.pinnedF)
);

const X_LMAX = Math.log10(40000); // frequency drag clamps to 1 Hz … 40 kHz (log space)

let geoRef: Geo | null = null;
let dragOrigin: { clientX: number; f: number } | null = null; // set on pointerdown (frequency band-select)
let yDrag: { mode: string; startY: number; ly0: number; ly1: number; logy: boolean; ph: number } | null = null; // Y-axis drag
let xDrag: { mode: string; startX: number; lx0: number; lx1: number; pw: number } | null = null; // X-axis (frequency) drag

// Is a pointer position inside the left Y-axis strip (the value-label margin)?
// Returns the vertical zone for the gesture, or null if not on the axis.
//   'zoomTop' (top quarter) / 'zoomBot' (bottom quarter) → zoom that end
//   'pan' (middle) → shift the window;  Shift key → 'zoomSym' (symmetric zoom)
function yAxisZone(e: PointerEvent | MouseEvent): string | null {
  if (!geoRef || !viewPlot.value) return null;
  const rect = canvasEl.value!.getBoundingClientRect();
  const xIn = e.clientX - rect.left, yIn = e.clientY - rect.top;
  const { m, ph } = geoRef;
  if (xIn < 0 || xIn > m.l || yIn < m.t || yIn > m.t + ph) return null;
  if (e.shiftKey) return 'zoomSym';
  if (yIn <= m.t + 0.25 * ph) return 'zoomTop';
  if (yIn >= m.t + 0.75 * ph) return 'zoomBot';
  return 'pan';
}

// Same idea for the bottom X-axis strip (the frequency-label margin, below the plot).
//   'zoomLo' (left quarter) / 'zoomHi' (right quarter) → zoom that end
//   'pan' (middle) → shift the frequency window;  Shift → 'zoomSym'
function xAxisZone(e: PointerEvent | MouseEvent): string | null {
  if (!geoRef) return null;
  const rect = canvasEl.value!.getBoundingClientRect();
  const xIn = e.clientX - rect.left, yIn = e.clientY - rect.top;
  const { m, pw, ph } = geoRef;
  if (yIn < m.t + ph || xIn < m.l || xIn > m.l + pw) return null;
  if (e.shiftKey) return 'zoomSym';
  if (xIn <= m.l + 0.25 * pw) return 'zoomLo';
  if (xIn >= m.l + 0.75 * pw) return 'zoomHi';
  return 'pan';
}

function freqAt(clientX: number): number | null {
  if (!geoRef) return null;
  const { m, pw, f0, f1 } = geoRef;
  const rect = canvasEl.value!.getBoundingClientRect();
  const frac = (clientX - rect.left - m.l) / pw;
  if (frac < 0 || frac > 1) return null;
  return Math.pow(10, Math.log10(f0) + frac * (Math.log10(f1) - Math.log10(f0)));
}

function rangeStats(fLo: number, fHi: number) {
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
  return { fLo, fHi, stats: rangeStats(fLo, fHi) ?? undefined };
});

function redraw() {
  if (!canvasEl.value) return;
  if (blocked.value || !viewPlot.value) { geoRef = null; return; }
  geoRef = drawOne(canvasEl.value, viewPlot.value, localDragRange.value ? null : effectiveF.value, readEl.value, localDragRange.value);
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 || !geoRef) return;
  // Y-axis strip → start a level pan/zoom drag (takes priority over the freq band).
  const zone = yAxisZone(e);
  if (zone) {
    const p = viewPlot.value!, logy = p.logy;
    yDrag = {
      mode: zone, startY: e.clientY, logy, ph: geoRef.ph,
      ly0: logy ? Math.log10(p.ymin) : p.ymin,
      ly1: logy ? Math.log10(p.ymax) : p.ymax,
    };
    canvasEl.value!.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  // X-axis (frequency) strip → start a frequency pan/zoom drag.
  const xzone = xAxisZone(e);
  if (xzone) {
    xDrag = {
      mode: xzone, startX: e.clientX, pw: geoRef.pw,
      lx0: Math.log10(state.P.fmin), lx1: Math.log10(state.P.fmax),
    };
    canvasEl.value!.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  const f = freqAt(e.clientX);
  if (f !== null) {
    state.dragRange = null; // clear previous selection
    dragOrigin = { clientX: e.clientX, f };
    canvasEl.value!.setPointerCapture(e.pointerId);
  }
}

// Apply the in-progress Y-axis drag → write a per-chart Y override (which viewPlot
// picks up and redraws). All math is in display space (log for log-scale charts).
function applyYDrag(e: PointerEvent) {
  const { mode, startY, ly0, ly1, logy, ph } = yDrag!;
  const span = ly1 - ly0;
  const dy = e.clientY - startY;
  let a = ly0, b = ly1;
  if (mode === 'pan') { const d = -(dy / ph) * span; a += d; b += d; }
  else if (mode === 'zoomTop') { b += -(dy / ph) * span; }        // drag top end
  else if (mode === 'zoomBot') { a += -(dy / ph) * span; }        // drag bottom end
  else { // zoomSym: drag down = zoom out (wider), up = zoom in
    const c = (ly0 + ly1) / 2, half = (span / 2) * Math.max(0.05, 1 + dy / ph);
    a = c - half; b = c + half;
  }
  if (b - a < span * 0.05) return;              // guard: don't collapse/invert
  const inv = (v: number) => logy ? Math.pow(10, v) : v;
  const min = inv(a), max = inv(b);
  if (!isFinite(min) || !isFinite(max) || (logy && min <= 0)) return;
  state.yRanges[props.tabId] = { min, max };
}

// Apply the in-progress X-axis (frequency) drag → write state.P.fmin/fmax (which
// re-sweeps). Math is in log space; result is clamped to 1 Hz … 40 kHz.
function applyXDrag(e: PointerEvent) {
  const { mode, startX, lx0, lx1, pw } = xDrag!;
  const span = lx1 - lx0;
  const dx = e.clientX - startX;
  let a = lx0, b = lx1;
  if (mode === 'pan') { const d = -(dx / pw) * span; a += d; b += d; }
  else if (mode === 'zoomLo') { a += (dx / pw) * span; }          // drag low (left) end
  else if (mode === 'zoomHi') { b += (dx / pw) * span; }          // drag high (right) end
  else { // zoomSym: drag right = zoom in (narrower), left = zoom out
    const c = (lx0 + lx1) / 2, half = (span / 2) * Math.max(0.05, 1 - dx / pw);
    a = c - half; b = c + half;
  }
  a = Math.max(0, Math.min(a, X_LMAX - 0.1));   // 0 = log10(1 Hz)
  b = Math.min(X_LMAX, Math.max(b, a + 0.1));
  if (b - a < 0.1) return;                        // keep at least ~0.1 decade
  state.P.fmin = Math.pow(10, a);
  state.P.fmax = Math.pow(10, b);
}

function onPointerMove(e: PointerEvent) {
  e.preventDefault(); // prevent scroll/zoom on touch and stylus
  // Hint which axis strip is under the pointer and what a drag there will do:
  // directional resize arrows on the zoom ends, a grab hand in the pan middle.
  if (!yDrag && !xDrag && !dragOrigin && canvasEl.value) {
    const yz = yAxisZone(e), xz = xAxisZone(e);
    canvasEl.value!.style.cursor =
      yz === 'zoomTop' ? 'n-resize' : yz === 'zoomBot' ? 's-resize' : yz === 'zoomSym' ? 'ns-resize' : yz ? 'grab' :
      xz === 'zoomLo' ? 'w-resize' : xz === 'zoomHi' ? 'e-resize' : xz === 'zoomSym' ? 'ew-resize' : xz ? 'grab' : '';
  }
  if (yDrag && (e.buttons & 1)) { applyYDrag(e); return; }
  if (xDrag && (e.buttons & 1)) { applyXDrag(e); return; }
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
  const rect = canvasEl.value!.getBoundingClientRect();
  const frac = (e.clientX - rect.left - m.l) / pw;
  if (frac < 0 || frac > 1) { if (state.cursorF !== null) state.cursorF = null; return; }
  state.cursorF = Math.pow(10, Math.log10(f0) + frac * (Math.log10(f1) - Math.log10(f0)));
}

function onPointerUp(e: PointerEvent) {
  if (yDrag) { yDrag = null; return; }
  if (xDrag) { xDrag = null; return; }
  if (!dragOrigin || e.button !== 0) { dragOrigin = null; return; }
  const wasDrag = Math.abs(e.clientX - dragOrigin.clientX) >= 5;
  dragOrigin = null;
  if (wasDrag) return; // leave selection visible; cleared on next pointerdown
  state.dragRange = null;
  // Click toggles a locked marker: first click locks the crosshair at that
  // frequency (hover stops moving it); clicking again unlocks and resumes hover.
  const f = freqAt(e.clientX);
  if (f === null) return;
  if (state.cursorLocked) { state.cursorLocked = false; }
  else { state.pinnedF = f; state.cursorLocked = true; }
}

// Double-click the Y-axis strip resets that chart's level scale to auto; double-click
// the X-axis strip resets the frequency range to the 1–20 kHz default.
function onDblClick(e: MouseEvent) {
  if (yAxisZone(e)) resetY();
  else if (xAxisZone(e)) { state.P.fmin = 1; state.P.fmax = 20000; }
}

function onPointerLeave() {
  dragOrigin = null;
  // Don't clear state.dragRange — selection persists across all panels
  if (!state.cursorLocked) state.cursorF = null;
}

function onPointerCancel() {
  dragOrigin = null; yDrag = null; xDrag = null; state.dragRange = null;
  if (!state.cursorLocked) state.cursorF = null;
}

// ── context menu ──────────────────────────────────────────────
const ctxMenu = ref<{ visible: boolean; x: number; y: number; f: number | null }>({ visible: false, x: 0, y: 0, f: null });

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  const f = state.cursorF ?? state.pinnedF;
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, f };
}

function closeMenu() { ctxMenu.value.visible = false; }

function snapAction(dir: string, type: string) {
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
  state.cursorLocked = true;   // hold the snapped point so hover doesn't override it
  closeMenu();
}

function pinHere() {
  const f = ctxMenu.value.f;
  if (f) { state.pinnedF = f; state.cursorLocked = true; }
  closeMenu();
}

function onDocClick(_e: Event) {
  if (ctxMenu.value.visible) closeMenu();
}

let ro: ResizeObserver | undefined;
onMounted(() => {
  ro = new ResizeObserver(redraw);
  ro.observe(canvasEl.value!);
  document.addEventListener('click', onDocClick);
});
onUnmounted(() => {
  ro?.disconnect();
  document.removeEventListener('click', onDocClick);
});

watch([viewPlot, effectiveF, localDragRange, blocked], redraw, { flush: 'post' });
</script>

<template>
  <div class="gpanel" :class="{ 'y-manual': !!yOverride }">
    <canvas ref="canvasEl"
            @pointerdown="onPointerDown"
            @pointerup="onPointerUp"
            @pointermove="onPointerMove"
            @pointerleave="onPointerLeave"
            @pointercancel="onPointerCancel"
            @dblclick="onDblClick"
            @contextmenu="onContextMenu" />
    <div class="gtitle">{{ meta.name }}</div>
    <div ref="readEl" class="gread"></div>
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
      <div class="ctx-item" @click="pinHere" title="Place the marker at this frequency">Pin marker here</div>
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
