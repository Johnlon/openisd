/** The notice when the start-up update of saved projects was refused because its backup did not fit. The
 *  words are the design layer's (`UPGRADE_REFUSED_NOTICE`). Shown until the user clicks Close. */
import {UPGRADE_REFUSED_NOTICE} from '@openisd/design/fields';
import type {CompactionOutcome} from '@openisd/persistence';
import type {ConfirmPort} from './confirmPort.js';

export async function announceUpgradeRefused(outcome: CompactionOutcome, confirm: ConfirmPort): Promise<void> {
  if (outcome.kind !== 'refused') return;
  await confirm.ask({title: UPGRADE_REFUSED_NOTICE.title, message: UPGRADE_REFUSED_NOTICE.message, confirmLabel: 'Close', dismissal: 'buttonsOnly'});
}
