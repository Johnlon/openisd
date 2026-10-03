import {describe, expect, it, vi} from 'vitest';
import {defineComponent, h, provide} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {APP_LOGIC} from '../../src/logic/app.js';
import {createFaultLog, type QuickFix, type SaveBackup} from '../../src/diagnostics/faultLog.js';
import {useDiagnosticsModal, type DiagnosticsModalAPI} from '../../src/hooks/DiagnosticsModal-hooks.js';
import {testAppLogic} from './testAppLogic.js';
import {
  type KeyValueStorage, type StoreName, createStoredDataFault, isStoredDataFault, createAppSettingsRepo, createMemoryStorage, createViewStateRepo,
} from '@openisd/persistence';

async function renderHook(
  saveBackup: SaveBackup = () => undefined, storage: KeyValueStorage = createMemoryStorage(),
): Promise<DiagnosticsModalAPI> {
  const faultLog = createFaultLog(saveBackup, () => ({
    view: createViewStateRepo(storage), appSettings: createAppSettingsRepo(storage),
  }), (thrown) => isStoredDataFault(thrown) ? thrown.store : null);
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
      provide(APP_LOGIC, testAppLogic({ faultLog }));
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
      id: 'fix-1', store: 'view',
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
      id: 'fix-err', store: 'view',
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

  describe('the repair ladder', () => {
    const EVERYTHING = {
      openisd_view: '{"ui":{}}',
      openisd_app_settings: '{"env":1}',
      openisd_projects: '{"designs":1}',
      openisd_open_sessions: '{"open":1}',
      openisd_state: '{"project":1}',
      openisd_my_drivers: '{"drivers":1}',
    };

    /** Raise stored-data faults for `stores` the way a loader does: through the installed handler. */
    function raiseStoredDataFaults(api: DiagnosticsModalAPI, ...stores: StoreName[]): void {
      let onError: (e: unknown) => void = () => undefined;
      vi.stubGlobal('window', {addEventListener: (type: string, fn: (e: unknown) => void) => { if (type === 'error') onError = fn; }});
      try {
        api.faultLog.install();
        for (const store of stores) onError({message: `${store} unreadable`, error: createStoredDataFault(store, `${store} unreadable`)});
      } finally {
        vi.unstubAllGlobals();
      }
    }

    it('offers only the view and app-settings resets: nothing that loses a design or a driver', async () => {
      const api = await renderHook(() => undefined, createMemoryStorage(EVERYTHING));
      raiseStoredDataFaults(api, 'view', 'options');
      expect(api.faultLog.applicable().map(f => f.id)).toEqual(['reset-view', 'reset-app-settings']);
    });

    it('saves a backup of what a repair deletes before deleting it, and touches nothing else', async () => {
      const storage = createMemoryStorage(EVERYTHING);
      const saveBackup = vi.fn<SaveBackup>(() => {
        expect(storage.get('openisd_view')).not.toBeNull(); // still there while the backup is written
      });
      const api = await renderHook(saveBackup, storage);
      raiseStoredDataFaults(api, 'view');
      const resetView = api.faultLog.applicable().find(f => f.id === 'reset-view');
      expect(resetView).toBeDefined();
      if (resetView) api.applyFix(resetView);
      expect(saveBackup).toHaveBeenCalledWith('openisd_view.backup.json', '{"ui":{}}');
      expect(storage.get('openisd_view')).toBeNull();
      for (const key of ['openisd_app_settings', 'openisd_my_drivers', 'openisd_open_sessions', 'openisd_projects', 'openisd_state']) {
        expect(storage.get(key)).not.toBeNull();
      }
    });
  });

  describe('a project repaired while loading', () => {
    const REPORT = {
      projectName: 'mine',
      repaired: [['saved', 'box', 'portVelocityLimit_m_per_s']],
      backupKey: 'openisd_open_sessions_backup',
    } as const;

    it('opens the dialog and lists the project and the fields that were reset', async () => {
      const api = await renderHook();
      api.faultLog.recordRepair(REPORT);
      expect(api.open.value).toBe(true);
      expect(api.faultLog.repairs).toEqual([{projectName: 'mine', fields: ['saved.box.portVelocityLimit_m_per_s'], backupKey: REPORT.backupKey}]);
    });

    it('Download the original hands the backed-up text to the backup writer', async () => {
      const saveBackup = vi.fn<SaveBackup>();
      vi.stubGlobal('localStorage', {getItem: (k: string) => k === REPORT.backupKey ? 'the original' : null});
      try {
        const api = await renderHook(saveBackup);
        api.faultLog.recordRepair(REPORT);
        api.downloadOriginal(api.faultLog.repairs[0]);
        expect(saveBackup).toHaveBeenCalledWith('openisd_open_sessions_backup.json', 'the original');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
