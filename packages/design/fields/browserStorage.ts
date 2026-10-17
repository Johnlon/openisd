/** What the app says about the browser's storage: whether the browser keeps OpenISD's data, and
 *  how full storage is. Both skins and Diagnostics show these words. */
import {formatByteSize, formatCount, formatCountOf} from './format.js';

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

/** What OpenISD holds in this browser: how many projects, and the bytes of its local store. */
export interface StoredUse {
  readonly projectCount: number;
  readonly localBytes: number;
}

/** "12 projects, 1.4 MB of 5 MB used": every storage notice and warning carries it. */
export function storageUseLine(use: StoredUse): string {
  const limit = `${formatCount(LOCAL_STORE_LIMIT_BYTES / (1024 * 1024))} MB`;
  return `${formatCountOf(use.projectCount, 'project')}, ${formatByteSize(use.localBytes)} of ${limit} used`;
}

/** The Diagnostics line: "Persistent storage: granted"; "asking" before the browser answers. */
export function persistenceLine(outcome: PersistOutcome | null): string {
  return `Persistent storage: ${outcome ?? 'asking'}`;
}

/** The warning when the browser may clear OpenISD's data; null when it keeps it, or has not answered. */
export function persistenceWarning(outcome: PersistOutcome | null, use: StoredUse): string | null {
  if (outcome !== 'refused' && outcome !== 'unsupported') return null;
  return `Nothing is wrong now (${storageUseLine(use)}): this browser could clear OpenISD's data only if your disk gets nearly full. `
    + `OpenISD warns you when its storage is ${Math.round(STORAGE_FULL_FROM * 100)}% full (usage is in Options, Your data); `
    + 'to be safe, use Chrome, turn on Google Drive sync, or export your projects.';
}

/** The startup banner: the warning, until the user dismisses it in this browser. */
export function persistenceBanner(outcome: PersistOutcome | null, dismissed: boolean, use: StoredUse): string | null {
  return dismissed ? null : persistenceWarning(outcome, use);
}

/** "This site uses 1.2 MB of the 2.3 GB this browser allows."; null when the browser cannot say. */
export function siteStorageLine(estimate: StorageEstimate | null): string | null {
  if (estimate === null || estimate.quota <= 0) return null;
  return `This site uses ${formatByteSize(estimate.usage)} of the ${formatByteSize(estimate.quota)} this browser allows.`;
}

/** "Storage is 86% full (40 projects, 4.3 MB of 5 MB used). Export or delete old projects." when
 *  the local store or the site's whole allowance is at least STORAGE_FULL_FROM full, else null. */
export function storageFullWarning(use: StoredUse, estimate: StorageEstimate | null): string | null {
  const local = use.localBytes / LOCAL_STORE_LIMIT_BYTES;
  const site = estimate === null || estimate.quota <= 0 ? 0 : estimate.usage / estimate.quota;
  const full = Math.max(local, site);
  if (full < STORAGE_FULL_FROM) return null;
  return `Storage is ${Math.min(100, Math.floor(full * 100))}% full (${storageUseLine(use)}). Export or delete old projects.`;
}

/** The flash once per browser tab at startup: "12 projects, 1.4 MB of 5 MB used."; null when no
 *  project is stored. */
export function startupNotice(use: StoredUse): string | null {
  return use.projectCount === 0 ? null : `${storageUseLine(use)}.`;
}

/** The flash after Save all: "Saved 2 projects. 12 projects, 1.4 MB of 5 MB used.", or the
 *  storageFullWarning in place of the usage line when the local store is nearly full. */
export function savedNotice(savedCount: number, use: StoredUse): string {
  if (savedCount === 0) return 'Nothing to save';
  const usage = storageFullWarning(use, null) ?? `${storageUseLine(use)}.`;
  return `Saved ${formatCountOf(savedCount, 'project')}. ${usage}`;
}
