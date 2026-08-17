<script setup lang="ts">
/**
 * The fault dialog — what broke, and the smallest repair that fixes it.
 *
 * Raised automatically on the first fault, because a runtime failure that only reaches the
 * console is a failure the user experiences as "the panel is blank" with nothing to act on.
 *
 * Repairs are listed LEAST DESTRUCTIVE FIRST and each states what it keeps and what it loses
 * before it is clicked. Nothing here clears the whole store to make an error go away — an
 * unexpected app state is still the user's work, and wiping it also destroys the evidence
 * needed to fix the cause.
 */
import { ref, computed } from 'vue';
import { useApp } from '../../logic/app.js';
import type { QuickFix } from '../../diagnostics/faultLog.js';

const { faultLog } = useApp();

const open = ref(false);
const outcome = ref<string | null>(null);
const copied = ref(false);

faultLog.onFault(() => { open.value = true; });

const fixes = computed<QuickFix[]>(() => faultLog.applicable());
const faults = computed(() => faultLog.faults);

function applyFix(fix: QuickFix): void {
  try {
    outcome.value = `${fix.apply()} Reload to continue.`;
  } catch (e) {
    outcome.value = `That repair failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function reload(): void { location.reload(); }

async function copyReport(): Promise<void> {
  try {
    await navigator.clipboard.writeText(faultLog.report());
    copied.value = true;
  } catch {
    // Clipboard can be denied. The report still has to be obtainable, so put it where it can
    // be selected by hand rather than silently doing nothing.
    outcome.value = faultLog.report();
  }
}
</script>

<template>
  <div v-if="open" class="dg-backdrop">
    <div class="dg" role="alertdialog" aria-labelledby="dg-title">
      <header>
        <h2 id="dg-title">Something went wrong</h2>
        <button class="dg-x" title="Dismiss — the app stays as it is" @click="open = false">&times;</button>
      </header>

      <section class="dg-faults">
        <div v-for="f in faults" :key="f.id" class="dg-fault">
          <div class="dg-msg">
            <span class="dg-kind">{{ f.kind }}</span>
            {{ f.message }}
            <span v-if="f.count > 1" class="dg-count">×{{ f.count }}</span>
          </div>
          <pre v-if="f.stack" class="dg-stack">{{ f.stack.split('\n').slice(0, 5).join('\n') }}</pre>
        </div>
      </section>

      <section v-if="fixes.length" class="dg-fixes">
        <h3>Repairs — least damaging first</h3>
        <div v-for="fix in fixes" :key="fix.id" class="dg-fix">
          <div class="dg-fix-head">
            <strong>{{ fix.title }}</strong>
            <button @click="applyFix(fix)">Apply</button>
          </div>
          <div class="dg-keeps">Keeps: {{ fix.keeps }}</div>
          <div v-if="fix.loses" class="dg-loses">Loses: {{ fix.loses }}</div>
          <div v-else class="dg-keeps">Loses: nothing</div>
        </div>
      </section>
      <p v-else class="dg-nofix">
        No stored-state repair applies — this fault is in the running code, not in your saved
        data. Copy the report below.
      </p>

      <p v-if="outcome" class="dg-outcome">{{ outcome }}</p>

      <footer>
        <button @click="copyReport">{{ copied ? 'Copied' : 'Copy diagnostics' }}</button>
        <button @click="reload">Reload</button>
        <button @click="open = false">Dismiss</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.dg-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
}
.dg {
  background: var(--panel, #fff); color: var(--fg, #111);
  border: 1px solid var(--border, #999); border-radius: 6px;
  width: min(720px, 92vw); max-height: 86vh; overflow: auto;
  padding: 1rem 1.25rem; font-size: 13px;
}
.dg header { display: flex; align-items: baseline; justify-content: space-between; }
.dg h2 { font-size: 15px; margin: 0 0 .5rem; }
.dg h3 { font-size: 13px; margin: 1rem 0 .35rem; }
.dg-x { border: 0; background: none; font-size: 20px; cursor: pointer; color: inherit; }
.dg-fault { margin-bottom: .5rem; }
.dg-kind {
  font-size: 11px; text-transform: uppercase; opacity: .7;
  border: 1px solid currentColor; border-radius: 3px; padding: 0 .3em; margin-right: .4em;
}
.dg-msg { font-family: ui-monospace, monospace; }
.dg-count { opacity: .7; margin-left: .4em; }
.dg-stack {
  font-size: 11px; opacity: .75; margin: .25rem 0 0; white-space: pre-wrap;
  max-height: 7em; overflow: auto;
}
.dg-fix { border: 1px solid var(--border, #ccc); border-radius: 4px; padding: .5rem .6rem; margin-bottom: .4rem; }
.dg-fix-head { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
.dg-keeps { opacity: .8; }
.dg-loses { color: var(--warn, #b45309); }
.dg-nofix { opacity: .85; }
.dg-outcome { border-left: 3px solid var(--accent, #2563eb); padding-left: .6rem; white-space: pre-wrap; }
.dg footer { display: flex; gap: .5rem; margin-top: .9rem; }
</style>
