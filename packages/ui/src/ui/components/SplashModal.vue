<script setup lang="ts">
/**
 * The splash dialog — raised once for a visitor whose stored view is empty, and on demand from
 * the toolbar's Info menu. The words are `SplashContent`'s, shared with the public about page.
 */
import {computed} from 'vue';
import {useApp} from '../../logic/app.js';
import {injectSplashModal} from '../../hooks/SplashModal-hooks.js';
import {injectAppUpdateUi} from '../../hooks/appUpdateUi.js';
import {AboutText, APP_UPDATE_TEXT} from '@openisd/design/fields';
import SplashContent from './SplashContent.vue';

const {open, dismiss, driverCount, passiveRadiatorCount, versions} = injectSplashModal();
const {forceRefresh} = injectAppUpdateUi();
const presentation = useApp().presentation;
const phone = computed(() => presentation.shownSkin() === 'mobile');
</script>

<template>
  <div v-if="open" class="sp-backdrop" @click.self="dismiss">
    <div class="sp" role="dialog" aria-labelledby="sp-title">
      <!-- The text runs past one screen, so the footer button is a scroll away — this one is
           reachable the moment the splash appears. -->
      <button class="sp-x" title="Close" aria-label="Close" @click="dismiss">&times;</button>
      <img class="sp-logo" src="/logo-wide.svg" alt="OpenISD — open loudspeaker enclosure simulator">

      <!-- The phone's About opens with the version and the change log (PHONE_CLASSIC_BUILD_SPEC row 21). -->
      <p v-if="phone && versions !== null && versions.running !== null" class="sp-version-line" data-testid="about-version-line">
        {{ AboutText.versionLine(versions.running.version, versions.running.stamp) }} ·
        <a :href="AboutText.CHANGE_LOG_URL" target="_blank" rel="noopener">{{ AboutText.CHANGE_LOG_LABEL }}</a>
      </p>

      <SplashContent :driver-count="driverCount" :passive-radiator-count="passiveRadiatorCount" />

      <section class="sp-versions">
        <h3>Version</h3>
        <template v-if="versions !== null && versions.running !== null">
          <p class="sp-heading" data-testid="running-heading">{{ versions.running.heading }}</p>
          <p class="sp-stamp" data-testid="running-stamp">{{ versions.running.stamp }}</p>
        </template>
        <button type="button" class="sp-refresh-btn" data-testid="force-refresh" @click="forceRefresh">{{ APP_UPDATE_TEXT.forceRefresh }}</button>
        <p class="sp-refresh-note">{{ APP_UPDATE_TEXT.forceRefreshNote }}</p>
      </section>

      <footer>
        <button class="sp-go" @click="dismiss">Start designing</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.sp-refresh-btn { min-height: 32px; padding: 0 14px; border: 1px solid #4fb0ff; border-radius: 4px; background: none; color: #4fb0ff; font: inherit; cursor: pointer; }
.sp-refresh-btn:hover { background: #1b2a3a; }
.sp-refresh-note { margin: 6px 0 0; font-size: 12px; color: #8a9bab; }
@media (max-width: 700px) { .sp-refresh-btn { min-height: 44px; } }
.sp-version-line { margin: -6px 0 18px; font-size: 14px; color: #8a96a3; }
.sp-version-line a { color: #4aa3ff; }
.sp-versions h3 { font-size: 13px; color: #4fb0ff; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.sp-heading { margin: 0; font-size: 17px; font-weight: 600; color: #e6edf3; }
.sp-stamp { margin: 0 0 6px; font-size: 11px; color: #8a9bab; }
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
