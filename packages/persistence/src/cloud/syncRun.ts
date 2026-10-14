import type {RoomShortfall} from '../repos/storageBackup.js';
import type { CloudFault, ConflictCopy } from '@openisd/design/cloud';

export type RunOutcome =
  | {
      readonly kind: 'synced';
      readonly pulled: number;
      readonly pushed: number;
      readonly conflicts: readonly ConflictCopy[];
      /** The items this run kept twice. */
      readonly keptBoth: readonly ConflictCopy[];
      readonly held: number;
      /** Local changes still not on Drive after the run. */
      readonly left: number;
      /** Duplicate Drive copies of a doc deleted by this run (the newest copy stays). */
      readonly removedDuplicates: number;
      /** Drive files of a kind this build does not know, left alone. */
      readonly skippedNewer: number;
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
      readonly reason: 'noRoom';
      /** What the backup taken first saw when it did not fit. */
      readonly shortfall: RoomShortfall;
      readonly pendingLocal: number;
    }
  | {
      readonly kind: 'refused';
      readonly reason: 'bucketUnreadable';
      readonly pendingLocal: number;
    }
  | {
      readonly kind: 'failed';
      readonly fault: CloudFault;
      readonly pendingLocal: number;
    };

export interface SyncEngine {
  run(): Promise<RunOutcome>;
  pendingLocal(): number;
}

/** What a run says while it runs: that it started, and each push as it lands. */
export interface SyncProgress {
  started(): void;
  pushed(count: number): void;
}
