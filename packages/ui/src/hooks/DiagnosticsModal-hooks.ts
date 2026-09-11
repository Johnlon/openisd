import type { InjectionKey, Ref } from 'vue';
import { ref } from 'vue';
import { useApp } from '../logic/app.js';
import type { QuickFix } from '../diagnostics/faultLog.js';

export interface DiagnosticsModalAPI {
  readonly open: Ref<boolean>;
  readonly outcome: Ref<string | null>;
  readonly copied: Ref<boolean>;
  readonly faultLog: ReturnType<typeof useApp>['faultLog'];
  applyFix(fix: QuickFix): void;
  reload(): void;
  copyReport(): Promise<void>;
}

export const DiagnosticsModalKey: InjectionKey<DiagnosticsModalAPI> = Symbol('DiagnosticsModalAPI');

export function useDiagnosticsModal(): DiagnosticsModalAPI {
  const { faultLog } = useApp();
  const open = ref(false);
  const outcome = ref<string | null>(null);
  const copied = ref(false);

  faultLog.onFault(() => {
    open.value = true;
  });

  function applyFix(fix: QuickFix): void {
    try {
      outcome.value = `${fix.apply()} Reload to continue.`;
    } catch (e) {
      outcome.value = `That repair failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  function reload(): void {
    location.reload();
  }

  async function copyReport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(faultLog.report());
      copied.value = true;
    } catch {
      outcome.value = faultLog.report();
    }
  }

  return {
    open,
    outcome,
    copied,
    faultLog,
    applyFix,
    reload,
    copyReport,
  };
}
