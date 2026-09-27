<script setup lang="ts">
// Placeholder for Phase 1's real mobile shell (bottom tab bar, Box/Driver/Signal tabs, a
// full-screen chart view — see the mobile-first-skin plan). Phase 0 only needs a distinct,
// addressable root — plus the "switch back" affordance — so the skin switch itself
// (auto-detect by viewport + a manual, persisted override) can be built and tested before any
// real mobile UI exists.
import {useMobileShell} from '../../../hooks/MobileShell-hooks.js';

const { switchToDesktop } = useMobileShell();
</script>

<template>
  <div class="mobile-root">
    <p>Mobile view — coming soon.</p>
    <button type="button" class="switch-desktop-btn" @click="switchToDesktop">Switch to Desktop view</button>
  </div>
</template>

<style scoped>
/* Re-declares the shared tokens, exactly as `.original-root` does in style.css, so the two
   skins can diverge later without one silently inheriting the other's values. The provenance
   colours (--good/--acc/--bad/--acc2) must stay byte-identical to :root — that's what keeps the
   Entered/Calculated/Not-available legend meaning the same thing in both skins. */
.mobile-root {
  --bg: #f2f2f2; --panel: #f7f7f7; --panel2: #ececec; --line: #bbb;
  --fg: #1a1a1a; --mut: #555; --acc: #1868d1; --acc2: #b8790f; --good: #1b7d1b; --bad: #b02a2a;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--bg);
  color: var(--fg);
  font: 15px/1.5 "Inter", system-ui, sans-serif;
}
.switch-desktop-btn {
  padding: 8px 16px;
  border: 1px solid var(--acc);
  border-radius: 6px;
  background: var(--panel);
  color: var(--acc);
  font: inherit;
  cursor: pointer;
}
</style>
