<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { state, driver, syncedP, curvesData, maxData } from '../store.js';
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

const plotData = computed(() =>
  buildPlotData(props.tabId, state.P.fmin, state.P.fmax, currentDesign.value, state.compare)
);

const effectiveF = computed(() =>
  state.cursorLocked ? state.pinnedF : (state.cursorF ?? state.pinnedF)
);

let geoRef = null;
function redraw() {
  geoRef = drawOne(canvasEl.value, plotData.value, effectiveF.value, readEl.value);
}

function onMouseMove(e) {
  if (state.cursorLocked || !geoRef) return;
  const { m, pw, f0, f1 } = geoRef;
  const rect = canvasEl.value.getBoundingClientRect();
  const frac = (e.clientX - rect.left - m.l) / pw;
  if (frac < 0 || frac > 1) { if (state.cursorF !== null) state.cursorF = null; return; }
  state.cursorF = Math.pow(10, Math.log10(f0) + frac * (Math.log10(f1) - Math.log10(f0)));
}

function onMouseLeave() { if (!state.cursorLocked) state.cursorF = null; }

// ── context menu ──────────────────────────────────────────────
const ctxMenu = ref({ visible: false, x: 0, y: 0, f: null });

function onContextMenu(e) {
  e.preventDefault();
  const f = state.cursorLocked ? state.pinnedF : state.cursorF;
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, f };
}

function closeMenu() { ctxMenu.value.visible = false; }

function localExtrema(s) {
  const out = [];
  for (let i = 1; i < s.ys.length - 1; i++) {
    if (!isFinite(s.ys[i])) continue;
    if ((s.ys[i] > s.ys[i-1] && s.ys[i] > s.ys[i+1]) ||
        (s.ys[i] < s.ys[i-1] && s.ys[i] < s.ys[i+1])) out.push(i);
  }
  return out;
}

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

function onDocClick(e) {
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

watch([plotData, effectiveF], redraw, { flush: 'post' });
</script>

<template>
  <div class="gpanel">
    <canvas ref="canvasEl"
            @mousemove="onMouseMove"
            @mouseleave="onMouseLeave"
            @contextmenu="onContextMenu" />
    <div class="gtitle">{{ meta.name }}</div>
    <div ref="readEl" class="gread"></div>
  </div>

  <Teleport to="body">
    <div v-if="ctxMenu.visible"
         class="ctx-menu"
         :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
         @click.stop>
      <div class="ctx-item" @click="lockHere">Lock cursor here</div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" @click="snapAction('left',  'max')">◄ Max to left</div>
      <div class="ctx-item" @click="snapAction('left',  'min')">◄ Min to left</div>
      <div class="ctx-item" @click="snapAction('right', 'max')">Max to right ►</div>
      <div class="ctx-item" @click="snapAction('right', 'min')">Min to right ►</div>
    </div>
  </Teleport>
</template>

<style scoped>
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
