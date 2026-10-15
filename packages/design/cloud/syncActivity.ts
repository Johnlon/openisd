/** What cloud sync moved, one item per entry: the Cloud sync dialog's activity list and the
 *  Diagnostics event lines. Plain data, so the sync state can keep the last entries across a reload. */
import {formatTime} from '../fields/format.js';
import type {DocKind} from './syncDoc.js';

/** How many activity entries are kept; older ones drop off. */
export const SYNC_ACTIVITY_KEPT = 30;

/** A kind of item that can be kept twice. */
export type KeptKind = 'project' | 'driver' | 'pr';

export type SyncActivity =
  /** An item went to Drive (`up`) or came from it (`down`): saved, or deleted. `name` is '' when not
   *  known; `device` is the device that made the change ('' when Drive did not say), for `down`. */
  | {
      readonly kind: 'moved';
      readonly at_ms: number;
      readonly direction: 'up' | 'down';
      readonly change: 'saved' | 'deleted';
      readonly item: DocKind;
      readonly name: string;
      readonly device: string;
    }
  /** An item changed on two devices; both kept, this device's version as `copyName`. */
  | {
      readonly kind: 'keptBoth';
      readonly at_ms: number;
      readonly item: KeptKind;
      readonly name: string;
      readonly copyName: string;
      readonly device: string;
    };

const ARROW = {up: '↑', down: '↓', keptBoth: '⇅'} as const;

export function keptKindWord(kind: KeptKind): string {
  switch (kind) {
    case 'project': return 'Project';
    case 'driver': return 'Driver';
    case 'pr': return 'Passive radiator';
  }
}

function deviceText(device: string): string {
  return device === '' ? 'another device' : device;
}

/** 'Driver "W5-1138SMF" kept both: yours and the copy from iPhone' */
export function keptBothText(kind: KeptKind, name: string, device: string): string {
  return `${keptKindWord(kind)} "${name}" kept both: yours and the copy from ${deviceText(device)}`;
}

function named(word: string, name: string): string {
  return name === '' ? `${word} (no name)` : `${word} "${name}"`;
}

/** The item as a line names it: 'Project "Sub 12"', 'Options', 'Favourites'. A Bin mark is named
 *  by its project. */
function itemText(item: DocKind, name: string): string {
  switch (item) {
    case 'project':
    case 'projectBin': return named('Project', name);
    case 'driver': return named('Driver', name);
    case 'pr': return named('Passive radiator', name);
    case 'settings': return 'Options';
    case 'favourites': return 'Favourites';
  }
}

function movedVerb(a: Extract<SyncActivity, {kind: 'moved'}>): string {
  const on = a.direction === 'down' ? ` on ${deviceText(a.device)}` : '';
  if (a.item === 'projectBin') {
    return a.change === 'saved' ? `moved to Bin${on}` : `taken out of the Bin${on}`;
  }
  if (a.change === 'deleted') return `deleted${on}`;
  return a.direction === 'up' ? 'sent' : 'received';
}

/** The entry without its time: '↑ Project "Sub 12" sent'. */
export function syncActivityText(a: SyncActivity): string {
  switch (a.kind) {
    case 'moved': return `${ARROW[a.direction]} ${itemText(a.item, a.name)} ${movedVerb(a)}`;
    case 'keptBoth': return `${ARROW.keptBoth} ${keptBothText(a.item, a.name, a.device)}; yours is "${a.copyName}"`;
  }
}

/** One line of the activity list: '14:56  ↑ Project "Sub 12" sent'. */
export function syncActivityLine(a: SyncActivity): string {
  return `${formatTime(new Date(a.at_ms))}  ${syncActivityText(a)}`;
}

/** The list after `added` (oldest first) happened: newest first, at most SYNC_ACTIVITY_KEPT. */
export function withActivity(kept: readonly SyncActivity[], added: readonly SyncActivity[]): readonly SyncActivity[] {
  return [...[...added].reverse(), ...kept].slice(0, SYNC_ACTIVITY_KEPT);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function docKindOf(value: unknown): DocKind | null {
  switch (value) {
    case 'project':
    case 'driver':
    case 'pr':
    case 'projectBin':
    case 'settings':
    case 'favourites':
      return value;
    default:
      return null;
  }
}

function keptKindOf(value: unknown): KeptKind | null {
  return value === 'project' || value === 'driver' || value === 'pr' ? value : null;
}

/** One stored entry read back; null when it is not one. */
export function parseSyncActivity(value: unknown): SyncActivity | null {
  if (!isRecord(value)) return null;
  const {at_ms, name, device} = value;
  if (typeof at_ms !== 'number' || !Number.isFinite(at_ms) || typeof name !== 'string' || typeof device !== 'string') return null;
  switch (value['kind']) {
    case 'moved': {
      const item = docKindOf(value['item']);
      const {direction, change} = value;
      if (item === null || (direction !== 'up' && direction !== 'down') || (change !== 'saved' && change !== 'deleted')) return null;
      return {kind: 'moved', at_ms, direction, change, item, name, device};
    }
    case 'keptBoth': {
      const item = keptKindOf(value['item']);
      const copyName = value['copyName'];
      if (item === null || typeof copyName !== 'string') return null;
      return {kind: 'keptBoth', at_ms, item, name, copyName, device};
    }
    default:
      return null;
  }
}
