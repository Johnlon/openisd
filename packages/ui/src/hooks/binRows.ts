/** The Bin's rows, as both shells show them. */
import type {BinnedProject} from '@openisd/persistence';
import {formatByteSize, formatDateTime} from '@openisd/design/fields';

/** One project in the Bin, as the Bin list shows it. */
export interface BinRow {
  readonly id: string;
  readonly name: string;
  /** When it was binned, as "14 Oct 2026, 13:20". */
  readonly binnedAt: string;
  /** The device that binned it. */
  readonly device: string;
  readonly size: string;
}

export function binRows(binned: readonly BinnedProject[]): BinRow[] {
  return binned.map(p => ({
    id: p.id,
    name: p.name,
    binnedAt: formatDateTime(new Date(p.binnedAt_ms)),
    device: p.device,
    size: formatByteSize(p.bytes),
  }));
}

/** The Bin's total size, for its Empty Bin button. */
export function binTotalSize(binned: readonly BinnedProject[]): string {
  return formatByteSize(binned.reduce((sum, p) => sum + p.bytes, 0));
}
