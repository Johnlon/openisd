import {describe, expect, it, vi} from 'vitest';
import {ref} from 'vue';
import type {ReloadLoss} from '@openisd/design/fields';
import {createAppUpdateUi, type UpdateUiSource} from '../../src/hooks/appUpdateUi.js';
import type {UpdateState} from '../../src/logic/appUpdate.js';

// T829 (John, 2026-11-15: "pulling a new version says you lose unsaved but that's not true"): the first tests
// here used to say Reload asks first "when edits are unsaved". Unsaved edits come back after a reload, so that
// question was false; those tests pinned the wrong behaviour and now say when the question is asked: only
// when `losses()` names something a reload really loses.
function build(losses: readonly ReloadLoss[], answer: boolean, kind: UpdateState['kind'] = 'offered') {
  const source: UpdateUiSource = {
    state: ref<UpdateState>({kind}),
    losses: () => losses,
    acceptOffer: vi.fn(),
    dismiss: vi.fn(),
    forceRefresh: vi.fn(() => Promise.resolve()),
  };
  const ask = vi.fn(() => Promise.resolve(answer));
  return {source, ask, ui: createAppUpdateUi(source, {ask})};
}

describe('createAppUpdateUi', () => {
  it('offers only in the offered state', () => {
    expect(build([], true, 'offered').ui.offered.value).toBe(true);
    expect(build([], true, 'dismissed').ui.offered.value).toBe(false);
    expect(build([], true, 'current').ui.offered.value).toBe(false);
  });

  it('Reload asks first when the reload would lose something, naming it, and does nothing on Keep', async () => {
    const t = build(['editorDraft'], false);
    await t.ui.reload();
    expect(t.ask).toHaveBeenCalledTimes(1);
    expect(t.ask).toHaveBeenCalledWith(expect.objectContaining({message: 'The values you typed in the driver editor are not applied yet, so reloading loses them.'}));
    expect(t.source.acceptOffer).not.toHaveBeenCalled();
  });

  it('Reload goes ahead on Reload', async () => {
    const t = build(['whatIf'], true);
    await t.ui.reload();
    expect(t.source.acceptOffer).toHaveBeenCalledTimes(1);
  });

  it('Reload does not ask when nothing would be lost (unsaved edits are kept by the session)', async () => {
    const t = build([], false);
    await t.ui.reload();
    expect(t.ask).not.toHaveBeenCalled();
    expect(t.source.acceptOffer).toHaveBeenCalledTimes(1);
  });

  it('Not now dismisses', () => {
    const t = build(['editorDraft'], true);
    t.ui.dismiss();
    expect(t.source.dismiss).toHaveBeenCalledTimes(1);
  });

  it('Force refresh asks first only when something would be lost', async () => {
    const t = build(['unstoredEdits'], false);
    await t.ui.forceRefresh();
    expect(t.source.forceRefresh).not.toHaveBeenCalled();
    const u = build(['unstoredEdits'], true);
    await u.ui.forceRefresh();
    expect(u.source.forceRefresh).toHaveBeenCalledTimes(1);
    const v = build([], false);
    await v.ui.forceRefresh();
    expect(v.ask).not.toHaveBeenCalled();
    expect(v.source.forceRefresh).toHaveBeenCalledTimes(1);
  });
});
