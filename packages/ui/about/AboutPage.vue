<script setup lang="ts">
/**
 * The public about page, https://openisd.app/about/ — the splash's words (`SplashContent`) under
 * a header that leads to the app. It is its own page, not part of the app: it boots no engine and
 * reads no project, only the two catalogue indexes for the counts the splash also states.
 */
import {onMounted, ref} from 'vue';
import SplashContent from '../src/ui/components/SplashContent.vue';
import {INSTALL_URL, REPO_URL, SITE_URL} from '../src/ui/siteLinks.js';

/** One level up from about/: the site root of whichever copy serves this page. A bound value, so the build leaves it alone. */
const LOGO_URL = '../logo-wide.svg';
const driverCount = ref<number | null>(null);
const passiveRadiatorCount = ref<number | null>(null);

/** The catalogue file is one object holding both index arrays; a failed fetch leaves the counts unstated. */
async function catalogueCounts(): Promise<{drivers: number; passiveRadiators: number} | null> {
  try {
    const body: unknown = await (await fetch('../catalogue.json')).json();
    if (typeof body !== 'object' || body === null || !('driverRows' in body) || !('passiveRadiatorRows' in body)) return null;
    const {driverRows, passiveRadiatorRows} = body;
    return Array.isArray(driverRows) && Array.isArray(passiveRadiatorRows)
      ? {drivers: driverRows.length, passiveRadiators: passiveRadiatorRows.length}
      : null;
  } catch {
    return null;
  }
}

onMounted(async () => {
  const counts = await catalogueCounts();
  driverCount.value = counts?.drivers ?? null;
  passiveRadiatorCount.value = counts?.passiveRadiators ?? null;
});
</script>

<template>
  <main class="about">
    <img class="about-logo" :src="LOGO_URL" alt="OpenISD — open loudspeaker enclosure simulator">
    <p class="about-cta">
      <a class="about-open" :href="SITE_URL">Open OpenISD</a>
      <a class="about-secondary" :href="INSTALL_URL">Add it as an app</a>
      <a class="about-secondary" :href="REPO_URL">Source on GitHub</a>
    </p>
    <SplashContent :driver-count="driverCount" :passive-radiator-count="passiveRadiatorCount" />
    <section id="privacy" class="about-privacy">
      <h3>Privacy</h3>
      <p>
        OpenISD is a free, open-source loudspeaker design app that runs in your web browser. It keeps
        your projects and drivers in your browser, on your own device.
      </p>
      <p>
        Cloud sync is off until you turn it on. When on, it copies your saved projects, drivers,
        passive radiators, favourites and Options to a hidden folder in your own Google Drive that
        only OpenISD can open. OpenISD can see no other file in your Drive. No OpenISD server sees
        your files, and they are not shared or sold. Disconnect stops it.
      </p>
      <p>
        The app does send anonymous usage counts (launches with device type and screen size, which
        charts and features are used, box types opened and saved, which catalogue drivers are picked,
        and errors) to a stats collector. They carry no project data, no account and no raw address.
        An error also carries which screen and dialog were open, how many projects were open, the box
        type, the names of your last few actions, the app version and the device type; never project
        data or values.
        An error report you choose to send also carries the note and contact you type.
      </p>
      <p>
        The app sends an anonymous random id with each usage event so we can count returning users.
        It is not linked to you or your Google account.
      </p>
      <p>Questions: <a :href="`${REPO_URL}/issues`">open an issue on GitHub</a>.</p>
    </section>
    <section id="terms" class="about-terms">
      <h3>Terms</h3>
      <p>
        OpenISD is free to use, as it is, with no warranty. Driver data in the library is collected from makers' and sellers' pages and may be wrong, out of date or mis-read. It is a design aid: check every driver value and any build against the maker's own datasheet before you cut wood. Your projects and drivers are yours and stay on your device or in your own Google Drive. The source is under the <a :href="`${REPO_URL}/blob/main/LICENSE`">MIT licence</a>. We may change or stop the service at any time.
      </p>
    </section>
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
.about-privacy { font-size: 13px; line-height: 1.55; color: #c7d3df; }
.about-privacy h3 { font-size: 13px; color: #4fb0ff; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.about-privacy p { margin: 0 0 8px; }
.about-privacy a { color: #4fb0ff; }
.about-terms { font-size: 13px; line-height: 1.55; color: #c7d3df; }
.about-terms h3 { font-size: 13px; color: #4fb0ff; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.about-terms p { margin: 0 0 8px; }
.about-terms a { color: #4fb0ff; }
</style>
