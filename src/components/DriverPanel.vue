<script setup>
import { computed } from 'vue';
import { state, driver, driverShort } from '../store.js';
import { ebp } from '../core/alignments.js';

const d = computed(() => state.driverRaw);
const drv = driver;

const ebpVal = computed(() => ebp(drv.value));
const sug = computed(() => {
  const e = ebpVal.value;
  return e < 50 ? 'sealed' : e > 100 ? 'vented' : 'sealed or vented';
});

function numInput(key, scale, val) {
  const v = parseFloat(val);
  if (!isNaN(v)) state.driverRaw[key] = v / scale;
}
</script>

<template>
  <fieldset>
    <legend>Driver</legend>
    <div class="row" style="margin-bottom:6px">
      <button style="flex:1" @click="state.browseOpen = true" title="Open the driver library to search and load a driver from the community database">Browse driver library…</button>
    </div>
    <template v-if="!state.editDriver">
      <div class="drvsum" @click="state.editDriver = true" title="Click to edit driver Thiele/Small parameters — opens the full T/S parameter editor">
        <span class="nm">{{ driverShort(d) }}</span>
        <span class="drvlinks">
          <a v-if="d.datasheetUrl" :href="d.datasheetUrl" target="_blank" rel="noopener"
             :title="d.datasheetUrl.match(/\.pdf(\?|$)/i) ? 'Open datasheet PDF' : 'Open product page'"
             @click.stop>{{ d.datasheetUrl.match(/\.pdf(\?|$)/i) ? 'PDF' : '↗' }}</a>
        </span>
        <span class="ed">Edit ✎</span>
      </div>
      <div class="drvspecs">
        Fs <b>{{ (+d.Fs||0).toFixed(0) }} Hz</b> ·
        Qts <b>{{ (drv.Qts||0).toFixed(2) }}</b> ·
        Vas <b>{{ (d.Vas*1000).toFixed(1) }} L</b> ·
        Sd <b>{{ (d.Sd*1e4).toFixed(0) }} cm²</b> ·
        Re <b>{{ (+d.Re||0).toFixed(1) }} Ω</b> ·
        Xmax <b>{{ (d.Xmax*1000).toFixed(1) }} mm</b><br>
        EBP <b>{{ ebpVal.toFixed(0) }}</b> → {{ sug }} ·
        Bl {{ drv.Bl.toFixed(1) }} Tm ·
        Mms {{ (drv.Mms*1000).toFixed(1) }} g
      </div>
      <div v-if="d.providedBy || d.comment || d.datasheetUrl || d.vendorpageUrl || d.sourceUrl" class="drvsource">
        <span v-if="d.providedBy">{{ d.providedBy }}</span>
        <span v-if="d.providedBy && d.comment"> · </span>
        <span v-if="d.comment">{{ d.comment }}</span>
        <template v-if="d.datasheetUrl && d.datasheetUrl !== d.vendorpageUrl">
          <span v-if="d.providedBy || d.comment"> · </span>
          <a :href="d.datasheetUrl" target="_blank" rel="noopener"
             title="Open manufacturer datasheet (PDF) in a new window">Datasheet ↗</a>
        </template>
        <template v-if="d.vendorpageUrl">
          <span v-if="d.providedBy || d.comment || (d.datasheetUrl && d.datasheetUrl !== d.vendorpageUrl)"> · </span>
          <a :href="d.vendorpageUrl" target="_blank" rel="noopener"
             title="Open manufacturer product page in a new window">Vendor page ↗</a>
        </template>
        <template v-if="d.sourceUrl && d.sourceUrl !== d.vendorpageUrl">
          <span v-if="d.providedBy || d.comment || d.datasheetUrl || d.vendorpageUrl"> · </span>
          <a :href="d.sourceUrl" target="_blank" rel="noopener"
             title="Open the source listing where T/S data was obtained">Source ↗</a>
        </template>
      </div>
    </template>
    <template v-else>
      <div class="row"><label>Fs</label>
        <input type="number" step="any" data-bind="Fs" :value="(+d.Fs).toFixed(1)" @input="e => numInput('Fs',1,e.target.value)">
        <span class="u">Hz</span></div>
      <div class="row"><label>Qts</label>
        <input type="number" step="any" :value="(+d.Qts).toPrecision(3)" @input="e => numInput('Qts',1,e.target.value)">
        <span class="u"></span></div>
      <div class="row"><label>Qes</label>
        <input type="number" step="any" :value="(+d.Qes).toPrecision(3)" @input="e => numInput('Qes',1,e.target.value)">
        <span class="u"></span></div>
      <div class="row"><label>Qms</label>
        <input type="number" step="any" :value="(+d.Qms).toPrecision(3)" @input="e => numInput('Qms',1,e.target.value)">
        <span class="u"></span></div>
      <div class="row"><label>Vas</label>
        <input type="number" step="any" :value="(d.Vas*1000).toPrecision(4)" @input="e => numInput('Vas',1000,e.target.value)">
        <span class="u">L</span></div>
      <div class="row"><label>Sd</label>
        <input type="number" step="any" :value="(d.Sd*1e4).toPrecision(4)" @input="e => numInput('Sd',1e4,e.target.value)">
        <span class="u">cm²</span></div>
      <div class="row"><label>Re</label>
        <input type="number" step="any" :value="(+d.Re).toPrecision(3)" @input="e => numInput('Re',1,e.target.value)">
        <span class="u">Ω</span></div>
      <div class="row"><label>Le</label>
        <input type="number" step="any" :value="(d.Le*1000).toPrecision(3)" @input="e => numInput('Le',1000,e.target.value)">
        <span class="u">mH</span></div>
      <div class="row"><label>Xmax</label>
        <input type="number" step="any" :value="(d.Xmax*1000).toPrecision(3)" @input="e => numInput('Xmax',1000,e.target.value)">
        <span class="u">mm</span></div>
      <div class="row"><label>Pe</label>
        <input type="number" step="any" :value="(+d.Pe||0)" @input="e => numInput('Pe',1,e.target.value)">
        <span class="u">W</span></div>
      <div class="ebp">
        EBP = Fs/Qes = <b>{{ ebpVal.toFixed(0) }}</b> → suggests <b>{{ sug }}</b>.<br>
        Derived: Bl={{ drv.Bl.toFixed(2) }} Tm, Mms={{ (drv.Mms*1000).toFixed(1) }} g,
        Cms={{ (drv.Cms*1000).toFixed(3) }} mm/N
      </div>
      <div v-if="d.datasheetUrl || d.vendorpageUrl || d.sourceUrl" class="drvsource" style="margin-top:4px">
        <a v-if="d.datasheetUrl && d.datasheetUrl !== d.vendorpageUrl"
           :href="d.datasheetUrl" target="_blank" rel="noopener"
           title="Open manufacturer datasheet (PDF) in a new window">Datasheet ↗</a>
        <span v-if="d.datasheetUrl && d.datasheetUrl !== d.vendorpageUrl && d.vendorpageUrl"> · </span>
        <a v-if="d.vendorpageUrl" :href="d.vendorpageUrl" target="_blank" rel="noopener"
           title="Open manufacturer product page in a new window">Vendor page ↗</a>
        <span v-if="d.sourceUrl && d.sourceUrl !== d.vendorpageUrl && (d.datasheetUrl || d.vendorpageUrl)"> · </span>
        <a v-if="d.sourceUrl && d.sourceUrl !== d.vendorpageUrl"
           :href="d.sourceUrl" target="_blank" rel="noopener"
           title="Open the source listing where T/S data was obtained">Source ↗</a>
      </div>
      <div class="btns">
        <button @click="state.editDriver = false" title="Collapse the driver parameter editor and return to the summary view">Done editing</button>
      </div>
    </template>
  </fieldset>
</template>
