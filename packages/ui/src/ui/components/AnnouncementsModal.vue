<script setup lang="ts">
import {computed} from 'vue';
import {useAnnouncementCenter} from '../../hooks/Announcements-hooks.js';
import {injectSplashModal} from '../../hooks/SplashModal-hooks.js';

const center = useAnnouncementCenter();
const splash = injectSplashModal();
const visible = computed(() => center.open.value && !splash.open.value);
const current = center.latest;
</script>

<template>
  <div v-if="visible" class="ann-backdrop" @click.self="center.view.value === 'latest' ? center.dismissLatest() : center.closeList()">
    <section class="ann-modal" role="dialog" aria-modal="true" aria-labelledby="ann-title">
      <header class="ann-head">
        <div>
          <h2 id="ann-title">{{ center.view.value === 'list' ? 'OpenISD announcements' : "What's new" }}</h2>
          <p v-if="center.view.value === 'list'">All announcements remain here after you dismiss them.</p>
        </div>
        <button type="button" class="ann-close" aria-label="Close announcements"
          @click="center.view.value === 'latest' ? center.dismissLatest() : center.closeList()">&times;</button>
      </header>

      <main v-if="center.view.value === 'latest' && current" class="ann-body">
        <p class="ann-version">OpenISD {{ current.version }} &middot; {{ current.published }}</p>
        <h3>{{ current.title }}</h3>
        <p class="ann-summary">{{ current.summary }}</p>
        <ul><li v-for="line in current.body" :key="line">{{ line }}</li></ul>
        <a class="ann-review-link" href="https://openisd-announcements-test.john-lonergan-0e9.workers.dev/?site=test" target="_blank" rel="noopener">Review all announcements</a>
      </main>

      <main v-else class="ann-body ann-list">
        <article v-for="item in center.items.value" :key="item.id" class="ann-item">
          <p class="ann-version">OpenISD {{ item.version }} &middot; {{ item.published }}</p>
          <h3>{{ item.title }}</h3>
          <p class="ann-summary">{{ item.summary }}</p>
          <ul><li v-for="line in item.body" :key="line">{{ line }}</li></ul>
        </article>
        <p v-if="center.items.value.length === 0">No announcements yet. Check back here for OpenISD news.</p>
      </main>

      <footer v-if="center.view.value === 'latest'" class="ann-actions">
        <button type="button" class="ann-secondary" @click="center.showList()">All announcements</button>
        <button type="button" class="ann-primary" @click="center.dismissLatest()">Dismiss</button>
      </footer>
      <footer v-else class="ann-actions ann-list-actions">
        <button type="button" class="ann-primary" @click="center.closeList()">Close</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.ann-backdrop{position:fixed;inset:0;z-index:230;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.58)}
.ann-modal{box-sizing:border-box;width:min(560px,100%);max-height:min(720px,calc(100dvh - 40px));overflow:auto;border:1px solid #bcc7c5;border-radius:12px;background:#f8f9f8;color:#202725;box-shadow:0 16px 48px rgba(0,0,0,.3)}
.ann-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;background:#e3e9e7;border-bottom:1px solid #c7cfcd}
.ann-head h2{margin:0;font-size:1.25rem}.ann-head p{margin:4px 0 0;color:#59625f}
.ann-close{flex:none;width:40px;height:40px;border:0;border-radius:8px;background:transparent;color:#35413e;font-size:28px;cursor:pointer}
.ann-close:hover{background:#d4ddda}
.ann-body{padding:20px;overflow-wrap:anywhere}.ann-version{margin:0 0 8px;color:#68726f;font-size:.9rem}
.ann-body h3{margin:0 0 10px;font-size:1.25rem;color:#202725}.ann-summary{margin:0 0 12px}
.ann-body ul{padding-left:22px;margin:10px 0 16px}.ann-body li{margin:8px 0}
.ann-review-link{color:#1769c2;text-decoration:underline}
.ann-item{padding:0 0 16px;margin:0 0 18px;border-bottom:1px solid #d7dddb}.ann-item:last-child{border-bottom:0;margin-bottom:0}
.ann-actions{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #d1d8d6}
.ann-actions button{min-height:44px;padding:8px 16px;border-radius:8px;font:inherit;font-weight:600;cursor:pointer}
.ann-primary{border:1px solid #1769c2;background:#1769c2;color:white}.ann-secondary{border:1px solid #1769c2;background:white;color:#1769c2}
.ann-list-actions{position:sticky;bottom:0;background:#f8f9f8}
@media(max-width:600px){.ann-modal{max-height:calc(100dvh - 24px)}.ann-head{padding:14px 16px}.ann-body{padding:16px}.ann-actions{padding:12px 16px}.ann-actions button{flex:1}}
</style>
