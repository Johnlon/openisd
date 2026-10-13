import {
  parseStoredGrant,
  type StoredGrant,
} from '@openisd/design/cloud';

export interface AuthStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove?(key: string): void;
}

export interface TokenStore {
  read(): StoredGrant;
  write(grant: StoredGrant): void;
}

export const OPENISD_CLOUD_AUTH_KEY = 'openisd_cloud_auth';

export function createTokenStore(storage: AuthStorage): TokenStore {
  return {
    read(): StoredGrant {
      try {
        return parseStoredGrant(storage.get(OPENISD_CLOUD_AUTH_KEY));
      } catch {
        return { kind: 'none' };
      }
    },
    write(grant: StoredGrant): void {
      try {
        storage.set(OPENISD_CLOUD_AUTH_KEY, JSON.stringify(grant));
      } catch {
        /* storage full or unavailable */
      }
    },
  };
}
