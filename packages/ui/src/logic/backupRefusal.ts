import {NO_ROOM_TO_BACK_UP, type SavedWrite} from '@openisd/persistence';
import type {Logging} from '../logging/flash.js';

/** Tell the user when a write that removes or replaces saved data was refused because the
 *  whole-store backup that must come first did not fit (T058). Nothing was changed. Any other
 *  outcome says nothing here. */
export function flashIfNoRoom(logging: Pick<Logging, 'flash'>, outcome: SavedWrite): void {
  if (outcome === 'noRoom') logging.flash(NO_ROOM_TO_BACK_UP);
}
