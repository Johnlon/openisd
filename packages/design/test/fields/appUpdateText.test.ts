/**
 * What the app says before a reload that would lose something (T829, John 2026-11-15: "pulling a new version
 * says you lose unsaved but that's not true"). Unsaved edits are kept in the stored session and come back
 * still unsaved, so the question is only asked for what a reload really loses, and it names each thing.
 */
import {describe, expect, it} from 'vitest';
import {APP_UPDATE_TEXT, reloadLossConfirm} from '../../fields/appUpdateText.js';

describe('reloadLossConfirm', () => {
  it('names the driver editor values that are not applied', () => {
    const ask = reloadLossConfirm(['editorDraft']);
    expect(ask.message).toBe('The values you typed in the driver editor are not applied yet, so reloading loses them.');
  });

  it('names a What-if the same way', () => {
    expect(reloadLossConfirm(['whatIf']).message).toBe('The values you are trying in What-if are only an experiment, so reloading loses them.');
  });

  it('says the browser could not keep the edits, and that a read-only backup keeps nothing', () => {
    expect(reloadLossConfirm(['unstoredEdits']).message).toBe("Some of your unsaved changes could not be kept in this browser's storage, so reloading loses them.");
    expect(reloadLossConfirm(['readOnlyStore']).message).toBe('This is a read-only backup, so reloading loses every change you made to it.');
  });

  it('lists every loss, in the order given, and never says all unsaved changes are discarded', () => {
    const ask = reloadLossConfirm(['unstoredEdits', 'editorDraft']);
    expect(ask.message).toContain("Some of your unsaved changes could not be kept");
    expect(ask.message).toContain('driver editor');
    expect(ask.message.indexOf('storage')).toBeLessThan(ask.message.indexOf('driver editor'));
    expect(ask.message).not.toMatch(/all unsaved/i);
  });

  it('keeps the buttons the prompt always had', () => {
    const ask = reloadLossConfirm(['editorDraft']);
    expect(ask.confirmLabel).toBe(APP_UPDATE_TEXT.reload);
    expect(ask.cancelLabel).toBe('Keep');
  });
});
