import { describe, it, expect } from 'vitest';
import {
  buildAuthUrl,
  isOAuthFragment,
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

  describe('isOAuthFragment', () => {
    it('returns true when fragment has access_token together with state', () => {
      expect(isOAuthFragment('#access_token=ya29.test-token&state=st-123')).toBe(true);
      expect(isOAuthFragment('access_token=ya29.test-token&expires_in=3600&state=st-123')).toBe(true);
    });

    it('returns true when fragment has error together with state', () => {
      expect(isOAuthFragment('#error=access_denied&state=st-123')).toBe(true);
      expect(isOAuthFragment('error=interaction_required&state=st-xyz')).toBe(true);
    });

    it('returns false when fragment has access_token or error without state', () => {
      expect(isOAuthFragment('#access_token=ya29.test-token')).toBe(false);
      expect(isOAuthFragment('#error=access_denied')).toBe(false);
      expect(isOAuthFragment('#error=access_denied&state=')).toBe(false);
      expect(isOAuthFragment('#access_token=ya29.test-token&state=')).toBe(false);
    });

    it('returns false when fragment has state without access_token or error', () => {
      expect(isOAuthFragment('#state=st-123')).toBe(false);
      expect(isOAuthFragment('#state=st-123&other=value')).toBe(false);
    });

    it('returns false for share-link fragment', () => {
      expect(isOAuthFragment('#s=eJzT0yMAAGQAAdw')).toBe(false);
      expect(isOAuthFragment('#s=eyJmb28iOiJlcnJvcj1iYXIifQ')).toBe(false);
    });

    it('returns false for fragment that merely contains error= in a value', () => {
      expect(isOAuthFragment('#param=error=something')).toBe(false);
      expect(isOAuthFragment('#filter=error=failed&page=1')).toBe(false);
      expect(isOAuthFragment('#state=123&note=error=none')).toBe(false);
    });

    it('returns false for empty or non-OAuth fragments', () => {
      expect(isOAuthFragment('')).toBe(false);
      expect(isOAuthFragment('#')).toBe(false);
      expect(isOAuthFragment('#section-title')).toBe(false);
    });
  });
});

