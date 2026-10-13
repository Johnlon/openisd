import { describe, expect, it, vi } from 'vitest';
import {
  createRedirectGuard,
  type RedirectGuard,
  type RedirectGuardDeps,
} from '../../../src/cloud/auth/redirectGuard.js';

describe('createRedirectGuard', () => {
  it('executes the four steps in order: commit, flush, record, navigate', () => {
    const callOrder: string[] = [];
    const commitFocusedField = vi.fn(() => {
      callOrder.push('commit');
    });
    const flushPendingSaves = vi.fn(() => {
      callOrder.push('flush');
    });
    const recordOpenProjectId = vi.fn(() => {
      callOrder.push('record');
    });
    const assign = vi.fn((_url: string) => {
      callOrder.push('assign');
    });

    const deps: RedirectGuardDeps = {
      commitFocusedField,
      flushPendingSaves,
      recordOpenProjectId,
      location: { assign },
    };

    const guard: RedirectGuard = createRedirectGuard(deps);
    const targetUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=123';
    guard.leave(targetUrl);

    expect(callOrder).toEqual(['commit', 'flush', 'record', 'assign']);
    expect(commitFocusedField).toHaveBeenCalledTimes(1);
    expect(flushPendingSaves).toHaveBeenCalledTimes(1);
    expect(recordOpenProjectId).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(targetUrl);
  });

  it('a throw in a flush does not navigate and is reported', () => {
    const commitFocusedField = vi.fn();
    const flushPendingSaves = vi.fn(() => {
      throw new Error('Quota exceeded on save');
    });
    const recordOpenProjectId = vi.fn();
    const assign = vi.fn();

    const guard = createRedirectGuard({
      commitFocusedField,
      flushPendingSaves,
      recordOpenProjectId,
      location: { assign },
    });

    expect(() => guard.leave('https://accounts.google.com/auth')).toThrow(
      'Quota exceeded on save',
    );
    expect(commitFocusedField).toHaveBeenCalledTimes(1);
    expect(flushPendingSaves).toHaveBeenCalledTimes(1);
    expect(recordOpenProjectId).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
