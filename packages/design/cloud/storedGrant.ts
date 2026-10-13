import { field } from './syncDoc.js';

export type StoredGrant =
  | { readonly kind: 'none' }
  | { readonly kind: 'pending'; readonly state: string; readonly returnTo: string; readonly silent: boolean; readonly account?: string }
  | { readonly kind: 'token'; readonly accessToken: string; readonly expiresAt_ms: number; readonly account: string }
  | { readonly kind: 'reconnect'; readonly account: string };

export function parseStoredGrant(text: string | null): StoredGrant {
  if (text === null || text === '') {
    return { kind: 'none' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'none' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'none' };
  }
  const kind = field(parsed, 'kind');
  if (kind === 'none') {
    return { kind: 'none' };
  }
  if (kind === 'pending') {
    const state = field(parsed, 'state');
    const returnTo = field(parsed, 'returnTo');
    const silent = field(parsed, 'silent');
    const account = field(parsed, 'account');
    if (typeof state !== 'string' || typeof returnTo !== 'string' || typeof silent !== 'boolean') {
      return { kind: 'none' };
    }
    return {
      kind: 'pending',
      state,
      returnTo,
      silent,
      ...(typeof account === 'string' ? { account } : {}),
    };
  }
  if (kind === 'token') {
    const accessToken = field(parsed, 'accessToken');
    const expiresAt = field(parsed, 'expiresAt_ms');
    const account = field(parsed, 'account');
    if (
      typeof accessToken !== 'string' ||
      accessToken === '' ||
      typeof expiresAt !== 'number' ||
      !Number.isFinite(expiresAt) ||
      typeof account !== 'string'
    ) {
      return { kind: 'none' };
    }
    return {
      kind: 'token',
      accessToken,
      expiresAt_ms: expiresAt,
      account,
    };
  }
  if (kind === 'reconnect') {
    const account = field(parsed, 'account');
    if (typeof account !== 'string') {
      return { kind: 'none' };
    }
    return {
      kind: 'reconnect',
      account,
    };
  }
  return { kind: 'none' };
}
