/**
 * `StoragePrefix` — what a deployment puts in front of every key it keeps in the browser's storage.
 * Browser storage is shared by every page of an origin, so the /test/ build, which sits beside the
 * released app, would otherwise read and overwrite the released app's projects.
 *
 * The root app and every other deployment share one store with no prefix; only a deployment
 * listed in `PREFIXED_DEPLOYMENTS` keeps a store of its own.
 */

/** The first path segment of each deployment that keeps its own store. */
const PREFIXED_DEPLOYMENTS: readonly string[] = ['test'];

export class StoragePrefix {
  /** The root app's keys, exactly as they have always been. */
  static readonly ROOT = new StoragePrefix('');

  /** `text` is put in front of every key: '' for the shared store, `<deployment>/` for one of its own. */
  constructor(private readonly text: string) {}

  /** The key as the browser stores it. */
  stored(key: string): string {
    return this.text + key;
  }

  /** The key as the app knows it, or null for a key that belongs to another deployment. */
  own(storedKey: string): string | null {
    if (this.text === '') return storedKey.includes('/') ? null : storedKey;
    return storedKey.startsWith(this.text) ? storedKey.slice(this.text.length) : null;
  }
}

/** The prefix of the app served at `pathname` (a document path such as `/test/` or `/test/index.html`). */
export function createStoragePrefix(pathname: string): StoragePrefix {
  const first = pathname.split('/').find(segment => segment !== '');
  const own = PREFIXED_DEPLOYMENTS.find(name => name === first);
  return own === undefined ? StoragePrefix.ROOT : new StoragePrefix(`${own}/`);
}
