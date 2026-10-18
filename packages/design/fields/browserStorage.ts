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

/** "This site uses 1.2 MB of the 2.3 GB this browser allows."; null when the browser cannot say. */
export function siteStorageLine(estimate: StorageEstimate | null): string | null {
  if (estimate === null || estimate.quota <= 0) return null;
  return `This site uses ${formatByteSize(estimate.usage)} of the ${formatByteSize(estimate.quota)} this browser allows.`;
}

/** "Storage is 86% full (40 projects, 4.3 MB of 5 MB used). Export or delete old projects." when
 *  the local store or the site's whole allowance is at least STORAGE_FULL_FROM full, else null. */
export function storageFullWarning(use: StoredUse, estimate: StorageEstimate | null): string | null {
  const percent = storageFullPercent(use, estimate);
  return percent === null ? null : `Storage is ${percent}% full (${storageUseLine(use)}). Export or delete old projects.`;
}

/** How full storage is, in whole percent (at most 100), when it is at least STORAGE_FULL_FROM full:
 *  the local store or the site's whole allowance, whichever is fuller. Else null. */
function storageFullPercent(use: StoredUse, estimate: StorageEstimate | null): number | null {
  const local = use.localBytes / LOCAL_STORE_LIMIT_BYTES;
  const site = estimate === null || estimate.quota <= 0 ? 0 : estimate.usage / estimate.quota;
  const full = Math.max(local, site);
  return full < STORAGE_FULL_FROM ? null : Math.min(100, Math.floor(full * 100));
}

/** The browsers OpenISD names to the user; `This browser` when the user agent says none of them. */
export type BrowserName = 'Edge' | 'Opera' | 'Samsung Internet' | 'Firefox' | 'Chrome' | 'Safari' | 'This browser';

/** The browser that sent this user agent. Order matters: Edge, Opera and Samsung Internet also say
 *  Chrome, and everything says Safari. */
export function browserNameOf(userAgent: string): BrowserName {
  if (/\bEdg(e|A|iOS)?\//.test(userAgent)) return 'Edge';
  if (/\bOPR\/|\bOPT\/|\bOpera\b/.test(userAgent)) return 'Opera';
  if (userAgent.includes('SamsungBrowser/')) return 'Samsung Internet';
  if (/\b(Firefox|FxiOS)\//.test(userAgent)) return 'Firefox';
  if (/(Chrome|CriOS)\//.test(userAgent)) return 'Chrome';
  if (userAgent.includes('Safari/')) return 'Safari';
  return 'This browser';
}

/** What the startup popup holds: nothing to say; the browser cannot promise to keep the data (the
 *  `condition` names which, so closing it is remembered for that case only); or storage is nearly
 *  full. The UI shows `title` and `message` and nothing else. */
export type StoragePopup =
  | {readonly kind: 'none'}
  | {readonly kind: 'risk'; readonly condition: string; readonly title: string; readonly message: string}
  | {readonly kind: 'nearlyFull'; readonly title: string; readonly message: string};

/** What the app observed at startup. `acknowledgedRisk` is the condition the user last closed, or
 *  null. */
export interface StoragePopupInput {
  readonly outcome: PersistOutcome | null;
  readonly browser: BrowserName;
  readonly use: StoredUse;
  readonly estimate: StorageEstimate | null;
  readonly acknowledgedRisk: string | null;
}

/** Stored by the dismissed banner that came before the popup: a user who closed that has seen the risk. */
const BANNER_DISMISSED_BEFORE_POPUP = '1';

const DRIVE_FIRST = 'Best: turn on Google Drive sync, so your projects live in Drive.';

/** The popup for what the app observed: nearly full wins (and also names the browser when it cannot
 *  promise); else the risk, once per condition; else none. */
export function storagePopup(input: StoragePopupInput): StoragePopup {
  const risky = input.outcome === 'refused' || input.outcome === 'unsupported';
  const promise = `${input.browser} has not promised to keep this site's data`;
  const percent = storageFullPercent(input.use, input.estimate);
  if (percent !== null) {
    const state = `Storage is ${percent}% full (${storageUseLine(input.use)}).`;
    const browserLine = risky ? ` ${promise}.` : '';
    return {
      kind: 'nearlyFull',
      title: 'Storage is nearly full',
      message: `${state}${browserLine} ${DRIVE_FIRST} Otherwise export your projects or delete old ones.`,
    };
  }
  if (!risky) return {kind: 'none'};
  const condition = `${input.outcome}:${input.browser}`;
  if (input.acknowledgedRisk === condition || input.acknowledgedRisk === BANNER_DISMISSED_BEFORE_POPUP) return {kind: 'none'};
  return {
    kind: 'risk',
    condition,
    title: 'Your projects may not be kept',
    message: `${promise}, so it could clear your OpenISD projects if your disk gets nearly full. ${DRIVE_FIRST} Otherwise export your projects.`,
  };
}

/** What to store in place of the closed-banner mark: the condition seen now, so the popup shows when
 *  the browser's storage situation changes (John, QO251, 18 Oct 2026). Null when there is no such mark. */
export function acknowledgementInPlaceOfBannerMark(input: Pick<StoragePopupInput, 'outcome' | 'browser' | 'acknowledgedRisk'>): string | null {
  return input.acknowledgedRisk === BANNER_DISMISSED_BEFORE_POPUP ? `${input.outcome}:${input.browser}` : null;
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

/** How much storage held before a save: the part of `StoragePopupInput` that tells fullness. */
export interface StorageLevel {
  readonly use: StoredUse;
  readonly estimate: StorageEstimate | null;
}

/** The popup after a save: nearly full only when this save took storage from below STORAGE_FULL_FROM
 *  to at or above it, so it shows once per crossing. Otherwise none. */
export function storagePopupAfterSave(before: StorageLevel, after: StoragePopupInput): StoragePopup {
  if (storageFullPercent(before.use, before.estimate) !== null) return {kind: 'none'};
  const popup = storagePopup(after);
  return popup.kind === 'nearlyFull' ? popup : {kind: 'none'};
}
