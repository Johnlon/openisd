<script setup lang="ts">
import { ref } from 'vue';
import { state, driver } from '../store.js';
import { toWdr, parseWdr } from '@openisd/engine';
import { serialize, stateToUrl } from '../utils/persist.js';
import { flash } from '../utils/flash.js';

function shareLink() {
  const url = stateToUrl(serialize(state, driver.value, state.compare));
  try { history.replaceState(null, '', url); } catch { /* replaceState can throw on some file:// origins — non-fatal */ }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(
      () => flash('Share link copied to clipboard'),
      () => prompt('Copy this share link:', url));
  } else { prompt('Copy this share link:', url); }
}

function exportDesign() {
  const text = JSON.stringify(serialize(state, driver.value, state.compare), null, 2);
  dlFile('design.openisd.json', text, 'application/json');
}

function exportWdr() {
  const fn = (state.driverRaw.name || 'driver').replace(/[^\w.-]+/g, '_') + '.wdr';
  dlFile(fn, toWdr(state.driverRaw), 'text/plain');
}

const fileInput = ref<HTMLInputElement | null>(null);
function importClick() { fileInput.value!.click(); }
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0]; if (!f) return;
  const rd = new FileReader();
  const isWdr = /\.wdr$/i.test(f.name);
  rd.onload = () => {
    const text = rd.result as string;
    try {
      if (isWdr || /^\s*\[Driver\]/.test(text)) {
        const { value: parsed } = parseWdr(text);
        if (parsed) state.driverRaw = parsed;
      } else {
        const o = JSON.parse(text);
        if (o.driver) state.driverRaw = o.driver;
        if (o.box) state.box = o.box;
        if (o.P) Object.assign(state.P, o.P);
        if (Array.isArray(o.graphs) && o.graphs.length) state.graphs = o.graphs;
      }
    } catch(err) { alert('Could not read "' + f.name + '": ' + (err as Error).message); }
  };
  rd.readAsText(f);
  input.value = '';
}

function dlFile(name: string, text: string, mime: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click();
}

function showAbout() {
  alert(`OpenISD — open loudspeaker enclosure simulator\nA community-owned tool modelling the Thiele/Small electro-mechano-acoustical system.\n\nBox types: sealed, vented, 4th-order bandpass, passive radiator\nCurves: SPL, excursion, port velocity, group delay, impedance, max SPL/power\n\nSee docs/MATHS.md for the circuit model and equations.`);
}
</script>

<template>
  <header>
    <h1>OpenISD<span style="color:var(--acc)"> ~</span> &nbsp;
      <small>open loudspeaker enclosure simulator · community-owned · runs anywhere</small>
    </h1>
    <div class="sp"></div>
    <button @click="importClick" title="Import a WinISD .wdr driver file or an OpenISD .json project file">Import .wdr / project</button>
    <button @click="exportWdr" title="Export the current driver parameters as a WinISD-compatible .wdr file">Export driver .wdr</button>
    <button id="btnShare" @click="shareLink" title="Copy a shareable URL that encodes the current design — paste into a forum or send to a colleague">Share link</button>
    <button @click="exportDesign" title="Export the full design (driver + box + settings) as an OpenISD .json project file">Export design</button>
    <button @click="showAbout" title="About OpenISD — version, licence, and contributors">About</button>
    <input ref="fileInput" type="file" accept=".wdr,.json" style="display:none" @change="onFileChange">
  </header>
</template>
