import {describe, expect, it} from 'vitest';
import {reactive} from 'vue';
import {useSplashModal, type SplashState} from '../../src/hooks/SplashModal-hooks.js';

function state(seen?: boolean): SplashState {
  return reactive<SplashState>({ui: seen === undefined ? {} : {splashSeen: seen}});
}

describe('useSplashModal', () => {
  it('opens on a first visit — nothing has recorded that the splash was seen', () => {
    expect(useSplashModal(state()).open.value).toBe(true);
  });

  it('stays shut on a later visit', () => {
    expect(useSplashModal(state(true)).open.value).toBe(false);
  });

  it('dismissing records that it was seen, so the next visit is quiet', () => {
    const s = state();
    const api = useSplashModal(s);
    api.dismiss();
    expect(api.open.value).toBe(false);
    expect(s.ui.splashSeen).toBe(true);
    expect(useSplashModal(s).open.value).toBe(false);
  });

  it('show() reopens it after dismissal — the Info menu entry', () => {
    const s = state(true);
    const api = useSplashModal(s);
    api.show();
    expect(api.open.value).toBe(true);
  });
});
