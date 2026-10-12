<script setup lang="ts">
/**
 * The splash dialog — raised once for a visitor whose stored view is empty, and on demand from
 * the toolbar's Info menu. The words are `SplashContent`'s, shared with the public about page.
 */
import {injectSplashModal} from '../../hooks/SplashModal-hooks.js';
import SplashContent from './SplashContent.vue';

const {open, dismiss, driverCount, passiveRadiatorCount, versions} = injectSplashModal();
</script>

<template>
  <div v-if="open" class="sp-backdrop" @click.self="dismiss">
    <div class="sp" role="dialog" aria-labelledby="sp-title">
      <!-- The text runs past one screen, so the footer button is a scroll away — this one is
           reachable the moment the splash appears. -->
      <button class="sp-x" title="Close" aria-label="Close" @click="dismiss">&times;</button>
      <img class="sp-logo" src="/logo-wide.svg" alt="OpenISD — open loudspeaker enclosure simulator">

      <SplashContent :driver-count="driverCount" :passive-radiator-count="passiveRadiatorCount" />

      <section v-if="versions !== null && versions.rows.length > 0" class="sp-versions">
        <h3>Versions</h3>
        <p v-if="versions.staleNotice" class="sp-stale">{{ versions.staleNotice }}</p>
        <ul>
          <li v-for="row in versions.rows" :key="row.stamp" :class="{'sp-current': row.current}">
            <span class="sp-ver-date">{{ row.date }}</span>
            <span v-if="row.kind === 'snap'" class="sp-ver-tag">Snapshot</span>
            <span v-if="row.current" class="sp-ver-tag sp-ver-here">This build</span>
            <template v-if="row.hostedPath !== null">
              <a :href="row.hostedPath">Open</a>
              <a v-if="row.githubUrl !== null" :href="row.githubUrl" target="_blank" rel="noopener">GitHub</a>
            </template>
          </li>
        </ul>
      </section>

      <footer>
        <button class="sp-go" @click="dismiss">Start designing</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.sp-versions h3 { font-size: 13px; color: #4fb0ff; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.sp-versions ul { list-style: none; margin: 0; padding: 0; }
.sp-versions li { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; padding: 4px 6px; border-radius: 4px; }
.sp-versions li.sp-current { background: #1b2a3a; }
.sp-versions a { color: #4fb0ff; }
.sp-ver-date { min-width: 150px; color: #e6edf3; }
.sp-ver-tag { font-size: 11px; color: #7f93a8; border: 1px solid #2b3a49; border-radius: 3px; padding: 0 5px; }
.sp-ver-here { color: #4fb0ff; border-color: #4fb0ff; }
.sp-stale { color: #e0b050; margin: 0 0 6px; }
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
.sp footer { margin-top: 22px; display: flex; justify-content: flex-end; }
.sp-go {
  background: #4fb0ff; color: #08121c; border: 0; border-radius: 5px;
  padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer;
}
.sp-go:hover { background: #6cbcff; }
</style>
