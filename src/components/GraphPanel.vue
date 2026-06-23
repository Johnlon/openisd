<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { state, driver, syncedP, curvesData, maxData } from '../store.js';
import { TABS, buildPlotData } from '../utils/series.js';
import { drawOne } from '../utils/canvas.js';
import { DPAL } from '../presets.js';

const props = defineProps({ tabId: String });

const canvasEl = ref(null);
const readEl = ref(null);
const meta = computed(() => TABS.find(t => t.id === props.tabId) || { name: props.tabId });

const currentDesign = computed(() => ({
  driver: driver.value,
  box: state.box,
  P: syncedP.value,
  curves: curvesData.value,
  maxCurves: maxData.value,
  name: 'Current',
  color: DPAL[0],
}));

const plotData = computed(() => {
  return buildPlotData(
    props.tabId,
    state.P.fmin,
    state.P.fmax,
    currentDesign.value,
    state.compare
  );
});

let geoRef = null;

function redraw() {
  geoRef = drawOne(canvasEl.value, plotData.value, state.cursorF, readEl.value);
}

function onMouseMove(e) {
  if (!geoRef) return;
  const { m, pw, f0, f1 } = geoRef;
  const rect = canvasEl.value.getBoundingClientRect();
  const frac = (e.clientX - rect.left - m.l) / pw;
  if (frac < 0 || frac > 1) {
    if (state.cursorF !== null) state.cursorF = null;
    return;
  }
  state.cursorF = Math.pow(10, Math.log10(f0) + frac * (Math.log10(f1) - Math.log10(f0)));
}

function onMouseLeave() { state.cursorF = null; }

let ro;
onMounted(() => {
  ro = new ResizeObserver(redraw);
  ro.observe(canvasEl.value);
});
onUnmounted(() => { ro?.disconnect(); });

watch([plotData, () => state.cursorF], redraw, { flush: 'post' });
</script>

<template>
  <div class="gpanel">
    <canvas ref="canvasEl" @mousemove="onMouseMove" @mouseleave="onMouseLeave" />
    <div class="gtitle">{{ meta.name }}</div>
    <div ref="readEl" class="gread"></div>
  </div>
</template>
