import type {CloudFault} from './cloudTypes.js';
import {type KeptKind, keptBothText, keptKindWord} from './syncActivity.js';
export class DeviceId {
  private declare readonly brand: 'DeviceId';
  private constructor(readonly text: string) {}
  static of(s: string): DeviceId | null {
    const t = s.trim();
    return t === '' ? null : new DeviceId(t);
  }
  equals(o: DeviceId): boolean {
    return o.text === this.text;
  }
}

export class ProjectId {
  private declare readonly brand: 'ProjectId';
  private constructor(readonly text: string) {}
  static of(s: string): ProjectId | null {
    const t = s.trim();
    return t === '' ? null : new ProjectId(t);
  }
  equals(o: ProjectId): boolean {
    return o.text === this.text;
  }
}

export class DriverId {
  private declare readonly brand: 'DriverId';
  private constructor(readonly text: string) {}
  static of(s: string): DriverId | null {
    const t = s.trim();
    return t === '' ? null : new DriverId(t);
  }
  equals(o: DriverId): boolean {
    return o.text === this.text;
  }
}

export class PrId {
  private declare readonly brand: 'PrId';
  private constructor(readonly text: string) {}
  static of(s: string): PrId | null {
    const t = s.trim();
    return t === '' ? null : new PrId(t);
  }
  equals(o: PrId): boolean {
    return o.text === this.text;
  }
}

export type SyncStatus =
  | { readonly kind: 'off' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'syncing'; readonly account: string }
  | { readonly kind: 'synced'; readonly account: string; readonly at_ms: number; readonly conflicts: number }
  | { readonly kind: 'pending'; readonly account: string; readonly at_ms: number | null; readonly changes: number; readonly nextAt_ms: number | null }
  | { readonly kind: 'offline'; readonly account: string; readonly at_ms: number | null; readonly changes: number }
  | { readonly kind: 'reconnect'; readonly account: string; readonly changes: number }
  | { readonly kind: 'held'; readonly account: string; readonly at_ms: number | null; readonly heldDocs: number }
  | { readonly kind: 'refused'; readonly account: string; readonly reason: 'noRoom' | 'bucketUnreadable' }
  | { readonly kind: 'failed'; readonly account: string; readonly fault: CloudFault; readonly retryAt_ms: number | null };

export interface ConflictCopy {
  /** The kept copy: this device's version, saved under a new id. */
  readonly id: ProjectId | DriverId | PrId;
  /** The kept copy's name, with the conflict mark. */
  readonly name: string;
  /** The item's own name, which the other device's version keeps. */
  readonly item: string;
  /** The device whose version kept the item's place; '' when Drive did not say. */
  readonly otherDevice: string;
  readonly from: DeviceId;
  readonly at_ms: number;
}

/** The kind of item a conflict copy is. */
export function conflictKind(id: ConflictCopy['id']): KeptKind {
  if (id instanceof ProjectId) return 'project';
  if (id instanceof DriverId) return 'driver';
  return 'pr';
}

/** "Driver", "Passive radiator" or "Project": the kind of item a conflict copy is. */
export function conflictKindWord(id: ConflictCopy['id']): string {
  return keptKindWord(conflictKind(id));
}

/** 'Driver "W5-1138SMF" kept both: yours and the copy from iPhone' */
export function conflictKeptText(c: ConflictCopy): string {
  return keptBothText(conflictKind(c.id), c.item, c.otherDevice);
}
