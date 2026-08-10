<!--
  The driver dimensions diagram — Basket, Outer, Depth, MagDpt, Magnet, Thick.

  ONE definition, shared. It previously existed in THREE versions: a 300x260 inline copy in
  DriverEditorModal, a second inline copy in DriverDefineModal, and a 600x300 standalone
  `winisd/driver.svg` that had been dropped from the tree entirely. Three drawings of one
  thing, free to drift — and two of them already had.

  Recovered from `mock/index.html` @587bc43b9, the version with proper dimension arrow
  markers.
-->
<template>
  <svg viewBox="0 0 540 450" class="dd-dim-svg" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="dd-arr-s" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 10 1.5 L 0 5 L 10 8.5 Z" fill="#4fb0ff"/>
      </marker>
      <marker id="dd-arr-e" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M 0 1.5 L 10 5 L 0 8.5 Z" fill="#4fb0ff"/>
      </marker>
    </defs>
    <g transform="translate(15,15)">
      <rect x="400" y="20" width="10" height="380" fill="#1a2029" stroke="#c9d4e0" stroke-width="1.3" stroke-linejoin="round"/>
      <g stroke="#c9d4e0" stroke-width="1.3" fill="none" stroke-linejoin="round" stroke-linecap="round">
        <path d="M 310 140 L 400 50"/>
        <path d="M 310 280 L 400 370"/>
        <path d="M 310 140 L 310 280"/>
        <polygon points="330,150 330,180 385,180 385,105" fill="#11151c"/>
        <polygon points="335,155 335,175 380,175 380,114" fill="none"/>
        <polygon points="330,270 330,240 385,240 385,315" fill="#11151c"/>
        <polygon points="335,265 335,245 380,245 380,306" fill="none"/>
      </g>
      <g stroke="#c9d4e0" stroke-width="1.3" fill="#1a2029" stroke-linejoin="round">
        <rect x="235" y="140" width="55" height="140" fill="#11151c"/>
        <rect x="227" y="150" width="8" height="120"/>
        <rect x="290" y="145" width="20" height="130"/>
      </g>
    </g>
    <g stroke="#4fb0ff" stroke-width="0.8" fill="none">
      <line x1="430" y1="35" x2="480" y2="35"/>
      <line x1="430" y1="415" x2="480" y2="415"/>
      <line x1="465" y1="50" x2="465" y2="400" marker-start="url(#dd-arr-s)" marker-end="url(#dd-arr-e)"/>
      <line x1="415" y1="65" x2="155" y2="65" stroke-dasharray="2,2"/>
      <line x1="415" y1="385" x2="155" y2="385" stroke-dasharray="2,2"/>
      <line x1="170" y1="80" x2="170" y2="370" marker-start="url(#dd-arr-s)" marker-end="url(#dd-arr-e)"/>
      <line x1="250" y1="155" x2="205" y2="155"/>
      <line x1="250" y1="295" x2="205" y2="295"/>
      <line x1="215" y1="170" x2="215" y2="280" marker-start="url(#dd-arr-s)" marker-end="url(#dd-arr-e)"/>
      <line x1="415" y1="55" x2="415" y2="20"/>
      <line x1="425" y1="55" x2="425" y2="20"/>
      <line x1="385" y1="25" x2="415" y2="25" marker-end="url(#dd-arr-e)"/>
      <line x1="455" y1="25" x2="425" y2="25" marker-end="url(#dd-arr-e)"/>
      <line x1="242" y1="295" x2="242" y2="340"/>
      <line x1="325" y1="295" x2="325" y2="340"/>
      <line x1="242" y1="330" x2="325" y2="330" marker-start="url(#dd-arr-s)" marker-end="url(#dd-arr-e)"/>
      <line x1="242" y1="295" x2="242" y2="420"/>
      <line x1="415" y1="385" x2="415" y2="420"/>
      <line x1="242" y1="410" x2="415" y2="410" marker-start="url(#dd-arr-s)" marker-end="url(#dd-arr-e)"/>
    </g>
    <g font-family="system-ui,sans-serif" font-size="14" fill="#4fb0ff" text-anchor="middle">
      <text x="482" y="225" transform="rotate(90,482,225)">Outer</text>
      <text x="153" y="225" transform="rotate(-90,153,225)">Basket</text>
      <text x="198" y="225" transform="rotate(-90,198,225)">Magnet</text>
      <text x="420" y="15" font-size="13">Thick</text>
      <text x="287" y="355">MagDpt</text>
      <text x="328" y="435">Depth</text>
    </g>
  </svg>
</template>
