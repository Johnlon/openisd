import {describe, expect, it} from 'vitest';
import {ref} from 'vue';
import {CompatSwitchGroup, WinisdDeviation, WinisdDifference, WinisdDifferenceSection, WinisdFilterDeviation} from '@openisd/design/fields';
import {useWinisdDifferencesModal} from '../../src/hooks/WinisdDifferencesModal-hooks.js';

describe('useWinisdDifferencesModal', () => {
  it('starts closed, and lists every section of the page', () => {
    const h = useWinisdDifferencesModal();
    expect(h.open.value).toBe(false);
    expect(h.sections).toEqual(WinisdDifferenceSection.ALL);
  });

  it('the Help menu opens the page at the top', () => {
    const h = useWinisdDifferencesModal();
    h.show();
    expect(h.open.value).toBe(true);
    expect(h.target.value).toBeNull();
  });

  it('a group heading\'s help link opens the page at that group\'s section', () => {
    const h = useWinisdDifferencesModal();
    h.showGroup(CompatSwitchGroup.OPTIONS);
    expect(h.open.value).toBe(true);
    expect(h.target.value).toBe(WinisdDifferenceSection.OPTIONS);
  });

  it('a ≠W cue opens the page at that cue\'s entry', () => {
    const h = useWinisdDifferencesModal();
    h.showDeviation(WinisdFilterDeviation.LINKWITZ_RILEY_ORDER);
    expect(h.target.value).toBe(WinisdDifference.forDeviation(WinisdFilterDeviation.LINKWITZ_RILEY_ORDER));
    h.showDeviation(WinisdDeviation.VA_MODEL);
    expect(h.target.value?.anchor).toBe(WinisdDifference.forDeviation(WinisdDeviation.VA_MODEL).anchor);
  });

  it('closing clears the target, so the menu reopens at the top', () => {
    const h = useWinisdDifferencesModal();
    h.showGroup(CompatSwitchGroup.BUGS);
    h.close();
    expect(h.open.value).toBe(false);
    h.show();
    expect(h.target.value).toBeNull();
  });

  it('the ≠W cues follow the app setting "Show WinISD difference markers"', () => {
    const shown = ref(true);
    const h = useWinisdDifferencesModal({differenceCuesShown: () => shown.value});
    expect(h.cuesShown.value).toBe(true);
    shown.value = false;
    expect(h.cuesShown.value).toBe(false);
    h.show();
    expect(h.open.value).toBe(true);
  });
});
