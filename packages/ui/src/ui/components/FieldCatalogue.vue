<script setup lang="ts">
import {provide, ref} from 'vue';
import {STEPPER_PIN, StepperPin} from '../../logic/stepperPin.js';
import {FIELD_APPEARANCE_SAMPLES, FIELD_APPEARANCES, FieldEditor, FieldAccess, FieldUnits, FieldCue, NumberField, WinisdDeviation, PhoneRowSizes, PhoneRowColumns, EnumField} from '@openisd/design/fields';
import {provideCellScope} from './cellScope.js';
import UIFixedField from './UIFixedField.vue';
import UIPickField from './UIPickField.vue';
import WinisdDeviationCue from './WinisdDeviationCue.vue';
import UnitToggle from './UnitToggle.vue';
import {selectedOption} from '../../logic/domEvents.js';


const contentEl = ref<HTMLElement | null>(null);
const pinSpacePx = ref(0);
// The standalone gallery hosts the same controls outside MobileShell. Supply the same
// keyboard-close pin controller against this page's own scrolling surface.
const stepperPin = new StepperPin({
  screenHeightPx: () => window.screen.height,
  scrollBy: dy => { if (contentEl.value !== null) contentEl.value.scrollTop += dy; },
  setSpacePx: px => { pinSpacePx.value = px; },
  belowViewPx: () => {
    const element = contentEl.value;
    return element === null ? 0 : element.scrollHeight - element.scrollTop - element.clientHeight;
  },
  now: () => performance.now(),
  nextFrame: run => { requestAnimationFrame(run); },
});
provide(STEPPER_PIN, stepperPin);

const revision = ref(0);
provideCellScope({revision, written: () => { revision.value++; }});
const values = ref<Record<string, number>>({});
const text = ref('Example');
const checked = ref(false);
const options = EnumField.VENT_SHAPE.options;
const choice = ref(options[0].value);
const units = (kind: FieldUnits) => kind === FieldUnits.Switchable ? NumberField.FS_HZ : kind === FieldUnits.Fixed ? NumberField.ADV_AIRDENSITY_KG_PER_M3 : NumberField.QMS;
const sample = (kind: FieldUnits) => FIELD_APPEARANCE_SAMPLES[kind];
const hasDq = (cue: FieldCue) => cue === FieldCue.Dq || cue === FieldCue.Both;
const hasModel = (cue: FieldCue) => cue === FieldCue.Model || cue === FieldCue.Both;
</script>

<template>
  <main ref="contentEl" class="field-catalogue mob-classic" @scroll="stepperPin.onScroll()" :style="Object.fromEntries([...PhoneRowSizes.CLASSIC.cssVars(), ...PhoneRowColumns.STANDARD.cssVars()])">
    <header><p><b>Type under a picture in the comparison gallery to request changes.</b></p><h1>Field appearance catalogue</h1>
      <p>Selected appearance: production-style joined value/unit boxes. ⚠ is outside left; ≠W is outside right after the spinners or dropdown. Inverse blinking digit selection remains selected. The separate-unit compact candidate is discarded. Specimen warnings and model cues demonstrate independent states; they do not assert an actual fault in the sample value.</p>
      <p>{{ FIELD_APPEARANCES.length }} valid base forms. Read/write access, value provenance and temporary disabling are separate properties. This page uses the real number, readout, unit, picker and model-cue components.</p>
    </header>
    <article v-for="form in FIELD_APPEARANCES" :key="form.id" :data-specimen="form.id">
      <h2>{{ form.id }}</h2>
      <UIFixedField v-if="form.editor === FieldEditor.Number || form.editor === FieldEditor.Count" class="mob-ui-field"
        :field="form.editor === FieldEditor.Count ? NumberField.PR_NUM : units(form.units)" label="Value"
        :value="values[form.id] ?? (form.editor === FieldEditor.Count ? 2 : sample(form.units))"
        :readonly="form.access === FieldAccess.Readonly" :stepper="form.stepper"
        :dq="hasDq(form.cue) ? ['Specimen diagnostic: the source measurement needs review.'] : []" dq-state="E"
        :deviation="hasModel(form.cue) ? WinisdDeviation.CLOSED_BOX_TYPING : undefined"
        @update:value="value => values[form.id] = value" />
      <UIPickField v-else class="mob-ui-field catalogue-other joined-field" :class="{'catalogue-range': form.editor === FieldEditor.Range}" :input-id="form.id" label="Value">
        <select v-if="form.editor === FieldEditor.Choice && form.access === FieldAccess.Writable" :id="form.id" :value="choice" @change="event => { const value = selectedOption(event, options); if (value !== null) choice = value; }"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>
        <textarea v-else-if="form.editor === FieldEditor.Multiline" :id="form.id" v-model="text" :readonly="form.access === FieldAccess.Readonly" />
        <span v-else-if="(form.editor === FieldEditor.Boolean || form.editor === FieldEditor.BugToggle) && form.access === FieldAccess.Readonly" :id="form.id" role="checkbox" :aria-checked="checked" aria-readonly="true" class="catalogue-check-readout" :class="{'catalogue-bug': form.editor === FieldEditor.BugToggle}">{{ checked ? '✓' : '' }}</span>
        <input v-else-if="form.editor === FieldEditor.Boolean || form.editor === FieldEditor.BugToggle" :id="form.id" v-model="checked" type="checkbox" :disabled="form.access === FieldAccess.Readonly" :class="{'catalogue-bug': form.editor === FieldEditor.BugToggle}">
        <meter v-else-if="form.editor === FieldEditor.Range && form.access === FieldAccess.Readonly" :id="form.id" min="0" max="100" value="50">50</meter>
        <span v-else-if="form.editor === FieldEditor.Colour && form.access === FieldAccess.Readonly" :id="form.id" class="catalogue-colour-readout" aria-label="Colour #2678a8" />
        <input v-else-if="form.editor === FieldEditor.Range" :id="form.id" type="range" min="0" max="100" value="50" :disabled="form.access === FieldAccess.Readonly">
        <input v-else-if="form.editor === FieldEditor.Colour" :id="form.id" type="color" value="#2678a8" :disabled="form.access === FieldAccess.Readonly">
        <input v-else-if="form.editor === FieldEditor.Date" :id="form.id" type="date" value="2026-10-27" :readonly="form.access === FieldAccess.Readonly">
        <input v-else :id="form.id" :value="form.editor === FieldEditor.Choice ? 'Round' : text" :readonly="form.access === FieldAccess.Readonly">
        <template #unit><UnitToggle v-if="form.editor === FieldEditor.Range" :field="units(form.units)" unit-class="ui-field-unit" /></template>
        <template #dq><button v-if="hasDq(form.cue)" type="button" class="ui-field-dq-btn" title="Specimen diagnostic: source measurement needs review" aria-label="Why this value is flagged">⚠</button></template>
        <template #cue><WinisdDeviationCue v-if="hasModel(form.cue)" :deviation="WinisdDeviation.CLOSED_BOX_TYPING" /></template>
      </UIPickField>

      <p class="catalogue-note">{{ form.access }} · {{ form.units }} units · {{ form.cue }} cues{{ form.stepper ? ' · spinners' : '' }}</p>
    </article>
    <div aria-hidden="true" :style="{height: pinSpacePx + 'px'}"></div>
  </main>
</template>

<style scoped>
.field-catalogue {height:100dvh;overflow:auto;background:#fff;color:#222;font:14px/1.4 Arial,sans-serif;}
header {padding:12px;}h1{font-size:22px;}h2{font-size:12px;overflow-wrap:anywhere;margin:0;padding:8px 6px;}
article {border-top:1px solid #bbb;padding-bottom:8px;} .catalogue-note,.catalogue-diagnostic{margin:4px 6px;font-size:12px;}
.catalogue-bug {accent-color:#d6a600;background:#fff1aa !important;border:2px solid #d6a600 !important;} .catalogue-check-readout{grid-column:2;grid-row:1;display:inline-flex;width:20px;height:20px;border:1px solid #777;align-items:center;justify-content:center;} .catalogue-colour-readout{grid-column:2;grid-row:1;display:block;width:36px;height:26px;background:#2678a8;border:1px solid #777;} .catalogue-range :deep(meter){grid-column:2;grid-row:1;width:100%;min-width:0;height:34px;box-sizing:border-box;} .catalogue-other textarea{height:64px !important;}.catalogue-other:has(textarea){height:70px !important;}
</style>

<style scoped>
.catalogue-other :deep(input[type=checkbox]) {width:20px !important;height:20px !important;min-height:20px !important;padding:0;justify-self:start;align-self:center;}
.catalogue-other :deep(input[type=color]) {width:36px !important;height:26px !important;min-height:26px !important;padding:0;justify-self:start;align-self:center;}
.catalogue-range:has(.ui-field-unit:not(:empty)) :deep(meter) {padding-right:var(--joined-chip);}
.catalogue-other :deep(textarea) {grid-column:2;grid-row:1;width:100%;min-width:0;box-sizing:border-box;border:1px solid #c4c4c4;border-radius:4px;font:15px Arial,sans-serif;padding:4px 16px;}
</style>
