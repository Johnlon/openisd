<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { state } from '../store.js';
import { useEscToClose } from '../composables/useEscToClose.js';
import { useDriverLibrary } from '../composables/useDriverLibrary.js';
import type { FileEntry } from '../composables/useDriverLibrary.js';
import { DriverFileFormat } from '../driverFileFormat.js';

// Modern-skin driver library — markup and CSS only (ARCHITECTURE.md AD-7). Every behaviour
// below is a call into useDriverLibrary; this component decides only what is on screen.
//
// Selecting a driver does NOT change the design: it opens the editor on a draft and this
// picker stays open behind it (STATE_MODEL.md). OK commits and closes both; Cancel returns
// here with the design untouched.

const {
  DRIVER_TYPES,
  statusMsg, statusErr,
  filterQ, typeHelpOpen, typeStates,
  fsMin, fsMax, sdMin, sdMax, selZ, displayLimit,
  toggleType, toggleZ, clearParamFilters,
  filteredFiles, displayedFiles, listTruncated, listedCount,
  filteredMyDrivers, myDriverName, myDriverEntry, driverId, editMyDriver, deleteMyDriver,
  previewFile, previewData, pickFile, chooseDriver, loadFromDisk, cloneDriver,
  openedLibrary, closeLibrary,
  shortSource,
  favoritesOnly, isFavorite, toggleFavorite, toggleFavoritesOnly,
} = useDriverLibrary();

const fileInputEl = ref<HTMLInputElement | null>(null);
function triggerFileLoad() { fileInputEl.value?.click(); }
function openSourceUrl(url: string | undefined) { if (url) window.open(url, '_blank', 'noopener'); }

// A row click previews; "Use this driver" selects. Preview is what this skin shows —
// what a selection DOES is identical in every skin.
function handleItemClick(f: FileEntry) { pickFile(f); }

function close() { closeLibrary(); }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }
useEscToClose(() => state.browseOpen, close);

async function openDefine() {
  state.browseOpen = false;
  await nextTick();
  state.defineOpen = true;
}

watch(() => state.browseOpen, val => { if (val) openedLibrary(); else pickFile(null); }, { immediate: true });
</script>
<template>
  <div class="overlay" :class="{ on: state.browseOpen }" @click="onBackdrop">
    <div class="modal" v-if="state.browseOpen">
      <h2>
        {{ previewFile ? previewData?.name : 'Driver library' }}
        <span class="x" @click="close" title="Close the driver library browser">&times;</span>
      </h2>
      <div class="body">
        <template v-if="!previewFile">
        <input class="filter" v-model="filterQ" placeholder="Search drivers…" autofocus>
        <div class="type-row">
          <button v-for="t in DRIVER_TYPES" :key="t.value"
                  class="type-chip"
                  :class="{ include: typeStates[t.value] === 'include' }"
                  :title="typeStates[t.value] === 'include' ? 'Filter active: ' + t.label + ' (click to clear)' : 'Filter by ' + t.label"
                  @click="toggleType(t.value)">{{ t.label }}</button>
          <button v-if="Object.keys(typeStates).length || fsMin || fsMax || sdMin || sdMax || selZ.length"
                  class="type-chip type-clear" title="Clear all type and parameter filters"
                  @click="clearParamFilters">✕ clear</button>
          <!-- Help popup — keep content in sync with drivers/DRIVER_TYPES.md -->
          <div class="help-wrap">
            <button class="help-btn" :class="{ active: typeHelpOpen }"
                    title="How are driver types classified?"
                    @click.stop="typeHelpOpen = !typeHelpOpen">?</button>
            <div v-if="typeHelpOpen" class="help-drop" @click.stop>
              <div class="help-title">Driver type classification
                <span class="help-ref">· see <code>drivers/DRIVER_TYPES.md</code></span>
              </div>
              <table class="help-table">
                <thead><tr><th>Vendor calls it</th><th>Badge</th><th>Chips</th></tr></thead>
                <tbody>
                  <tr><td>Subwoofer</td><td>Subwoofer</td><td>Sub · Woofer · Bass</td></tr>
                  <tr><td>Woofer</td><td>Woofer</td><td>Woofer · Bass</td></tr>
                  <tr><td>Mid-bass / mid-woofer / midwoofer</td><td>Mid-bass</td><td>Woofer · Mid · Bass</td></tr>
                  <tr><td>Midrange / mid-range</td><td>Midrange</td><td>Woofer · Mid</td></tr>
                  <tr><td>Full-range</td><td>Full-range</td><td>Woofer · Mid · Tweet · Bass · Full-range</td></tr>
                  <tr><td>BMR / balanced mode</td><td>BMR</td><td>Mid · Tweet <em>(not bass)</em></td></tr>
                  <tr><td>Tweeter / dome</td><td>Tweeter</td><td>Tweet</td></tr>
                  <tr><td>Ribbon tweeter</td><td>Ribbon Tweeter</td><td>Tweet</td></tr>
                  <tr><td>Planar</td><td>Planar Tweeter</td><td>Tweet</td></tr>
                  <tr><td>AMT / air motion</td><td>AMT</td><td>Tweet</td></tr>
                  <tr><td>Passive radiator</td><td>Passive Radiator</td><td>PR</td></tr>
                  <tr><td>Coaxial / coax</td><td>Coaxial</td><td>Woofer · Mid · Tweet · Bass · Coaxial</td></tr>
                  <tr class="help-fallback"><td><em>Tiny piston (Sd &lt; 12 cm²)</em></td><td>Tweeter</td><td>Tweet</td></tr>
                  <tr class="help-fallback"><td><em>Very low Fs (&lt; 40 Hz)</em></td><td>Subwoofer</td><td>Sub · Woofer · Bass</td></tr>
                  <tr class="help-unclass"><td><em>No signal either way</em></td><td>⚠ Unclassified</td><td><em>shows in all queries</em></td></tr>
                </tbody>
              </table>
            </div>
            <div v-if="typeHelpOpen" class="src-backdrop" @click="typeHelpOpen = false"></div>
          </div>
        </div>
        <div class="param-row">
          <span class="plabel" :class="{ active: fsMin || fsMax }">Fs</span>
          <input class="pnum" :class="{ active: fsMin }" v-model="fsMin" type="number" min="1" placeholder="min"
                 title="Minimum free-air resonance (Hz) — WinISD: Fs">
          <span class="pmid">–</span>
          <input class="pnum" :class="{ active: fsMax }" v-model="fsMax" type="number" min="1" placeholder="max"
                 title="Maximum free-air resonance (Hz) — WinISD: Fs">
          <span class="plabel" :class="{ active: fsMin || fsMax }">Hz</span>
          <span class="psep"></span>
          <span class="plabel" :class="{ active: sdMin || sdMax }">Sd</span>
          <input class="pnum" :class="{ active: sdMin }" v-model="sdMin" type="number" min="0" placeholder="min"
                 title="Minimum piston area in cm² — WinISD: Sd (converts from m²)">
          <span class="pmid">–</span>
          <input class="pnum" :class="{ active: sdMax }" v-model="sdMax" type="number" min="0" placeholder="max"
                 title="Maximum piston area in cm² — WinISD: Sd (converts from m²)">
          <span class="plabel" :class="{ active: sdMin || sdMax }">cm²</span>
          <span class="psep"></span>
          <span class="plabel" :class="{ active: selZ.length }">Z</span>
          <button v-for="z in ['4','8','16']" :key="z" class="zchip"
                  :class="{ active: selZ.includes(z) }"
                  :title="`Filter to nominal ${z}Ω impedance — stored as WinISD Znom (descriptive label only; not used in simulation by WinISD or OpenISD)`"
                  @click="toggleZ(z)">{{ z }}Ω</button>
        </div>
        <div class="type-row" style="margin-top: 4px;">
          <button class="type-chip fav-filter"
                  :class="{ include: favoritesOnly }"
                  title="Show only favorited/starred drivers"
                  @click="toggleFavoritesOnly">★ Favorites only</button>
        </div>
        <div class="statusrow">
          <span class="status" :class="{ err: statusErr }">{{ statusMsg || `${listedCount} drivers` }}</span>
        </div>
        </template><!-- end !previewFile controls -->
        <!-- ── Driver summary (browse mode) ── -->
        <div v-if="previewFile && previewData" class="preview">
          <div class="prev-nav" style="display: flex; gap: 8px;">
            <button @click="previewFile = null" title="Back to driver list">← Back</button>
            <button class="clone-btn" @click="cloneDriver(previewFile)"
                    title="Clone this driver and add it to My Drivers">Clone driver</button>
            <button class="edit-btn" :disabled="!previewFile.myDriverData" @click="chooseDriver(previewFile)"
                    title="Edit this custom driver's T/S parameters (enabled for My Drivers only)">Edit</button>
            <button class="use-btn" @click="chooseDriver(previewFile)"
                    title="Open this driver in the editor — it replaces the design only when you press OK">Use this driver</button>
          </div>
          <div class="prev-body">
            <div class="prev-specs">
              <div v-for="s in previewData.specs" :key="s.label" class="spec-row">
                <span class="spec-lbl">{{ s.label }}</span>
                <span class="spec-val"><b>{{ s.value }}</b><span v-if="s.unit" class="spec-unit"> {{ s.unit }}</span></span>
              </div>
            </div>
            <div v-if="previewData.links.length" class="prev-links">
              <a v-for="lnk in previewData.links" :key="lnk.href"
                 :href="lnk.href" target="_blank" rel="noopener"
                 class="prev-link">{{ lnk.label }} ↗</a>
            </div>
            <div v-if="previewData.brand || previewData.model || previewData.manufacturer || previewData.notes || previewData.added || previewData.providedBy" class="prev-textinfo">
              <div v-if="previewData.brand || previewData.model" class="prev-textrow">
                <span class="prev-src-lbl">Brand / Model</span>
                {{ [previewData.brand, previewData.model].filter(Boolean).join(' — ') }}
              </div>
              <div v-if="previewData.manufacturer" class="prev-textrow">
                <span class="prev-src-lbl">Manufacturer</span> {{ previewData.manufacturer }}
              </div>
              <div v-if="previewData.providedBy" class="prev-textrow">
                <span class="prev-src-lbl">Measured by</span> {{ previewData.providedBy }}
              </div>
              <div v-if="previewData.added" class="prev-textrow">
                <span class="prev-src-lbl">Date added</span> {{ previewData.added }}
              </div>
              <div v-if="previewData.notes" class="prev-textrow prev-notes">
                <span class="prev-src-lbl">Notes</span> {{ previewData.notes }}
              </div>
            </div>
            <div v-if="previewData.source" class="prev-source">
              <span class="prev-src-lbl">Source</span>
              <a v-if="previewData.sourceUrl" :href="previewData.sourceUrl" target="_blank" rel="noopener" :title="previewData.sourceUrl">{{ previewData.source }} ↗</a>
              <span v-else>{{ previewData.source }}</span>
            </div>
          </div>
        </div>

        <!-- ── Driver list ── -->
        <div v-else class="dlist">
          <!-- My Drivers (respect the search query) -->
          <template v-if="filteredMyDrivers.length">
            <div class="dlist-section">My Drivers</div>
            <div v-for="d in filteredMyDrivers" :key="driverId(d) || myDriverName(d)"
                 class="ditem my-ditem"
                 @click="handleItemClick(myDriverEntry(d))">
              <b>{{ myDriverName(d) }}</b>
              <button class="fav-star-btn" @click.stop="toggleFavorite(myDriverEntry(d))"
                      :title="isFavorite(myDriverEntry(d)) ? 'Remove from favorites' : 'Add to favorites'">
                {{ isFavorite(myDriverEntry(d)) ? '★' : '☆' }}
              </button>
              <button class="my-edit" @click.stop="editMyDriver(d)"
                      title="Edit this saved driver — changes the My Drivers entry, not the project">&#9998;</button>
              <button class="my-del" @click.stop="deleteMyDriver(driverId(d))" title="Remove from My Drivers">✕</button>
            </div>
            <div class="dlist-sep"></div>
          </template>
          <div v-for="f in displayedFiles" :key="(f.sourceKey || f.sourceName || '') + '/' + (f.path || f.fileName || f.name)"
               :class="['ditem', f._isLatest && 'ditem-latest', f._isOlder && 'ditem-older']"
               @click="handleItemClick(f)">
            <b>{{ f.name }}</b>
            <span class="dmeta">
              <span v-if="f._nd" :class="['ddate', f._isLatest && 'ddate-latest', f._isOlder && 'ddate-older']">{{ f._nd }}</span>
              <a v-if="f.datasheet" class="dpdf"
                 :href="f.datasheet" target="_blank" rel="noopener"
                 title="Open manufacturer datasheet (PDF)" @click.stop>PDF</a>
              <a v-if="f.manupage" class="dpdf"
                 :href="f.manupage" target="_blank" rel="noopener"
                 title="Open manufacturer product page" @click.stop>Manu ↗</a>
              <a v-if="f.vendorpage && f.vendorpage !== f.manupage" class="dpdf"
                 :href="f.vendorpage" target="_blank" rel="noopener"
                 title="Open vendor/retailer product listing" @click.stop>Vendor ↗</a>
              <a v-if="f.frd" class="dpdf"
                 :href="f.frd" target="_blank" rel="noopener"
                 title="Download frequency response & impedance data (FRD/ZMA)" @click.stop>FRD ↗</a>
              <span v-if="f._canonical" :class="['dtype', f._canonical === 'Unclassified' && 'unk']">{{ f._canonical }}</span>
              <a v-if="f.sourceUrl" class="stag"
                 :title="f.sourceName + (f.sourceDesc ? ' — ' + f.sourceDesc : '') + '\n' + f.sourceUrl"
                 @click.stop.prevent="openSourceUrl(f.sourceUrl)">{{ shortSource(f.sourceName) }}</a>
              <span v-else class="stag" :title="f.sourceName + (f.sourceDesc ? ' — ' + f.sourceDesc : '')">{{ shortSource(f.sourceName) }}</span>
              <button class="fav-star-btn" @click.stop="toggleFavorite(f)"
                      :title="isFavorite(f) ? 'Remove from favorites' : 'Add to favorites'">
                {{ isFavorite(f) ? '★' : '☆' }}
              </button>
            </span>
          </div>
          <div v-if="listTruncated" class="dlist-more">
            Showing {{ displayLimit }} of {{ filteredFiles.length }} —
            <button class="dlist-more-btn" @click="displayLimit += 200"
                    title="Show 200 more drivers">show more</button>
            or type to search
          </div>
          <div v-if="!filteredFiles.length && !statusErr" class="status loading">
            {{ filterQ ? 'No matching drivers.' : 'Loading…' }}
          </div>
        </div><!-- end dlist -->
        <div class="browser-footer">
          <div style="display: flex; gap: 8px;">
            <button @click="openDefine"
                    title="Define a new driver model from datasheet T/S parameters">
              Add new Driver
            </button>
            <button @click="triggerFileLoad" title="Load a .wdr file from disk">Load File…</button>
            <input type="file" ref="fileInputEl" style="display:none" :accept="DriverFileFormat.ACCEPT" @change="loadFromDisk">
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { display:none; position:fixed; inset:0; background:#0008; z-index:1000; align-items:center; justify-content:center; }
.overlay.on { display:flex; }
.modal { background:var(--panel2); border:1px solid var(--mut); border-radius:8px; width:620px; max-width:95vw; max-height:80vh; display:flex; flex-direction:column; backdrop-filter:none; isolation:isolate; }
h2 { margin:0; padding:12px 16px; font-size:14px; font-weight:600; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--mut); }
.reset-demo-btn { margin-left:auto; margin-right:12px; font-size:11px; padding:3px 9px; background:var(--bg); border:1px solid var(--mut); border-radius:4px; color:var(--mut); cursor:pointer; white-space:nowrap; }
.reset-demo-btn:hover { border-color:var(--acc); color:var(--acc); }
.x { cursor:pointer; font-size:18px; line-height:1; color:var(--mut); }
.x:hover { color:var(--fg); }
.body { display:flex; flex-direction:column; padding:10px; gap:6px; overflow:hidden; }
.filter { width:100%; box-sizing:border-box; padding:5px 8px; font-size:12px; background:var(--bg); border:1px solid var(--mut); border-radius:4px; color:var(--fg); }
.filter:focus { outline:none; border-color:var(--acc); }
.statusrow { display:flex; align-items:center; gap:8px; }
.status { font-size:11px; color:var(--mut); flex:1; }
.status.err { color:#ff6b6b; }
.dlist { flex:1; overflow-y:auto; border:1px solid var(--mut); border-radius:4px; min-height:200px; }
.dlist-section { padding:4px 10px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--acc2); background:rgba(255,180,84,.07); border-bottom:1px solid var(--line); }
.dlist-sep { height:1px; background:var(--line); margin:4px 0; }
.my-ditem { background:rgba(255,180,84,.04); }
.my-edit { flex-shrink:0; background:none; border:none; color:var(--mut); cursor:pointer; padding:0 4px; font-size:12px; line-height:1; min-height:unset; }
.my-edit:hover { color:var(--acc); }
.my-del { flex-shrink:0; background:none; border:none; color:var(--mut); cursor:pointer; padding:0 4px; font-size:12px; line-height:1; min-height:unset; }
.my-del:hover { color:var(--bad); }
.ditem { padding:4px 10px; cursor:pointer; font-size:12px; display:flex; justify-content:space-between; align-items:center; gap:6px; }
.ditem b { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:1; }
.ditem:hover { background:var(--line); }
.dmeta { display:flex; align-items:center; gap:6px; flex-shrink:0; }
.ddate { font-size:10px; color:var(--mut); white-space:nowrap; }
.ditem-latest .ddate { color:var(--acc); font-weight:600; }
.ditem-older { opacity:0.5; }
.ditem-older .ddate { color:#c07000; }
.dpdf { font-size:9px; font-weight:600; color:var(--acc); white-space:nowrap; text-decoration:none; border:1px solid var(--acc); border-radius:2px; padding:0 3px; line-height:1.6; }
.dpdf:hover { background:var(--acc); color:var(--bg); }
.dtype { font-size:9px; color:var(--acc); white-space:nowrap; border:1px solid var(--acc); border-radius:2px; padding:0 3px; line-height:1.6; opacity:0.7; }
.dtype.unk { color:#c07000; border-color:#c07000; opacity:1; }
.stag { font-size:10px; color:var(--mut); white-space:nowrap; cursor:pointer; }
.stag:hover { color:var(--acc); text-decoration:underline; }
.status.loading { padding:8px 10px; }
.dlist-more { padding:6px 10px; font-size:11px; color:var(--mut); text-align:center; border-top:1px solid var(--line); }
.dlist-more-btn { background:none; border:none; color:var(--acc); cursor:pointer; font-size:11px; padding:0 3px; text-decoration:underline; min-height:unset; }
.browser-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:4px 0 2px; flex-wrap:wrap; }
.browser-footer a { font-size:11px; color:var(--mut); text-decoration:none; }
.browser-footer a:hover { color:var(--acc); }
.browser-footer button { font-size:11px; padding:3px 10px; }
.src-backdrop { position:fixed; inset:0; z-index:9; }
.type-row { display:flex; gap:4px; flex-wrap:wrap; align-items:center; position:relative; }
.help-wrap { position:relative; margin-left:auto; }
.help-btn { font-size:11px; width:18px; height:18px; border-radius:50%; border:1px solid var(--mut); background:none; color:var(--mut); cursor:pointer; padding:0; line-height:1; }
.help-btn:hover, .help-btn.active { border-color:var(--acc); color:var(--acc); }
.help-drop { position:absolute; top:calc(100% + 4px); right:0; width:520px; max-width:90vw; background:var(--panel2); border:1px solid var(--mut); border-radius:6px; box-shadow:0 4px 20px #0008; z-index:20; padding:10px 12px; }
.help-title { font-size:11px; font-weight:600; margin-bottom:8px; color:var(--fg); }
.help-ref { font-size:10px; font-weight:400; color:var(--mut); }
.help-table { width:100%; border-collapse:collapse; font-size:11px; }
.help-table th { text-align:left; color:var(--mut); font-weight:600; border-bottom:1px solid var(--mut); padding:2px 6px; }
.help-table td { padding:2px 6px; border-bottom:1px solid color-mix(in srgb, var(--mut) 20%, transparent); color:var(--fg); }
.help-table tr:last-child td { border-bottom:none; }
.help-fallback td { color:var(--mut); font-style:italic; }
.help-unclass td { color:#c07000; }
.type-chip { font-size:11px; padding:2px 9px; border:1px solid var(--mut); border-radius:12px; background:none; color:var(--mut); cursor:pointer; white-space:nowrap; }
.type-chip:hover { border-color:var(--fg); color:var(--fg); }
.type-chip.include { border-color:#2a2; color:#fff; background:#2a2; font-weight:600; }
.type-chip.exclude { border-color:#d32f2f; color:#fff; background:#d32f2f; font-weight:600; }
.type-clear { border-color:transparent; }
.param-row { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
.plabel { font-size:10px; color:var(--mut); white-space:nowrap; padding:0 1px; }
.plabel.active { color:var(--acc); font-weight:600; }
.pnum { width:46px; padding:2px 3px; font-size:11px; background:var(--bg); border:1px solid var(--mut); border-radius:3px; color:var(--fg); text-align:right; }
.pnum.active { border-color:var(--acc); background:color-mix(in srgb, var(--acc) 10%, var(--bg)); }
/* No spinners — these are search bounds in a picker, not live what-if controls. */
.pnum::-webkit-outer-spin-button,
.pnum::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
.pnum { -moz-appearance:textfield; appearance:textfield; }
.pnum:focus { outline:none; border-color:var(--acc); }
.pmid { font-size:11px; color:var(--mut); }
.psep { width:8px; flex-shrink:0; }
.zchip { font-size:10px; padding:1px 6px; border:1px solid var(--mut); border-radius:10px; background:none; color:var(--mut); cursor:pointer; white-space:nowrap; }
.zchip:hover { border-color:var(--fg); color:var(--fg); }
.zchip.active { border-color:var(--acc); color:#06223a; background:var(--acc); font-weight:600; }
.preview { display:flex; flex-direction:column; flex:1; overflow:hidden; }
.prev-nav { display:flex; justify-content:space-between; align-items:center; gap:8px; padding-bottom:6px; }
.use-btn { font-size:11px; padding:3px 10px; background:var(--acc); color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:600; }
.use-btn:hover { opacity:0.85; }
.prev-body { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px; }
.prev-specs { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:4px 12px; }
.spec-row { display:flex; justify-content:space-between; align-items:baseline; padding:3px 6px; background:var(--bg); border-radius:3px; font-size:12px; }
.spec-lbl { color:var(--mut); }
.spec-val { font-variant-numeric:tabular-nums; }
.spec-unit { color:var(--mut); font-size:10px; }
.prev-links { display:flex; flex-direction:column; gap:5px; }
.prev-link { font-size:12px; color:var(--acc); text-decoration:none; padding:5px 8px; border:1px solid var(--acc); border-radius:4px; }
.prev-link:hover { background:var(--acc); color:var(--bg); }
.prev-source { font-size:11px; color:var(--mut); margin-top:2px; }
.prev-src-lbl { font-weight:600; color:var(--acc2); margin-right:4px; }
.prev-textinfo { display:flex; flex-direction:column; gap:3px; padding:7px 9px; background:var(--bg); border-radius:4px; border:1px solid var(--line); }
.prev-textrow { font-size:11px; color:var(--mut); line-height:1.4; }
.prev-notes { white-space:pre-wrap; }
.fav-star-btn { background: none; border: none; font-size: 14px; cursor: pointer; color: #ffb454; padding: 2px 4px; line-height: 1; margin-left: 4px; }
.fav-star-btn:hover { color: #ffd085; transform: scale(1.1); }
.clone-btn, .edit-btn { font-size: 11px; padding: 3px 10px; background: var(--bg); border: 1px solid var(--mut); border-radius: 4px; color: var(--fg); cursor: pointer; }
.clone-btn:hover, .edit-btn:hover:not(:disabled) { border-color: var(--acc); color: var(--acc); }
.edit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
