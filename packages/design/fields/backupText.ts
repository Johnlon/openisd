/** The words the Backups page puts on what it restores; both skins show the same ones. */
import {formatByteSize, formatDay} from './format.js';

/** The name a project restored from a backup is saved under: "Sub 12 (restored 14 Oct 2026)". */
export function restoredProjectName(name: string, on: Date): string {
  return `${name} (restored ${formatDay(on)})`;
}

/** "Using 2.1 MB of about 5 MB in this browser." Browsers let one site keep about 5 MB; they
 *  differ, so the line says "about". */
export function storageUsedLine(usedBytes: number): string {
  return `Using ${formatByteSize(usedBytes)} of about 5 MB in this browser.`;
}
