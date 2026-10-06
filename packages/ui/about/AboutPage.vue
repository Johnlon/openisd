<script setup lang="ts">
/**
 * The public about page, https://openisd.app/about/ — the splash's words (`SplashContent`) under
 * a header that leads to the app. It is its own page, not part of the app: it boots no engine and
 * reads no project, only the two catalogue indexes for the counts the splash also states.
 */
import {onMounted, ref} from 'vue';
import SplashContent from '../src/ui/components/SplashContent.vue';
import {INSTALL_URL, REPO_URL, SITE_URL} from '../src/ui/siteLinks.js';

const driverCount = ref<number | null>(null);
const passiveRadiatorCount = ref<number | null>(null);

/** An index is a JSON array; its length is the count. A failed fetch leaves the count unstated. */
async function indexLength(url: string): Promise<number | null> {
  try {
    const body: unknown = await (await fetch(url)).json();
    return Array.isArray(body) ? body.length : null;
  } catch {
    return null;
  }
}

onMounted(async () => {
  driverCount.value = await indexLength('/drivers-index.json');
  passiveRadiatorCount.value = await indexLength('/passive-radiators-index.json');
});
</script>

<template>
  <main class="about">
    <img class="about-logo" src="/logo-wide.svg" alt="OpenISD — open loudspeaker enclosure simulator">
    <p class="about-cta">
      <a class="about-open" :href="SITE_URL">Open OpenISD</a>
      <a class="about-secondary" :href="INSTALL_URL">Add it as an app</a>
      <a class="about-secondary" :href="REPO_URL">Source on GitHub</a>
    </p>
    <SplashContent :driver-count="driverCount" :passive-radiator-count="passiveRadiatorCount" />
    <p class="about-cta about-cta-end">
      <a class="about-open" :href="SITE_URL">Start designing</a>
    </p>
  </main>
</template>

<style scoped>
.about {
  box-sizing: border-box;
  max-width: 780px; margin: 0 auto; padding: 8px 20px 48px;
  background: #11151c; min-height: 100vh;
  font-family: Inter, system-ui, sans-serif;
}
.about-logo { display: block; width: 100%; height: auto; margin: 18px 0 14px; }
.about-cta { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 0 0 20px; }
.about-cta-end { justify-content: flex-end; margin: 24px 0 0; }
.about-open {
  background: #4fb0ff; color: #08121c; border-radius: 5px; padding: 9px 20px;
  font-size: 14px; font-weight: 600; text-decoration: none;
}
.about-open:hover { background: #6cbcff; }
.about-secondary { color: #4fb0ff; font-size: 13px; }
</style>
