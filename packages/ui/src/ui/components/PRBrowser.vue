<script setup lang="ts">
import {useEscToClose} from '../../logic/useEscToClose.js';
import {usePRBrowser} from '../../hooks/PRBrowser-hooks.js';
import {PhonePrBrowserText} from '@openisd/design/fields';

// PR browser — a popup mirroring the driver browser (DriverBrowserMd.vue): two
// sections, "Saved" (your localStorage PR library) and "Bundled" (passive radiators
// pulled from the driver collections), plus a "Define new PR" affordance.

// A row's `id` is all that crosses the boundary: the storage uuid for a saved radiator, the
// list position for a bundled one. The shell resolves it back to a radiator (A9 — a component
// carries no domain value).
// `phone`: the classic phone browser (screen 35): 48 px title bar, 44 px rows with a specs line under the name.
const props = defineProps<{ phone?: boolean }>();
const emit = defineEmits<{
  close: [];
  load: [string];
  loadBundled: [string];
  define: [];
}>();

const {filter, fSaved, fBundled, bundledStatus, favoritesOnly, isFavorite, toggleFavorite, toggleFavoritesOnly, remove, close} = usePRBrowser(emit);
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }
useEscToClose(() => true, close);
</script>

<template>
  <div class="overlay on" :class="{ 'pr-overlay-desktop': !props.phone }" @click="onBackdrop">
    <div class="modal" :class="{ 'pr-phone': props.phone, 'pr-desktop': !props.phone }">
      <h2>Passive radiator library<button class="x" @click="close" title="Close">✕</button></h2>
      <div class="body">
        <input class="pr-filter" type="text" v-model="filter" placeholder="Filter passive radiators…"
          style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:5px 8px" />
        <button class="fav-filter" :class="{ active: favoritesOnly }" style="margin-bottom:8px"
          :title="favoritesOnly ? 'Showing favourites only — click to show every passive radiator again' : 'Show only your favourite passive radiators'"
          @click="toggleFavoritesOnly()">★ Favorites</button>

        <div class="pr-lib">
          <div class="pr-lib-hdr">Saved</div>
          <div v-if="!fSaved.length" style="color:var(--mut);font-size:11px;padding:4px 8px">
            {{ filter ? 'No saved passive radiators match.' : 'No saved passive radiators yet — define one below, or Save from the passive radiator editor.' }}
          </div>
          <div v-for="e in fSaved" :key="e.id" class="pr-lib-item">
            <button class="fav-btn" :class="{ on: isFavorite(e.id) }" :title="isFavorite(e.id) ? 'Remove from favourites' : 'Add to favourites'"
              @click.stop="toggleFavorite(e.id)">{{ isFavorite(e.id) ? '★' : '☆' }}</button>
            <span class="pr-lib-info">
              <span class="pr-lib-name" @click="emit('load', e.id)"
                :title="`Load ${e.name} — Sd=${e.sd} Mms=${e.mms} Cms=${e.cms}`">{{ e.name }}</span>
              <span v-if="props.phone" class="pr-lib-specs">{{ PhonePrBrowserText.specsLine(e.sd, e.mms, e.cms) }}</span>
            </span>
            <button class="pr-lib-del" @click="remove(e.id)" title="Remove this passive radiator from your library">✕</button>
          </div>

          <div class="pr-lib-hdr"
            title="Passive radiators bundled from the driver collections. Datasheets publish Sd/Cms/Vas only — Fs/Mms/Rms/Xmax are left blank for you to supply.">Bundled</div>
          <div v-if="bundledStatus" class="pr-lib-status" style="color:var(--bad);font-size:11px;padding:4px 8px">{{ bundledStatus }}</div>
          <div v-else-if="!fBundled.length" style="color:var(--mut);font-size:11px;padding:4px 8px">
            {{ filter ? 'No bundled passive radiators match.' : 'No bundled passive radiators in the current collection.' }}
          </div>
          <div v-for="p in fBundled" :key="p.id" class="pr-lib-item">
            <button class="fav-btn" :class="{ on: isFavorite(p.id) }" :title="isFavorite(p.id) ? 'Remove from favourites' : 'Add to favourites'"
              @click.stop="toggleFavorite(p.id)">{{ isFavorite(p.id) ? '★' : '☆' }}</button>
            <span class="pr-lib-info">
              <span class="pr-lib-name" @click="emit('loadBundled', p.id)"
                :title="'Load ' + p.name + ' — Sd=' + p.sd + ' Mms=' + p.mms + ' Cms=' + p.cms">{{ p.name }}</span>
              <span v-if="props.phone" class="pr-lib-specs">{{ PhonePrBrowserText.specsLine(p.sd, p.mms, p.cms) }}</span>
            </span>
            <span v-if="p.dq" class="dq-flag" title="Data quality issues detected — Fs, Sd, or a moving mass / compliance is missing or not positive. Open to review.">⚠</span>
          </div>
        </div>
      </div>
      <div class="btns pr-footer">
        <button @click="emit('define')" title="Define a brand-new passive radiator from scratch">＋ Define new passive radiator</button>
        <button class="pri" @click="close" title="Close">Done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Desktop picker shares the Driver library's compact popup proportions and scrim. */
.overlay.pr-overlay-desktop {align-items:center;background:rgba(0,0,0,.18);z-index:100;}
.pr-desktop {width:770px;max-width:95vw;height:535px;max-height:85vh;border-radius:6px !important;color:#000;}
.pr-desktop h2 {flex:none;}
.pr-desktop .body {flex:1;min-height:0;overflow-y:auto;}

/* Pinned under the scrolling .body (the .modal is a flex column): Define and Done never scroll off. */
.pr-footer { margin-top: 0; padding: 10px 14px 12px; flex-shrink: 0; }
.pri { background: var(--acc); color:#fff; border-color: var(--acc); }
.fav-btn { flex-shrink: 0; background: none; border: none; color: #c8c8c8; cursor: pointer; padding: 0 4px; font-size: 16px; line-height: 1; }
.fav-btn:hover { color: #e8a317; }
.fav-btn.on { color: #f0a500; text-shadow: 0 0 1px rgba(0, 0, 0, .25); }
.fav-btn.on:hover { color: #ffc63d; }
.fav-filter { font-size: 11px; padding: 3px 9px; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; color: #555; cursor: pointer; white-space: nowrap; }
.fav-filter:hover { background: #e8e8e8; }
.fav-filter.active { background: #f0a500; border-color: #c98600; color: #fff; font-weight: 600; }

/* Classic phone browser (screen 35). The desktop popup does not set .pr-phone, so it is unchanged. */
.pr-lib-info { display: contents; }
.pr-phone { position: relative; }
.pr-phone h2 { flex: none; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; height: 48px; margin: 0; padding: 0 8px 0 16px; font-size: 16px; font-weight: 600; }
.pr-phone h2 .x { min-width: 44px; min-height: 44px; font-size: 18px; }
.pr-phone .body { padding: 12px 14px; }
.pr-phone .pr-filter { height: 36px; padding: 0 10px !important; font-size: 14px; margin-bottom: 8px !important; }
.pr-phone .fav-filter { height: 30px; padding: 4px 10px; font-size: 12px; margin-bottom: 12px !important; }
.pr-phone .pr-lib { display: flex; flex-direction: column; gap: 4px; border: none; }
.pr-phone .pr-lib-hdr { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; padding: 8px 0 4px; margin-top: 4px; border-bottom: 1px solid #eee; }
.pr-phone .pr-lib-item { gap: 8px; min-height: 44px; padding: 4px 8px; font-size: 14px; }
.pr-phone .pr-lib-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pr-phone .pr-lib-name { flex: none; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pr-phone .pr-lib-specs { font-size: 12px; color: var(--mut); }
.pr-phone .fav-btn { font-size: 18px; padding: 0 2px; }
.pr-phone .pr-footer { gap: 8px; padding: 10px 14px; }
.pr-phone .pr-footer button { flex: 1; height: 42px; font-size: 13px; font-weight: 600; }
.pr-phone .pr-footer button.pri { flex: 0 0 90px; }
</style>
