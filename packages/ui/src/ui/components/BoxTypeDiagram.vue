<script setup lang="ts">
/**
 * The Box tab's enclosure illustration — one shared component so the Original shell's
 * Box tab and the New Project wizard draw the exact same art for a given box type,
 * instead of each carrying its own copy of the SVG markup.
 */
import type {BoxType} from '@openisd/design/engine';

import DriverPairArt from './DriverPairArt.vue';

/** One driver, or (inside a BoxPairDrawing) the Iso-Barik pair drawn face to face (clamshell) or one behind the other (tandem). */
import {computed, inject} from 'vue';
import {BOX_PAIR, SINGLE_DRIVER} from './boxPairContext.js';

defineProps<{ boxType: BoxType }>();
const pair = inject(BOX_PAIR, SINGLE_DRIVER);
const variant = pair.variant;

/** How far the pair is squeezed in depth to fit inside the box. */
const depthScale = computed(() => variant === 'clamshell' ? 0.6 : 0.45);

/**
 * The static id and viewBox stay for the single drawing. In an Iso-Barik pair the box is drawn twice on one page: the cut-through is
 * cropped to the box and its driver (the margins are empty) so two fit side by side, and the second drawing gets a suffixed id
 * (no repeated ids in the page).
 */
function overrides(id: string, pairViewBox: string): {id?: string; viewBox?: string} {
  if (variant === 'single') return {};
  return pair.idSuffix === '' ? {viewBox: pairViewBox} : {id: `${id}${pair.idSuffix}`, viewBox: pairViewBox};
}
</script>

<template>
  <svg v-show="boxType === 'sealed'" id="og-box-diagram-sealed" viewBox="0 30 200 240" height="126" v-bind="overrides('og-box-diagram-sealed', '30 30 150 240')">
    <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="40" x2="160" y2="110" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="190" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
    <DriverPairArt :variant="variant" :x="160" :y="150" :half="40" :x-scale="depthScale">
    <path d="M160,110 L130,130 L130,170 L160,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
    <rect x="110" y="140" width="20" height="20" fill="#0F4761"/>
    </DriverPairArt>
  </svg>
  <svg v-show="boxType === 'vented'" id="og-box-diagram-vented" viewBox="0 30 200 240" height="126" v-bind="overrides('og-box-diagram-vented', '30 30 150 240')">
    <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="40" x2="160" y2="70" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="150" x2="160" y2="200" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="230" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="200" x2="100" y2="200" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="230" x2="100" y2="230" stroke="#0F4761" stroke-width="4"/>
    <DriverPairArt :variant="variant" :x="160" :y="110" :half="40" :x-scale="depthScale">
    <path d="M160,70 L130,90 L130,130 L160,150" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
    <rect x="110" y="100" width="20" height="20" fill="#0F4761"/>
    </DriverPairArt>
  </svg>
  <svg v-show="boxType === 'box-passive-radiator'" id="og-box-diagram-passive-radiator" viewBox="0 30 200 240" height="126" v-bind="overrides('og-box-diagram-passive-radiator', '30 30 150 240')">
    <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="40" x2="160" y2="60" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="130" x2="160" y2="170" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="240" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
    <DriverPairArt :variant="variant" :x="160" :y="95" :half="35" :x-scale="depthScale">
    <path d="M160,60 L130,75 L130,115 L160,130" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
    <rect x="110" y="85" width="20" height="20" fill="#0F4761"/>
    </DriverPairArt>
    <path d="M160,170 L130,185 L130,225 L160,240" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
  </svg>
  <svg v-show="boxType === 'bandpass4'" id="og-box-diagram-bandpass4" viewBox="0 30 200 240" height="126" v-bind="overrides('og-box-diagram-bandpass4', '30 30 150 240')">
    <polyline points="160,200 160,40 40,40 40,260 160,260 160,230" fill="none" stroke="#0F4761" stroke-width="4"/>
    <line x1="100" y1="40" x2="100" y2="110" stroke="#0F4761" stroke-width="4"/>
    <line x1="100" y1="190" x2="100" y2="260" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="200" x2="120" y2="200" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="230" x2="120" y2="230" stroke="#0F4761" stroke-width="4"/>
    <DriverPairArt :variant="variant" :x="100" :y="150" :half="40" :x-scale="depthScale">
    <path d="M100,110 L70,130 L70,170 L100,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
    <rect x="50" y="140" width="20" height="20" fill="#0F4761"/>
    </DriverPairArt>
  </svg>
  <svg v-show="boxType === 'bandpass6'" id="og-box-diagram-bandpass6" viewBox="0 30 200 240" height="126" v-bind="overrides('og-box-diagram-bandpass6', '30 30 150 240')">
    <DriverPairArt :variant="variant" :x="100" :y="150" :half="40" :x-scale="depthScale">
    <path d="M100,110 L70,130 L70,170 L100,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
    <rect x="50" y="140" width="20" height="20" fill="#0F4761"/>
    </DriverPairArt>
    <line x1="40" y1="40" x2="160" y2="40" stroke="#0F4761" stroke-width="4"/>
    <line x1="40" y1="260" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="40" x2="160" y2="200" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="230" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
    <line x1="40" y1="40" x2="40" y2="70" stroke="#0F4761" stroke-width="4"/>
    <line x1="40" y1="100" x2="40" y2="260" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="200" x2="120" y2="200" stroke="#0F4761" stroke-width="4"/>
    <line x1="160" y1="230" x2="120" y2="230" stroke="#0F4761" stroke-width="4"/>
    <line x1="40" y1="70" x2="80" y2="70" stroke="#0F4761" stroke-width="4"/>
    <line x1="40" y1="100" x2="80" y2="100" stroke="#0F4761" stroke-width="4"/>
    <line x1="100" y1="40" x2="100" y2="110" stroke="#0F4761" stroke-width="4"/>
    <line x1="100" y1="190" x2="100" y2="260" stroke="#0F4761" stroke-width="4"/>
  </svg>
  <svg v-show="boxType === 'abc'" id="og-box-diagram-abc" viewBox="0 15 200 270" height="126" v-bind="overrides('og-box-diagram-abc', '30 15 150 270')">
    <path d="M 100,20 L 100,140 M 75,140 L 125,140 M 100,180 L 100,280 M 75,180 L 125,180" fill="none" stroke="#0F4761" stroke-width="4"/>
    <path d="M 100,20 L 40,20 L 40,70 L 80,70" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
    <path d="M 80,100 L 40,100 L 40,280 L 100,280" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
    <path d="M 100,20 L 160,20 L 160,60" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
    <path d="M 160,130 L 160,210 L 120,210" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
    <path d="M 120,240 L 160,240 L 160,280 L 100,280" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
    <DriverPairArt :variant="variant" :x="160" :y="95" :half="35" :x-scale="depthScale">
    <path d="M 160,60 L 130,75 L 130,115 L 160,130 Z" fill="#A0B8C6" stroke="#0F4761" stroke-width="3" stroke-linejoin="round"/>
    <rect x="115" y="80" width="15" height="30" fill="#0F4761"/>
    <rect x="100" y="88" width="15" height="14" fill="#0F4761"/>
    </DriverPairArt>
  </svg>
</template>
