<script setup lang="ts">
// The passive-radiator editor (John, 16 Nov 2026: QO946.c115, c117 "the same select info edit setup and workflow as the
// driver", c118 approved), both skins: the driver editor's frame, tabs General (name) and Parameters (the radiator's own
// figures), Auto calculate unknowns, Inspect Provenance, and OK / Cancel / Reset / Export / Import / Copy to My PRs (the
// phone keeps the last four behind More, as the driver editor). Opened by Edit, and by the Select popup's "+ Define new
// passive radiator" on a blank radiator. The project's choices (count, added mass, tuning) are not here (QO946.c38).
// Thin: the editor object (hooks/passiveRadiatorEditor.ts) holds the copy and does the work.
import {onMounted, ref} from 'vue';
import type {PassiveRadiatorEditorView, PassiveRadiatorFigure} from '../../hooks/passiveRadiatorEditor.js';
import type {PassiveRadiatorStepCells} from '../../hooks/OriginalNewProject-hooks.js';
import {ChartInputs, DateField, NumberField, TextField, WinisdDeviation} from '@openisd/design/fields';
import type {PassiveRadiatorIdentityKey} from '../../hooks/passiveRadiatorEditor.js';
import UIField from './UIField.vue';
import {inputFrom, inputValue} from '../../logic/domEvents.js';
import {provideCellScope} from './cellScope.js';
import {PHONE_DRIVER_EDITOR_SKIN} from './driverEditorSkin.js';
import {useEscToClose} from '../../logic/useEscToClose.js';

const props = defineProps<{ editor: PassiveRadiatorEditorView; cells: PassiveRadiatorStepCells; phone?: boolean }>();
const {title, name, savedNote, autoCalculate, inspect, provenance, identity, setIdentity, ok, cancel, reset, saveToMyPRs,
  setAutoCalculate, setInspect, inspectField, exportFile, importText} = props.editor;

// The copy's cells do not announce their writes (as the driver editor's draft), so this dialog is its own scope:
// without it a typed figure is committed but its box redraws blank.
const revision = ref(0);
provideCellScope({ revision, written: () => { revision.value++; } });

// A new radiator starts on General at its name; an existing one opens on Parameters without the keyboard.
const tab = ref<'general' | 'parameters'>(name.value === '' ? 'general' : 'parameters');
const panelEl = ref<HTMLElement | null>(null);
onMounted(() => { if (name.value === '') panelEl.value?.querySelector<HTMLInputElement>('#pr-editor-name')?.focus(); });
const more = ref(false);
function fromMore(action: () => void): void { more.value = false; action(); }
useEscToClose(() => true, cancel);

const fileEl = ref<HTMLInputElement | null>(null);
function pickImport(): void { fileEl.value?.click(); }
async function onImport(e: Event): Promise<void> {
  const input = inputFrom(e);
  const file = input?.files?.[0];
  if (input === null || file === undefined) return;
  input.value = '';
  importText(file.name, await file.text());
}

interface TextRow { readonly key: Exclude<PassiveRadiatorIdentityKey, 'comment'>; readonly id: string; readonly label: string }
const GENERAL: readonly TextRow[] = [
  {key: 'manufacturer', id: 'pr-editor-manufacturer', label: TextField.DRIVER_MANUFACTURER.label},
  {key: 'brand', id: 'pr-editor-brand', label: TextField.DRIVER_BRAND.label},
  {key: 'model', id: 'pr-editor-name', label: TextField.DRIVER_MODEL.label},
  {key: 'providedBy', id: 'pr-editor-provided-by', label: TextField.DRIVER_PROVIDEDBY.label},
  {key: 'added', id: 'pr-editor-added', label: DateField.DRIVER_ADDED.label},
];
function textValue(e: Event): string { const t = e.target; return t instanceof HTMLTextAreaElement ? t.value : ''; }

interface FigureRow { readonly key: PassiveRadiatorFigure; readonly id: string; readonly field: NumberField; readonly deviation?: WinisdDeviation }
const ROWS: readonly FigureRow[] = [
  {key: 'Vas_m3', id: 'pr-editor-vas', field: NumberField.PR_VAS_L},
  {key: 'Qms', id: 'pr-editor-qms', field: NumberField.PR_QMS},
  {key: 'Fs_hz', id: 'pr-editor-fs', field: NumberField.PR_FS_HZ},
  {key: 'Sd_m2', id: 'pr-editor-sd', field: NumberField.PR_SD_CM2},
  {key: 'Mms_kg', id: 'pr-editor-mms', field: NumberField.MMS_KG, deviation: WinisdDeviation.PR_MMS_CMS_TYPING},
  {key: 'Cms_m_per_N', id: 'pr-editor-cms', field: NumberField.CMS_M_PER_N, deviation: WinisdDeviation.PR_MMS_CMS_TYPING},
  {key: 'Rms_kg_per_s', id: 'pr-editor-rms', field: NumberField.RMS_KG_PER_S},
  {key: 'Xmax_m', id: 'pr-editor-xmax', field: NumberField.PR_XMAX_MM},
];
</script>

<template>
  <div class="prd-scrim" :class="{'prd-phone-scrim': phone}" @click.self="cancel">
    <div ref="panelEl" class="prd-panel" :class="{'prd-phone': phone, 'mob-classic': phone}" role="dialog" :aria-label="title" :style="props.phone ? PHONE_DRIVER_EDITOR_SKIN.rowVars : undefined">
      <div class="prd-head"><h3>{{ title }}</h3><button type="button" class="prd-x" aria-label="Close" title="Discard edits made in this session and close" @click="cancel">&#10005;</button></div>
      <div class="prd-tabs" role="tablist">
        <button type="button" role="tab" :aria-selected="tab === 'general'" :class="{on: tab === 'general'}" @click="tab = 'general'">General</button>
        <button type="button" role="tab" :aria-selected="tab === 'parameters'" :class="{on: tab === 'parameters'}" @click="tab = 'parameters'">Parameters</button>
      </div>
      <div class="prd-legend"><i class="g"></i>Entered <i class="b"></i>Calculated <i class="k"></i>Not Available</div>
      <div class="prd-scroll">
        <template v-if="tab === 'general'">
          <div class="prd-band">General</div>
          <!-- The radiator record's General fields, as the driver editor's General tab (John, 16 Nov 2026 14:03); Model is its name. -->
          <div class="prd-general">
            <label v-for="t in GENERAL" :key="t.key" class="prd-text">{{ t.label }}
              <input :id="t.id" type="text" :value="identity[t.key]" :placeholder="t.key === 'model' ? 'e.g. SD270A-88' : undefined"
                     @input="e => setIdentity(t.key, inputValue(e))" @keydown.enter="ok">
            </label>
            <label class="prd-text prd-comment">{{ TextField.DRIVER_COMMENT.label }}
              <textarea id="pr-editor-comment" :value="identity.comment" @input="e => setIdentity('comment', textValue(e))"></textarea>
            </label>
          </div>
        </template>
        <template v-else>
          <div class="prd-band">Passive radiator parameters</div>
          <div class="prd-fields">
            <div v-for="r in ROWS" :key="r.key" class="prd-fig"
                 :class="{'prd-inspected': provenance?.key === r.key, 'prd-feeds': provenance?.inputs.includes(r.key)}"
                 @click.capture="inspectField(r.key)" @focusin="inspectField(r.key)">
              <UIField :class="phone ? 'mob-ui-field' : undefined" stepper :input-id="r.id" :field="r.field" :cell="cells[r.key]" :deviation="r.deviation" :chart-inputs="ChartInputs.RADIATOR" />
            </div>
          </div>
        </template>
      </div>
      <section v-if="provenance" class="prd-prov" aria-label="Provenance">
        <b>{{ provenance.label }}</b> — {{ provenance.state }}
        <ul v-if="provenance.formulas.length > 0"><li v-for="f in provenance.formulas" :key="f">{{ f }}</li></ul>
        <p v-else>Only stated: no formula gives it from the radiator's other figures.</p>
      </section>
      <div class="prd-checks">
        <label title="Fill the figures the typed ones give"><input type="checkbox" :checked="autoCalculate" @change="e => setAutoCalculate(inputFrom(e)?.checked === true)"> Auto calculate unknowns</label>
        <label title="Tap a figure to see whether it is typed or worked out, and from what"><input type="checkbox" :checked="inspect" @change="e => setInspect(inputFrom(e)?.checked === true)"> Inspect Provenance</label>
      </div>
      <p v-if="savedNote" class="prd-saved" role="status">{{ savedNote }}</p>
      <input ref="fileEl" id="pr-editor-import" type="file" accept=".owdr" hidden @change="onImport">
      <div v-if="!phone" class="prd-foot">
        <button type="button" title="Export this passive radiator to an .owdr file" @click="exportFile">Export</button>
        <button type="button" title="Read a passive radiator from an .owdr file into this editor" @click="pickImport">Import</button>
        <button type="button" class="prd-save" title="Copy this passive radiator into My passive radiators, under its name" @click="saveToMyPRs">Copy to My PRs</button>
        <span class="prd-gap"></span>
        <button type="button" class="pri prd-ok" title="Apply changes and close the editor" @click="ok">OK</button>
        <button type="button" title="Put back what the editor opened with" @click="reset">Reset</button>
        <button type="button" class="prd-cancel" title="Discard edits made in this session and close" @click="cancel">Cancel</button>
      </div>
      <div v-else class="prd-foot">
        <button type="button" class="pri prd-ok mob-btn mob-btn-primary" @click="ok">OK</button>
        <button type="button" class="prd-cancel mob-btn mob-btn-plain" @click="cancel">Cancel</button>
        <button type="button" class="prd-more mob-btn mob-btn-secondary" aria-haspopup="menu" :aria-expanded="more" @click="more = !more">More &#9650;</button>
        <template v-if="more">
          <div class="prd-more-scrim" @click="more = false"></div>
          <div class="prd-more-menu" role="menu">
            <button type="button" role="menuitem" @click="fromMore(exportFile)">Export</button>
            <button type="button" role="menuitem" @click="fromMore(pickImport)">Import</button>
            <button type="button" role="menuitem" @click="fromMore(saveToMyPRs)">Copy to My PRs</button>
            <button type="button" role="menuitem" @click="fromMore(reset)">Reset</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prd-scrim { position: fixed; inset: 0; z-index: 1300; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .35); }
.prd-panel { box-sizing: border-box; width: 1160px; max-width: calc(100% - 24px); max-height: calc(100% - 24px); display: flex; flex-direction: column; background: #f7f7f7; color: #222; border: 1px solid #bbb; border-radius: 4px; box-shadow: 0 6px 22px rgba(0,0,0,.35); font-size: 13px; }
.prd-head { display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 12px; background: #e8e8e8; border-bottom: 1px solid #d0d0d0; }
.prd-head h3 { flex: 1 1 auto; margin: 0; font-size: 15px; font-weight: 600; }
.prd-x { width: 38px; height: 30px; border: 1px solid #aaa; border-radius: 4px; background: #fff; font-size: 18px; cursor: pointer; }
.prd-tabs { display: flex; gap: 2px; padding: 6px 12px 0; border-bottom: 1px solid #c8c8c8; }
.prd-tabs button { padding: 7px 14px; border: 1px solid #c8c8c8; border-bottom: 0; border-radius: 3px 3px 0 0; background: #ececec; font: inherit; font-size: 14px; cursor: pointer; }
.prd-tabs button.on { background: #f7f7f7; font-weight: 600; margin-bottom: -1px; }
.prd-legend { display: none; }
.prd-scroll { flex: 1 1 auto; overflow: auto; padding: 10px 14px; min-height: 0; }
.prd-band { position: relative; padding: 3px 8px; margin-bottom: 8px; background: #e6e6e6; text-align: center; font-size: 12px; color: #444; }
.prd-general { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; }
.prd-text { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: #444; }
.prd-text input, .prd-text textarea { box-sizing: border-box; width: 100%; padding: 5px 8px; font: inherit; font-size: 13px; border: 1px solid #bbb; border-radius: 3px; background: #fff; color: #222; }
.prd-comment { grid-column: 1 / -1; }
.prd-comment textarea { min-height: 60px; resize: vertical; }
.prd-fields { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 20px; }
.prd-panel:not(.prd-phone) .prd-fields :deep(.ui-field) { --joined-chip: 60px !important; }
.prd-checks { display: flex; gap: 16px; padding: 8px 14px; border-top: 1px solid #ddd; }
.prd-checks label { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border: 1px solid #ccc; border-radius: 3px; background: #fff; }
.prd-saved { margin: 0; padding: 4px 14px; font-size: 12px; }
.prd-prov { margin: 0 14px 6px; padding: 6px 10px; border: 1px solid #38bdf8; border-radius: 4px; background: #eef8fe; font-size: 12px; }
.prd-prov ul { margin: 4px 0 0; padding-left: 18px; }
.prd-prov p { margin: 4px 0 0; color: #555; }
.prd-inspected { outline: 2px solid #38bdf8; outline-offset: 1px; border-radius: 4px; }
.prd-feeds { background: rgba(59, 130, 246, .18); border-radius: 4px; }
.prd-more-scrim { position: fixed; inset: 0; z-index: 1; }
.prd-phone .prd-foot .mob-btn { position: relative; z-index: 2; }
.prd-foot { display: flex; align-items: center; gap: 8px; padding: 10px 14px 12px; border-top: 1px solid #ddd; }
.prd-foot button { padding: 5px 12px; border: 1px solid #bbb; border-radius: 3px; background: #fff; font: inherit; cursor: pointer; }
.prd-gap { flex: 1 1 auto; }
.prd-foot .pri { background: #1565c0; color: #fff; border-color: #1565c0; font-weight: 600; }
.prd-foot button:disabled { opacity: .5; cursor: default; }
/* Phone: full screen, as the driver editor is. */
.prd-phone-scrim { align-items: stretch; }
.prd-phone { width: 100%; max-width: 100%; max-height: 100%; height: 100%; border: 0; border-radius: 0; box-shadow: none; }
.prd-phone .prd-head { height: 56px; }
.prd-phone .prd-head h3 { font-size: 15px; }
.prd-phone .prd-x { width: 42px; height: 42px; font-size: 22px; }
.prd-phone .prd-tabs { padding: 6px 6px 0; }
.prd-phone .prd-tabs button { flex: 1; padding: 12px 4px; }
.prd-phone .prd-legend { display: flex; justify-content: center; align-items: center; gap: 4px; padding: 4px; font-size: 13px; color: #555; }
.prd-phone .prd-legend i { display: inline-block; width: 9px; height: 9px; margin-left: 6px; }
.prd-phone .prd-legend .g { background: #1b7f1b; } .prd-phone .prd-legend .b { background: #1565c0; } .prd-phone .prd-legend .k { background: #555; }
.prd-phone .prd-scroll { padding: 0; }
.prd-phone .prd-band { margin: 0; padding: 8px 16px; text-align: left; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; font-size: 12px; }
.prd-phone .prd-fields { display: block; }
.prd-phone .prd-fields :deep(.ui-field) { --mob-chip: var(--mob-col-chip-wide) !important; }
.prd-phone .prd-general { grid-template-columns: 1fr; padding: 10px 16px; }
.prd-phone .prd-text { font-size: 14px; }
.prd-phone .prd-text input { height: 40px; font-size: 15px; }
.prd-phone .prd-checks { padding: 8px 10px; gap: 8px; }
.prd-phone .prd-checks label { flex: 1; padding: 8px 6px; white-space: nowrap; font-size: 12.5px; }
.prd-phone .prd-foot { position: relative; padding: 10px; gap: 8px; }
.prd-phone .prd-foot .mob-btn { flex: 1 1 0; height: 44px; }
.prd-phone .prd-foot .prd-ok { flex: 1.4 1 0; }
.prd-phone .prd-foot .prd-more { flex: 0.7 1 0; }
.prd-more-menu { position: absolute; z-index: 3; right: 10px; bottom: 60px; display: flex; flex-direction: column; min-width: 190px; background: #fff; border: 1px solid #bbb; border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.prd-more-menu button { padding: 12px 14px; border: 0; border-bottom: 1px solid #eee; background: none; text-align: left; font-size: 15px; }
</style>
