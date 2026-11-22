import { describe, expect, it } from 'vitest';
import type { CloudFault, CloudGrant, CloudResult } from '@openisd/design/cloud';
import { createAccountNamer, type CloudIdentity } from '../../src/cloud/accountNamer.js';

class FakeIdentity implements CloudIdentity {
  calls = 0;
  constructor(private readonly reply: CloudResult<string>) {}
  signedInEmail(): Promise<CloudResult<string>> {
    this.calls++;
    return Promise.resolve(this.reply);
  }
}

function harness(grant: CloudGrant, reply: CloudResult<string>) {
  const identity = new FakeIdentity(reply);
  const named: string[] = [];
  const refused: CloudFault[] = [];
  const namer = createAccountNamer({
    grant: () => grant,
    identity,
    nameAccount: (email) => named.push(email),
    onRefused: (fault) => refused.push(fault),
  });
  return { identity, named, refused, namer };
}

const FORBIDDEN: CloudFault = { operation: 'about', status: 403, reason: 'insufficientPermissions', reply: '{}' };

describe('accountNamer', () => {
  it('asks Drive for the email when the account has no name, and stores it', async () => {
    const h = harness({ kind: 'connected', account: '' }, { kind: 'ok', value: 'john@example.com' });
    await h.namer.nameIfUnknown();
    expect(h.named).toEqual(['john@example.com']);
    expect(h.refused).toEqual([]);
  });

  it('does not ask when the account already has a name or there is no grant', async () => {
    const named = harness({ kind: 'connected', account: 'john@example.com' }, { kind: 'ok', value: 'x@y' });
    await named.namer.nameIfUnknown();
    const none = harness({ kind: 'none' }, { kind: 'ok', value: 'x@y' });
    await none.namer.nameIfUnknown();
    expect(named.identity.calls + none.identity.calls).toBe(0);
  });

  it('a refusal is reported once and not asked again', async () => {
    const h = harness({ kind: 'connected', account: '' }, { kind: 'faulted', fault: FORBIDDEN });
    await h.namer.nameIfUnknown();
    await h.namer.nameIfUnknown();
    expect(h.refused).toEqual([FORBIDDEN]);
    expect(h.identity.calls).toBe(1);
    expect(h.named).toEqual([]);
  });

  it('being offline is not a refusal: it asks again next time', async () => {
    const h = harness({ kind: 'connected', account: '' }, { kind: 'offline' });
    await h.namer.nameIfUnknown();
    await h.namer.nameIfUnknown();
    expect(h.identity.calls).toBe(2);
    expect(h.refused).toEqual([]);
  });
});
