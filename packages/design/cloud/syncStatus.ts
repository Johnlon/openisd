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
  | { readonly kind: 'pending'; readonly account: string; readonly at_ms: number | null; readonly changes: number }
  | { readonly kind: 'offline'; readonly account: string; readonly at_ms: number | null; readonly changes: number }
  | { readonly kind: 'reconnect'; readonly account: string; readonly changes: number }
  | { readonly kind: 'held'; readonly account: string; readonly at_ms: number | null; readonly heldDocs: number }
  | { readonly kind: 'refused'; readonly account: string; readonly reason: 'noRoom' | 'bucketUnreadable' }
  | { readonly kind: 'failed'; readonly account: string; readonly reason: string };

export interface ConflictCopy {
  readonly id: ProjectId | DriverId | PrId;
  readonly name: string;
  readonly from: DeviceId;
  readonly at_ms: number;
}
