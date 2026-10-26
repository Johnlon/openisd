import {describe, expect, it, vi} from 'vitest';
import {ANNOUNCEMENTS_URL, createAnnouncementCenter, parseAnnouncementResponse, type AnnouncementStorage} from '../../src/logic/announcementCenter.js';

const earlier = {id: 'openisd-7.0.956', version: '7.0.956', published: '2026-10-25', title: 'Earlier', summary: 'Earlier release', body: ['One'], href: 'https://openisd.app/'};
const current = {id: 'openisd-7.0.957', version: '7.0.957', published: '2026-10-26', title: 'Current', summary: 'Current release', body: ['Two'], href: 'https://openisd.app/'};

function storage(): AnnouncementStorage & {values: Map<string, string>} {
  const values = new Map<string, string>();
  return {values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
}

function response(items: readonly object[]): Response {
  return new Response(JSON.stringify({version: 1, announcements: items}), {status: 200, headers: {'Content-Type': 'application/json'}});
}

describe('announcement center', () => {
  it('requests the fixed feed with browser caching disabled and opens the newest item', async () => {
    const fetchFn: typeof fetch = vi.fn(async () => response([earlier, current]));
    const center = createAnnouncementCenter(storage(), fetchFn);

    await center.load();

    expect(fetchFn).toHaveBeenCalledWith(ANNOUNCEMENTS_URL, {cache: 'no-store', credentials: 'omit'});
    expect(center.latest.value?.id).toBe(current.id);
    expect(center.open.value).toBe(true);
    expect(center.view.value).toBe('latest');
    expect(center.unreadCount.value).toBe(2);
  });

  it('persists dismissal by stable ID and still opens a later announcement', async () => {
    const saved = storage();
    const firstFetch: typeof fetch = vi.fn(async () => response([current, earlier]));
    const first = createAnnouncementCenter(saved, firstFetch);
    await first.load();
    first.dismissLatest();
    expect(first.open.value).toBe(false);

    const later = {...current, id: 'openisd-7.0.958', version: '7.0.958', published: '2026-10-27', title: 'Later'};
    const nextFetch: typeof fetch = vi.fn(async () => response([earlier, current, later]));
    const next = createAnnouncementCenter(saved, nextFetch);
    await next.load();

    expect(next.latest.value?.id).toBe(later.id);
    expect(next.open.value).toBe(true);
    expect(next.unreadCount.value).toBe(2);
    next.showList();
    expect(next.view.value).toBe('list');
    expect(next.items.value.map(item => item.id)).toEqual([later.id, current.id, earlier.id]);
  });

  it('rejects duplicate IDs and malformed records rather than displaying an ambiguous feed', () => {
    expect(parseAnnouncementResponse({version: 1, announcements: [current, current]})).toBeNull();
    expect(parseAnnouncementResponse({version: 1, announcements: [{...current, body: [3]}]})).toBeNull();
  });

  it('leaves the app usable when the feed is unavailable', async () => {
    const fetchFn: typeof fetch = vi.fn(async () => { throw new Error('offline'); });
    const center = createAnnouncementCenter(storage(), fetchFn);
    await expect(center.load()).resolves.toBeUndefined();
    expect(center.open.value).toBe(false);
    expect(center.items.value).toEqual([]);
  });
});
