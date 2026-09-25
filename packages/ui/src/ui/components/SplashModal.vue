<script setup lang="ts">
/**
 * The splash — what OpenISD is, who it credits, and where the project lives.
 *
 * Raised once for a visitor whose stored view is empty, and on demand from the toolbar's Info
 * menu. Every claim here has a page behind it: the goals, the feature list and the WinISD
 * comparison all link out to the repository documents that own them, so the splash never
 * becomes a second copy of a fact.
 */
import {injectSplashModal} from '../../hooks/SplashModal-hooks.js';

const REPO = 'https://github.com/Johnlon/openisd';
const {open, dismiss} = injectSplashModal();
</script>

<template>
  <div v-if="open" class="sp-backdrop" @click.self="dismiss">
    <div class="sp" role="dialog" aria-labelledby="sp-title">
      <img class="sp-logo" src="/logo-wide.svg" alt="OpenISD — open loudspeaker enclosure simulator">

      <h2 id="sp-title">An open loudspeaker enclosure simulator that runs in any browser.</h2>
      <p class="sp-motto">Speaker design belongs to everyone who builds.</p>

      <section>
        <h3>Credit where it is due</h3>
        <p>
          WinISD, by Linearteam, is the tool this hobby was built on — a generation of builders
          learned enclosure design from it. It stopped at version 0.7, is Windows-only, has had
          no release since 2016, and its source was never opened, so nobody can carry it
          forward. OpenISD is not a reaction against it; it is the continuation it never got.
          The default circuit model reproduces WinISD's simulation output, and OpenISD reads and
          writes WinISD <code>.wdr</code> driver files and <code>.wpr</code> projects.
        </p>
      </section>

      <section>
        <h3>Goals</h3>
        <ul>
          <li><strong>Match WinISD, then go past it</strong> — the same numbers by default, so a WinISD user can trust the move.</li>
          <li><strong>No install, no licence, no platform</strong> — a browser is the whole requirement, and it installs for offline use as a PWA.</li>
          <li><strong>Correct, and provably so</strong> — every model is checked against the closed-form solutions, in CI and in public.</li>
          <li><strong>Community-owned</strong> — MIT licensed, open repository, open backlog. It has to survive its author losing interest.</li>
          <li><strong>Open data</strong> — a shared driver library anyone can contribute a spec sheet to.</li>
        </ul>
      </section>

      <section>
        <h3>What is distinctive</h3>
        <ul>
          <li><strong>Live everything</strong> — no <em>calculate</em> button. Change a box volume, drag a vent, swap a driver, and SPL, excursion, port velocity, impedance and group delay redraw on the keystroke.</li>
          <li><strong>Switchable circuit model</strong> — WinISD-compatible (Le excluded from SPL) or full gyrator (Le throughout, physically correct).</li>
          <li><strong>Design compare</strong> — pin any design and overlay its curves on the next one.</li>
          <li><strong>A cursor that works</strong> — hover, right-click to snap to a peak or trough, lock it, or type a frequency.</li>
          <li><strong>Data-quality marks</strong> — the app says when a driver's own stated parameters contradict each other, and which ones.</li>
          <li><strong>What-If editor</strong> — edit a driver's Thiele/Small parameters inline as a scratchpad; nothing touches your library until you save it.</li>
          <li><strong>Sealed, vented, 4th-order bandpass and passive radiator</strong>, with alignment helpers, a vent-length ↔ tuning solver and passive-radiator mass auto-tune.</li>
          <li><strong>Auto-saves</strong> to browser storage; projects export as JSON or as WinISD files.</li>
        </ul>
      </section>

      <section>
        <h3>Honesty about where the two tools differ</h3>
        <p>
          Where OpenISD and WinISD disagree, the disagreement is written down rather than hidden
          — which tool is right, why, and what we chose:
          <a :href="`${REPO}/blob/main/OPENISD_WINISD_GAPS_AND_BUGS.md`" target="_blank" rel="noopener">WinISD gaps and bugs</a>.
        </p>
      </section>

      <section>
        <h3>Built in the open</h3>
        <p>
          <a :href="REPO" target="_blank" rel="noopener">github.com/Johnlon/openisd</a>
          — issues, pull requests and the backlog are public.
          The
          <a :href="`${REPO}/blob/main/ARCHITECTURE.md`" target="_blank" rel="noopener">architecture specification</a>
          states the layers, boundaries and invariants the code is held to.
        </p>
        <p><strong>I am looking for a band of the willing.</strong> Ideas, feedback and pull requests all welcome.</p>
      </section>

      <footer>
        <button class="sp-go" @click="dismiss">Start designing</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.sp-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.sp {
  background: #11151c;
  color: #c7d3df;
  border: 1px solid #2b3a49;
  border-radius: 10px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.6);
  width: min(780px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  padding: 0 28px 20px;
  font-size: 13px;
  line-height: 1.55;
}
.sp-logo { display: block; width: 100%; height: auto; margin: 18px 0 14px; }
.sp h2 { font-size: 17px; color: #e6edf3; margin: 0 0 4px; font-weight: 600; }
.sp-motto { margin: 0 0 18px; color: #7f93a8; font-style: italic; }
.sp h3 { font-size: 13px; color: #4fb0ff; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.sp p { margin: 0 0 8px; }
.sp ul { margin: 0; padding-left: 18px; }
.sp li { margin-bottom: 5px; }
.sp strong { color: #e6edf3; font-weight: 600; }
.sp code { background: #1b2230; padding: 0 4px; border-radius: 3px; }
.sp a { color: #4fb0ff; }
.sp footer { margin-top: 22px; display: flex; justify-content: flex-end; }
.sp-go {
  background: #4fb0ff; color: #08121c; border: 0; border-radius: 5px;
  padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer;
}
.sp-go:hover { background: #6cbcff; }
</style>
