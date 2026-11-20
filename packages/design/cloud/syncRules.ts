import type { BodyHash, DocId, RevisionId } from './syncDoc.js';
import type { CloudMeta } from './cloudTypes.js';

export type SyncRuleAction =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'adopt'; readonly remote: CloudMeta }
  | { readonly kind: 'applyRemote'; readonly remote: CloudMeta }
  | { readonly kind: 'removeLocal' }
  | { readonly kind: 'conflict'; readonly remote: CloudMeta }
  | { readonly kind: 'pushCreate' }
  | { readonly kind: 'pushUpdate'; readonly expectedRevision: RevisionId }
  | { readonly kind: 'pushTombstone'; readonly expectedRevision: RevisionId }
  | { readonly kind: 'dropLedger' }
  | { readonly kind: 'held'; readonly remote: CloudMeta };

export interface LocalDocState {
  readonly hash: BodyHash;
  readonly layout: number;
}

export interface LedgerRowState {
  readonly hash: BodyHash;
  readonly revision: RevisionId;
  readonly seq: number;
}

export interface DecideSyncInputs {
  readonly id: DocId;
  readonly local: LocalDocState | null;
  readonly ledger: LedgerRowState | null;
  readonly remote: CloudMeta | null;
  readonly appLayout: number;
  readonly deviceId: string;
  readonly prospectiveSeq?: number;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function shouldPurgeTombstone(
  meta: CloudMeta,
  hasLocalRef: boolean,
  now_ms: number
): boolean {
  if (!meta.deleted || hasLocalRef) {
    return false;
  }
  if ('tombstonedAt_ms' in meta && typeof meta.tombstonedAt_ms === 'number') {
    return now_ms - meta.tombstonedAt_ms >= NINETY_DAYS_MS;
  }
  if ('modifiedTime_ms' in meta && typeof meta.modifiedTime_ms === 'number') {
    return now_ms - meta.modifiedTime_ms >= NINETY_DAYS_MS;
  }
  return false;
}

export function compareLamport(
  remote: { readonly seq: number; readonly writer: string },
  local: { readonly seq: number; readonly writer: string }
): 'remote' | 'local' {
  if (remote.seq > local.seq) return 'remote';
  if (local.seq > remote.seq) return 'local';
  return remote.writer > local.writer ? 'remote' : 'local';
}

/** Docs where one version wins outright (Lamport) instead of keeping both: the singletons, and a
 *  Bin mark, which two devices may write for one project and which has nothing to keep twice. */
function oneVersionWins(id: DocId): boolean {
  return id.kind === 'settings' || id.kind === 'favourites' || id.kind === 'projectBin';
}

/** A doc where one version wins (`oneVersionWins`): the remote when it is later in Lamport order than this device's
 *  version stamped `seq`, else this device's version, pushed over the remote's revision. */
function lamportWinner(remote: CloudMeta, seq: number, deviceId: string): SyncRuleAction {
  if (compareLamport(remote, { seq, writer: deviceId }) === 'remote') {
    return { kind: 'applyRemote', remote };
  }
  return { kind: 'pushUpdate', expectedRevision: remote.revision };
}

export function decideDocSync(inputs: DecideSyncInputs): SyncRuleAction {
  const { id, local, ledger, remote, appLayout, deviceId, prospectiveSeq } = inputs;

  // 1. Remote layout > app layout is held (section 5.3 row 14)
  if (remote !== null && remote.layout > appLayout) {
    return { kind: 'held', remote };
  }

  // 2. Pre-condition: equal-hash adoption rule (section 5.1 & 5.3)
  if (local !== null && remote !== null && !remote.deleted) {
    if (remote.remoteHash !== null && remote.remoteHash.toString() === local.hash.toString()) {
      if (ledger !== null && ledger.revision.toString() === remote.revision.toString()) {
        return { kind: 'nothing' };
      }
      return { kind: 'adopt', remote };
    }
  }

  // 3. Classify Local & Remote presence
  const isLocalPresent = local !== null;
  const hasLedger = ledger !== null;

  if (remote === null) {
    if (isLocalPresent) {
      // local new or user cleared Drive: push as create
      return { kind: 'pushCreate' };
    }
    // local absent
    if (hasLedger) {
      return { kind: 'dropLedger' };
    }
    return { kind: 'nothing' };
  }

  if (remote.deleted) {
    if (!isLocalPresent) {
      if (hasLedger) {
        // delete + delete -> drop ledger
        return { kind: 'dropLedger' };
      }
      return { kind: 'nothing' };
    }
    // local is present
    if (hasLedger && local.hash.toString() === ledger.hash.toString()) {
      // clean + delete -> remove local
      return { kind: 'removeLocal' };
    }
    // edit + delete -> edit wins: push update (undeletes)
    return { kind: 'pushUpdate', expectedRevision: remote.revision };
  }

  // Remote is present and not deleted
  if (!hasLedger) {
    if (isLocalPresent) {
      // new + present (no ledger)
      if (oneVersionWins(id)) return lamportWinner(remote, prospectiveSeq !== undefined ? prospectiveSeq : 1, deviceId);
      // multi-doc: keep both
      return { kind: 'conflict', remote };
    }
    // absent + new -> apply
    return { kind: 'applyRemote', remote };
  }

  // Ledger exists, remote is present and not deleted
  const isRemoteUnchanged = remote.revision.toString() === ledger.revision.toString();
  const isLineageOk =
    remote.parentRevision !== null &&
    remote.parentRevision.toString() === ledger.revision.toString();

  if (!isLocalPresent) {
    // local delete
    if (isRemoteUnchanged) {
      // delete + unchanged -> push tombstone
      return { kind: 'pushTombstone', expectedRevision: ledger.revision };
    }
    // delete + edit -> edit wins: apply remote
    return { kind: 'applyRemote', remote };
  }

  // Both local and remote are present with ledger
  const isLocalClean = local.hash.toString() === ledger.hash.toString();

  if (isLocalClean) {
    if (isRemoteUnchanged) {
      return { kind: 'nothing' };
    }
    if (isLineageOk) {
      return { kind: 'applyRemote', remote };
    }
    // lineage broken
    if (oneVersionWins(id)) {
      return { kind: 'applyRemote', remote };
    }
    return { kind: 'conflict', remote };
  }

  // local is edit
  if (isRemoteUnchanged) {
    return { kind: 'pushUpdate', expectedRevision: ledger.revision };
  }

  // local edit + remote edit (lineage ok or broken)
  if (oneVersionWins(id)) return lamportWinner(remote, prospectiveSeq !== undefined ? prospectiveSeq : ledger.seq + 1, deviceId);

  return { kind: 'conflict', remote };
}
