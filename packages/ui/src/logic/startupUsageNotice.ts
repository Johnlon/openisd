/** The startup flash, once per browser tab, of how many projects are stored and how much storage
 *  they use (John, 17 Oct 2026). The words are the design layer's (`startupNotice`). */
import {startupNotice, type StoredUse} from '@openisd/design/fields';
import type {UsageNoticeTab} from '@openisd/persistence';

export function flashStartupUse(use: StoredUse, tab: UsageNoticeTab, flash: (msg: string) => void): void {
  const notice = startupNotice(use);
  if (notice === null || !tab.due()) return;
  flash(notice);
  tab.shown();
}
