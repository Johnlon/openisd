<script setup lang="ts">
import {onMounted, ref} from 'vue';
import {useApp} from '../../logic/app.js';
import {DriverFileFormat} from '../../fileFormat.js';

// The WinISD-style driver library body: search, filters, list, one-driver summary and the
// footer actions. Markup and CSS only (ARCHITECTURE.md AD-7) — every behaviour is
// logic/driverBrowsingState.ts. Two hosts render it: the DriverBrowser overlay, and step 1 of
// the New Project wizard (FIX_WIZARD_SEALED Q1), which differ only in what "Use" does — the
// composable decides that, not this component.
//
// `showName`: the overlay puts the summarised driver's name in its own title bar; a host with
// no title bar asks for it inline above the summary.
const props = defineProps<{ showName?: boolean }>();

const { driverBrowsing, selection } = useApp();
const { openNewDriver } = selection;

// Source filtering, the custom-GitHub-URL loader and the reset-to-demo action are NOT
// destructured here: ui-todo.md removed their controls from this picker. They remain live
// on the composable because DriverBrowserMd.vue still offers all three.
const {
  DRIVER_TYPES, DRIVER_SCOPES,
  allDrivers, statusMsg, statusErr,
  filterQ, typeHelpOpen, typeStates,
  fsMin, fsMax, sdMin, sdMax, selZ, displayLimit,
  toggleType, toggleZ, clearParamFilters,
  filteredDrivers, displayedDrivers, listTruncated, listedCount,
  filteredMyDrivers, displayNameOf, driverId, editMyDriver, editOverviewDriver, deleteMyDriver,
  favoritesOnly, isFavorite, toggleFavorite, toggleFavoritesOnly,
  driverScope, cycleDriverScope,
  previewDriver, previewData, pickDriver, pickBundledDriver, chooseDriver, loadFromDisk, cloneDriver,
  openedLibrary,
  driverHasDqIssues,
  myDriversRead, exportedThisSession, exportBrokenEntry, removeBrokenEntry,
} = driverBrowsing;

// The broken-row Delete CHALLENGES an un-exported session before acting (QO81: the user is
// always offered their bytes first). Two-step, no cancel: every button is a real action.
const brokenDeleteArmed = ref<number | null>(null);
function requestRemoveBroken(key: number): void {
  if (!exportedThisSession.value && brokenDeleteArmed.value !== key) { brokenDeleteArmed.value = key; return; }
  brokenDeleteArmed.value = null;
  removeBrokenEntry(key);
}

const fileInputEl = ref<HTMLInputElement | null>(null);
function triggerFileLoad() { fileInputEl.value?.click(); }

// A row click summarises; "Use" is what chooses. The summary is a reading step in front of the
// choice, so the user can check a driver before it lands in their project. A My Drivers row
// holds its driver; a bundled row is an index row, and its driver is loaded on the click.
function handleItemClick(d: Parameters<typeof pickDriver>[0]) { pickDriver(d); }
function handleBundledClick(row: Parameters<typeof pickBundledDriver>[0]) { void pickBundledDriver(row); }

// Every route that CREATES a driver ends in My Drivers, which is the one place a user
// driver can land: "Add new Driver" opens the editor on a blank driver, "Clone driver" forks
// the summarised one, and "Load File…" reads one off disk. None of them touches the project —
// "Use" is still the only thing that embeds a driver in the design.
function openNew() { openNewDriver(); }

// Wherever the library is shown, the pool is built and My Drivers re-read on the way in.
onMounted(openedLibrary);
</script>

<template>
  <div class="driver-library">
        <template v-if="!previewDriver">
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
          <!-- QO81 failure surfaces: the bucket's own state, before any list -->
          <div v-if="myDriversRead.kind === 'unavailable'" class="my-storage-note">
            Saved drivers are unavailable in this browser mode (storage is inaccessible).
          </div>
          <div v-else-if="myDriversRead.kind === 'unreadable'" class="my-storage-broken" role="alert">
            <div class="dlist-section">My Drivers</div>
            <p>Saved drivers could not be read — resolve the storage problem in the dialog.</p>
          </div>
          <template v-if="myDriversRead.kind === 'ok' && myDriversRead.broken.length">
            <div class="dlist-section">My Drivers — entries that could not be read</div>
            <div v-for="b in myDriversRead.broken" :key="'broken-' + b.key" class="ditem my-broken-row">
              <b>{{ b.label }}</b>
              <span class="dq-flag" title="This saved entry could not be read by this version of the app. It is preserved untouched.">⚠</span>
              <button class="my-broken-export" @click.stop="exportBrokenEntry(b)">Export</button>
              <button class="my-broken-del" @click.stop="requestRemoveBroken(b.key)">
                {{ brokenDeleteArmed === b.key ? 'Delete WITHOUT exporting' : 'Delete' }}
              </button>
            </div>
            <div class="dlist-sep"></div>
          </template>
          <template v-if="filteredMyDrivers.length">
            <div class="dlist-section">My Drivers</div>
            <div v-for="row in filteredMyDrivers" :key="row.uuid"
                 class="ditem my-ditem"
                 @click="handleItemClick(row.driver)">
              <b>{{ displayNameOf(row.driver) }}</b>
              <span v-if="driverHasDqIssues(row.driver)" class="dq-flag" title="Data quality issues detected on this driver — some fields may be missing or have suspicious values">⚠</span>
              <button class="fav-btn" :class="{ on: isFavorite(driverId(row.driver)) }"
                      :title="isFavorite(driverId(row.driver)) ? 'Remove from favourites' : 'Add to favourites'"
                      @click.stop="toggleFavorite(driverId(row.driver))">{{ isFavorite(driverId(row.driver)) ? '★' : '☆' }}</button>
              <button class="my-edit" @click.stop="editMyDriver(row.driver, row.uuid)"
                      title="Edit this saved driver — changes the My Drivers entry, not the project">&#9998;</button>
              <button class="my-del" @click.stop="deleteMyDriver(row.uuid)" title="Remove from My Drivers">✕</button>
            </div>
            <div class="dlist-sep"></div>
          </template>

          <div v-for="d in displayedDrivers" :key="d.uuid"
               class="ditem"
               @click="handleBundledClick(d)">
            <b>{{ d.name }}</b>
            <span v-if="d.dq" class="dq-flag" title="Data quality issues detected — some core fields may be missing or have suspicious values (e.g. Fs=0). Open to review.">⚠</span>
            <span class="dmeta">
              <a v-if="d.datasheet" class="dpdf"
                 :href="d.datasheet" target="_blank" rel="noopener"
                 title="Open manufacturer datasheet (PDF)" @click.stop>PDF</a>
              <a v-if="d.productPage" class="dpdf"
                 :href="d.productPage" target="_blank" rel="noopener"
                 title="Open manufacturer product page" @click.stop>Manu ↗</a>
              <a v-if="d.listingPage && d.listingPage !== d.productPage" class="dpdf"
                 :href="d.listingPage" target="_blank" rel="noopener"
                 title="Open retailer product listing" @click.stop>Listing ↗</a>
              <button class="fav-btn" :class="{ on: isFavorite(d.uuid) }"
                      :title="isFavorite(d.uuid) ? 'Remove from favourites' : 'Add to favourites'"
                      @click.stop="toggleFavorite(d.uuid)">{{ isFavorite(d.uuid) ? '★' : '☆' }}</button>
            </span>
          </div>

          <div v-if="listTruncated" class="dlist-more">
            Showing {{ displayLimit }} of {{ filteredDrivers.length }} —
            <button class="dlist-more-btn" @click="displayLimit += 200"
                    title="Show 200 more drivers">show more</button>
            or type to search
          </div>
          <!-- Empty means BOTH sections are empty: with the scope chip on My Drivers the pool
               is empty by design, and an empty pool must not read as an empty list. What is
               still loading is likewise the pool itself, not the absence of a search term —
               a type chip that matches nothing said "Loading…" forever. -->
          <div v-if="!listedCount && !statusMsg" class="status loading">
            {{ allDrivers.length ? 'No matching drivers.' : 'Loading…' }}
          </div>
        </div>

        </template><!-- end !previewDriver: the list and its controls -->

        <!-- The summary: what we know about one driver. Reading, not choosing — Use is the
             only thing here that selects, and even that only opens the editor on a draft. -->
        <div v-if="previewDriver && previewData" class="preview">
          <h3 v-if="props.showName" class="prev-name">{{ previewData.name }}</h3>
          <div class="prev-nav">
            <button class="fav-btn" :class="{ on: isFavorite(driverId(previewDriver)) }"
                    :title="isFavorite(driverId(previewDriver)) ? 'Remove from favourites' : 'Add to favourites'"
                    @click="toggleFavorite(driverId(previewDriver))">{{ isFavorite(driverId(previewDriver)) ? '★' : '☆' }}</button>
            <button class="clone-btn" @click="cloneDriver(previewDriver)"
                    title="Copy this driver into My Drivers as &quot;Copy of …&quot; — an independent driver you can then edit">Clone driver</button>
            <button class="edit-btn" @click="editOverviewDriver(previewDriver)"
                    title="Edit this driver's parameters — saving will add or update in My Drivers">Edit</button>
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
            <div v-if="previewData.brand || previewData.model || previewData.sku || previewData.series || previewData.manufacturer || previewData.description || previewData.comment || previewData.added || previewData.providedBy"
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
              <div v-if="previewData.comment" class="prev-textrow prev-notes">
                <span class="prev-src-lbl">Notes</span> {{ previewData.comment }}
              </div>
            </div>
          </div>
          <!-- The primary action sits at the bottom, under the specs it commits (John, 2026-09-24).
               Cancel sits beside it — the pane's two exits belong together (John, 2026-09-24). -->
          <div class="prev-footer">
            <button class="cancel-btn" @click="pickDriver(null)"
                    title="Back to the driver list — nothing is changed">Cancel</button>
            <button class="use-btn" @click="chooseDriver(previewDriver)"
                    title="Open this driver in the editor — it replaces the design only when you press OK">Use</button>
          </div>
        </div>

        <div class="browser-footer">
          <div v-if="!previewDriver" style="display: flex; gap: 8px;">
            <button @click="openNew" title="Create a new custom driver — opens the driver editor">Add new Driver</button>
            <button @click="triggerFileLoad" title="Load a .wdr or .owdr file from disk">Load File…</button>
            <input type="file" ref="fileInputEl" style="display:none" @change="loadFromDisk" :accept="DriverFileFormat.ACCEPT">
          </div>
        </div>
  </div>
</template>

<style scoped>
.driver-library {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  color: #000;
}
.driver-library .prev-name {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
}
.driver-library .filter {
  width: 100%;
  box-sizing: border-box;
  background: #fff !important;
  color: #000 !important;
  border: 1px solid #ccc !important;
  border-radius: 4px !important;
  padding: 5px 8px !important;
  font-size: 12px;
}
.driver-library .filter:focus {
  outline: none;
  border-color: #888;
}
.driver-library .statusrow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.driver-library .status {
  font-size: 11px;
  color: #666;
  flex: 1;
}
.driver-library .status.err {
  color: #d9381e;
}
.driver-library .dlist {
  flex: 1;
  overflow-y: auto;
  background: #fff !important;
  border: 1px solid #ccc !important;
  border-radius: 4px !important;
  min-height: 180px;
}
.driver-library .dlist-section {
  background: #f0f0f0 !important;
  color: #444 !important;
  border-bottom: 1px solid #ddd !important;
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.driver-library .dlist-sep {
  height: 1px;
  background: #eee;
  margin: 4px 0;
}
.driver-library .my-ditem {
  background: rgba(255, 180, 84, .05);
}
/* DQ warning badge — amber triangle, shown inline after the driver name */
.driver-library .dq-flag {
  flex-shrink: 0;
  font-size: 11px;
  color: #c97600;
  cursor: default;
  padding: 0 3px;
  line-height: 1;
  vertical-align: middle;
}
/* Plain rules, no `!important`: the blanket `.driver-library button` rule excludes these by name. */
.driver-library .my-edit {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 0 4px;
  font-size: 18px;
  line-height: 1;
}
.driver-library .my-edit:hover {
  color: #1a6fb5;
}
.driver-library .my-del {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 0 4px;
  font-size: 12px;
  line-height: 1;
}
.driver-library .my-del:hover {
  color: #d9381e;
}
/* The per-row star. The state is the GLYPH — hollow ☆ off, filled ★ on — because colour alone
   cannot carry it: the pointer is ON the star at the moment it toggles, and hover tints it. An
   amber hover over a grey-vs-amber state made the toggle look dead until the mouse moved off
   (John, 2026-09-24). Hover still tints, as an affordance; the shape is what reports state. */
.driver-library .fav-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #c8c8c8;
  cursor: pointer;
  padding: 0 4px;
  font-size: 16px;
  line-height: 1;
}
.driver-library .fav-btn:hover {
  color: #e8a317;
}
.driver-library .fav-btn.on {
  color: #f0a500;
  text-shadow: 0 0 1px rgba(0, 0, 0, .25);
}
.driver-library .fav-btn.on:hover {
  color: #ffc63d;
}
/* ── The driver summary ── */
.driver-library .preview {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
.driver-library .prev-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
}
.driver-library .prev-nav .fav-btn {
  font-size: 32px;
  margin-right: auto;   /* the star left; Clone / Edit pushed to the right */
}
.driver-library .prev-footer {
  display: flex;
  justify-content: flex-end;   /* Cancel and Use sit together, right-aligned */
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #ececec;
}
.driver-library .use-btn {
  font-size: 12px;
  padding: 5px 22px;
  background: #2b7a3e;
  border: 1px solid #246634;
  border-radius: 4px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.driver-library .use-btn:hover {
  background: #246634;
}
.driver-library .cancel-btn {
  font-size: 11px;
  padding: 4px 14px;
}
.driver-library .clone-btn,
.driver-library .edit-btn {
  font-size: 11px;
  padding: 4px 14px;
}
/* Disabled Edit must READ disabled — the blanket `.driver-library button` rule paints every button
   the same, so without this an unavailable action looks exactly like an available one. */
.driver-library .edit-btn:disabled {
  color: #aaa;
  background: #f7f7f7;
  border-color: #e0e0e0;
  cursor: not-allowed;
}
.driver-library .edit-btn:disabled:hover {
  background: #f7f7f7;
}
.driver-library .prev-body {
  flex: 1;
  overflow-y: auto;
}
.driver-library .prev-specs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 2px 10px;
  margin-bottom: 10px;
}
.driver-library .spec-row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 2px 6px;
  font-size: 11px;
  border-bottom: 1px solid #ececec;
}
.driver-library .spec-lbl {
  color: #666;
}
.driver-library .spec-val {
  color: #000;
}
.driver-library .spec-unit {
  color: #888;
}
.driver-library .prev-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.driver-library .prev-link {
  font-size: 11px;
  color: #0066cc;
  text-decoration: none;
}
.driver-library .prev-link:hover {
  text-decoration: underline;
}
.driver-library .prev-textinfo {
  font-size: 11px;
  color: #333;
}
.driver-library .prev-textrow {
  padding: 2px 0;
}
.driver-library .prev-src-lbl {
  display: inline-block;
  min-width: 92px;
  color: #666;
}
.driver-library .fav-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.driver-library .fav-filter {
  font-size: 11px;
  padding: 3px 9px;
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
}
.driver-library .fav-filter:hover {
  background: #e8e8e8;
}
.driver-library .fav-filter.active {
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
   is why the container zeroes the padding `.driver-library button` would otherwise give it, and
   clips with `overflow: hidden` so the fill follows the corner radius. */
.driver-library .scope-filter {
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
/* `.driver-library button:hover` counts one element term more than `.driver-library .scope-filter`, so
   it WINS on the tiebreak and repaints the control grey under the pointer unless a rule at
   this depth answers it — the trap the blanket-button comment above documents. */
.driver-library .scope-filter:hover {
  background: #e8e8e8;
}
/* Labels, not buttons: no hover, no pointer of their own, nothing that offers a click the
   control does not honour. The whole chip rotates as one. */
.driver-library .scope-seg {
  font-size: 11px;
  padding: 3px 9px;
  color: #8a8a8a;
  line-height: 1.35;
}
.driver-library .scope-seg + .scope-seg {
  border-left: 1px solid #ddd;
}
/* The hairline is there to separate two muted words. It must not cut into the active fill,
   which it borders on one side or the other whichever segment is highlighted. Both rules
   outrank the one above — the first on source order at equal weight, the second on a class. */
.driver-library .scope-seg.active,
.driver-library .scope-seg.active + .scope-seg {
  border-left-color: transparent;
}
.driver-library .scope-seg.active {
  background: #0066cc;
  color: #fff;
  font-weight: 600;
}
.driver-library .ditem {
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
.driver-library .ditem b {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}
.driver-library .ditem:hover {
  background: #eaf2ff !important;
  color: #000 !important;
}
.driver-library .ditem:hover b {
  color: #000 !important;
}
.driver-library .dmeta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.driver-library .dpdf {
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
.driver-library .dpdf:hover {
  background: #ddd;
}
.driver-library .status.loading {
  padding: 8px 10px;
  color: #666;
}
.driver-library .dlist-more {
  padding: 6px 10px;
  font-size: 11px;
  color: #666;
  text-align: center;
  border-top: 1px solid #eee;
}
.driver-library .dlist-more-btn {
  background: none !important;
  border: none !important;
  color: #0066cc !important;
  cursor: pointer;
  font-size: 11px;
  padding: 0 3px !important;
  text-decoration: underline;
}
.driver-library .browser-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0 2px;
  flex-wrap: wrap;
}
.driver-library .browser-footer a {
  font-size: 11px;
  color: #0066cc;
  text-decoration: none;
}
.driver-library .browser-footer a:hover {
  text-decoration: underline;
}
/* The WinISD look for a PLAIN modal button, overriding the dark global `button` rule in
   style.css. Specificity alone carries it — `.driver-library button` outranks a bare element
   selector — so nothing here is `!important`: that would also outrank the state rules a
   button carries about itself, such as `.type-chip.include` below, and paint an active
   filter chip in the idle colours.

   IT MUST STAY THE LEAST SPECIFIC BUTTON RULE IN THIS FILE. Every button that styles itself
   — a chip, a star, Use, Cancel, the My Drivers ✕ — is written as `.driver-library .thing`, which
   outranks `.driver-library button` by one class term and therefore wins without help. Both of the
   escapes tried here before made that impossible and cost a bug each: `!important` beat every
   state rule outright, and a `:not(…)` exclusion list ADDED a class term, so the blanket rule
   quietly outranked the very rules it was meant to step aside for. Anything a button declares
   about itself belongs in its own `.driver-library`-prefixed rule, and a `:hover` here needs a
   matching `.driver-library .thing:hover` or the hover grey wins while the pointer rests on it. */
.driver-library button {
  background: #f0f0f0;
  color: #000;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 11px;
}
.driver-library button:hover {
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
.driver-library .type-chip {
  font-size: 11px;
  padding: 2px 9px;
  border: 1px solid #ccc;
  border-radius: 12px;
  background: #f0f0f0;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
}
.driver-library .type-chip:hover {
  background: #e0e0e0;
}
.driver-library .type-chip.include {
  border-color: #2b7a3e;
  color: #fff;
  background: #2b7a3e;
  font-weight: 600;
}
.driver-library .type-chip.type-clear {
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
.driver-library .zchip {
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid #ccc;
  border-radius: 10px;
  background: #f0f0f0;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
}
.driver-library .zchip:hover {
  background: #e0e0e0;
}
.driver-library .zchip.active {
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
.driver-library .help-btn {
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
.driver-library .help-btn:hover, .driver-library .help-btn.active {
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
