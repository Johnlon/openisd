<script setup lang="ts">
/**
 * Shared WinISD-style toolbar icon set — ONE source for Original + Classic (both are
 * WinISD desktop recreations, so their toolbar iconography should be identical, not two
 * independently hand-drawn sets). Shapes/colours are modelled on the real WinISD 0.7.0.950
 * toolbar (docs/winisd/view_2_box.png): filled/shaded glyphs, not bare wireframe strokes —
 * orange folder, silver floppy disks, blue speaker/driver icon, blue info circle, pink
 * chart-curve icon. "saveAs" and "export" extend the real disk+pencil / disk+ribbon icons
 * WinISD itself uses for its 2nd/3rd toolbar floppy — there is no WinISD icon for "export a
 * WinISD project", since that concept doesn't exist in WinISD itself (this is OpenISD's own
 * addition), so the ribbon/tag motif is reused for it rather than invented from nothing.
 */
defineProps<{
  name: 'open' | 'new' | 'save' | 'saveAs' | 'export' | 'drivers' | 'options' | 'info' | 'chart';
}>();
</script>

<template>
  <svg v-if="name === 'open'" width="22" height="19" viewBox="0 0 30 26">
    <path d="M2 6 h9 l2 3 h14 a2 2 0 0 1 2 2 v11 a2 2 0 0 1-2 2 H4 a2 2 0 0 1-2-2 Z" fill="#f4b23e" stroke="#c8871a"/>
    <path d="M5 12 h20 l-3 10 H8 Z" fill="#ffd980" stroke="#c8871a"/>
  </svg>
  <svg v-else-if="name === 'new'" width="17" height="19" viewBox="0 0 22 26">
    <path d="M3 2 h11 l5 5 v17 H3 Z" fill="#fff" stroke="#9aa4ad"/>
    <path d="M14 2 v5 h5" fill="#e8edf2" stroke="#9aa4ad"/>
    <circle cx="16" cy="6" r="3.4" fill="#ffe14d" stroke="#d4b800"/>
  </svg>
  <svg v-else-if="name === 'save'" width="18" height="19" viewBox="0 0 24 26">
    <path d="M3 3 h15 l3 3 v17 H3 Z" fill="#5b7fb0" stroke="#3c5a86"/>
    <rect x="7" y="3" width="9" height="7" fill="#cdd8e6"/>
    <rect x="7" y="14" width="10" height="7" fill="#eef2f7"/>
  </svg>
  <svg v-else-if="name === 'saveAs'" width="18" height="19" viewBox="0 0 24 26">
    <path d="M3 3 h15 l3 3 v17 H3 Z" fill="#5b7fb0" stroke="#3c5a86"/>
    <rect x="7" y="3" width="9" height="7" fill="#cdd8e6"/>
    <line x1="9" y1="20" x2="19" y2="10" stroke="#c9971b" stroke-width="2"/>
    <polygon points="18,9 20,11 19,12 17,10" fill="#c9971b"/>
  </svg>
  <svg v-else-if="name === 'export'" width="18" height="19" viewBox="0 0 24 26">
    <path d="M3 3 h15 l3 3 v17 H3 Z" fill="#5b7fb0" stroke="#3c5a86"/>
    <rect x="7" y="3" width="9" height="7" fill="#cdd8e6"/>
    <path d="M13 21 l7-7 3 3 -7 7 -3.6 .6 Z" fill="#ffd34d" stroke="#b8901f"/>
  </svg>
  <svg v-else-if="name === 'drivers'" width="22" height="19" viewBox="0 0 30 26">
    <circle cx="15" cy="13" r="11" fill="#c9c9c9" stroke="#8a8a8a"/>
    <circle cx="15" cy="13" r="6.5" fill="#9c9c9c" stroke="#6f6f6f"/>
    <circle cx="15" cy="13" r="2.6" fill="#5f5f5f"/>
  </svg>
  <svg v-else-if="name === 'options'" width="19" height="19" viewBox="0 0 26 26">
    <!-- A real open-end wrench (docs/winisd/view_1_driver_drivers_standard.png toolbar, cropped
         close up) — a slender, mostly-horizontal handle with a two-pronged open FORK at one end
         and a small ring loop at the other, tilted ~20°. (An earlier attempt used a diagonal bar
         with a full ring at each end and a bite cut from it — that reads as a dumbbell/lollipop,
         not a tool, because a real spanner's jaw is an open fork at the very tip, not a notch
         bitten out of a ring's middle.) The fork's gap is a MASK (true alpha cutout) so it reads
         correctly on any skin's toolbar background. -->
    <defs>
      <mask id="wrenchFork">
        <rect x="0" y="0" width="26" height="26" fill="#fff"/>
        <rect x="17" y="11.2" width="9" height="3.6" fill="#000"/>
      </mask>
    </defs>
    <g transform="rotate(-22 13 13)">
      <rect x="6.2" y="11.3" width="10.5" height="3.4" rx="1.5" fill="#adbdcd" stroke="#5b6b7d" stroke-width="1"/>
      <g mask="url(#wrenchFork)">
        <rect x="15.3" y="7.2" width="8.4" height="11.6" rx="2.6" fill="#c7d3de" stroke="#5b6b7d" stroke-width="1.1"/>
      </g>
      <circle cx="5.4" cy="13" r="3.7" fill="#c7d3de" stroke="#5b6b7d" stroke-width="1.1"/>
      <circle cx="5.4" cy="13" r="1.4" fill="none" stroke="#5b6b7d" stroke-width="1.1"/>
    </g>
  </svg>
  <svg v-else-if="name === 'info'" width="19" height="19" viewBox="0 0 26 26">
    <circle cx="13" cy="13" r="11" fill="#2f8fe0" stroke="#1c6db3"/>
    <circle cx="13" cy="7.5" r="1.8" fill="#fff"/>
    <rect x="11.4" y="11" width="3.2" height="9" rx="1.4" fill="#fff"/>
  </svg>
  <svg v-else-if="name === 'chart'" width="19" height="17" viewBox="0 0 26 24">
    <rect x="1" y="1" width="24" height="22" rx="2" fill="#fff" stroke="#cfcfcf"/>
    <path d="M3 18 L9 12 L13 15 L22 5" fill="none" stroke="#d05bd0" stroke-width="2"/>
  </svg>
</template>
