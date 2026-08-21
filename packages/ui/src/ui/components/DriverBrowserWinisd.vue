<script setup lang="ts">
import { ref, watch } from 'vue';
import { state } from '../../logic/store.js';
import { useEscToClose } from '../../logic/useEscToClose.js';
import { useApp } from '../../logic/app.js';
import type { FileEntry } from '../../logic/driverLibrary.js';
import { DriverFileFormat } from '../../driverFileFormat.js';

const { library, selection } = useApp();
const { openNewDriver } = selection;

// The WinISD-style driver library — markup and
// CSS only (ARCHITECTURE.md AD-7). All behaviour is logic/driverLibrary.ts; callers differ in
// their own stylesheets, not in what a click does.
//
// Choosing a driver EMBEDS it in the project and closes this picker (docs/design/STATE_MODEL.md rule 1) —
// the user lands back in the project, not in an editor. The ✎ on a My Drivers row is the other
// thing entirely: it edits that SAVED driver, and never touches the project.

// Source filtering, the custom-GitHub-URL loader and the reset-to-demo action are NOT
// destructured here: ui-todo.md removed their controls from this picker. They remain live
// on the composable because DriverBrowserMd.vue still offers all three.
const {
  DRIVER_TYPES, DRIVER_SCOPES,
  allFiles, statusMsg, statusErr,
  filterQ, typeHelpOpen, typeStates,
  fsMin, fsMax, sdMin, sdMax, selZ, displayLimit,
  toggleType, toggleZ, clearParamFilters,
  filteredFiles, displayedFiles, listTruncated, listedCount,
  filteredMyDrivers, myDriverName, myDriverEntry, driverId, editMyDriver, editOverviewDriver, deleteMyDriver,
  favoritesOnly, isFavorite, toggleFavorite, toggleFavoritesOnly, driverKey,
  driverScope, cycleDriverScope,
  previewFile, previewData, pickFile, chooseDriver, loadFromDisk, cloneDriver,
  openedLibrary, closeLibrary,
  shortSource, driverHasDqIssues,
} = library;

const fileInputEl = ref<HTMLInputElement | null>(null);
function triggerFileLoad() { fileInputEl.value?.click(); }

// A row click SUMMARISES; "Use" is what chooses. The summary is a reading step in front of the
// choice, so the user can check a driver before it lands in their project.
function handleItemClick(f: FileEntry) { pickFile(f); }

function close() { closeLibrary(); }
useEscToClose(() => state.browseOpen, close);

// Every route that CREATES a driver ends in My Drivers, which is the one place a user
// driver can land: "Add new Driver" opens the editor on a blank driver, "Clone driver" forks
// the summarised one, and "Load File…" reads one off disk. None of them touches the project —
// "Use" is still the only thing that embeds a driver in the design.
//
// The T/S define form (state.defineOpen) remains available from other entry points.
function openNew() { openNewDriver(); }



// Closing the picker drops any open summary, so reopening lands on the list rather than on
// whatever was last being read.
watch(() => state.browseOpen, val => { if (val) openedLibrary(); else pickFile(null); }, { immediate: true });
</script>

<template>
  <div class="overlay" :class="{ on: state.browseOpen }">
    <div class="modal wb-modal" v-if="state.browseOpen">
      <h2>
        {{ previewFile ? previewData?.name : 'Driver database' }}
        <span class="x" @click="close" title="Close the driver library browser">✕</span>
      </h2>
      <div class="body">
        <template v-if="!previewFile">
        <input class="filter" v-model="filterQ" placeholder="Search drivers…" autofocus>
        
        <div class="type-row">
          <button v-for="t in DRIVER_TYPES" :key="t.value"
                  class="type-chip"
                  :class="{
                    include: typeStates[t.value] === 'include'
                  }"
                  :title="t.title"
                  @click="toggleType(t.value)">{{ t.label }}</button>

          <button v-if="Object.keys(typeStates).length || fsMin || fsMax || sdMin || sdMax || selZ.length"
                  class="type-chip type-clear"
                  @click="clearParamFilters">✕ clear</button>

          <div class="help-wrap">
            <button class="help-btn" :class="{ active: typeHelpOpen }"
                    title="How are driver types classified?"
                    @click.stop="typeHelpOpen = !typeHelpOpen">?</button>
            
            <div v-if="typeHelpOpen" class="help-drop" @click.stop>
              <div class="help-title">Driver Range Classifications</div>
              <table class="help-table">
                <thead>
                  <tr><th>Type</th><th>Criteria</th></tr>
                </thead>
                <tbody>
                  <tr><td>Tweeter</td><td>Fs &gt; 800Hz, Sd &lt; 25cm²</td></tr>
                  <tr><td>Midrange</td><td>Fs [100Hz, 800Hz], Sd &lt; 90cm²</td></tr>
                  <tr><td>Woofer</td><td>Fs [35Hz, 120Hz], Sd [90cm², 350cm²]</td></tr>
                  <tr><td>Subwoofer</td><td>Fs &lt; 40Hz, Sd &gt; 180cm²</td></tr>
                  <tr><td>PR</td><td>Has Sd and Cms/Mmd, but no voice coil (Re=0)</td></tr>
                </tbody>
              </table>
              <div class="help-ref mt-1">Classified programmatically from T/S parameters. See DRIVER_TYPES.md for details.</div>
            </div>
            <div v-if="typeHelpOpen" class="help-backdrop" @click="typeHelpOpen = false"></div>
          </div>
        </div>

        <div class="param-row">
          <span class="plabel" :class="{ active: fsMin || fsMax }">Fs</span>
          <input class="pnum" :class="{ active: fsMin }" type="number" v-model="fsMin" min="1" placeholder="min" title="Minimum Fs (Hz)">
          <span class="pmid">–</span>
          <input class="pnum" :class="{ active: fsMax }" type="number" v-model="fsMax" min="1" placeholder="max" title="Maximum Fs (Hz)">
          <span class="plabel" :class="{ active: fsMin || fsMax }">Hz</span>

          <span class="psep"></span>

          <span class="plabel" :class="{ active: sdMin || sdMax }">Sd</span>
          <input class="pnum" :class="{ active: sdMin }" type="number" v-model="sdMin" min="0" placeholder="min" title="Minimum Sd (cm²)">
          <span class="pmid">–</span>
          <input class="pnum" :class="{ active: sdMax }" type="number" v-model="sdMax" min="0" placeholder="max" title="Maximum Sd (cm²)">
          <span class="plabel" :class="{ active: sdMin || sdMax }">cm²</span>

          <span class="psep"></span>

          <span class="plabel" :class="{ active: selZ.length }">Z</span>
          <button v-for="z in ['4', '8', '16']" :key="z"
                  class="zchip" :class="{ active: selZ.includes(z) }"
                  :title="`Filter to nominal ${z}Ω impedance — stored as WinISD Znom (derived from Re when not entered; not fed back into the simulation)`"
                  @click="toggleZ(z)">{{ z }}Ω</button>
        </div>

        <!-- The slot the All Sources dropdown vacated. Two chips that compose: scope says
             WHICH LIBRARY is a candidate, Favorites says which of those rows to keep, so all
             six pairings are reachable. -->
        <div class="fav-row">
          <!-- ONE control, not three. Every scope is on screen so the user can see what the
               choices are and where the highlight goes next, but a click anywhere rotates —
               the segments are labels, never separate buttons. Rendered off DRIVER_SCOPES so
               the order shown is the order clicked; a hand-written list could disagree. -->
          <button class="scope-filter" :title="driverScope.title" @click="cycleDriverScope()">
            <span v-for="s in DRIVER_SCOPES" :key="s.value"
                  class="scope-seg" :class="{ active: s === driverScope }">{{ s.label }}</span>
          </button>

          <button class="fav-filter" :class="{ active: favoritesOnly }"
                  :title="favoritesOnly
                    ? 'Showing favourites only — click to show every driver again'
                    : 'Show only the drivers you have starred'"
                  @click="toggleFavoritesOnly()">★ Favorites</button>
        </div>

        <div class="statusrow">
          <span class="status" :class="{ err: statusErr }">{{ statusMsg || `${listedCount} drivers` }}</span>
        </div>

        <div class="dlist">
          <template v-if="filteredMyDrivers.length">
            <div class="dlist-section">My Drivers</div>
            <div v-for="d in filteredMyDrivers" :key="driverId(d) || myDriverName(d)"
                 class="ditem my-ditem"
                 @click="handleItemClick(myDriverEntry(d))">
              <b>{{ myDriverName(d) }}</b>
              <span v-if="driverHasDqIssues(myDriverEntry(d))" class="dq-flag" title="Data quality issues detected on this driver — some fields may be missing or have suspicious values">⚠</span>
              <button class="fav-btn" :class="{ on: isFavorite(myDriverEntry(d)) }"
                      :title="isFavorite(myDriverEntry(d)) ? 'Remove from favourites' : 'Add to favourites'"
                      @click.stop="toggleFavorite(myDriverEntry(d))">★</button>
              <button class="my-edit" @click.stop="editMyDriver(d)"
                      title="Edit this saved driver — changes the My Drivers entry, not the project">&#9998;</button>
              <button class="my-del" @click.stop="deleteMyDriver(driverId(d))" title="Remove from My Drivers">✕</button>
            </div>
            <div class="dlist-sep"></div>
          </template>
          
          <div v-for="f in displayedFiles" :key="driverKey(f)"
               :class="['ditem', f._isLatest && 'ditem-latest', f._isOlder && 'ditem-older']"
               @click="handleItemClick(f)">
            <b>{{ f.name }}</b>
            <span v-if="driverHasDqIssues(f)" class="dq-flag" title="Data quality issues detected — some core fields may be missing or have suspicious values (e.g. Fs=0). Open to review.">⚠</span>
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
              <span class="stag" :title="f.sourceName + (f.sourceDesc ? ' — ' + f.sourceDesc : '')">{{ shortSource(f.sourceName) }}</span>
              <button class="fav-btn" :class="{ on: isFavorite(f) }"
                      :title="isFavorite(f) ? 'Remove from favourites' : 'Add to favourites'"
                      @click.stop="toggleFavorite(f)">★</button>
            </span>
          </div>
          
          <div v-if="listTruncated" class="dlist-more">
            Showing {{ displayLimit }} of {{ filteredFiles.length }} —
            <button class="dlist-more-btn" @click="displayLimit += 200"
                    title="Show 200 more drivers">show more</button>
            or type to search
          </div>
          <!-- Empty means BOTH sections are empty: with the scope chip on My Drivers the pool
               is empty by design, and an empty pool must not read as an empty list. What is
               still loading is likewise the pool itself, not the absence of a search term —
               a type chip that matches nothing said "Loading…" forever. -->
          <div v-if="!listedCount && !statusMsg" class="status loading">
            {{ allFiles.length ? 'No matching drivers.' : 'Loading…' }}
          </div>
        </div>

        </template><!-- end !previewFile: the list and its controls -->

        <!-- The summary: what we know about one driver. Reading, not choosing — Use is the
             only thing here that selects, and even that only opens the editor on a draft. -->
        <div v-if="previewFile && previewData" class="preview">
          <div class="prev-nav">
            <button class="cancel-btn" @click="pickFile(null)"
                    title="Back to the driver list — nothing is changed">Cancel</button>
            <button class="fav-btn" :class="{ on: isFavorite(previewFile) }"
                    :title="isFavorite(previewFile) ? 'Remove from favourites' : 'Add to favourites'"
                    @click="toggleFavorite(previewFile)">★</button>
            <button class="clone-btn" @click="cloneDriver(previewFile)"
                    title="Copy this driver into My Drivers as &quot;Copy of …&quot; — an independent driver you can then edit">Clone driver</button>
            <button class="edit-btn" @click="editOverviewDriver(previewFile)"
                    title="Edit this driver's parameters — saving will add or update in My Drivers">Edit</button>
            <button class="use-btn" @click="chooseDriver(previewFile)"
                    title="Open this driver in the editor — it replaces the design only when you press OK">Use</button>
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
            <div v-if="previewData.brand || previewData.model || previewData.sku || previewData.series || previewData.manufacturer || previewData.description || previewData.notes || previewData.added || previewData.providedBy"
                 class="prev-textinfo">
              <div v-if="previewData.brand" class="prev-textrow">
                <span class="prev-src-lbl">Brand</span> {{ previewData.brand }}
              </div>
              <div v-if="previewData.series" class="prev-textrow">
                <span class="prev-src-lbl">Series</span> {{ previewData.series }}
              </div>
              <div v-if="previewData.model" class="prev-textrow">
                <span class="prev-src-lbl">Model</span> {{ previewData.model }}
              </div>
              <div v-if="previewData.sku" class="prev-textrow">
                <span class="prev-src-lbl">SKU</span> <code>{{ previewData.sku }}</code>
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
              <div v-if="previewData.description" class="prev-textrow prev-desc">
                <span class="prev-src-lbl">Description</span> {{ previewData.description }}
              </div>
              <div v-if="previewData.notes" class="prev-textrow prev-notes">
                <span class="prev-src-lbl">Notes</span> {{ previewData.notes }}
              </div>
            </div>
            <div v-if="previewData.source" class="prev-source">
              <span class="prev-src-lbl">Source</span>
              <a v-if="previewData.sourceUrl" :href="previewData.sourceUrl" target="_blank" rel="noopener"
                 :title="previewData.sourceUrl">{{ previewData.source }} ↗</a>
              <span v-else>{{ previewData.source }}</span>
            </div>
          </div>
        </div>

        <div class="browser-footer">
          <div v-if="!previewFile" style="display: flex; gap: 8px;">
            <button @click="openNew" title="Create a new custom driver — opens the driver editor">Add new Driver</button>
            <button @click="triggerFileLoad" title="Load a .wdr or .owdr file from disk">Load File…</button>
            <input type="file" ref="fileInputEl" style="display:none" @change="loadFromDisk" :accept="DriverFileFormat.ACCEPT">
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.18); z-index:100; align-items:center; justify-content:center; }
.overlay.on { display:flex; }

/* styling for Driver Library to match Driver Editor */
.wb-modal {
  background: #f7f7f7 !important;
  border: 1px solid #888 !important;
  box-shadow: 3px 6px 18px rgba(0,0,0,.35) !important;
  border-radius: 6px !important;
  color: #000 !important;
  width: 770px !important;
  max-width: 95vw !important;
  height: 535px !important;
  max-height: 85vh !important;
  display: flex !important;
  flex-direction: column !important;
}
.wb-modal h2 {
  background: #e8e8e8 !important;
  color: #000 !important;
  padding: 10px 12px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  border-bottom: 1px solid #ddd !important;
  margin: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.wb-modal h2 .x {
  background: none !important;
  border: none !important;
  font-size: 18px !important;
  color: #888 !important;
  cursor: pointer !important;
  width: auto !important;
  height: auto !important;
  padding: 0 !important;
  display: inline-block !important;
}
.wb-modal h2 .x:hover {
  color: #000 !important;
}
.wb-modal .body {
  padding: 12px !important;
  background: #f7f7f7 !important;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
  flex: 1;
}
.wb-modal .filter {
  width: 100%;
  box-sizing: border-box;
  background: #fff !important;
  color: #000 !important;
  border: 1px solid #ccc !important;
  border-radius: 4px !important;
  padding: 5px 8px !important;
  font-size: 12px;
}
.wb-modal .filter:focus {
  outline: none;
  border-color: #888;
}
.wb-modal .statusrow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wb-modal .status {
  font-size: 11px;
  color: #666;
  flex: 1;
}
.wb-modal .status.err {
  color: #d9381e;
}
.wb-modal .dlist {
  flex: 1;
  overflow-y: auto;
  background: #fff !important;
  border: 1px solid #ccc !important;
  border-radius: 4px !important;
  min-height: 180px;
}
.wb-modal .dlist-section {
  background: #f0f0f0 !important;
  color: #444 !important;
  border-bottom: 1px solid #ddd !important;
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.wb-modal .dlist-sep {
  height: 1px;
  background: #eee;
  margin: 4px 0;
}
.wb-modal .my-ditem {
  background: rgba(255, 180, 84, .05);
}
/* DQ warning badge — amber triangle, shown inline after the driver name */
.wb-modal .dq-flag {
  flex-shrink: 0;
  font-size: 11px;
  color: #c97600;
  cursor: default;
  padding: 0 3px;
  line-height: 1;
  vertical-align: middle;
}
/* Plain rules, no `!important`: the blanket `.wb-modal button` rule excludes these by name. */
.wb-modal .my-edit {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 0 4px;
  font-size: 12px;
  line-height: 1;
}
.wb-modal .my-edit:hover {
  color: #1a6fb5;
}
.wb-modal .my-del {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 0 4px;
  font-size: 12px;
  line-height: 1;
}
.wb-modal .my-del:hover {
  color: #d9381e;
}
/* The per-row star. Grey outline when off, filled amber when on — a colour change, not only
   a weight change, so the state is readable at a glance (see the chip bug in bugs/_archive). */
.wb-modal .fav-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #c8c8c8;
  cursor: pointer;
  padding: 0 4px;
  font-size: 13px;
  line-height: 1;
}
.wb-modal .fav-btn:hover {
  color: #e8a317;
}
.wb-modal .fav-btn.on {
  color: #f0a500;
  text-shadow: 0 0 1px rgba(0, 0, 0, .25);
}
/* ── The driver summary ── */
.wb-modal .preview {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
.wb-modal .prev-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
}
.wb-modal .prev-nav .fav-btn {
  font-size: 16px;
  margin-right: auto;   /* Cancel and the star left; Clone / Edit / Use pushed to the right */
}
.wb-modal .use-btn {
  font-size: 11px;
  padding: 4px 14px;
  background: #2b7a3e;
  border: 1px solid #246634;
  border-radius: 4px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.wb-modal .use-btn:hover {
  background: #246634;
}
.wb-modal .cancel-btn {
  font-size: 11px;
  padding: 4px 14px;
}
.wb-modal .clone-btn,
.wb-modal .edit-btn {
  font-size: 11px;
  padding: 4px 14px;
}
/* Disabled Edit must READ disabled — the blanket `.wb-modal button` rule paints every button
   the same, so without this an unavailable action looks exactly like an available one. */
.wb-modal .edit-btn:disabled {
  color: #aaa;
  background: #f7f7f7;
  border-color: #e0e0e0;
  cursor: not-allowed;
}
.wb-modal .edit-btn:disabled:hover {
  background: #f7f7f7;
}
.wb-modal .prev-body {
  flex: 1;
  overflow-y: auto;
}
.wb-modal .prev-specs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 2px 10px;
  margin-bottom: 10px;
}
.wb-modal .spec-row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 2px 6px;
  font-size: 11px;
  border-bottom: 1px solid #ececec;
}
.wb-modal .spec-lbl {
  color: #666;
}
.wb-modal .spec-val {
  color: #000;
}
.wb-modal .spec-unit {
  color: #888;
}
.wb-modal .prev-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.wb-modal .prev-link {
  font-size: 11px;
  color: #0066cc;
  text-decoration: none;
}
.wb-modal .prev-link:hover {
  text-decoration: underline;
}
.wb-modal .prev-textinfo, .wb-modal .prev-source {
  font-size: 11px;
  color: #333;
}
.wb-modal .prev-textrow {
  padding: 2px 0;
}
.wb-modal .prev-src-lbl {
  display: inline-block;
  min-width: 92px;
  color: #666;
}
.wb-modal .prev-source {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid #e0e0e0;
}
.wb-modal .fav-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.wb-modal .fav-filter {
  font-size: 11px;
  padding: 3px 9px;
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
}
.wb-modal .fav-filter:hover {
  background: #e8e8e8;
}
.wb-modal .fav-filter.active {
  background: #f0a500;
  border-color: #c98600;
  color: #fff;
  font-weight: 600;
}
/* The scope control — a segmented display of all three scopes, sharing the Favorites chip's
   border, radius, type size and background so the two read as siblings on the row.

   The ONLY thing colour says here is WHICH SEGMENT IS ACTIVE. The blue is the one this file
   already spends on "this filter is doing something" (.pnum.active, .zchip.active); amber
   stays the star's. There is no second signal for "the scope is narrowing the list": with
   every label on screen, `All` highlighted reads as a chosen state, whereas leaving it
   unhighlighted would show three grey words and no selection at all.

   The padding lives on the SEGMENTS, so the active fill reaches the control's edges. That
   is why the container zeroes the padding `.wb-modal button` would otherwise give it, and
   clips with `overflow: hidden` so the fill follows the corner radius. */
.wb-modal .scope-filter {
  display: inline-flex;
  align-items: stretch;
  padding: 0;
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  white-space: nowrap;
}
/* `.wb-modal button:hover` counts one element term more than `.wb-modal .scope-filter`, so
   it WINS on the tiebreak and repaints the control grey under the pointer unless a rule at
   this depth answers it — the trap the blanket-button comment above documents. */
.wb-modal .scope-filter:hover {
  background: #e8e8e8;
}
/* Labels, not buttons: no hover, no pointer of their own, nothing that offers a click the
   control does not honour. The whole chip rotates as one. */
.wb-modal .scope-seg {
  font-size: 11px;
  padding: 3px 9px;
  color: #8a8a8a;
  line-height: 1.35;
}
.wb-modal .scope-seg + .scope-seg {
  border-left: 1px solid #ddd;
}
/* The hairline is there to separate two muted words. It must not cut into the active fill,
   which it borders on one side or the other whichever segment is highlighted. Both rules
   outrank the one above — the first on source order at equal weight, the second on a class. */
.wb-modal .scope-seg.active,
.wb-modal .scope-seg.active + .scope-seg {
  border-left-color: transparent;
}
.wb-modal .scope-seg.active {
  background: #0066cc;
  color: #fff;
  font-weight: 600;
}
.wb-modal .ditem {
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  color: #000 !important;
  border-bottom: 1px solid #eee !important;
}
.wb-modal .ditem b {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}
.wb-modal .ditem:hover {
  background: #eaf2ff !important;
  color: #000 !important;
}
.wb-modal .ditem:hover b {
  color: #000 !important;
}
.wb-modal .ditem:hover .ddate,
.wb-modal .ditem:hover .dtype {
  color: #888 !important;
}
.wb-modal .dmeta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.wb-modal .ddate {
  font-size: 10px;
  color: #666;
  white-space: nowrap;
}
.wb-modal .ditem-latest .ddate {
  font-weight: 600;
  color: #2b7a3e;
}
.wb-modal .ditem-older {
  opacity: 0.65;
}
.wb-modal .ditem-older .ddate {
  color: #c07000;
}
.wb-modal .dpdf {
  font-size: 9px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  text-decoration: none;
  border: 1px solid #999;
  border-radius: 2px;
  padding: 0 3px;
  line-height: 1.6;
}
.wb-modal .dpdf:hover {
  background: #ddd;
}
.wb-modal .dtype {
  font-size: 9px;
  color: #555;
  white-space: nowrap;
  border: 1px solid #ccc;
  border-radius: 2px;
  padding: 0 3px;
  line-height: 1.6;
}
.wb-modal .dtype.unk {
  color: #888;
  border-color: #ddd;
}
.wb-modal .stag {
  font-size: 10px;
  color: #888;
  white-space: nowrap;
}
.wb-modal .status.loading {
  padding: 8px 10px;
  color: #666;
}
.wb-modal .dlist-more {
  padding: 6px 10px;
  font-size: 11px;
  color: #666;
  text-align: center;
  border-top: 1px solid #eee;
}
.wb-modal .dlist-more-btn {
  background: none !important;
  border: none !important;
  color: #0066cc !important;
  cursor: pointer;
  font-size: 11px;
  padding: 0 3px !important;
  text-decoration: underline;
}
.wb-modal .browser-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0 2px;
  flex-wrap: wrap;
}
.wb-modal .browser-footer a {
  font-size: 11px;
  color: #0066cc;
  text-decoration: none;
}
.wb-modal .browser-footer a:hover {
  text-decoration: underline;
}
/* The WinISD look for a PLAIN modal button, overriding the dark global `button` rule in
   style.css. Specificity alone carries it — `.wb-modal button` outranks a bare element
   selector — so nothing here is `!important`: that would also outrank the state rules a
   button carries about itself, such as `.type-chip.include` below, and paint an active
   filter chip in the idle colours.

   IT MUST STAY THE LEAST SPECIFIC BUTTON RULE IN THIS FILE. Every button that styles itself
   — a chip, a star, Use, Cancel, the My Drivers ✕ — is written as `.wb-modal .thing`, which
   outranks `.wb-modal button` by one class term and therefore wins without help. Both of the
   escapes tried here before made that impossible and cost a bug each: `!important` beat every
   state rule outright, and a `:not(…)` exclusion list ADDED a class term, so the blanket rule
   quietly outranked the very rules it was meant to step aside for. Anything a button declares
   about itself belongs in its own `.wb-modal`-prefixed rule, and a `:hover` here needs a
   matching `.wb-modal .thing:hover` or the hover grey wins while the pointer rests on it. */
.wb-modal button {
  background: #f0f0f0;
  color: #000;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 11px;
}
.wb-modal button:hover {
  background: #e0e0e0;
}

/* Driver ranges (chips / type filters) */
.type-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
  position: relative;
}
.wb-modal .type-chip {
  font-size: 11px;
  padding: 2px 9px;
  border: 1px solid #ccc;
  border-radius: 12px;
  background: #f0f0f0;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
}
.wb-modal .type-chip:hover {
  background: #e0e0e0;
}
.wb-modal .type-chip.include {
  border-color: #2b7a3e;
  color: #fff;
  background: #2b7a3e;
  font-weight: 600;
}
.wb-modal .type-chip.type-clear {
  border-color: transparent;
  background: none;
  color: #666;
  text-decoration: underline;
}

/* Param search inputs (Fs, Sd) */
.param-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.plabel {
  font-size: 11px;
  color: #444;
  white-space: nowrap;
}
.plabel.active {
  color: #0066cc;
  font-weight: 600;
}
.pnum {
  width: 50px;
  padding: 3px 5px;
  font-size: 11px;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 3px;
  color: #000;
  text-align: right;
  -moz-appearance: textfield;
  appearance: textfield;
}
.pnum.active {
  border-color: #0066cc;
  background: #eaf2ff;
}
.pnum::-webkit-outer-spin-button,
.pnum::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.pnum:focus {
  outline: none;
  border-color: #888;
}
.pmid {
  font-size: 11px;
  color: #888;
}
.psep {
  width: 8px;
  flex-shrink: 0;
}
.wb-modal .zchip {
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid #ccc;
  border-radius: 10px;
  background: #f0f0f0;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
}
.wb-modal .zchip:hover {
  background: #e0e0e0;
}
.wb-modal .zchip.active {
  border-color: #0066cc;
  color: #fff;
  background: #0066cc;
  font-weight: 600;
}

/* Help popup classification box */
.help-wrap {
  position: relative;
  margin-left: auto;
}
.wb-modal .help-btn {
  font-size: 11px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid #ccc;
  background: #f0f0f0;
  color: #555;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.wb-modal .help-btn:hover, .wb-modal .help-btn.active {
  background: #e0e0e0;
  color: #000;
}
.help-drop {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 440px;
  max-width: 90vw;
  background: #fff;
  border: 1px solid #888;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  z-index: 10000;
  padding: 12px 14px;
}
.help-title {
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 8px;
  color: #000;
  border-bottom: 1px solid #ddd;
  padding-bottom: 4px;
}
.help-ref {
  font-size: 10px;
  color: #666;
}
.help-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  margin-bottom: 8px;
}
.help-table th {
  text-align: left;
  color: #444;
  font-weight: 600;
  border-bottom: 1px solid #ccc;
  padding: 4px 6px;
}
.help-table td {
  padding: 4px 6px;
  border-bottom: 1px solid #eee;
  color: #333;
}
.help-table tr:last-child td {
  border-bottom: none;
}
.help-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.25);
  z-index: 9999;
}
</style>
