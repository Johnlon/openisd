/** What the app says about the browser's storage: whether the browser keeps OpenISD's data, and
 *  how full storage is. Both skins and Diagnostics show these words. */
import {formatByteSize} from './format.js';

/** What the browser answered when asked to keep OpenISD's data: `granted`, it will not clear it to
 *  free space; `refused`, it may; `unsupported`, it cannot be asked. */
export type PersistOutcome = 'granted' | 'refused' | 'unsupported';

/** How much the browser holds for this site, and how much it allows. */
export interface StorageEstimate {
  readonly usage: number;
  readonly quota: number;
}

/** What browsers let one site keep in local storage, where OpenISD saves: about 5 MB. */
export const LOCAL_STORE_LIMIT_BYTES = 5 * 1024 * 1024;

/** Storage counts as nearly full from this share of a limit. */
export const STORAGE_FULL_FROM = 0.8;

/** The Diagnostics line: "Persistent storage: granted"; "asking" before the browser answers. */
export function persistenceLine(outcome: PersistOutcome | null): string {
  return `Persistent storage: ${outcome ?? 'asking'}`;
}

const PERSIST_WARNING = 'Nothing is wrong now: this browser could clear OpenISD\'s data only if your disk gets nearly full. '
  + `OpenISD warns you when its storage is ${Math.round(STORAGE_FULL_FROM * 100)}% full (usage is in Options, Your data); `
  + 'to be safe, use Chrome, turn on Google Drive sync, or export your projects.';

/** The warning when the browser may clear OpenISD's data; null when it keeps it, or has not answered. */
export function persistenceWarning(outcome: PersistOutcome | null): string | null {
  return outcome === 'refused' || outcome === 'unsupported' ? PERSIST_WARNING : null;
}

/** The startup banner: the warning, until the user dismisses it in this browser. */
export function persistenceBanner(outcome: PersistOutcome | null, dismissed: boolean): string | null {
  return dismissed ? null : persistenceWarning(outcome);
}

/** "This site uses 1.2 MB of the 2.3 GB this browser allows."; null when the browser cannot say. */
export function siteStorageLine(estimate: StorageEstimate | null): string | null {
  if (estimate === null || estimate.quota <= 0) return null;
  return `This site uses ${formatByteSize(estimate.usage)} of the ${formatByteSize(estimate.quota)} this browser allows.`;
}

/** "Storage is 86% full. Export or delete old projects." when the local store or the site's whole
 *  allowance is at least STORAGE_FULL_FROM full, else null. */
export function storageFullWarning(localBytes: number, estimate: StorageEstimate | null): string | null {
  const local = localBytes / LOCAL_STORE_LIMIT_BYTES;
  const site = estimate === null || estimate.quota <= 0 ? 0 : estimate.usage / estimate.quota;
  const full = Math.max(local, site);
  if (full < STORAGE_FULL_FROM) return null;
  return `Storage is ${Math.min(100, Math.floor(full * 100))}% full. Export or delete old projects.`;
}
