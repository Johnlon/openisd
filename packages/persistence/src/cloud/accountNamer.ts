import type { CloudFault, CloudGrant, CloudResult } from '@openisd/design/cloud';

/** Asks Drive who is signed in. */
export interface CloudIdentity {
  signedInEmail(): Promise<CloudResult<string>>;
}

/** Names a connected account the sign-in left unnamed. */
export interface AccountNamer {
  nameIfUnknown(): Promise<void>;
}

export interface AccountNamerDeps {
  readonly grant: () => CloudGrant;
  readonly identity: CloudIdentity;
  /** Stores the email as the account's name. */
  readonly nameAccount: (email: string) => void;
  /** Google refused to say; told once per page load. */
  readonly onRefused: (fault: CloudFault) => void;
}

export function createAccountNamer(deps: AccountNamerDeps): AccountNamer {
  let refused = false;
  return {
    async nameIfUnknown(): Promise<void> {
      const grant = deps.grant();
      if (refused || grant.kind !== 'connected' || grant.account !== '') return;
      const res = await deps.identity.signedInEmail();
      switch (res.kind) {
        case 'ok':
          deps.nameAccount(res.value);
          return;
        case 'faulted':
          refused = true;
          deps.onRefused(res.fault);
          return;
        case 'offline':
        case 'unauthorised':
        case 'quota':
        case 'moved':
        case 'cursorExpired':
        case 'malformed':
        case 'failed':
          // Not a refusal: ask again before the next run.
          return;
      }
    },
  };
}
