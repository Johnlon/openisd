import type { CloudSession } from '../cloudStore.js';
import {
  buildAuthUrl,
  parseCallbackFragment,
  type AuthPrompt,
  type OAuthConfig,
} from '@openisd/design/cloud';
import type { Revoker } from './googleRevoker.js';
import type { TokenStore } from './tokenStore.js';

export interface SessionLocation {
  readonly href: string;
  readonly hash: string;
  assign(url: string): void;
  replaceState(url: string): void;
}

export interface ImplicitSessionDeps {
  readonly config: OAuthConfig;
  readonly location: SessionLocation;
  readonly random: () => Uint8Array;
  readonly store: TokenStore;
  readonly clock: () => number;
  readonly revoker: Revoker;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

function mintState(random: () => Uint8Array): string {
  return bytesToHex(random());
}

function stripFragment(location: SessionLocation): void {
  const clean = location.href.split('#')[0] ?? location.href;
  location.replaceState(clean);
}

const EXPIRY_BUFFER_MS = 60_000;

export function createImplicitSession(deps: ImplicitSessionDeps): CloudSession {
  const { config, store, location, clock, random, revoker } = deps;

  return {
    grant(): { readonly kind: 'none' } | { readonly kind: 'connected'; readonly account: string } | { readonly kind: 'reconnect'; readonly account: string } {
      if (config.clientId === null || config.clientId === '') {
        return { kind: 'none' };
      }
      const stored = store.read();
      switch (stored.kind) {
        case 'none':
        case 'pending':
          return { kind: 'none' };
        case 'reconnect':
          return { kind: 'reconnect', account: stored.account };
        case 'token': {
          const remaining_ms = stored.expiresAt_ms - clock();
          if (remaining_ms <= EXPIRY_BUFFER_MS) {
            return { kind: 'reconnect', account: stored.account };
          }
          return { kind: 'connected', account: stored.account };
        }
      }
    },

    async accessToken(): Promise<
      | { readonly kind: 'ok'; readonly token: string }
      | { readonly kind: 'none' }
      | { readonly kind: 'reconnect' }
      | { readonly kind: 'offline' }
    > {
      if (config.clientId === null || config.clientId === '') {
        return { kind: 'none' };
      }
      const stored = store.read();
      switch (stored.kind) {
        case 'none':
        case 'pending':
          return { kind: 'none' };
        case 'reconnect':
          return { kind: 'reconnect' };
        case 'token': {
          const remaining_ms = stored.expiresAt_ms - clock();
          if (remaining_ms <= EXPIRY_BUFFER_MS) {
            store.write({ kind: 'reconnect', account: stored.account });
            return { kind: 'reconnect' };
          }
          return { kind: 'ok', token: stored.accessToken };
        }
      }
    },

    async onBoot(bootLoc: { readonly search: string; readonly hash: string }): Promise<
      | { readonly kind: 'notACallback' }
      | { readonly kind: 'connected'; readonly account: string; readonly returnTo: string }
      | { readonly kind: 'denied'; readonly returnTo: string }
      | { readonly kind: 'failed'; readonly reason: string; readonly returnTo: string }
      | { readonly kind: 'willRedirect'; readonly go: () => void }
    > {
      const fragment = bootLoc.hash !== '' ? bootLoc.hash : location.hash;
      const parsed = parseCallbackFragment(fragment !== '' ? fragment : bootLoc.search);

      if (parsed.kind !== 'notACallback') {
        stripFragment(location);
        const stored = store.read();

        if (parsed.kind === 'error') {
          if (stored.kind === 'pending') {
            if (parsed.state !== null && parsed.state !== stored.state) {
              return { kind: 'failed', reason: 'Invalid state', returnTo: stored.returnTo };
            }
            if (stored.silent) {
              const account = stored.account ?? '';
              store.write({ kind: 'reconnect', account });
              return { kind: 'failed', reason: parsed.error, returnTo: stored.returnTo };
            }
            if (parsed.error === 'access_denied') {
              store.write({ kind: 'none' });
              return { kind: 'denied', returnTo: stored.returnTo };
            }
            store.write({ kind: 'none' });
            return { kind: 'failed', reason: parsed.error, returnTo: stored.returnTo };
          }
          return { kind: 'failed', reason: parsed.error, returnTo: '/' };
        }

        if (parsed.kind === 'token') {
          if (stored.kind !== 'pending' || stored.state !== parsed.state) {
            const returnTo = stored.kind === 'pending' ? stored.returnTo : '/';
            return { kind: 'failed', reason: 'Invalid state', returnTo };
          }
          const expiresAt_ms = clock() + parsed.expiresIn_s * 1000;
          const account = stored.account ?? '';
          store.write({
            kind: 'token',
            accessToken: parsed.accessToken,
            expiresAt_ms,
            account,
          });
          return {
            kind: 'connected',
            account,
            returnTo: stored.returnTo,
          };
        }
      }

      const stored = store.read();
      if (stored.kind === 'pending' && stored.silent) {
        const account = stored.account ?? '';
        store.write({ kind: 'reconnect', account });
        return { kind: 'notACallback' };
      }

      if (stored.kind === 'token') {
        const remaining_ms = stored.expiresAt_ms - clock();
        if (remaining_ms <= EXPIRY_BUFFER_MS) {
          if (config.clientId === null || config.clientId === '') {
            return { kind: 'notACallback' };
          }
          return {
            kind: 'willRedirect',
            go: () => {
              const state = mintState(random);
              const returnTo = location.href.split('#')[0] ?? location.href;
              store.write({
                kind: 'pending',
                state,
                returnTo,
                silent: true,
                account: stored.account,
              });
              const url = buildAuthUrl(config, { state, prompt: 'none' });
              if (url !== null) {
                location.assign(url);
              }
            },
          };
        }
      }

      return { kind: 'notACallback' };
    },

    beginConnect(reason: 'connect' | 'reconnect'): void {
      if (config.clientId === null || config.clientId === '') {
        return;
      }
      const stored = store.read();
      let account: string | undefined;
      if (stored.kind === 'token' || stored.kind === 'reconnect') {
        account = stored.account;
      }
      const state = mintState(random);
      const returnTo = location.href.split('#')[0] ?? location.href;
      store.write({
        kind: 'pending',
        state,
        returnTo,
        silent: false,
        ...(account !== undefined ? { account } : {}),
      });
      const prompt: AuthPrompt = reason === 'reconnect' ? 'select_account' : 'consent';
      const url = buildAuthUrl(config, { state, prompt });
      if (url !== null) {
        location.assign(url);
      }
    },

    async disconnect(): Promise<void> {
      const stored = store.read();
      if (stored.kind === 'token' && stored.accessToken !== '') {
        try {
          await revoker.revoke(stored.accessToken);
        } catch {
          /* best effort */
        }
      }
      store.write({ kind: 'none' });
    },
  };
}
