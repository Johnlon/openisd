import type {InjectionKey, Ref} from 'vue';
import {inject, provide, ref} from 'vue';
import {useApp} from '../logic/app.js';
import type {QuickFix, RepairNotice} from '../diagnostics/faultLog.js';

export interface DiagnosticsModalAPI {
  readonly open: Ref<boolean>;
  readonly outcome: Ref<string | null>;
  readonly copied: Ref<boolean>;
  readonly faultLog: ReturnType<typeof useApp>['faultLog'];
  show(): void;
  close(): void;
  applyFix(fix: QuickFix): void;
  downloadOriginal(notice: RepairNotice): void;
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
  faultLog.onRepair(() => {
    open.value = true;
  });
  // A repair recorded during boot, before this dialog existed, is shown as soon as it mounts.
  if (faultLog.repairs.length > 0) open.value = true;

  function show(): void {
    open.value = true;
  }

  function close(): void {
    open.value = false;
  }

  function downloadOriginal(notice: RepairNotice): void {
    outcome.value = faultLog.downloadOriginal(notice)
      ? `Saved the original of "${notice.projectName}" as a file.`
      : `No stored original is kept for "${notice.projectName}": it is still in the file or link it came from.`;
  }

  function applyFix(fix: QuickFix): void {
    try {
      outcome.value = `${faultLog.repair(fix)} Reload to continue.`;
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
    show,
    close,
    applyFix,
    downloadOriginal,
    reload,
    copyReport,
  };
}

export function provideDiagnosticsModal(): DiagnosticsModalAPI {
  const api = useDiagnosticsModal();
  provide(DiagnosticsModalKey, api);
  return api;
}

export function injectDiagnosticsModal(): DiagnosticsModalAPI {
  const api = inject(DiagnosticsModalKey);
  if (!api) throw new Error('DiagnosticsModal: no provider — App.vue must call provideDiagnosticsModal()');
  return api;
}
