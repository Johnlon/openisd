/** The Open project list's rows — desktop's dialog and mobile's sheet show the same rows. */
import type {BinnedProject, StoredProjectListing} from '@openisd/persistence';
import {formatByteSize, formatDateTime} from '@openisd/design/fields';

/** One saved project in the Open project list. */
export interface StoredProjectRow {
  readonly id: string;
  readonly name: string;
  /** When it was last saved, as "2026-10-05 23:32". */
  readonly modified: string;
  readonly modifiedMs: number;
  /** "Tang Band W5-1138SMF · Vented · 12.0 L"; empty for a record that would not read. */
  readonly summary: string;
}

/** `listings` as rows, each volume in the unit `unitTokens` holds for the box volume. */
export function storedProjectRows(listings: readonly StoredProjectListing[], unitTokens: Readonly<Record<string, string>>): StoredProjectRow[] {
  return listings.map(listing => ({
    id: listing.id,
    name: listing.name,
    modified: formatDateTime(new Date(listing.modified)),
    modifiedMs: new Date(listing.modified).getTime(),
    summary: listing.kind === 'readable' ? listing.summary.line(unitTokens) : '',
  }));
}

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
