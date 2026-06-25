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

const drvLinks = computed(() => {
  const r = state.driverRaw;
  const links = [];
  if (r.datasheetUrl)  links.push({ href: r.datasheetUrl,  label: 'Datasheet ↗',   title: 'Open manufacturer datasheet PDF' });
  if (r.manuPageUrl)   links.push({ href: r.manuPageUrl,   label: 'Manufacturer ↗', title: 'Open manufacturer product page' });
  if (r.vendorpageUrl && r.vendorpageUrl !== r.manuPageUrl)
    links.push({ href: r.vendorpageUrl, label: 'Vendor ↗', title: 'Open vendor/retailer product listing' });
  if (r.sourceUrl && r.sourceUrl !== r.vendorpageUrl && r.sourceUrl !== r.manuPageUrl)
    links.push({ href: r.sourceUrl, label: 'Source ↗', title: 'Source where T/S data was obtained' });
  if (r.frdUrl)        links.push({ href: r.frdUrl,        label: 'FRD/ZMA ↗',     title: 'Download frequency response & impedance measurement data' });
  if (r.impedanceUrl && r.impedanceUrl !== r.frdUrl)
    links.push({ href: r.impedanceUrl, label: 'Impedance ↗', title: 'Download impedance curve data' });
  return links;
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
      <button style="flex:1" @click="state.browseMode = 'select'; state.browseOpen = true" title="Open the driver library and select a driver to load into the current design">Select driver…</button>
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
      <div v-if="d.providedBy || d.comment || drvLinks.length" class="drvsource">
        <span v-if="d.providedBy || d.comment">{{ [d.providedBy, d.comment].filter(Boolean).join(' · ') }}</span>
        <template v-for="(lnk, i) in drvLinks" :key="lnk.href">
          <span v-if="i === 0 && (d.providedBy || d.comment)"> · </span>
          <span v-else-if="i > 0"> · </span>
          <a :href="lnk.href" target="_blank" rel="noopener" :title="lnk.title">{{ lnk.label }}</a>
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
      <div v-if="drvLinks.length" class="drvsource" style="margin-top:4px">
        <template v-for="(lnk, i) in drvLinks" :key="lnk.href">
          <span v-if="i > 0"> · </span>
          <a :href="lnk.href" target="_blank" rel="noopener" :title="lnk.title">{{ lnk.label }}</a>
        </template>
      </div>
      <div class="btns">
        <button @click="state.editDriver = false" title="Collapse the driver parameter editor and return to the summary view">Done editing</button>
      </div>
    </template>
  </fieldset>
</template>
