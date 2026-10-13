import { describe, it, expect } from 'vitest';
import {
  buildAuthUrl,
  parseCallbackFragment,
  type OAuthConfig,
} from '../../cloud/oauthRedirect.js';

describe('oauthRedirect', () => {
  describe('buildAuthUrl', () => {
    const baseConfig: OAuthConfig = {
      clientId: 'test-client-id.apps.googleusercontent.com',
      redirectUri: 'https://openisd.app/',
      scope: 'https://www.googleapis.com/auth/drive.appdata',
    };

    it('builds the Google auth URL with default consent prompt', () => {
      const urlStr = buildAuthUrl(baseConfig, { state: 'state-123' });
      expect(urlStr).not.toBeNull();
      if (!urlStr) return;
      const url = new URL(urlStr);
      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
      expect(url.searchParams.get('redirect_uri')).toBe('https://openisd.app/');
      expect(url.searchParams.get('response_type')).toBe('token');
      expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.appdata');
      expect(url.searchParams.get('include_granted_scopes')).toBe('true');
      expect(url.searchParams.get('state')).toBe('state-123');
      expect(url.searchParams.get('prompt')).toBe('consent');
    });

    it('supports prompt=select_account for reconnect', () => {
      const urlStr = buildAuthUrl(baseConfig, { state: 'state-rec', prompt: 'select_account' });
      expect(urlStr).not.toBeNull();
      if (!urlStr) return;
      const url = new URL(urlStr);
      expect(url.searchParams.get('prompt')).toBe('select_account');
    });

    it('supports prompt=none for silent renewal', () => {
      const urlStr = buildAuthUrl(baseConfig, { state: 'state-silent', prompt: 'none' });
      expect(urlStr).not.toBeNull();
      if (!urlStr) return;
      const url = new URL(urlStr);
      expect(url.searchParams.get('prompt')).toBe('none');
    });

    it('supports scopes array in config', () => {
      const configWithScopes: OAuthConfig = {
        clientId: 'test-client-id',
        redirectUri: 'https://openisd.app/',
        scopes: ['https://www.googleapis.com/auth/drive.appdata', 'openid', 'email'],
      };
      const urlStr = buildAuthUrl(configWithScopes, { state: 'state-scopes' });
      expect(urlStr).not.toBeNull();
      if (!urlStr) return;
      const url = new URL(urlStr);
      expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.appdata openid email');
    });

    it('returns null when clientId is null', () => {
      const config: OAuthConfig = {
        clientId: null,
        redirectUri: 'https://openisd.app/',
        scope: 'drive.appdata',
      };
      expect(buildAuthUrl(config, { state: 'st' })).toBeNull();
    });
  });

  describe('parseCallbackFragment', () => {
    it('parses valid access token callback fragment with leading hash', () => {
      const hash = '#access_token=ya29.test-token&token_type=Bearer&expires_in=3599&state=state-abc';
      const parsed = parseCallbackFragment(hash);
      expect(parsed).toEqual({
        kind: 'token',
        accessToken: 'ya29.test-token',
        expiresIn_s: 3599,
        state: 'state-abc',
      });
    });

    it('parses valid access token callback fragment without leading hash', () => {
      const query = 'access_token=ya29.no-hash&expires_in=1800&state=st-xyz';
      const parsed = parseCallbackFragment(query);
      expect(parsed).toEqual({
        kind: 'token',
        accessToken: 'ya29.no-hash',
        expiresIn_s: 1800,
        state: 'st-xyz',
      });
    });

    it('parses error callback fragment (e.g. access_denied)', () => {
      const hash = '#error=access_denied&state=st-denied';
      const parsed = parseCallbackFragment(hash);
      expect(parsed).toEqual({
        kind: 'error',
        error: 'access_denied',
        state: 'st-denied',
      });
    });

    it('parses error callback fragment without state', () => {
      const hash = '#error=interaction_required';
      const parsed = parseCallbackFragment(hash);
      expect(parsed).toEqual({
        kind: 'error',
        error: 'interaction_required',
        state: null,
      });
    });

    it('returns notACallback for empty fragment or non-callback hash', () => {
      expect(parseCallbackFragment('')).toEqual({ kind: 'notACallback' });
      expect(parseCallbackFragment('#')).toEqual({ kind: 'notACallback' });
      expect(parseCallbackFragment('#heading-1')).toEqual({ kind: 'notACallback' });
      expect(parseCallbackFragment('#some_random_key=value')).toEqual({ kind: 'notACallback' });
    });
  });
});
