<script setup lang="ts">
import {nextTick, ref, watch} from 'vue';
import {injectFeedbackDialog} from '../../hooks/FeedbackDialog-hooks.js';

const dialog = injectFeedbackDialog();
const {open, phone, phase, faces, chosen, heading, statusText, comment, commentSent, commentStatusText, texts} = dialog;
/** The drawn mouth of each face, in the order `faces` lists them: sad, flat, smiling. */
const sheet = ref<HTMLElement | null>(null);
// Focus the dialog when it opens so Escape closes it.
watch(open, async isOpen => { if (isOpen) { await nextTick(); sheet.value?.focus(); } });
const MOUTHS: readonly string[] = ['M12 31 Q20 24 28 31', 'M13 29 L27 29', 'M12 27 Q20 35 28 27'];
</script>

<template>
  <div v-if="open" class="fb-backdrop" :class="{'fb-phone': phone}" data-testid="feedback-backdrop" @click.self="dialog.dismiss()" @keydown.esc="dialog.dismiss()">
    <section ref="sheet" class="fb-modal" role="dialog" aria-modal="true" aria-labelledby="fb-title" tabindex="-1" data-testid="feedback-dialog">
      <header class="fb-head">
        <h2 id="fb-title" data-testid="feedback-heading">{{ heading }}</h2>
        <button type="button" class="fb-close" :aria-label="texts.close" data-testid="feedback-close" @click="dialog.dismiss()">&times;</button>
      </header>
      <div class="fb-body">
        <div class="fb-faces" role="group" aria-label="Your answer">
          <button v-for="(face, i) in faces" :key="face.value" type="button" class="fb-face"
            :class="{chosen: chosen === face.value}" :disabled="chosen !== null" :aria-pressed="chosen === face.value"
            :data-testid="'feedback-face-' + face.value" @click="dialog.pickFace(face)">
            <svg viewBox="0 0 40 40" class="fb-svg" aria-hidden="true">
              <circle cx="20" cy="20" r="17" fill="#ffd45e" stroke="#7a5b00" stroke-width="2" />
              <circle cx="14" cy="16" r="2" fill="#4a3600" /><circle cx="26" cy="16" r="2" fill="#4a3600" />
              <path :d="MOUTHS[i]" fill="none" stroke="#4a3600" stroke-width="2.2" stroke-linecap="round" />
            </svg>
            <span class="fb-face-label">{{ face.label }}</span>
          </button>
        </div>
        <p v-if="statusText !== ''" class="fb-status" role="status" data-testid="feedback-status">{{ statusText }}</p>
        <template v-if="phase === 'comment' && !commentSent">
          <label class="fb-prompt" for="fb-comment">{{ texts.commentPrompt }}</label>
          <textarea id="fb-comment" v-model="comment" class="fb-text" rows="3" maxlength="1000" :placeholder="texts.commentPlaceholder" data-testid="feedback-comment"></textarea>
        </template>
        <p v-if="commentStatusText !== ''" class="fb-status" role="status" data-testid="feedback-comment-status">{{ commentStatusText }}</p>
        <p class="fb-privacy">{{ texts.privacy }}</p>
      </div>
      <footer class="fb-actions">
        <button v-if="phase === 'face'" type="button" class="fb-secondary" data-testid="feedback-not-now" @click="dialog.dismiss()">{{ texts.notNow }}</button>
        <template v-else-if="!commentSent">
          <button type="button" class="fb-secondary" data-testid="feedback-done" @click="dialog.dismiss()">{{ texts.close }}</button>
          <button type="button" class="fb-primary" data-testid="feedback-send-comment" @click="dialog.sendComment()">{{ texts.sendComment }}</button>
        </template>
        <button v-else type="button" class="fb-primary" data-testid="feedback-done" @click="dialog.dismiss()">{{ texts.close }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.fb-backdrop{position:fixed;inset:0;z-index:230;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.5)}
.fb-modal{box-sizing:border-box;width:min(460px,100%);max-height:calc(100dvh - 40px);overflow:auto;border:1px solid #bcc7c5;border-radius:12px;background:#f8f9f8;color:#202725;box-shadow:0 16px 48px rgba(0,0,0,.3)}
.fb-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#e3e9e7;border-bottom:1px solid #c7cfcd}
.fb-head h2{margin:0;font-size:1.2rem}
.fb-close{flex:none;width:44px;height:44px;border:0;border-radius:8px;background:transparent;color:#35413e;font-size:28px;cursor:pointer}
.fb-body{padding:16px;display:flex;flex-direction:column;gap:12px}
.fb-faces{display:flex;justify-content:center;gap:14px}
.fb-face{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:84px;padding:8px 6px;border:2px solid transparent;border-radius:12px;background:transparent;color:#202725;font:inherit;cursor:pointer}
.fb-face:hover:not(:disabled){background:#e8f0fb}
.fb-face:disabled{cursor:default}
.fb-face:disabled:not(.chosen){opacity:.45}
.fb-face.chosen{border-color:#1769c2;background:#e1edfb}
.fb-svg{width:56px;height:56px}
.fb-face-label{font-size:.85rem;text-align:center}
.fb-status{margin:0;padding:8px 10px;border:1px solid #9fcfa8;border-radius:6px;background:#e1f3e4;color:#17421f;text-align:center}
.fb-prompt{font-weight:600}
.fb-text{box-sizing:border-box;width:100%;resize:vertical;padding:8px;border:1px solid #9aa6a3;border-radius:6px;font:inherit}
.fb-privacy{margin:0;color:#59625f;font-size:.8rem}
.fb-actions{display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;border-top:1px solid #d1d8d6}
.fb-actions button{min-height:44px;padding:8px 18px;border-radius:8px;font:inherit;font-weight:600;cursor:pointer}
.fb-primary{border:1px solid #1769c2;background:#1769c2;color:#fff}
.fb-secondary{border:1px solid #9aa6a3;background:#fff;color:#202725}
.fb-phone{align-items:flex-end;padding:0}
.fb-phone .fb-modal{width:100%;max-height:calc(100dvh - 16px);border-radius:16px 16px 0 0}
.fb-phone .fb-face{min-width:92px;padding:10px 4px}
.fb-phone .fb-svg{width:68px;height:68px}
.fb-phone .fb-faces{gap:6px}
.fb-phone .fb-actions button{flex:1;min-height:52px}
</style>
