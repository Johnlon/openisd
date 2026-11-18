/** `createFeedbackDialog`: the one-tap flow, and the rules for when the app may ask. */
import {describe, expect, it} from 'vitest';
import {createMemoryStorage} from '@openisd/persistence';
import {FEEDBACK_DAY_MS, FeedbackFace} from '@openisd/design/fields';
import {createFeedbackDialog, FEEDBACK_ASK_KEY, type FeedbackDialogDeps, type UserAction} from '../../src/hooks/FeedbackDialog-hooks.js';
import {FeedbackOutbox, type FeedbackTransport} from '../../src/logic/feedback/feedbackOutbox.js';
import {SaveTappedTelemetry} from '../../src/logic/feedback/saveTappedTelemetry.js';
import {NoTelemetry} from '../../src/logic/telemetry/telemetry.js';

const PERSON: UserAction = {isTrusted: true};
const SCRIPT: UserAction = {isTrusted: false};

class Net implements FeedbackTransport {
  isOnline = true;
  readonly bodies: string[] = [];
  online(): boolean { return this.isOnline; }
  async post(body: string): Promise<boolean> {
    if (!this.isOnline) return false;
    this.bodies.push(body);
    return true;
  }
}

class Online {
  private listener: () => void = () => undefined;
  listen(fn: () => void): () => void { this.listener = fn; return () => undefined; }
  fire(): void { this.listener(); }
}

function setup(busy: () => boolean = () => false) {
  const net = new Net();
  const storage = createMemoryStorage();
  const clock = {now: Date.UTC(2026, 10, 17, 12)};
  const saves = new SaveTappedTelemetry(new NoTelemetry());
  const online = new Online();
  const deferred: (() => void)[] = [];
  let ids = 0;
  const outbox = new FeedbackOutbox({
    storage, transport: net, now: () => clock.now, newId: () => `id${++ids}`,
    version: 'v', sessionId: 's', browserId: () => 'b', environment: 'test',
  });
  const deps: FeedbackDialogDeps = {
    outbox, storage, now: () => clock.now, skin: () => 'original', screen: () => 'original/Vented',
    busy, userSaves: saves, onlineAgain: online, defer: fn => { deferred.push(fn); },
  };
  const dialog = createFeedbackDialog(deps);
  const runDeferred = () => { for (const fn of deferred.splice(0)) fn(); };
  return {dialog, net, storage, clock, saves, online, runDeferred, deps};
}

describe('opening from the Info menu', () => {
  it('opens with three faces and no required field', () => {
    const {dialog} = setup();
    expect(dialog.open.value).toBe(false);
    dialog.show();
    expect(dialog.open.value).toBe(true);
    expect(dialog.phase.value).toBe('face');
    expect(dialog.faces.map(f => f.value)).toEqual(['not_really', 'ok', 'yes']);
  });

  it('one tap on a face sends the answer at once and says thanks, sent; the comment box then offers itself', async () => {
    const {dialog, net} = setup();
    dialog.show();
    await dialog.pickFace(FeedbackFace.Yes, PERSON);
    expect(net.bodies).toHaveLength(1);
    expect(net.bodies[0]).toContain('"face":"yes"');
    expect(dialog.phase.value).toBe('comment');
    expect(dialog.chosen.value).toBe('yes');
    expect(dialog.statusText.value).toBe('Thanks, sent');
    expect(dialog.heading.value).toBe('Thanks!');
  });

  it('offline: the tap is saved and says so; coming online sends it and the line changes to sent', async () => {
    const {dialog, net, online} = setup();
    net.isOnline = false;
    dialog.show();
    await dialog.pickFace(FeedbackFace.Ok, PERSON);
    expect(dialog.statusText.value).toBe('Saved, will send when online');
    expect(net.bodies).toHaveLength(0);
    net.isOnline = true;
    online.fire();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(net.bodies).toHaveLength(1);
    expect(dialog.statusText.value).toBe('Thanks, sent');
  });

  it('a comment typed afterwards is a follow-up to the same answer; ignoring the box is fine', async () => {
    const {dialog, net} = setup();
    dialog.show();
    await dialog.pickFace(FeedbackFace.Ok, PERSON);
    dialog.comment.value = 'add a dark theme';
    await dialog.sendComment(PERSON);
    expect(net.bodies).toHaveLength(2);
    expect(net.bodies[1]).toContain('"comment":"add a dark theme"');
    expect(net.bodies[1]).toContain('"id":"id1"');
    expect(dialog.commentSent.value).toBe(true);
    expect(dialog.statusText.value).toBe('Thanks, sent');
  });

  it('face then comment: one confirmation line, which speaks for the comment too (T881: it showed "Thanks, sent" twice)', async () => {
    const {dialog, net} = setup();
    net.isOnline = false;
    dialog.show();
    await dialog.pickFace(FeedbackFace.Yes, PERSON);
    expect(dialog.statusText.value).toBe('Saved, will send when online');
    // Back online without the online event: sending the comment sends the waiting face with it.
    net.isOnline = true;
    dialog.comment.value = 'Love the charts';
    await dialog.sendComment(PERSON);
    expect(net.bodies.join('')).toContain('"comment":"Love the charts"');
    expect(dialog.commentSent.value).toBe(true);
    expect(dialog.statusText.value).toBe('Thanks, sent');
    expect(Object.keys(dialog).filter(key => /status/i.test(key))).toEqual(['statusText']);
  });

  it('offline comment: the one line says saved, then sent when the network is back', async () => {
    const {dialog, net, online} = setup();
    net.isOnline = false;
    dialog.show();
    await dialog.pickFace(FeedbackFace.Ok, PERSON);
    dialog.comment.value = 'add a dark theme';
    await dialog.sendComment(PERSON);
    expect(dialog.statusText.value).toBe('Saved, will send when online');
    net.isOnline = true;
    online.fire();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(net.bodies.join('')).toContain('"comment":"add a dark theme"');
    expect(dialog.statusText.value).toBe('Thanks, sent');
  });

  it('a blank comment sends nothing and still shows a result', async () => {
    const {dialog, net} = setup();
    dialog.show();
    await dialog.pickFace(FeedbackFace.Yes, PERSON);
    dialog.comment.value = '  ';
    await dialog.sendComment(PERSON);
    expect(net.bodies).toHaveLength(1);
    expect(dialog.open.value).toBe(false);
  });

  it('closing before any tap sends nothing; opening again starts fresh', async () => {
    const {dialog, net} = setup();
    dialog.show();
    dialog.dismiss();
    expect(dialog.open.value).toBe(false);
    expect(net.bodies).toHaveLength(0);
    dialog.show();
    await dialog.pickFace(FeedbackFace.Yes, PERSON);
    dialog.dismiss();
    dialog.show();
    expect(dialog.phase.value).toBe('face');
    expect(dialog.chosen.value).toBeNull();
    expect(dialog.comment.value).toBe('');
  });
});

describe('only a person sends', () => {
  it('ignores an answer or a comment that script code (an untrusted event) asks for', async () => {
    const {dialog, net} = setup();
    dialog.show();
    await dialog.pickFace(FeedbackFace.Yes, SCRIPT);
    expect(net.bodies).toHaveLength(0);
    expect(dialog.phase.value).toBe('face');
    await dialog.pickFace(FeedbackFace.Yes, PERSON);
    dialog.comment.value = 'spam';
    await dialog.sendComment(SCRIPT);
    expect(net.bodies).toHaveLength(1);
  });
});

describe('the occasional prompt after a save', () => {
  it('appears after a user save, after a short wait, and not before', () => {
    const {dialog, saves, runDeferred} = setup();
    saves.record({kind: 'project_save', format: 'stored', box: 'vented'});
    expect(dialog.open.value).toBe(false);
    runDeferred();
    expect(dialog.open.value).toBe(true);
    expect(dialog.source.value).toBe('prompt');
  });

  it('is not shown on top of another dialog, and a save then does not use up the turn', () => {
    let busy = true;
    const {dialog, saves, runDeferred, storage} = setup(() => busy);
    saves.record({kind: 'project_save', format: 'stored', box: 'vented'});
    runDeferred();
    expect(dialog.open.value).toBe(false);
    expect(storage.get(FEEDBACK_ASK_KEY)).toBeNull();
    busy = false;
    saves.record({kind: 'project_save', format: 'stored', box: 'vented'});
    runDeferred();
    expect(dialog.open.value).toBe(true);
  });

  it('is re-checked when the wait is over: another dialog that opened meanwhile wins', () => {
    let busy = false;
    const {dialog, saves, runDeferred} = setup(() => busy);
    saves.record({kind: 'project_save', format: 'stored', box: 'vented'});
    busy = true;
    runDeferred();
    expect(dialog.open.value).toBe(false);
  });

  it('asks at most once every 60 days, Not now keeps it quiet, an answer for 90 days', () => {
    const {dialog, saves, runDeferred, clock} = setup();
    const save = () => { saves.record({kind: 'project_save', format: 'stored', box: 'vented'}); runDeferred(); };
    save();
    dialog.dismiss();
    expect(dialog.open.value).toBe(false);
    clock.now += 59 * FEEDBACK_DAY_MS;
    save();
    expect(dialog.open.value).toBe(false);
    clock.now += 2 * FEEDBACK_DAY_MS;
    save();
    expect(dialog.open.value).toBe(true);
  });

  it('after an answer it stays quiet for 90 days', async () => {
    const {dialog, saves, runDeferred, clock} = setup();
    const save = () => { saves.record({kind: 'project_save', format: 'stored', box: 'vented'}); runDeferred(); };
    save();
    await dialog.pickFace(FeedbackFace.Yes, PERSON);
    dialog.dismiss();
    clock.now += 89 * FEEDBACK_DAY_MS;
    save();
    expect(dialog.open.value).toBe(false);
    clock.now += 2 * FEEDBACK_DAY_MS;
    save();
    expect(dialog.open.value).toBe(true);
  });

  it('never replaces a dialog the user already has open', () => {
    const {dialog, saves, runDeferred} = setup();
    dialog.show();
    saves.record({kind: 'project_save', format: 'stored', box: 'vented'});
    runDeferred();
    expect(dialog.source.value).toBe('menu');
  });

  it('the Info menu entry ignores the quiet time', () => {
    const {dialog, saves, runDeferred} = setup();
    saves.record({kind: 'project_save', format: 'stored', box: 'vented'});
    runDeferred();
    dialog.dismiss();
    dialog.show();
    expect(dialog.open.value).toBe(true);
  });
});
