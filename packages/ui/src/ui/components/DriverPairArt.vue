<script setup lang="ts">
/**
 * Two drivers in one baffle opening, drawn inside a parent <svg> (T919, John 19 Nov 2026, QO953.c43: "for iso show two diagrams
 * clamshells and back to front so user knows that the model applies to both"). Local coordinates: the baffle is x = 0, behind it is
 * negative x, the middle of the opening is y = 0 and the opening is 40 either side. `x` and `y` put that point on the parent's
 * drawing, `half` is the opening's half height there, `xScale` squeezes the depth to fit. `single` draws what the parent puts in the slot (the one-driver art). Display only.
 *  - clamshell: the cones face each other in a short tunnel, magnets outward (one magnet outside the baffle).
 *  - tandem: both drivers face the front, one behind the other in the tunnel.
 */
defineProps<{ variant: 'single' | 'clamshell' | 'tandem'; x: number; y: number; half: number; xScale: number }>();
</script>

<template>
  <slot v-if="variant === 'single'" />
  <g v-else :transform="`translate(${x} ${y}) scale(${xScale} ${half / 40})`" stroke="#0F4761" stroke-width="3" stroke-linejoin="round">
    <template v-if="variant === 'clamshell'">
      <path d="M0,-40 L-48,-40 M0,40 L-48,40" fill="none" vector-effect="non-scaling-stroke"/>
      <path d="M0,-20 L-22,-38 L-22,38 L0,20 Z" fill="#A0B8C6" vector-effect="non-scaling-stroke"/>
      <rect x="1" y="-10" width="18" height="20" fill="#0F4761" stroke="none"/>
      <path d="M-26,-38 L-48,-20 L-48,20 L-26,38 Z" fill="#A0B8C6" vector-effect="non-scaling-stroke"/>
      <rect x="-68" y="-10" width="20" height="20" fill="#0F4761" stroke="none"/>
    </template>
    <template v-else>
      <path d="M0,-40 L-60,-40 M0,40 L-60,40" fill="none" vector-effect="non-scaling-stroke"/>
      <path d="M0,-40 L-30,-20 L-30,20 L0,40" fill="#A0B8C6" vector-effect="non-scaling-stroke"/>
      <rect x="-50" y="-10" width="20" height="20" fill="#0F4761" stroke="none"/>
      <path d="M-60,-40 L-90,-20 L-90,20 L-60,40" fill="#A0B8C6" vector-effect="non-scaling-stroke"/>
      <rect x="-110" y="-10" width="20" height="20" fill="#0F4761" stroke="none"/>
    </template>
  </g>
</template>
