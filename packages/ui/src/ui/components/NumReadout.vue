<script setup lang="ts">
// The read-only counterpart to NumInput: the SAME field/unitKey-driven SI->display conversion,
// reformatting live when the paired UnitToggle rotates the unit — just nothing to type into.
//
// Every calculated numeric readout must render through this, never a hand-rolled
// `value.toFixed(dp) + ' <unit>'` template expression. That pattern reimplements the conversion
// math at the call site and hardcodes the unit string, so it silently stops tracking the unit
// picker the moment the selected unit isn't the one someone hardcoded (John, 2026-10-01: mobile's
// Enclosure tab readouts never looked at the picker at all). One formatter, used everywhere a
// calculated value is shown, is what NumInput already is for the ENTERED side of the same fields
// — this is its read-only twin, not a second implementation.
import {computed} from 'vue';
import {unitToken, presentationState} from '../../logic/presentationState.js';
import type {NumberField} from '@openisd/design/fields';

const props = withDefaults(defineProps<{
  /** The value in SI — same convention as NumInput's modelValue. */
  value: number | null | undefined;
  /** Switchable-unit binding, same meaning as NumInput's own `field`/`unitKey` pair: when both
   *  are given, the shown number converts through the field's registered unit group and
   *  reformats live when the paired UnitToggle (same unitKey) rotates it. Omit either for a
   *  field with no alternate units — the SI value is shown unconverted. */
  field?: NumberField;
  unitKey?: string;
  /** Decimals in the base unit. Defaults to the bound `field`'s own registry precision. */
  precision?: number;
  /** The value's own half-width in SI — typed, or inherited from what it was calculated from.
   *  Shows more decimals than `precision` where it states them. */
  halfWidth?: number | null;
  /** Shown in place of a null/non-finite value — '—' everywhere the app already uses it. */
  placeholder?: string;
  /** Render as a readonly `<input>` (desktop's "greyed field" look) instead of a bare `<span>`
   *  (mobile's plain readout row) — same formatted text either way. */
  asInput?: boolean;
}>(), {
  value: null,
  precision: undefined,
  halfWidth: null,
  placeholder: '—',
  asInput: false,
});

const activeToken = computed(() => {
  if (props.field) {
    const d = props.field.display;
    return props.field.unitTokenFor(presentationState.ui.unitTokens ?? {}, props.unitKey) ?? (props.unitKey && d.kind === 'switchable' ? unitToken(props.unitKey, d.group, d.base) : undefined);
  }
  if (props.unitKey) {
    return presentationState.ui.unitTokens?.[props.unitKey];
  }
  return undefined;
});

const text = computed(() => {
  const si = props.value;
  if (si == null || !isFinite(si)) return props.placeholder;
  if (props.field) {
    return props.field.format(si, props.halfWidth, activeToken.value);
  }
  const minDp = props.precision ?? 2;
  return si.toFixed(minDp);
});
</script>

<template>
  <input v-if="asInput" type="text" :value="text" readonly>
  <span v-else>{{ text }}</span>
</template>
