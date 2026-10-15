import {describe, expect, it} from 'vitest';
import {
  parseSyncActivity,
  SYNC_ACTIVITY_KEPT,
  type SyncActivity,
  syncActivityLine,
  syncActivityText,
  withActivity,
} from '../../cloud/syncActivity.js';

const AT = new Date(2026, 9, 14, 14, 56).getTime();

function moved(direction: 'up' | 'down', change: 'saved' | 'deleted', item: SyncActivity['item'], name: string, device = ''): SyncActivity {
  return {kind: 'moved', at_ms: AT, direction, change, item, name, device};
}

describe('syncActivityLine', () => {
  it('says what moved, which way, and when', () => {
    expect(syncActivityLine(moved('up', 'saved', 'project', 'Sub 12'))).toBe('14:56  ↑ Project "Sub 12" sent');
    expect(syncActivityLine(moved('down', 'saved', 'driver', 'RS225', 'iPhone'))).toBe('14:56  ↓ Driver "RS225" received');
    expect(syncActivityLine(moved('down', 'saved', 'pr', 'RSS390-PR', 'iPhone'))).toBe('14:56  ↓ Passive radiator "RSS390-PR" received');
  });

  it('names a Bin mark by its project and says where it was binned', () => {
    expect(syncActivityLine(moved('down', 'saved', 'projectBin', 'Sub 12', 'iPhone'))).toBe('14:56  ↓ Project "Sub 12" moved to Bin on iPhone');
    expect(syncActivityLine(moved('up', 'saved', 'projectBin', 'Sub 12'))).toBe('14:56  ↑ Project "Sub 12" moved to Bin');
    expect(syncActivityLine(moved('down', 'deleted', 'projectBin', 'Sub 12', 'iPhone'))).toBe('14:56  ↓ Project "Sub 12" taken out of the Bin on iPhone');
    expect(syncActivityLine(moved('up', 'deleted', 'projectBin', 'Sub 12'))).toBe('14:56  ↑ Project "Sub 12" taken out of the Bin');
  });

  it('says a deletion came from another device, by name when Drive said', () => {
    expect(syncActivityLine(moved('down', 'deleted', 'project', 'Sub 12', 'iPhone'))).toBe('14:56  ↓ Project "Sub 12" deleted on iPhone');
    expect(syncActivityLine(moved('down', 'deleted', 'driver', 'RS225'))).toBe('14:56  ↓ Driver "RS225" deleted on another device');
    expect(syncActivityLine(moved('up', 'deleted', 'project', 'Sub 12'))).toBe('14:56  ↑ Project "Sub 12" deleted');
  });

  it('names Options and Favourites by what they are, and an item with no name says so', () => {
    expect(syncActivityLine(moved('up', 'saved', 'settings', ''))).toBe('14:56  ↑ Options sent');
    expect(syncActivityLine(moved('down', 'saved', 'favourites', '', 'iPhone'))).toBe('14:56  ↓ Favourites received');
    expect(syncActivityLine(moved('up', 'deleted', 'project', ''))).toBe('14:56  ↑ Project (no name) deleted');
  });

  it('a conflict reads as T178 named it, with the name of the copy', () => {
    expect(syncActivityText({kind: 'keptBoth', at_ms: AT, item: 'driver', name: 'W5-1138SMF', copyName: 'W5-1138SMF (conflict, 14 Oct 2026, Windows PC)', device: 'iPhone'}))
      .toBe('⇅ Driver "W5-1138SMF" kept both: yours and the copy from iPhone; yours is "W5-1138SMF (conflict, 14 Oct 2026, Windows PC)"');
  });
});

describe('withActivity', () => {
  it('puts the newest first and keeps the last SYNC_ACTIVITY_KEPT', () => {
    const a = moved('up', 'saved', 'project', 'A');
    const b = moved('up', 'saved', 'project', 'B');
    expect(withActivity([a], [b, moved('up', 'saved', 'project', 'C')]).map(x => x.kind === 'moved' ? x.name : '')).toEqual(['C', 'B', 'A']);
    const many = Array.from({length: 40}, (_, i) => moved('up', 'saved', 'project', `P${i}`));
    const kept = withActivity([], many);
    expect(kept).toHaveLength(SYNC_ACTIVITY_KEPT);
    expect(kept[0]).toBe(many[39]);
  });
});

describe('parseSyncActivity', () => {
  it('reads back what was stored, and refuses what is not an entry', () => {
    const entry = moved('down', 'deleted', 'projectBin', 'Sub 12', 'iPhone');
    expect(parseSyncActivity(JSON.parse(JSON.stringify(entry)))).toEqual(entry);
    const kept: SyncActivity = {kind: 'keptBoth', at_ms: AT, item: 'pr', name: 'X', copyName: 'X (conflict)', device: ''};
    expect(parseSyncActivity(JSON.parse(JSON.stringify(kept)))).toEqual(kept);
    expect(parseSyncActivity({...entry, item: 'spaceship'})).toBeNull();
    expect(parseSyncActivity({...kept, item: 'settings'})).toBeNull();
    expect(parseSyncActivity('moved')).toBeNull();
  });
});
