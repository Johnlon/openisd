<script setup lang="ts">
import {nextTick, ref, watch} from 'vue';
import {injectFeedbackDialog} from '../../hooks/FeedbackDialog-hooks.js';

const dialog = injectFeedbackDialog();
const {open, phone, phase, faces, chosen, heading, statusText, comment, commentSent, texts} = dialog;
/** The drawn mouth of each face, in the order `faces` lists them: sad, flat, smiling. */
const sheet = ref<HTMLElement | null>(null);
// Focus the dialog when it opens so Escape closes it.
watch(open, async isOpen => { if (isOpen) { await nextTick(); sheet.value?.focus(); } });
</script>

<template>
  <div v-if="open" class="fb-backdrop" :class="{'fb-phone': phone}" data-testid="feedback-backdrop" @click.self="dialog.dismiss()" @keydown.esc="dialog.dismiss()">
    <section ref="sheet" class="fb-modal" role="dialog" aria-modal="true" aria-labelledby="fb-title" tabindex="-1" data-testid="feedback-dialog">
      <header class="fb-head">
        <h2 id="fb-title"><span v-if="phase === 'comment'" class="fb-tick" aria-hidden="true">&#10003;</span><span data-testid="feedback-heading">{{ heading }}</span></h2>
        <button type="button" class="fb-close" :aria-label="texts.close" data-testid="feedback-close" @click="dialog.dismiss()">&times;</button>
      </header>
      <div class="fb-body">
        <div class="fb-faces" role="group" aria-label="Your answer">
          <button v-for="face in faces" :key="face.value" type="button" class="fb-face"
            :class="['tone-' + face.tone, {chosen: chosen === face.value}]" :disabled="chosen !== null" :aria-pressed="chosen === face.value"
            :data-testid="'feedback-face-' + face.value" @click="dialog.pickFace(face, $event)">
            <svg viewBox="0 0 40 40" class="fb-svg" aria-hidden="true">
              <circle class="fb-disc" cx="20" cy="20" r="17.5" />
              <circle class="fb-eye" cx="14.5" cy="16" r="2.1" /><circle class="fb-eye" cx="25.5" cy="16" r="2.1" />
              <path class="fb-mouth" :d="face.mouth" />
            </svg>
            <span class="fb-face-label">{{ face.label }}</span>
          </button>
        </div>
        <p v-if="statusText !== ''" class="fb-status" role="status" data-testid="feedback-status">{{ statusText }}</p>
        <template v-if="phase === 'comment' && !commentSent">
          <label class="fb-prompt" for="fb-comment">{{ texts.commentPrompt }}</label>
          <textarea id="fb-comment" v-model="comment" class="fb-text" rows="3" maxlength="1000" :placeholder="texts.commentPlaceholder" data-testid="feedback-comment"></textarea>
        </template>
        <p class="fb-privacy">{{ texts.privacy }}</p>
      </div>
      <footer class="fb-actions">
        <button v-if="phase === 'face'" type="button" class="fb-secondary" data-testid="feedback-not-now" @click="dialog.dismiss()">{{ texts.notNow }}</button>
        <template v-else-if="!commentSent">
          <button type="button" class="fb-secondary" data-testid="feedback-done" @click="dialog.dismiss()">{{ texts.close }}</button>
          <button type="button" class="fb-primary" data-testid="feedback-send-comment" @click="dialog.sendComment($event)">{{ texts.sendComment }}</button>
        </template>
        <button v-else type="button" class="fb-primary" data-testid="feedback-done" @click="dialog.dismiss()">{{ texts.close }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
/* Colours and the font are the app's own (--bg, --panel, --line, --fg, --mut, --acc, --good, --bad, --acc2, --font-ui). */
.fb-backdrop{position:fixed;inset:0;z-index:230;display:flex;align-items:center;justify-content:center;padding:20px;background:color-mix(in srgb,var(--fg) 55%,transparent);font-family:var(--font-ui)}
.fb-modal{box-sizing:border-box;width:min(460px,100%);max-height:calc(100dvh - 40px);overflow:auto;border:1px solid var(--line);border-radius:16px;background:var(--panel);color:var(--fg);box-shadow:0 18px 50px color-mix(in srgb,var(--fg) 35%,transparent);outline:none;animation:fb-in .18s ease-out}
.fb-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px 4px}
.fb-head h2{margin:0;font-size:1.35rem;display:flex;align-items:center;gap:10px}
.fb-tick{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--good);color:var(--panel);font-size:1rem;animation:fb-pop .3s ease-out}
.fb-close{flex:none;width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--mut);font-size:28px;line-height:1;cursor:pointer}
.fb-close:hover{background:var(--panel2)}
.fb-body{padding:8px 20px 12px;display:flex;flex-direction:column;gap:16px}
.fb-faces{display:flex;justify-content:center;gap:18px;padding:8px 0}
.fb-face{--tone:var(--acc);display:flex;flex-direction:column;align-items:center;gap:8px;min-width:92px;padding:12px 8px 10px;border:2px solid transparent;border-radius:16px;background:transparent;color:var(--fg);font:inherit;cursor:pointer;transition:transform .15s ease,background-color .15s ease,border-color .15s ease,opacity .15s ease}
.fb-face.tone-bad{--tone:var(--bad)}
.fb-face.tone-mid{--tone:var(--acc2)}
.fb-face.tone-good{--tone:var(--good)}
.fb-face:hover:not(:disabled),.fb-face:focus-visible:not(:disabled){transform:scale(1.1);background:color-mix(in srgb,var(--tone) 12%,var(--panel));border-color:color-mix(in srgb,var(--tone) 45%,transparent);outline:none}
.fb-face:active:not(:disabled){transform:scale(.96)}
.fb-face:disabled{cursor:default}
.fb-face:disabled:not(.chosen){opacity:.4}
.fb-face.chosen{transform:scale(1.1);border-color:var(--tone);background:color-mix(in srgb,var(--tone) 16%,var(--panel))}
.fb-svg{width:60px;height:60px}
.fb-disc{fill:color-mix(in srgb,var(--tone) 22%,var(--panel));stroke:var(--tone);stroke-width:2}
.fb-eye{fill:var(--tone)}
.fb-mouth{fill:none;stroke:var(--tone);stroke-width:2.4;stroke-linecap:round}
.fb-face-label{font-size:.9rem;text-align:center;font-weight:600}
.fb-status{margin:0;padding:10px 12px;border:1px solid color-mix(in srgb,var(--good) 40%,var(--line));border-radius:10px;background:color-mix(in srgb,var(--good) 10%,var(--panel));color:var(--fg);text-align:center;font-weight:600;animation:fb-in .2s ease-out}
.fb-prompt{font-weight:600}
.fb-text{box-sizing:border-box;width:100%;resize:vertical;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg);font:inherit}
.fb-text:focus{outline:2px solid var(--acc);outline-offset:1px}
.fb-privacy{margin:0;color:var(--mut);font-size:.8rem}
.fb-actions{display:flex;justify-content:flex-end;gap:10px;padding:12px 20px 18px}
.fb-actions button{min-height:46px;padding:8px 22px;border-radius:12px;font:inherit;font-weight:600;cursor:pointer}
.fb-primary{border:1px solid var(--acc);background:var(--acc);color:var(--panel)}
.fb-secondary{border:1px solid var(--line);background:var(--panel2);color:var(--fg)}
.fb-phone{align-items:flex-end;padding:0}
.fb-phone .fb-modal{width:100%;max-height:calc(100dvh - 12px);border-radius:20px 20px 0 0;animation:fb-up .22s ease-out}
.fb-phone .fb-faces{gap:4px}
.fb-phone .fb-face{min-width:96px;padding:14px 4px 12px}
.fb-phone .fb-svg{width:72px;height:72px}
.fb-phone .fb-actions button{flex:1;min-height:54px}
@keyframes fb-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes fb-up{from{transform:translateY(40px);opacity:.6}to{transform:none;opacity:1}}
@keyframes fb-pop{0%{transform:scale(.4)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
@media(prefers-reduced-motion:reduce){.fb-modal,.fb-status,.fb-tick,.fb-phone .fb-modal{animation:none}.fb-face{transition:none}.fb-face:hover:not(:disabled),.fb-face.chosen{transform:none}}
</style>
