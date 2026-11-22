import {
  type CloudUiState,
  DEFAULT_CLOUD_UI_STATE,
  parseCloudUiState,
} from '@openisd/design/cloud';

export interface CloudUiStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface CloudUiStore {
  read(): CloudUiState;
  write(state: CloudUiState): void;
  recordLaunch(): number;
  dismissHint(): void;
  setConflictsSeen(count: number): void;
}

export const OPENISD_CLOUD_UI_KEY = 'openisd_cloud_ui';

export function createCloudUiStore(storage: CloudUiStorage): CloudUiStore {
  return {
    read(): CloudUiState {
      try {
        return parseCloudUiState(storage.get(OPENISD_CLOUD_UI_KEY));
      } catch {
        return DEFAULT_CLOUD_UI_STATE;
      }
    },
    write(state: CloudUiState): void {
      try {
        storage.set(OPENISD_CLOUD_UI_KEY, JSON.stringify(state));
      } catch {
        /* storage full or unavailable */
      }
    },
    recordLaunch(): number {
      const current = this.read();
      const updated: CloudUiState = {
        ...current,
        launches: current.launches + 1,
      };
      this.write(updated);
      return updated.launches;
    },
    dismissHint(): void {
      const current = this.read();
      this.write({
        ...current,
        hintDismissed: true,
      });
    },
    setConflictsSeen(count: number): void {
      const current = this.read();
      this.write({
        ...current,
        conflictsSeen: Math.max(0, Math.floor(count)),
      });
    },
  };
}
