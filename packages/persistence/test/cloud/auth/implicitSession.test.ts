import { describe, it, expect, vi } from 'vitest';
import {
  createImplicitSession,
  type SessionLocation,
} from '../../../src/cloud/auth/implicitSession.js';
import type { RedirectGuard } from '../../../src/cloud/auth/redirectGuard.js';
import type { Revoker } from '../../../src/cloud/auth/googleRevoker.js';
import {
  createTokenStore,
  type AuthStorage,
} from '../../../src/cloud/auth/tokenStore.js';
import {
  type OAuthConfig,
  type StoredGrant,
} from '@openisd/design/cloud';

function createMemoryStorage(initial: Record<string, string> = {}): AuthStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get(key: string): string | null {
      return map.get(key) ?? null;
    },
    set(key: string, value: string): void {
      map.set(key, value);
    },
    remove(key: string): void {
      map.delete(key);
    },
  };
}

interface MockLocation extends SessionLocation {
  replaceStateCalls: string[];
}

function createMockLocation(initialHref: string, initialHash = ''): MockLocation {
  const replaceStateCalls: string[] = [];
  return {
    href: initialHref,
    hash: initialHash,
    replaceStateCalls,
    replaceState(url: string): void {
      replaceStateCalls.push(url);
    },
  };
}

interface MockGuard extends RedirectGuard {
  readonly leaveCalls: string[];
}

function createMockGuard(): MockGuard {
  const leaveCalls: string[] = [];
  return {
    leaveCalls,
    leave(url: string): void {
      leaveCalls.push(url);
    },
  };
}

const noopRevoker: Revoker = {
  async revoke(_token: string): Promise<void> {},
};

const dummyRandom = (): Uint8Array => new Uint8Array([0x01, 0x02, 0x03, 0x04]);

describe('tokenStore', () => {
  it('reads unreadable storage as none', () => {
    const storage = createMemoryStorage({ openisd_cloud_auth: 'not-json' });
    const store = createTokenStore(storage);
    expect(store.read()).toEqual({ kind: 'none' });

    const emptyStore = createTokenStore(createMemoryStorage());
    expect(emptyStore.read()).toEqual({ kind: 'none' });
  });

  it('reads and writes pending grant', () => {
    const store = createTokenStore(createMemoryStorage());
    const grant: StoredGrant = {
      kind: 'pending',
      state: 'st-123',
      returnTo: '/project/1',
      silent: false,
    };
    store.write(grant);
    expect(store.read()).toEqual(grant);
  });

  it('reads and writes token grant', () => {
    const store = createTokenStore(createMemoryStorage());
    const grant: StoredGrant = {
      kind: 'token',
      accessToken: 'ya29.xyz',
      expiresAt_ms: 123456789,
      account: 'test@example.com',
    };
    store.write(grant);
    expect(store.read()).toEqual(grant);
  });

  it('reads and writes reconnect grant', () => {
    const store = createTokenStore(createMemoryStorage());
    const grant: StoredGrant = {
      kind: 'reconnect',
      account: 'test@example.com',
    };
    store.write(grant);
    expect(store.read()).toEqual(grant);
  });

  it('reads and writes none grant', () => {
    const store = createTokenStore(createMemoryStorage());
    store.write({ kind: 'none' });
    expect(store.read()).toEqual({ kind: 'none' });
  });
});

describe('implicitSession', () => {
  const baseConfig: OAuthConfig = {
    clientId: 'client-id-123.apps.googleusercontent.com',
    redirectUri: 'https://openisd.app/',
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  };

  it('wrong state refused', async () => {
    const storage = createMemoryStorage();
    const store = createTokenStore(storage);
    store.write({
      kind: 'pending',
      state: 'correct-state',
      returnTo: '/current-page',
      silent: false,
    });
    const location = createMockLocation(
      'https://openisd.app/#access_token=ya29.xyz&expires_in=3600&state=wrong-state',
      '#access_token=ya29.xyz&expires_in=3600&state=wrong-state',
    );
    const guard = createMockGuard();
    const session = createImplicitSession({
      config: baseConfig,
      store,
      location,
      clock: () => 1000000,
      random: dummyRandom,
      revoker: noopRevoker,
      guard,
    });

    const bootRes = await session.onBoot({
      search: '',
      hash: '#access_token=ya29.xyz&expires_in=3600&state=wrong-state',
    });

    expect(bootRes.kind).toBe('failed');
    if (bootRes.kind === 'failed') {
      expect(bootRes.returnTo).toBe('/current-page');
    }
    expect(session.grant().kind).toBe('none');
  });

  it('token with 30 s left → accessToken answers reconnect, no redirect', async () => {
    const storage = createMemoryStorage();
    const store = createTokenStore(storage);
    const now = 1000000;
    store.write({
      kind: 'token',
      accessToken: 'ya29.expiring',
      expiresAt_ms: now + 30_000, // 30s left (< 60s buffer)
      account: 'test@example.com',
    });
    const location = createMockLocation('https://openisd.app/');
    const guard = createMockGuard();
    const session = createImplicitSession({
      config: baseConfig,
      store,
      location,
      clock: () => now,
      random: dummyRandom,
      revoker: noopRevoker,
      guard,
    });

    const tokenAnswer = await session.accessToken();

    expect(tokenAnswer).toEqual({ kind: 'reconnect' });
    expect(guard.leaveCalls).toEqual([]);
    expect(session.grant()).toEqual({ kind: 'reconnect', account: 'test@example.com' });
    expect(store.read()).toEqual({ kind: 'reconnect', account: 'test@example.com' });
  });

  it('boot with expired token → willRedirect once, a second boot finding pending{silent} → reconnect', async () => {
    const storage = createMemoryStorage();
    const store = createTokenStore(storage);
    const now = 1000000;
    store.write({
      kind: 'token',
      accessToken: 'ya29.expired',
      expiresAt_ms: now - 1000, // expired
      account: 'user@example.com',
    });
    const location = createMockLocation('https://openisd.app/project/2');
    const guard1 = createMockGuard();
    const session = createImplicitSession({
      config: baseConfig,
      store,
      location,
      clock: () => now,
      random: () => new Uint8Array([0x11, 0x22, 0x33]),
      revoker: noopRevoker,
      guard: guard1,
    });

    // Boot 1: answers willRedirect
    const boot1 = await session.onBoot({ search: '', hash: '' });
    expect(boot1.kind).toBe('willRedirect');
    if (boot1.kind === 'willRedirect') {
      boot1.go();
    }
    expect(guard1.leaveCalls.length).toBe(1);
    const assignUrl = new URL(guard1.leaveCalls[0] ?? '');
    expect(assignUrl.searchParams.get('prompt')).toBe('none');
    expect(assignUrl.searchParams.get('state')).toBe('112233');
    expect(store.read()).toEqual({
      kind: 'pending',
      state: '112233',
      returnTo: 'https://openisd.app/project/2',
      silent: true,
      account: 'user@example.com',
    });

    // Boot 2: re-booting with pending{silent: true} already written
    const location2 = createMockLocation('https://openisd.app/project/2');
    const guard2 = createMockGuard();
    const session2 = createImplicitSession({
      config: baseConfig,
      store,
      location: location2,
      clock: () => now + 1000,
      random: () => new Uint8Array([0x44, 0x55, 0x66]),
      revoker: noopRevoker,
      guard: guard2,
    });

    const boot2 = await session2.onBoot({ search: '', hash: '' });
    expect(boot2.kind).toBe('notACallback');
    expect(guard2.leaveCalls).toEqual([]); // did not redirect a second time
    expect(session2.grant()).toEqual({ kind: 'reconnect', account: 'user@example.com' });
    expect(store.read()).toEqual({ kind: 'reconnect', account: 'user@example.com' });
  });

  it('mints state as hex on beginConnect', () => {
    const storage = createMemoryStorage();
    const store = createTokenStore(storage);
    const location = createMockLocation('https://openisd.app/test');
    const guard = createMockGuard();
    const session = createImplicitSession({
      config: baseConfig,
      store,
      location,
      clock: () => 1000000,
      random: () => new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      revoker: noopRevoker,
      guard,
    });

    session.beginConnect('connect');

    expect(guard.leaveCalls.length).toBe(1);
    const url = new URL(guard.leaveCalls[0] ?? '');
    expect(url.searchParams.get('state')).toBe('deadbeef');
    expect(store.read()).toEqual({
      kind: 'pending',
      state: 'deadbeef',
      returnTo: 'https://openisd.app/test',
      silent: false,
    });
  });

  it('#error= on the silent attempt → reconnect', async () => {
    const storage = createMemoryStorage();
    const store = createTokenStore(storage);
    store.write({
      kind: 'pending',
      state: 'silent-state',
      returnTo: '/',
      silent: true,
      account: 'user@example.com',
    });
    const location = createMockLocation(
      'https://openisd.app/#error=interaction_required&state=silent-state',
      '#error=interaction_required&state=silent-state',
    );
    const guard = createMockGuard();
    const session = createImplicitSession({
      config: baseConfig,
      store,
      location,
      clock: () => 1000000,
      random: dummyRandom,
      revoker: noopRevoker,
      guard,
    });

    const bootRes = await session.onBoot({
      search: '',
      hash: '#error=interaction_required&state=silent-state',
    });

    expect(session.grant()).toEqual({ kind: 'reconnect', account: 'user@example.com' });
    expect(store.read()).toEqual({ kind: 'reconnect', account: 'user@example.com' });
    expect(bootRes.kind).toBe('failed');
    expect(location.replaceStateCalls).toEqual(['https://openisd.app/']);
  });

  it('#error=access_denied on a user connect → denied', async () => {
    const storage = createMemoryStorage();
    const store = createTokenStore(storage);
    store.write({
      kind: 'pending',
      state: 'user-state',
      returnTo: '/my-project',
      silent: false,
    });
    const location = createMockLocation(
      'https://openisd.app/#error=access_denied&state=user-state',
      '#error=access_denied&state=user-state',
    );
    const guard = createMockGuard();
    const session = createImplicitSession({
      config: baseConfig,
      store,
      location,
      clock: () => 1000000,
      random: dummyRandom,
      revoker: noopRevoker,
      guard,
    });

    const bootRes = await session.onBoot({
      search: '',
      hash: '#error=access_denied&state=user-state',
    });

    expect(bootRes).toEqual({ kind: 'denied', returnTo: '/my-project' });
    expect(location.replaceStateCalls).toEqual(['https://openisd.app/']);
  });

  it('clientId null → beginConnect is a no-op and grant is none', () => {
    const nullConfig: OAuthConfig = {
      clientId: null,
      redirectUri: 'https://openisd.app/',
      scopes: ['drive.appdata'],
    };
    const storage = createMemoryStorage();
    const store = createTokenStore(storage);
    const location = createMockLocation('https://openisd.app/');
    const guard = createMockGuard();
    const session = createImplicitSession({
      config: nullConfig,
      store,
      location,
      clock: () => 1000000,
      random: dummyRandom,
      revoker: noopRevoker,
      guard,
    });

    expect(session.grant()).toEqual({ kind: 'none' });
    session.beginConnect('connect');
    expect(guard.leaveCalls).toEqual([]);
    expect(store.read()).toEqual({ kind: 'none' });
    expect(session.grant()).toEqual({ kind: 'none' });
  });

  it('the fragment is stripped after a callback', async () => {
    const storage = createMemoryStorage();
    const store = createTokenStore(storage);
    store.write({
      kind: 'pending',
      state: 'valid-state',
      returnTo: '/dashboard',
      silent: false,
      account: 'test@example.com',
    });
    const location = createMockLocation(
      'https://openisd.app/#access_token=ya29.ok&expires_in=3600&state=valid-state',
      '#access_token=ya29.ok&expires_in=3600&state=valid-state',
    );
    const guard = createMockGuard();
    const session = createImplicitSession({
      config: baseConfig,
      store,
      location,
      clock: () => 1000000,
      random: dummyRandom,
      revoker: noopRevoker,
      guard,
    });

    const bootRes = await session.onBoot({
      search: '',
      hash: '#access_token=ya29.ok&expires_in=3600&state=valid-state',
    });

    expect(bootRes).toEqual({
      kind: 'connected',
      account: 'test@example.com',
      returnTo: '/dashboard',
    });
    expect(location.replaceStateCalls).toEqual(['https://openisd.app/']);
    expect(store.read()).toEqual({
      kind: 'token',
      accessToken: 'ya29.ok',
      expiresAt_ms: 1000000 + 3600 * 1000,
      account: 'test@example.com',
    });
  });

  it('disconnect writes none', async () => {
    const storage = createMemoryStorage();
    const store = createTokenStore(storage);
    store.write({
      kind: 'token',
      accessToken: 'ya29.active',
      expiresAt_ms: 2000000,
      account: 'test@example.com',
    });
    const revokeFn = vi.fn(async (_token: string) => {});
    const revoker: Revoker = { revoke: revokeFn };
    const location = createMockLocation('https://openisd.app/');
    const guard = createMockGuard();
    const session = createImplicitSession({
      config: baseConfig,
      store,
      location,
      clock: () => 1000000,
      random: dummyRandom,
      revoker,
      guard,
    });

    await session.disconnect();

    expect(revokeFn).toHaveBeenCalledWith('ya29.active');
    expect(store.read()).toEqual({ kind: 'none' });
    expect(session.grant()).toEqual({ kind: 'none' });
  });
});

describe('implicitSession nameAccount', () => {
  const baseConfig: OAuthConfig = {
    clientId: 'client-id-123.apps.googleusercontent.com',
    redirectUri: 'https://openisd.app/',
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  };

  it('stores the email on the held token, keeping the token', () => {
    const store = createTokenStore(createMemoryStorage());
    store.write({ kind: 'token', accessToken: 'tok', expiresAt_ms: 10_000_000, account: '' });
    const session = createImplicitSession({
      config: baseConfig, store, location: createMockLocation('https://openisd.app/'), clock: () => 1000,
      random: dummyRandom, revoker: noopRevoker, guard: createMockGuard(),
    });
    session.nameAccount('john@example.com');
    expect(store.read()).toEqual({ kind: 'token', accessToken: 'tok', expiresAt_ms: 10_000_000, account: 'john@example.com' });
    expect(session.grant()).toEqual({ kind: 'connected', account: 'john@example.com' });
  });

  it('does nothing when no token is held', () => {
    const store = createTokenStore(createMemoryStorage());
    const session = createImplicitSession({
      config: baseConfig, store, location: createMockLocation('https://openisd.app/'), clock: () => 1000,
      random: dummyRandom, revoker: noopRevoker, guard: createMockGuard(),
    });
    session.nameAccount('john@example.com');
    expect(store.read()).toEqual({ kind: 'none' });
  });
});
