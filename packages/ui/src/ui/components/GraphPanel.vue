<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref, watch} from 'vue';
import {projectChanged} from '../../logic/appState.js';
import {useFocusedProject} from '../../logic/focusedProjectContext.js';
import {presentationState} from '../../logic/presentationState.js';
import type {Design, FrequencyAxis, FrequencyDragMode, LevelAxis, LevelDragMode, SnapDirection, SnapExtremum} from '@openisd/design/chart';
import type {Geo} from '../../types.js';
import type {ChartId} from '@openisd/design/engine';
import {drawOne} from '../canvas.js';
import {useGraphPanel} from '../../hooks/GraphPanel-hooks.js';
import {useApp} from '../../logic/app.js';

// `bare`/`primaryColor` are the WinISD chart mode: a clean single trace with no
// F3/F6/F10 reference lines or legend, coloured to match the shell's Color swatch.
// `overlays` are the extra traces drawn behind the current design — other PROJECTS the
// caller wants seen alongside this one (the Original skin's open project rows). A design
// never holds another design to get it drawn, so there is no default set to fall back to:
// no overlays passed means this project is drawn alone.
const props = defineProps<{ chartId: ChartId; bare?: boolean; primaryColor?: string; overlays?: Design[] }>();

const project = useFocusedProject();
const graph = useGraphPanel(props, useApp().engine);

const canvasEl = ref<HTMLCanvasElement | null>(null);
const readEl   = ref<HTMLElement | null>(null);
const meta = graph.meta;
const plotData = graph.plotData;
const blockErrors = graph.blockErrors;
const blocked = graph.blocked;
const warnings = graph.warnings;
const warningsDismissed = graph.warningsDismissed;

// Per-chart Y-axis (level) override — the vertical half of "zoom out/in". Absent =
// auto-scale to fit the data. When set, it replaces the auto ymin/ymax on the drawn
// plot only; series data and cursor stats are untouched.
const yOverride = computed(() => presentationState.yRanges[props.chartId] || null);
const viewPlot  = computed(() => {
  const p = plotData.value;
  if (!p) return p;
  const ov = yOverride.value;
  const axis = ov ? p.levelAxis.overridden(ov.min, ov.max) : null;
  return axis ? { ...p, ymin: axis.min, ymax: axis.max, levelAxis: axis } : p;
});
// Reset a chart's Y scale to auto (invoked by double-clicking its axis).
function resetY() { delete presentationState.yRanges[props.chartId]; }

const effectiveF = computed(() => {
  void projectChanged.value;
  const p = project.value;
  return p.cursorLocked.value ? p.pinnedF.value : (p.cursorF.value ?? p.pinnedF.value);
});

let geoRef: Geo | null = null;
let dragOrigin: { clientX: number; f: number } | null = null; // set on pointerdown (frequency band-select)
let yDrag: { mode: LevelDragMode; startY: number; axis: LevelAxis; ph: number } | null = null; // Y-axis drag
let xDrag: { mode: FrequencyDragMode; startX: number; axis: FrequencyAxis; pw: number } | null = null; // X-axis (frequency) drag

// Is a pointer position inside the left Y-axis strip (the value-label margin)?
// Returns the vertical zone for the gesture, or null if not on the axis.
//   'zoomTop' (top quarter) / 'zoomBot' (bottom quarter) → zoom that end
//   'pan' (middle) → shift the window;  Shift key → 'zoomSym' (symmetric zoom)
function yAxisZone(e: PointerEvent | MouseEvent): LevelDragMode | null {
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
function xAxisZone(e: PointerEvent | MouseEvent): FrequencyDragMode | null {
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
  const { m, pw, axis } = geoRef;
  const rect = canvasEl.value!.getBoundingClientRect();
  const frac = (clientX - rect.left - m.l) / pw;
  if (frac < 0 || frac > 1) return null;
  return axis.at(frac);
}

// Per-panel view of the shared frequency selection — stats come from this panel's series
const localDragRange = computed(() => {
  void projectChanged.value;
  const range = project.value.dragRange.value;
  if (!range) return null;
  const { fLo, fHi } = range;
  return { fLo, fHi, stats: graph.rangeStats(fLo, fHi) ?? undefined };
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
    const p = viewPlot.value!;
    yDrag = { mode: zone, startY: e.clientY, ph: geoRef.ph, axis: p.levelAxis };
    canvasEl.value!.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  // X-axis (frequency) strip → start a frequency pan/zoom drag.
  const xzone = xAxisZone(e);
  if (xzone) {
    xDrag = {
      mode: xzone, startX: e.clientX, pw: geoRef.pw,
      axis: graph.frequencyAxis(),
    };
    canvasEl.value!.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  const f = freqAt(e.clientX);
  if (f !== null) {
    project.value.dragRange.set(null); // clear previous selection
    dragOrigin = { clientX: e.clientX, f };
    canvasEl.value!.setPointerCapture(e.pointerId);
  }
}

// Apply the in-progress Y-axis drag → write a per-chart Y override (which viewPlot
// picks up and redraws).
function applyYDrag(e: PointerEvent) {
  const { mode, startY, axis, ph } = yDrag!;
  const next = axis.drag(mode, (e.clientY - startY) / ph);
  if (next) presentationState.yRanges[props.chartId] = { min: next.min, max: next.max };
}

// Apply the in-progress X-axis (frequency) drag → write the global sweep range
// (`presentationState.sweepRange`, shared across every open project).
function applyXDrag(e: PointerEvent) {
  const { mode, startX, axis, pw } = xDrag!;
  const next = axis.drag(mode, (e.clientX - startX) / pw);
  if (next) presentationState.sweepRange = { min: next.fmin, max: next.fmax };
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
        project.value.dragRange.set({ fLo, fHi });
        redraw();
      }
      return;
    }
  }
  if (project.value.cursorLocked.value || !geoRef) return;
  const { m, pw, axis } = geoRef;
  const rect = canvasEl.value!.getBoundingClientRect();
  const frac = (e.clientX - rect.left - m.l) / pw;
  if (frac < 0 || frac > 1) { if (project.value.cursorF.value !== null) project.value.cursorF.set(null); return; }
  project.value.cursorF.set(axis.at(frac));
}

function onPointerUp(e: PointerEvent) {
  if (yDrag) { yDrag = null; return; }
  if (xDrag) { xDrag = null; return; }
  if (!dragOrigin || e.button !== 0) { dragOrigin = null; return; }
  const wasDrag = Math.abs(e.clientX - dragOrigin.clientX) >= 5;
  dragOrigin = null;
  if (wasDrag) return; // leave selection visible; cleared on next pointerdown
  project.value.dragRange.set(null);
  // Click locks or moves the marker:
  // - Clicking an unlocked chart locks the cursor at that frequency.
  // - Clicking near the already pinned location unlocks it.
  // - Clicking somewhere else while locked moves the cursor to the new location UNLOCKED.
  const f = freqAt(e.clientX);
  if (f === null) return;
  graph.clickCursorAt(f);
}

// Double-click the Y-axis strip resets that chart's level scale to auto; double-click
// the X-axis strip resets the frequency range to the 1–20 kHz default.
function onDblClick(e: MouseEvent) {
  if (yAxisZone(e)) resetY();
  else if (xAxisZone(e)) { presentationState.sweepRange = { min: 1, max: 20000 }; }
}

function onPointerLeave() {
  dragOrigin = null;
  // Don't clear the project's dragRange — selection persists across all panels
  if (!project.value.cursorLocked.value) project.value.cursorF.set(null);
}

function onPointerCancel() {
  dragOrigin = null; yDrag = null; xDrag = null;
  const p = project.value;
  p.dragRange.set(null);
  if (!p.cursorLocked.value) p.cursorF.set(null);
}

// ── context menu ──────────────────────────────────────────────
const ctxMenu = ref<{ visible: boolean; x: number; y: number; f: number | null }>({ visible: false, x: 0, y: 0, f: null });

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  const p = project.value;
  const f = p.cursorF.value ?? p.pinnedF.value;
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, f };
}

function closeMenu() { ctxMenu.value.visible = false; }

function snapAction(direction: SnapDirection, extremum: SnapExtremum) {
  const f = graph.snapFrequency(ctxMenu.value.f, direction, extremum);
  if (f !== null) {
    project.value.pinnedF.set(f);
    project.value.cursorLocked.set(true);   // hold the snapped point so hover doesn't override it
  }
  closeMenu();
}

function pinHere() {
  const f = ctxMenu.value.f;
  if (f) { project.value.pinnedF.set(f); project.value.cursorLocked.set(true); }
  closeMenu();
}

function onDocClick() {
  if (ctxMenu.value.visible) closeMenu();
}

let ro: ResizeObserver | undefined;
onMounted(() => {
  // Deferred to the next frame: drawing resizes the canvas backing store, and a resize inside
  // the observer's own callback is the loop Chrome reports as an error (BUG_20261001).
  ro = new ResizeObserver(() => requestAnimationFrame(redraw));
  ro.observe(canvasEl.value!);
  document.addEventListener('click', onDocClick);
  // Canvas text is rasterized at draw time — if Inter loads after the first
  // paint, that paint used a fallback font. Redraw once the real font is in.
  document.fonts.ready.then(redraw);
});
onUnmounted(() => {
  ro?.disconnect();
  document.removeEventListener('click', onDocClick);
});

const canvasStyles = computed(() => {
  const colors = presentationState.ui.chartColors;
  if (!colors) return {};
  const styles: Record<string, string> = {};
  if (colors.background) styles['--chart-bg-override'] = colors.background;
  if (colors.otherLines) styles['--chart-grid'] = colors.otherLines;
  if (colors.labels) styles['--chart-text'] = colors.labels;
  if (colors.xmaxLimit) styles['--chart-pelimit'] = colors.xmaxLimit;
  if (colors.cursor) {
    styles['--chart-cross'] = colors.cursor;
    styles['--chart-band-line'] = colors.cursor;
    styles['--chart-band'] = `color-mix(in srgb, ${colors.cursor} 7%, transparent)`;
  }
  return styles;
});

watch([viewPlot, effectiveF, localDragRange, blocked, canvasStyles], redraw, { flush: 'post' });
</script>

<template>
  <div class="gpanel" :class="{ 'y-manual': !!yOverride }">
    <canvas ref="canvasEl"
            :style="canvasStyles"
            @pointerdown="onPointerDown"
            @pointerup="onPointerUp"
            @pointermove="onPointerMove"
            @pointerleave="onPointerLeave"
            @pointercancel="onPointerCancel"
            @dblclick="onDblClick"
            @contextmenu="onContextMenu" />
    <div class="gtitle">{{ meta.name }}</div>
    <div v-if="warnings.length && !warningsDismissed" class="gwarn gwarn-pill" :title="warnings.map(w => w.message).join('\n')">
      <span class="gwarn-icon">⚠</span>
      <span class="gwarn-text">{{ warnings[0].message }}</span>
      <button class="gwarn-x" @click.stop="warningsDismissed = true" title="Dismiss warning">✕</button>
    </div>
    <div ref="readEl" class="gread"></div>
    <div v-if="blocked" class="gmsg">
      <div class="gmsg-title">Can’t plot {{ meta.name }}</div>
      <div v-for="e in blockErrors" :key="e.field" class="gmsg-line">{{ e.message }}</div>
       <div class="gmsg-foot">Fix the listed inputs to restore this chart.</div>
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

/* Non-blocking warning pill in the chart header: sits cleanly beside the title
   without obscuring graph curves, axis tick labels, or cursor readouts.
   `min(120px, 30%)` matches the old flat 120px on any container ≥400px wide (every desktop
   width `original-shell-layout.browser.spec.ts` tests, down to 780px, and every use before the mobile
   shell existed), and shrinks proportionally instead of eating a fixed 240px budget on a
   narrow phone-width container, where the flat value left little or no room for the pill. */
.gwarn-pill {
  position: absolute;
  left: min(120px, 30%);
  top: 3px;
  max-width: calc(100% - 2 * min(120px, 30%) - 8px);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: color-mix(in srgb, var(--panel) 90%, var(--acc2) 10%);
  border: 1px solid var(--acc2);
  border-radius: 3px;
  z-index: 3;
  pointer-events: auto;
}
.gwarn-icon {
  font-size: 11px;
  color: var(--acc2);
  flex-shrink: 0;
}
.gwarn-text {
  font-size: 10px;
  line-height: 1.2;
  color: var(--acc2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gwarn-x {
  background: transparent;
  border: none;
  color: var(--acc2);
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 0 2px;
  margin-left: 2px;
  flex-shrink: 0;
  opacity: 0.8;
}
.gwarn-x:hover {
  opacity: 1;
}

.ctx-menu {
  position: fixed;
  z-index: 9999;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 3px 0;
  min-width: 160px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  font-size: 12px;
  user-select: none;
}
.ctx-item {
  padding: 5px 14px;
  color: var(--fg);
  cursor: pointer;
}
.ctx-item:hover { background: var(--panel2); }
.ctx-sep {
  height: 1px;
  background: var(--line);
  margin: 3px 0;
}
</style>
