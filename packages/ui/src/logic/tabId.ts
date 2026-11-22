/** The tab rail's closed set — every tab reads a project. Application settings live in the
 *  Options dialog. Shared by every shell's tab rail. */
export type TabId = 'box' | 'driver' | 'enclosure' | 'filters' | 'signal' | 'advanced' | 'project';

/** Parse a persisted tab id — the one string→`TabId` boundary. A stored id the app no longer has
 *  must not come back as an active tab. */
export function isTabId(v: unknown): v is TabId {
  return v === 'box' || v === 'driver' || v === 'enclosure' || v === 'filters'
    || v === 'signal' || v === 'advanced' || v === 'project';
}
