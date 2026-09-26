<script setup lang="ts">
/**
 * The splash — what OpenISD is, who it credits, and where the project lives.
 *
 * Raised once for a visitor whose stored view is empty, and on demand from the toolbar's Info
 * menu. Every claim here has a page behind it: the goals, the feature list and the WinISD
 * comparison all link out to the repository documents that own them, so the splash never
 * becomes a second copy of a fact.
 */
import {computed} from 'vue';
import {injectSplashModal} from '../../hooks/SplashModal-hooks.js';

const REPO = 'https://github.com/Johnlon/openisd';
const {open, dismiss, driverCount, passiveRadiatorCount} = injectSplashModal();

/** What the bundled library holds, stated only for the counts the catalogue actually gave us. */
const libraryLine = computed(() => {
  const parts: string[] = [];
  if (driverCount.value !== null) parts.push(`${driverCount.value.toLocaleString()} drivers`);
  if (passiveRadiatorCount.value !== null) parts.push(`${passiveRadiatorCount.value.toLocaleString()} passive radiators`);
  return parts.length === 0 ? '' : `${parts.join(' and ')} are bundled with the app, ready to load.`;
});
</script>

<template>
  <div v-if="open" class="sp-backdrop" @click.self="dismiss">
    <div class="sp" role="dialog" aria-labelledby="sp-title">
      <!-- The text runs past one screen, so the footer button is a scroll away — this one is
           reachable the moment the splash appears. -->
      <button class="sp-x" title="Close" aria-label="Close" @click="dismiss">&times;</button>
      <img class="sp-logo" src="/logo-wide.svg" alt="OpenISD — open loudspeaker enclosure simulator">

      <h2 id="sp-title">An open loudspeaker enclosure simulator that runs in any browser.</h2>
      <p class="sp-motto">Speaker design belongs to everyone who builds.</p>
      <p v-if="libraryLine" class="sp-stat">{{ libraryLine }}</p>

      <section>
        <h3>WinISD</h3>
        <p>
          Many of us learned enclosure design on WinISD, by Linearteam. It stopped at version
          0.7, runs on Windows only, has had no release since 2016, and its source was never
          opened, so nobody can carry it forward. OpenISD picks it up: the default circuit model
          reproduces WinISD's output, and it reads and writes WinISD <code>.wdr</code> driver
          files and <code>.wpr</code> projects.
        </p>
      </section>

      <section>
        <h3>Goals</h3>
        <ul>
          <li><strong>Match WinISD, then go past it</strong> — the same numbers by default, so a WinISD user can trust the move.</li>
          <li><strong>No install, no licence, no platform</strong> — a browser is the whole requirement, and it installs for offline use as a PWA.</li>
          <li><strong>Checked, in public</strong> — every model is tested against the closed-form maths, in CI, on every commit.</li>
          <li><strong>Community-owned</strong> — MIT licensed, open repository, open backlog. It has to survive its author losing interest.</li>
          <li><strong>Open data</strong> — a shared driver library anyone can contribute a spec sheet to.<template v-if="driverCount !== null"> It holds {{ driverCount.toLocaleString() }} drivers today.</template></li>
        </ul>
      </section>

      <section>
        <h3>What is distinctive</h3>
        <ul>
          <li><strong>Alignment lives on the Box page</strong>, for every box type — WinISD offers the choice once, in the new-project wizard, and never again.</li>
          <li><strong>Switch one box from sealed to ported and back</strong> — same design, both ways, compared side by side.</li>
          <li><strong>No division-by-zero results and no crashes</strong> — an incomplete design says what is missing instead of producing a NaN or a blank window.</li>
          <li><strong>Modern cursor</strong> — hover, right-click to snap to a peak or trough, lock it, or type a frequency.</li>
          <li><strong>Data-quality marks</strong> — the app says when a driver's own stated parameters contradict each other, and which ones.</li>
          <li><strong>What-if?</strong> — change a driver's Thiele/Small parameters and see what each one does to the curves. It never saves: close it and your design is untouched.</li>
          <li><strong>Solvers that run in every direction</strong> — enter what you know, at either end, and it works out the rest.</li>
          <li><strong>Error messages that teach</strong> — what is wrong, which physics says so, and what to change.</li>
          <li><strong>Visible calculation provenance</strong> — trace any number back to the values and the formula it came from.</li>
        </ul>
      </section>

      <section>
        <h3>Where we differ from WinISD</h3>
        <p>
          Some numbers do not match WinISD's. Each one is written up — which tool is right, and
          why: <a :href="`${REPO}/blob/main/OPENISD_WINISD_GAPS_AND_BUGS.md`" target="_blank" rel="noopener">WinISD gaps and bugs</a>.
        </p>
      </section>

      <section>
        <h3>Built in the open</h3>
        <p>
          <a :href="REPO" target="_blank" rel="noopener">github.com/Johnlon/openisd</a>
          — issues, pull requests and the backlog are public.
          The
          <a :href="`${REPO}/blob/main/ARCHITECTURE.md`" target="_blank" rel="noopener">architecture specification</a>
          sets the rules the code is held to.
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
  position: relative;
}
.sp-x {
  position: sticky; top: 10px; float: right; z-index: 1;
  margin: 10px -10px 0 0;
  width: 28px; height: 28px;
  background: #1b2230; color: #9fb3c8;
  border: 1px solid #2b3a49; border-radius: 5px;
  font-size: 18px; line-height: 1; cursor: pointer;
}
.sp-x:hover { background: #24304180; color: #e6edf3; }
.sp-logo { display: block; width: 100%; height: auto; margin: 18px 0 14px; }
.sp h2 { font-size: 17px; color: #e6edf3; margin: 0 0 4px; font-weight: 600; }
.sp-motto { margin: 0 0 8px; color: #7f93a8; font-style: italic; }
.sp-stat { margin: 0 0 18px; color: #4fb0ff; font-weight: 600; }
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
