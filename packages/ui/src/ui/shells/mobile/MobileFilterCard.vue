<script setup lang="ts">
// One filter of the phone Filters tab, as a card: a header (tick, short name, caption, fold arrow,
// remove, ?) and, while open, the filter's rows. Tapping the name or caption folds the card.
// Which rows a type shows is the one `*Fields` component for its variant; every edit is decided by
// the engine through `api`.
import {ref} from 'vue';
import {PhoneHelp, PHONE_FILTER_CHIPS} from '@openisd/design/fields';
import type {Filter} from '@openisd/design/engine';
import {inputChecked} from '../../../logic/domEvents.js';
import {useEscToClose} from '../../../logic/useEscToClose.js';
import type {OriginalFiltersAPI} from '../../../hooks/OriginalFilters-hooks.js';
import PhoneHelpSheet from './PhoneHelpSheet.vue';
import PassFields from './filters/PassFields.vue';
import AllpassFields from './filters/AllpassFields.vue';
import LinkwitzFields from './filters/LinkwitzFields.vue';
import ParametricEqFields from './filters/ParametricEqFields.vue';
import PeakHighpassFields from './filters/PeakHighpassFields.vue';
import StaticGainFields from './filters/StaticGainFields.vue';
import RaisedCosineFields from './filters/RaisedCosineFields.vue';
import ShelfFields from './filters/ShelfFields.vue';

const {f, api, open} = defineProps<{ f: Filter; api: OriginalFiltersAPI; open: boolean }>();
const emit = defineEmits<{ toggle: []; remove: [] }>();

const helpOpen = ref(false);
useEscToClose(() => helpOpen.value, () => { helpOpen.value = false; });

const shortName = (): string => PHONE_FILTER_CHIPS.find(c => c.type === f.type)?.short ?? '';
</script>

<template>
  <div class="mob-fcard" :class="{'mob-fcard-shut': !open}">
    <div class="mob-fcard-head">
      <label class="mob-fcard-tick">
        <input type="checkbox" :checked="f.enabled" :aria-label="`${shortName()} on`" @change="api.setEnabled(f, inputChecked($event))">
      </label>
      <button type="button" class="mob-fcard-fold" :aria-expanded="open" :aria-label="`${open ? 'Fold' : 'Open'} ${shortName()}`" @click="emit('toggle')">
        <span class="mob-fcard-name">{{ shortName() }}</span>
        <span class="mob-fcard-cap" :class="{'mob-fcard-off': !f.enabled}">{{ api.caption(f) }}</span>
        <span class="mob-fcard-arrow" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
      </button>
      <button type="button" class="mob-fcard-rm" :aria-label="`Remove ${shortName()}`" @click="emit('remove')">×</button>
      <button type="button" class="mob-band-help mob-fcard-help" :aria-label="`Help: ${shortName()}`" @click="helpOpen = true">?</button>
    </div>
    <div v-if="open" class="mob-fcard-body">
      <PassFields          v-if="f.type === 'lowpass' || f.type === 'highpass'" :f="f" :api="api" />
      <AllpassFields       v-else-if="f.type === 'allpass'" :f="f" :api="api" />
      <LinkwitzFields      v-else-if="f.type === 'linkwitz'" :f="f" :api="api" />
      <ParametricEqFields  v-else-if="f.type === 'peaking'" :f="f" :api="api" />
      <PeakHighpassFields  v-else-if="f.type === 'peakHighpass'" :f="f" :api="api" />
      <StaticGainFields    v-else-if="f.type === 'staticGain'" :f="f" :api="api" />
      <RaisedCosineFields  v-else-if="f.type === 'raisedCosine'" :f="f" :api="api" />
      <ShelfFields         v-else-if="f.type === 'lowshelf' || f.type === 'highshelf'" :f="f" :api="api" />
    </div>
  </div>
  <PhoneHelpSheet v-if="helpOpen" :section="PhoneHelp.filter(f.type)" @close="helpOpen = false" />
</template>

<style scoped>
.mob-fcard { margin: 8px 12px 0; border: 1px solid #b9c7dd; border-radius: 6px; background: #fff; overflow: hidden; }
.mob-fcard-head { display: flex; align-items: center; min-height: 48px; background: #e8effa; }
.mob-fcard-shut .mob-fcard-head { background: #f3f6fb; }
.mob-fcard-tick { flex: none; width: 40px; align-self: stretch; display: grid; place-items: center; cursor: pointer; }
.mob-fcard-tick input { width: 20px; height: 20px; margin: 0; }
.mob-fcard-fold { flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; align-items: center; gap: 8px; padding: 4px 0; border: none; background: none; font: inherit; font-size: 14px; color: #222; text-align: left; cursor: pointer; }
.mob-fcard-name { flex: none; min-width: 44px; font-weight: 700; white-space: nowrap; }
.mob-fcard-cap { flex: 1 1 auto; min-width: 0; color: #444; line-height: 1.35; overflow-wrap: anywhere; }
.mob-fcard-off { color: #999; text-decoration: line-through; }
.mob-fcard-arrow { flex: none; width: 18px; color: #666; font-size: 12px; text-align: center; }
.mob-fcard-rm { flex: none; width: 36px; height: 40px; padding: 0; border: none; background: none; color: #b02a2a; font-size: 20px; cursor: pointer; }
.mob-fcard-help { flex: none; margin: 0 10px 0 2px; width: 22px; height: 22px; padding: 0; border: 1px solid #999; border-radius: 50%; background: #fff; color: #333; font: inherit; font-size: 12px; font-weight: 600; line-height: 1; cursor: pointer; }
.mob-fcard-body > :last-child { box-shadow: none; }
</style>
