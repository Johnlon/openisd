<script setup lang="ts">
/**
 * What OpenISD is, who it credits, and where the project lives — the words of the splash.
 *
 * One body, two homes: the splash dialog in the app and the public about page both render this
 * component, so the two can never say different things. Every claim has a page behind it: the
 * goals, the feature list and the WinISD comparison link out to the repository documents that
 * own them.
 */
import {computed} from 'vue';
import {formatCount} from '@openisd/design/fields';
import {INSTALL_URL, REPO_URL} from '../siteLinks.js';

const props = defineProps<{
  /** Bundled drivers, or null when the catalogue has not answered — a count not stated is a sentence not printed. */
  driverCount: number | null;
  passiveRadiatorCount: number | null;
}>();

const libraryLine = computed(() => {
  const parts: string[] = [];
  if (props.driverCount !== null) parts.push(`${formatCount(props.driverCount)} drivers`);
  if (props.passiveRadiatorCount !== null) parts.push(`${formatCount(props.passiveRadiatorCount)} passive radiators`);
  return parts.length === 0 ? '' : `${parts.join(' and ')} are bundled with the app, ready to load.`;
});
</script>

<template>
  <div class="sp-body">
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
      <p>
        Bigger tools exist and do more. WinISD is simple, familiar and trusted — so OpenISD
        takes it as the golden source, and is not afraid to improve on it where it is wrong.
      </p>
    </section>

    <section>
      <h3>Desktop and mobile versions</h3>
      <p>
        There are two versions of the app, one made for the desktop and one made for the phone.
        Each is laid out for its own screen, and the app picks the right one for yours.
        Like WinISD, both work offline once you have opened the app, so there is nothing you have
        to install.
      </p>
      <p>
        If you would like it in your Start menu, dock or home screen like any other app,
        <a :href="INSTALL_URL" target="_blank" rel="noopener">here is how to add it as an app</a>.
      </p>
    </section>

    <section>
      <h3>Goals</h3>
      <ul>
        <li><strong>Match WinISD, then go past it</strong> — the same numbers by default, so a WinISD user can trust the move.</li>
        <li><strong>No install, no licence, no platform</strong> — a browser is the whole requirement, on a desktop or a phone, and it works offline.</li>
        <li><strong>Checked, in public</strong> — every model is tested against the closed-form maths, in CI, on every commit.</li>
        <li><strong>Community-owned</strong> — MIT licensed, open repository, open backlog. It has to survive its author losing interest.</li>
        <li><strong>Open data</strong> — a shared driver library anyone can contribute a spec sheet to.<template v-if="driverCount !== null"> It holds {{ formatCount(driverCount) }} drivers today.</template></li>
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
        why: <a :href="`${REPO_URL}/blob/main/OPENISD_WINISD_GAPS_AND_BUGS.md`" target="_blank" rel="noopener">WinISD gaps and bugs</a>.
      </p>
    </section>

    <section>
      <h3>Built in the open</h3>
      <p>
        <a :href="REPO_URL" target="_blank" rel="noopener">github.com/Johnlon/openisd</a>
        — issues, pull requests and the backlog are public.
        The
        <a :href="`${REPO_URL}/blob/main/ARCHITECTURE.md`" target="_blank" rel="noopener">architecture specification</a>
        sets the rules the code is held to.
      </p>
      <p><strong>I am looking for a band of the willing.</strong> Ideas, feedback and pull requests all welcome.</p>
    </section>
  </div>
</template>

<style scoped>
.sp-body { font-size: 13px; line-height: 1.55; color: #c7d3df; }
.sp-body h2 { font-size: 17px; color: #e6edf3; margin: 0 0 4px; font-weight: 600; }
.sp-motto { margin: 0 0 8px; color: #7f93a8; font-style: italic; }
.sp-stat { margin: 0 0 18px; color: #4fb0ff; font-weight: 600; }
.sp-body h3 { font-size: 13px; color: #4fb0ff; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.sp-body p { margin: 0 0 8px; }
.sp-body ul { margin: 0; padding-left: 18px; }
.sp-body li { margin-bottom: 5px; }
.sp-body strong { color: #e6edf3; font-weight: 600; }
.sp-body code { background: #1b2230; padding: 0 4px; border-radius: 3px; }
.sp-body a { color: #4fb0ff; }
</style>
