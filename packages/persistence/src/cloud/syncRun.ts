import type { ConflictCopy } from '@openisd/design/cloud';

export type RunOutcome =
  | {
      readonly kind: 'synced';
      readonly pulled: number;
      readonly pushed: number;
      readonly conflicts: readonly ConflictCopy[];
      readonly held: number;
    }
  | {
      readonly kind: 'stopped';
      readonly reason: 'offline' | 'quota';
      readonly pushedSoFar: number;
      readonly pendingLocal: number;
    }
  | { readonly kind: 'notConnected' }
  | { readonly kind: 'reconnect'; readonly pendingLocal: number }
  | {
      readonly kind: 'refused';
      readonly reason: 'noRoom' | 'bucketUnreadable';
      readonly pendingLocal: number;
    }
  | {
      readonly kind: 'failed';
      readonly reason: string;
      readonly pendingLocal: number;
    };

export interface SyncEngine {
  run(): Promise<RunOutcome>;
  pendingLocal(): number;
}
