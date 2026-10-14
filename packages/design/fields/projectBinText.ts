/** The words the project Bin's confirmations use; both skins show the same ones. */
import {formatCountOf} from './format.js';

/** Asks before moving project `name` to the Bin. */
export function moveToBinMessage(name: string): string {
  return `Move "${name}" to the Bin? You can restore it from the Bin on any device.`;
}

/** Asks before deleting project `name` forever. */
export function deleteForeverMessage(name: string): string {
  return `Delete "${name}" forever? It is removed from this browser and from Drive on every synced device. A backup is taken first.`;
}

/** Asks before emptying a Bin of `count` projects taking `totalSize`. */
export function emptyBinMessage(count: number, totalSize: string): string {
  return `Delete ${formatCountOf(count, 'project')} in the Bin (${totalSize}) forever? They are removed from this browser and from Drive on every synced device. A backup is taken first.`;
}
