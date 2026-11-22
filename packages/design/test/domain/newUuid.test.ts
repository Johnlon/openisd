import {afterEach, describe, expect, it, vi} from 'vitest';
import {newUuid} from '../../domain/newUuid.js';

describe('newUuid', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when the platform provides it', () => {
    const stub = vi.fn(() => '11111111-2222-4333-8444-555555555555');
    vi.stubGlobal('crypto', {randomUUID: stub});
    expect(newUuid()).toBe('11111111-2222-4333-8444-555555555555');
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it('falls back to a manual v4 uuid when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    const id = newUuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('falls back when crypto exists but has no randomUUID function', () => {
    vi.stubGlobal('crypto', {});
    const id = newUuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('the manual fallback produces different ids on successive calls', () => {
    vi.stubGlobal('crypto', undefined);
    expect(newUuid()).not.toBe(newUuid());
  });
});
