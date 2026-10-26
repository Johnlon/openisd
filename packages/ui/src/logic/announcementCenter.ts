import {computed, ref, type ComputedRef, type Ref} from 'vue';

export interface Announcement {
  readonly id: string;
  readonly version: string;
  readonly published: string;
  readonly title: string;
  readonly summary: string;
  readonly body: readonly string[];
  readonly href: string;
}


export interface AnnouncementStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AnnouncementCenter {
  readonly items: Readonly<Ref<readonly Announcement[]>>;
  readonly open: Readonly<Ref<boolean>>;
  readonly view: Readonly<Ref<'latest' | 'list' | null>>;
  readonly latest: ComputedRef<Announcement | null>;
  readonly unreadCount: ComputedRef<number>;
  readonly archiveUrl: string;
  readonly refreshUrl: string;
  load(): Promise<void>;
  showList(): void;
  closeList(): void;
  dismissLatest(): void;
}

const TEST_SERVICE_ORIGIN = 'https://openisd-announcements-test.john-lonergan-0e9.workers.dev';
const PRODUCTION_SERVICE_ORIGIN = 'https://openisd-announcements.john-lonergan-0e9.workers.dev';

export interface AnnouncementEndpoints {
  readonly feedUrl: string;
  readonly archiveUrl: string;
  readonly refreshUrl: string;
  readonly showLatestOnLoad: boolean;
}

export function announcementEndpointsForHostname(hostname: string): AnnouncementEndpoints {
  const production = hostname === 'openisd.app' || hostname === 'snapshots.openisd.app';
  const archived = hostname === 'snapshots.openisd.app';
  const origin = production ? PRODUCTION_SERVICE_ORIGIN : TEST_SERVICE_ORIGIN;
  const site = production ? '' : '?site=test';
  return {
    feedUrl: `${origin}/announcements`,
    archiveUrl: `${origin}/${site}`,
    refreshUrl: `${origin}/refresh${site}`,
    showLatestOnLoad: !archived,
  };
}

export const ANNOUNCEMENTS_URL = announcementEndpointsForHostname('test.openisd.app').feedUrl;
const DISMISSED_KEY = 'openisd_announcements_dismissed_v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAnnouncement(value: unknown): Announcement | null {
  if (!isRecord(value)) return null;
  const item = value;
  if (typeof item.id !== 'string' || item.id.length === 0
    || typeof item.version !== 'string' || typeof item.published !== 'string'
    || typeof item.title !== 'string' || typeof item.summary !== 'string'
    || !Array.isArray(item.body) || !item.body.every(line => typeof line === 'string')
    || typeof item.href !== 'string') return null;
  return {
    id: item.id,
    version: item.version,
    published: item.published,
    title: item.title,
    summary: item.summary,
    body: item.body,
    href: item.href,
  };
}

export function parseAnnouncementResponse(value: unknown): readonly Announcement[] | null {
  if (!isRecord(value)) return null;
  const payload = value;
  if (payload.version !== 1 || !Array.isArray(payload.announcements)) return null;
  const items = payload.announcements.map(parseAnnouncement);
  if (items.some(item => item === null)) return null;
  const parsed = items.filter((item): item is Announcement => item !== null);
  const ids = new Set(parsed.map(item => item.id));
  if (ids.size !== parsed.length) return null;
  return [...parsed].sort((a, b) => b.published.localeCompare(a.published) || b.id.localeCompare(a.id));
}

function readDismissed(storage: AnnouncementStorage): Set<string> {
  try {
    const raw = storage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(value => typeof value === 'string')
      ? new Set(parsed)
      : new Set();
  } catch {
    return new Set();
  }
}

export function createAnnouncementCenter(
  storage: AnnouncementStorage,
  fetchFn: typeof fetch,
  endpoints: AnnouncementEndpoints = announcementEndpointsForHostname('test.openisd.app'),
): AnnouncementCenter {
  const items = ref<readonly Announcement[]>([]);
  const open = ref(false);
  const view = ref<'latest' | 'list' | null>(null);
  const dismissed = readDismissed(storage);
  const latest = computed(() => items.value[0] ?? null);
  const unreadCount = computed(() => items.value.filter(item => !dismissed.has(item.id)).length);

  async function load(): Promise<void> {
    try {
      const response = await fetchFn(endpoints.feedUrl, {cache: 'no-store', credentials: 'omit'});
      if (!response.ok) return;
      const parsed = parseAnnouncementResponse(await response.json());
      if (parsed === null) return;
      items.value = parsed;
      const newest = parsed[0];
      if (endpoints.showLatestOnLoad && newest && !dismissed.has(newest.id)) {
        open.value = true;
        view.value = 'latest';
      }
    } catch {
      // Announcements are optional; offline starts must remain unaffected.
    }
  }

  function showList(): void {
    view.value = 'list';
    open.value = true;
  }

  function closeList(): void {
    open.value = false;
    view.value = null;
  }

  function dismissLatest(): void {
    const newest = latest.value;
    if (newest) {
      dismissed.add(newest.id);
      try { storage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed])); } catch { /* storage may be unavailable */ }
    }
    closeList();
  }

  return {items, open, view, latest, unreadCount, archiveUrl: endpoints.archiveUrl, refreshUrl: endpoints.refreshUrl, load, showList, closeList, dismissLatest};
}
