<script setup>
import { ref } from 'vue';
import { state, driver, syncedP, curvesData, driverShort } from '../store.js';
import { toWdr, parseWdr } from '../core/driver.js';
import { serialize, stateToUrl } from '../utils/persist.js';
import { flash } from '../utils/flash.js';
import { ebp } from '../core/alignments.js';

function shareLink() {
  const url = stateToUrl(serialize(state, driver.value, state.compare));
  try { history.replaceState(null, '', url); } catch {}
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(
      () => flash('Share link copied to clipboard'),
      () => prompt('Copy this share link:', url));
  } else { prompt('Copy this share link:', url); }
}

function exportDesign() {
  const text = JSON.stringify(serialize(state, driver.value, state.compare), null, 2);
  dlFile('design.resonate.json', text, 'application/json');
}

function exportWdr() {
  const fn = (state.driverRaw.name || 'driver').replace(/[^\w.-]+/g, '_') + '.wdr';
  dlFile(fn, toWdr(state.driverRaw), 'text/plain');
}

const fileInput = ref(null);
function importClick() { fileInput.value.click(); }
function onFileChange(e) {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  const isWdr = /\.wdr$/i.test(f.name);
  rd.onload = () => {
    try {
      if (isWdr || /^\s*\[Driver\]/.test(rd.result)) {
        state.driverRaw = parseWdr(rd.result);
      } else {
        const o = JSON.parse(rd.result);
        if (o.driver) state.driverRaw = o.driver;
        if (o.box) state.box = o.box;
        if (o.P) Object.assign(state.P, o.P);
        if (Array.isArray(o.graphs) && o.graphs.length) state.graphs = o.graphs;
      }
    } catch(err) { alert('Could not read "' + f.name + '": ' + err.message); }
  };
  rd.readAsText(f);
  e.target.value = '';
}

function dlFile(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click();
}

function showAbout() {
  const d = driver.value;
  alert(`Resonate — open loudspeaker enclosure simulator\nA community-owned tool modelling the Thiele/Small electro-mechano-acoustical system.\n\nBox types: sealed, vented, 4th-order bandpass, passive radiator\nCurves: SPL, excursion, port velocity, group delay, impedance, max SPL/power\n\nSee docs/MATHS.md for the circuit model and equations.`);
}
</script>

<template>
  <header>
    <h1>Resonate<span style="color:var(--acc)"> ~</span> &nbsp;
      <small>open loudspeaker enclosure simulator · community-owned · runs anywhere</small>
    </h1>
    <div class="sp"></div>
    <button @click="importClick">Import .wdr / project</button>
    <button @click="exportWdr">Export driver .wdr</button>
    <button id="btnShare" @click="shareLink">Share link</button>
    <button @click="exportDesign">Export design</button>
    <button @click="showAbout">About</button>
    <input ref="fileInput" type="file" accept=".wdr,.json" style="display:none" @change="onFileChange">
  </header>
</template>
