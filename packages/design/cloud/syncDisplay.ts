import {formatCountOf, formatDateTime, formatTime} from '../fields/format.js';
import {type ConflictCopy, type SyncStatus, conflictKeptText, conflictKindWord} from './syncStatus.js';
import {cloudFaultText} from './cloudTypes.js';

export type SyncTone = 'muted' | 'accent' | 'good' | 'warn' | 'bad';
export type SyncGlyph = 'cloudOff' | 'cloudBusy' | 'cloudDone' | 'cloudSlash' | 'cloudAlert';
export type SyncTap = 'openDialog' | 'reconnect';

export interface SyncDisplayInputs {
  readonly status: SyncStatus;
  readonly conflicts: readonly ConflictCopy[];
  readonly conflictsSeen: number;
  readonly hintDismissed: boolean;
  readonly launches: number;
  readonly updateBannerShown: boolean;
  readonly configured: boolean;
}

export interface SyncDisplay {
  readonly glyph: SyncGlyph;
  readonly tone: SyncTone;
  readonly badge: number | null;
  readonly shortText: string;
  readonly text: string;
  readonly tooltip: string;
  readonly tap: SyncTap;
  readonly strip: { readonly text: string; readonly button: string } | null;
  readonly hint: { readonly text: string; readonly yes: string; readonly no: string } | null;
  readonly conflictNotice: { readonly text: string; readonly button: string } | null;
  readonly dialog: SyncDialogModel;
}

export type SyncDialogAction = 'connect' | 'syncNow' | 'reconnect' | 'disconnect';

export interface SyncDialogButton {
  readonly action: SyncDialogAction;
  readonly label: string;
  readonly enabled: boolean;
  readonly primary: boolean;
}

export const CLOUD_SYNC_MENU_LABEL = 'Cloud sync…';
export const CLOUD_SYNC_CLOSE_LABEL = 'Close';

export interface SyncDialogModel {
  readonly title: string;
  readonly closeLabel: string;
  readonly providerHeading: string;
  readonly tone: SyncTone;
  readonly headline: string;
  readonly account: string | null;
  readonly pendingLine: string | null;
  /** What is copied, where it goes and who can see it, with a link to the privacy page; shown while off. */
  readonly privacy: { readonly lines: readonly string[]; readonly linkLabel: string } | null;
  readonly notConfiguredLine: string | null;
  readonly buttons: readonly SyncDialogButton[];
  readonly conflictsHeading: string;
  readonly conflictOpenLabel: string;
  readonly conflicts: readonly {
    readonly id: ConflictCopy['id'];
    readonly title: string;
    readonly sub: string;
  }[];
  readonly disconnectConfirm: {
    readonly title: string;
    readonly body: string;
    readonly yes: string;
    readonly no: string;
  };
}

const DISCONNECT_CONFIRM = {
  title: 'Disconnect Google Drive?',
  body: 'Your work stays in this browser and in your Drive. Changes made after this will not sync.',
  yes: 'Disconnect',
  no: 'Keep connected',
} as const;

const PRIVACY = {
  lines: [
    'Copies your saved projects, drivers, passive radiators, favourites and Options.',
    'Keeps them in a hidden folder in your own Google Drive that only OpenISD can open.',
    'Nobody else sees them, and no OpenISD server does. Disconnect stops it.',
  ],
  linkLabel: 'Privacy',
} as const;

function buttonOf(action: SyncDialogAction, configured: boolean): SyncDialogButton {
  switch (action) {
    case 'connect':
      return {action, label: 'Connect Google Drive', enabled: configured, primary: true};
    case 'syncNow':
      return {action, label: 'Sync now', enabled: true, primary: true};
    case 'reconnect':
      return {action, label: 'Reconnect', enabled: true, primary: true};
    case 'disconnect':
      return {action, label: 'Disconnect', enabled: true, primary: false};
  }
}

/** The items kept twice, named: one in full, several as a list after the count. */
function conflictsText(conflicts: readonly ConflictCopy[]): string {
  const [only] = conflicts;
  if (conflicts.length === 1 && only !== undefined) return `${conflictKeptText(only)}.`;
  const names = conflicts.map(c => `${conflictKindWord(c.id)} "${c.item}"`).join(', ');
  return `${formatCountOf(conflicts.length, 'item')} changed on two devices. Both kept: ${names}.`;
}

export function syncDisplayOf(inputs: SyncDisplayInputs): SyncDisplay {
  const {status} = inputs;

  let glyph: SyncGlyph;
  let tone: SyncTone;
  let badge: number | null;
  let shortText: string;
  let text: string;
  let tooltip: string;
  let tap: SyncTap = 'openDialog';
  let account: string | null = null;
  let pendingLine: string | null = null;
  let buttons: readonly SyncDialogButton[];

  switch (status.kind) {
    case 'off': {
      glyph = 'cloudOff';
      tone = 'muted';
      badge = null;
      shortText = 'Off';
      text = 'Cloud sync is off';
      tooltip = 'Sync your work across devices through your Google Drive. Tap to turn on.';
      account = null;
      pendingLine = null;
      buttons = [buttonOf('connect', inputs.configured)];
      break;
    }

    case 'connecting': {
      glyph = 'cloudBusy';
      tone = 'accent';
      badge = null;
      shortText = 'Connecting';
      text = 'Connecting to Google Drive…';
      tooltip = 'Connecting to Google Drive…';
      account = null;
      pendingLine = null;
      buttons = [];
      break;
    }

    case 'syncing': {
      glyph = 'cloudBusy';
      tone = 'accent';
      badge = null;
      shortText = 'Syncing';
      text = 'Syncing…';
      tooltip = 'Syncing…';
      account = status.account;
      pendingLine = null;
      buttons = [buttonOf('disconnect', inputs.configured)];
      break;
    }

    case 'synced': {
      const date = new Date(status.at_ms);
      const conflictCount = status.conflicts > 0 ? status.conflicts : inputs.conflicts.length;
      if (conflictCount > 0) {
        glyph = 'cloudAlert';
        tone = 'warn';
        badge = conflictCount;
        shortText = formatCountOf(conflictCount, 'conflict');
        text = `Synced ${formatDateTime(date)}`;
        tooltip = inputs.conflicts.length > 0
          ? `${conflictsText(inputs.conflicts)} Tap to see them.`
          : `${formatCountOf(conflictCount, 'item')} changed on two devices. Both kept. Tap to see them.`;
      } else {
        glyph = 'cloudDone';
        tone = 'good';
        badge = null;
        shortText = `Synced ${formatTime(date)}`;
        text = `Synced ${formatDateTime(date)}`;
        tooltip = 'Up to date with Google Drive.';
      }
      account = status.account;
      pendingLine = null;
      buttons = [buttonOf('syncNow', inputs.configured), buttonOf('disconnect', inputs.configured)];
      break;
    }

    case 'pending': {
      glyph = 'cloudBusy';
      tone = 'accent';
      badge = status.changes > 0 ? status.changes : null;
      shortText = `${status.changes} not synced`;
      text = status.nextAt_ms === null
        ? `${formatCountOf(status.changes, 'change')} not synced`
        : `${formatCountOf(status.changes, 'change')} not synced, syncs at ${formatTime(new Date(status.nextAt_ms))}`;
      tooltip = `${formatCountOf(status.changes, 'change')} will sync in a moment.`;
      account = status.account;
      pendingLine = `${formatCountOf(status.changes, 'change')} not synced`;
      buttons = [buttonOf('syncNow', inputs.configured), buttonOf('disconnect', inputs.configured)];
      break;
    }

    case 'offline': {
      glyph = 'cloudSlash';
      tone = 'muted';
      badge = status.changes > 0 ? status.changes : null;
      shortText = 'Offline';
      text = status.changes > 0
        ? `Offline. ${formatCountOf(status.changes, 'change')} not synced`
        : 'Offline';
      tooltip = 'No connection. They will sync when you are back online.';
      account = status.account;
      pendingLine = status.changes > 0
        ? `${formatCountOf(status.changes, 'change')} not synced`
        : null;
      buttons = [buttonOf('syncNow', inputs.configured), buttonOf('disconnect', inputs.configured)];
      break;
    }

    case 'reconnect': {
      glyph = 'cloudAlert';
      tone = 'warn';
      badge = status.changes > 0 ? status.changes : null;
      shortText = 'Reconnect';
      text = status.changes > 0
        ? `Google needs you to connect again. ${formatCountOf(status.changes, 'change')} not synced`
        : 'Google needs you to connect again.';
      tooltip = text;
      tap = 'reconnect';
      account = status.account;
      pendingLine = status.changes > 0
        ? `${formatCountOf(status.changes, 'change')} not synced`
        : null;
      buttons = [buttonOf('reconnect', inputs.configured), buttonOf('disconnect', inputs.configured)];
      break;
    }

    case 'held': {
      glyph = 'cloudAlert';
      tone = 'warn';
      badge = status.heldDocs > 0 ? status.heldDocs : null;
      shortText = 'Update app';
      text = `Update the app to sync ${formatCountOf(status.heldDocs, 'project')} saved by a newer version`;
      tooltip = text;
      account = status.account;
      pendingLine = null;
      buttons = [buttonOf('syncNow', inputs.configured), buttonOf('disconnect', inputs.configured)];
      break;
    }

    case 'refused': {
      glyph = 'cloudAlert';
      tone = 'bad';
      badge = null;
      shortText = 'Not synced';
      text = status.reason === 'bucketUnreadable'
        ? 'Nothing synced. A local file is unreadable.'
        : 'Nothing synced. No room in this browser to back up first. Export, then try again.';
      tooltip = text;
      account = status.account;
      pendingLine = null;
      buttons = [buttonOf('disconnect', inputs.configured)];
      break;
    }

    case 'failed': {
      glyph = 'cloudAlert';
      tone = 'bad';
      badge = null;
      shortText = 'Sync failed';
      text = status.retryAt_ms === null
        ? cloudFaultText(status.fault)
        : `${cloudFaultText(status.fault)} Retrying at ${formatTime(new Date(status.retryAt_ms))}.`;
      tooltip = text;
      account = status.account;
      pendingLine = null;
      buttons = [buttonOf('syncNow', inputs.configured), buttonOf('disconnect', inputs.configured)];
      break;
    }
  }

  const strip = inputs.configured && status.kind === 'reconnect' && !inputs.updateBannerShown
    ? {
        text: status.changes > 0
          ? `⚠ Google needs you to connect again. ${formatCountOf(status.changes, 'change')} not synced.`
          : '⚠ Google needs you to connect again.',
        button: 'Reconnect',
      }
    : null;

  const hint = inputs.configured && inputs.launches >= 2 && status.kind === 'off' && !inputs.hintDismissed
    ? {
        text: 'Sync your projects across devices?',
        yes: 'Turn on',
        no: 'No thanks',
      }
    : null;

  const conflictNotice = inputs.configured && inputs.conflicts.length > inputs.conflictsSeen
    ? {
        text: conflictsText(inputs.conflicts),
        button: 'View',
      }
    : null;

  const dialog: SyncDialogModel = {
    title: 'Cloud sync',
    closeLabel: CLOUD_SYNC_CLOSE_LABEL,
    providerHeading: 'Google Drive',
    tone,
    headline: text,
    account,
    pendingLine,
    privacy: status.kind === 'off' ? PRIVACY : null,
    notConfiguredLine: !inputs.configured ? 'Not set up yet.' : null,
    buttons,
    conflictsHeading: 'Conflict copies',
    conflictOpenLabel: 'Open',
    conflicts: inputs.conflicts.map(c => ({
      id: c.id,
      title: c.name,
      sub: conflictKeptText(c),
    })),
    disconnectConfirm: DISCONNECT_CONFIRM,
  };

  return {
    glyph,
    tone,
    badge,
    shortText,
    text,
    tooltip,
    tap,
    strip,
    hint,
    conflictNotice,
    dialog,
  };
}
