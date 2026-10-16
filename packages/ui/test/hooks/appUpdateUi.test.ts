import {describe, expect, it, vi} from 'vitest';
import {ref} from 'vue';
import {createAppUpdateUi, type UpdateUiSource} from '../../src/hooks/appUpdateUi.js';
import type {UpdateState} from '../../src/logic/appUpdate.js';

function build(unsaved: boolean, answer: boolean, kind: UpdateState['kind'] = 'offered') {
  const source: UpdateUiSource = {
    state: ref<UpdateState>({kind}),
    acceptOffer: vi.fn(),
    dismiss: vi.fn(),
    forceRefresh: vi.fn(() => Promise.resolve()),
  };
  const ask = vi.fn(() => Promise.resolve(answer));
  return {source, ask, ui: createAppUpdateUi(source, () => unsaved, {ask})};
}

describe('createAppUpdateUi', () => {
  it('offers only in the offered state', () => {
    expect(build(true, true, 'offered').ui.offered.value).toBe(true);
    expect(build(true, true, 'dismissed').ui.offered.value).toBe(false);
    expect(build(true, true, 'current').ui.offered.value).toBe(false);
  });

  it('Reload asks first when edits are unsaved, and does nothing on Keep', async () => {
    const t = build(true, false);
    await t.ui.reload();
    expect(t.ask).toHaveBeenCalledTimes(1);
    expect(t.source.acceptOffer).not.toHaveBeenCalled();
  });

  it('Reload goes ahead on Reload', async () => {
    const t = build(true, true);
    await t.ui.reload();
    expect(t.source.acceptOffer).toHaveBeenCalledTimes(1);
  });

  it('Reload does not ask when nothing is unsaved', async () => {
    const t = build(false, false);
    await t.ui.reload();
    expect(t.ask).not.toHaveBeenCalled();
    expect(t.source.acceptOffer).toHaveBeenCalledTimes(1);
  });

  it('Not now dismisses', () => {
    const t = build(true, true);
    t.ui.dismiss();
    expect(t.source.dismiss).toHaveBeenCalledTimes(1);
  });

  it('Force refresh asks first when edits are unsaved', async () => {
    const t = build(true, false);
    await t.ui.forceRefresh();
    expect(t.source.forceRefresh).not.toHaveBeenCalled();
    const u = build(true, true);
    await u.ui.forceRefresh();
    expect(u.source.forceRefresh).toHaveBeenCalledTimes(1);
  });
});
