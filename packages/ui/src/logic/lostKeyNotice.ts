/** The notice for a key that was in this browser at the last start and is gone now (T058). It
 *  names what was lost and when it was last seen, and is shown until the user clicks one of its buttons: Export log
 *  hands them the storage log, OK closes it. Esc and a click outside do not answer it. */
import {lostDataSentence, parseBasicUtc} from '@openisd/design/fields';
import type {LostKey} from '@openisd/persistence';
import type {ConfirmPort} from './confirmPort.js';

/** "Saved drivers were in this browser at 2026-10-12 21:30, they are gone now." */
export function lostKeyText(lost: LostKey, formatTime: (at: Date) => string): string {
  const seen = parseBasicUtc(lost.lastSeenAt);
  const when = seen === null ? lost.lastSeenAt : formatTime(seen);
  return lostDataSentence(lost.what, lost.plural, when);
}

export interface LostKeyNoticeDeps {
  readonly confirm: ConfirmPort;
  readonly formatTime: (at: Date) => string;
  /** Hand the storage log to the user as a file. */
  readonly exportLog: () => void;
}

/** Say what was lost, if anything was. Resolves when the user has clicked. */
export async function announceLostKeys(lostKeys: readonly LostKey[], deps: LostKeyNoticeDeps): Promise<void> {
  if (lostKeys.length === 0) return;
  const wantsLog = await deps.confirm.ask({
    title: 'Saved data is gone',
    message: lostKeys.map(lost => lostKeyText(lost, deps.formatTime)).join(' '),
    confirmLabel: 'Export log',
    cancelLabel: 'OK',
    dismissal: 'buttonsOnly',
  });
  if (wantsLog) deps.exportLog();
}
