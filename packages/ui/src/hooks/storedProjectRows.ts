/** The Open project list's rows — desktop's dialog and mobile's sheet show the same rows. */
import type {StoredProjectListing} from '@openisd/persistence';
import {formatDateTime} from '@openisd/design/fields';

/** One saved project in the Open project list. */
export interface StoredProjectRow {
  readonly id: string;
  readonly name: string;
  /** When it was last saved, as "5 Oct 2026, 23:32". */
  readonly modified: string;
  /** "Tang Band W5-1138SMF · Vented · 12.0 L"; empty for a record that would not read. */
  readonly summary: string;
}

/** `listings` as rows, each volume in the unit `unitTokens` holds for the box volume. */
export function storedProjectRows(listings: readonly StoredProjectListing[], unitTokens: Readonly<Record<string, string>>): StoredProjectRow[] {
  return listings.map(listing => ({
    id: listing.id,
    name: listing.name,
    modified: formatDateTime(new Date(listing.modified)),
    summary: listing.kind === 'readable' ? listing.summary.line(unitTokens) : '',
  }));
}
