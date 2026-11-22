import type { Http } from '../http.js';

export interface Revoker {
  revoke(token: string): Promise<void>;
}

export function createGoogleRevoker(http: Http): Revoker {
  return {
    async revoke(token: string): Promise<void> {
      try {
        await http.send({
          method: 'POST',
          url: `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        /* best effort: offline/failed is ignored */
      }
    },
  };
}
