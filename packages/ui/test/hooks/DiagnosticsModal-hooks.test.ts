import {describe, expect, it, vi} from 'vitest';
import {defineComponent, h, provide} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {APP_LOGIC, type AppLogic} from '../../src/logic/app.js';
import {createFaultLog, type QuickFix} from '../../src/diagnostics/faultLog.js';
import {useDiagnosticsModal, type DiagnosticsModalAPI} from '../../src/hooks/DiagnosticsModal-hooks.js';

async function renderHook(): Promise<DiagnosticsModalAPI> {
  const faultLog = createFaultLog();
  let api!: DiagnosticsModalAPI;
  const Child = defineComponent({
    setup() {
      api = useDiagnosticsModal();
      return () => null;
    },
    render() { return h('div'); },
  });

  const Parent = defineComponent({
    setup() {
      provide(APP_LOGIC, { faultLog } as unknown as AppLogic);
      return () => h(Child);
    },
  });

  await renderToString(h(Parent));
  return api;
}

describe('useDiagnosticsModal', () => {
  it('opens modal when a fault occurs', async () => {
    const api = await renderHook();
    expect(api.open.value).toBe(false);

    // `install()` hooks window error events and `console.error` — node has no window, and the
    // console hook must not outlive this test.
    const originalConsoleError = console.error;
    vi.stubGlobal('window', { addEventListener: () => undefined });
    try {
      api.faultLog.install();
      console.error('Test fault');
      expect(api.open.value).toBe(true);
    } finally {
      console.error = originalConsoleError;
      vi.unstubAllGlobals();
    }
  });

  it('applies quick fix and updates outcome message on success', async () => {
    const api = await renderHook();
    const mockFix: QuickFix = {
      id: 'fix-1',
      title: 'Test repair',
      impact: 1,
      keeps: 'all',
      loses: 'none',
      probe: () => true,
      apply: () => 'Reset successful.',
    };
    api.applyFix(mockFix);
    expect(api.outcome.value).toBe('Reset successful. Reload to continue.');
  });

  it('catches and reports quick fix failure in outcome', async () => {
    const api = await renderHook();
    const failingFix: QuickFix = {
      id: 'fix-err',
      title: 'Failing repair',
      impact: 1,
      keeps: 'all',
      loses: 'none',
      probe: () => true,
      apply: () => {
        throw new Error('Database locked');
      },
    };
    api.applyFix(failingFix);
    expect(api.outcome.value).toBe('That repair failed: Database locked');
  });
});
