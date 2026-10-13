export interface OAuthConfig {
  readonly clientId: string | null;
  readonly redirectUri: string;
  readonly scope?: string;
  readonly scopes?: readonly string[];
}

export type AuthPrompt = 'consent' | 'select_account' | 'none';

export interface BuildAuthUrlParams {
  readonly state: string;
  readonly prompt?: AuthPrompt;
}

export type CallbackFragment =
  | { readonly kind: 'token'; readonly accessToken: string; readonly expiresIn_s: number; readonly state: string }
  | { readonly kind: 'error'; readonly error: string; readonly state: string | null }
  | { readonly kind: 'notACallback' };

export function buildAuthUrl(config: OAuthConfig, params: BuildAuthUrlParams): string | null {
  if (config.clientId === null || config.clientId === '') {
    return null;
  }
  const scope = config.scope ?? (config.scopes ? config.scopes.join(' ') : 'https://www.googleapis.com/auth/drive.appdata');
  const prompt = params.prompt ?? 'consent';

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', scope);
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', params.state);
  url.searchParams.set('prompt', prompt);

  return url.toString();
}

export function parseCallbackFragment(fragment: string): CallbackFragment {
  if (fragment === '') {
    return { kind: 'notACallback' };
  }
  let query = fragment;
  const hashIdx = query.indexOf('#');
  if (hashIdx >= 0) {
    query = query.slice(hashIdx + 1);
  }
  const qIdx = query.indexOf('?');
  if (qIdx >= 0) {
    query = query.slice(qIdx + 1);
  }
  if (query === '') {
    return { kind: 'notACallback' };
  }
  const params = new URLSearchParams(query);
  const error = params.get('error');
  if (error !== null && error !== '') {
    const state = params.get('state');
    return {
      kind: 'error',
      error,
      state: state !== null && state !== '' ? state : null,
    };
  }
  const accessToken = params.get('access_token');
  if (accessToken !== null && accessToken !== '') {
    const expiresInStr = params.get('expires_in');
    const expiresIn_s = expiresInStr !== null ? Number(expiresInStr) : 3600;
    const state = params.get('state') ?? '';
    return {
      kind: 'token',
      accessToken,
      expiresIn_s: Number.isFinite(expiresIn_s) && expiresIn_s > 0 ? expiresIn_s : 3600,
      state,
    };
  }
  return { kind: 'notACallback' };
}
