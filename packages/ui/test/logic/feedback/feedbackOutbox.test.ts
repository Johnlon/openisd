/** The feedback outbox: an answer is kept on the device, sent when online, never blocks, never duplicates. */
import {describe, expect, it} from 'vitest';
import {createMemoryStorage} from '@openisd/persistence';
import {FeedbackFace} from '@openisd/design/fields';
import {FeedbackOutbox, type FeedbackTransport} from '../../../src/logic/feedback/feedbackOutbox.js';
import {fieldsOf, type WireEvent} from '../../../src/logic/telemetry/events.js';

class FakeTransport implements FeedbackTransport {
  isOnline = true;
  accepts = true;
  readonly bodies: string[] = [];
  online(): boolean { return this.isOnline; }
  async post(body: string): Promise<boolean> {
    if (!this.isOnline || !this.accepts) return false;
    this.bodies.push(body);
    return true;
  }
  events(): WireEvent[] {
    const parsed: unknown[] = [];
    for (const b of this.bodies) {
      const one: unknown = JSON.parse(b);
      const items: unknown[] = Array.isArray(one) ? one : [];
      for (const item of items) parsed.push(item);
    }
    return parsed.filter((e): e is WireEvent => typeof e === 'object' && e !== null && 'name' in e && 'fields' in e);
  }
}

function setup() {
  const transport = new FakeTransport();
  const storage = createMemoryStorage();
  let n = 0;
  const make = () => new FeedbackOutbox({
    storage, transport, now: () => 1_800_000_000_000, sessionAgeS: () => 42, newId: () => `id-${++n}`,
    version: '7.1.0', sessionId: 'sess', browserId: () => 'brow', environment: 'test',
  });
  return {transport, storage, outbox: make(), make};
}

describe('FeedbackOutbox', () => {
  it('sends a face tap at once when online, as a feedback event with only the shown fields', async () => {
    const {outbox, transport} = setup();
    const r = await outbox.answer(FeedbackFace.Yes, 'original/Vented', 'original');
    expect(r.delivery).toBe('sent');
    expect(transport.events()).toEqual([{
      name: 'feedback', ts: 1_800_000_000_000, version: '7.1.0', session: 'sess', browser_id: 'brow', environment: 'test',
      fields: {id: r.id, face: 'yes', screen: 'original/Vented', skin: 'original', age_s: 42},
    }]);
    expect(outbox.pendingCount()).toBe(0);
  });

  it('keeps the answer when offline, says saved, and sends it once online', async () => {
    const {outbox, transport} = setup();
    transport.isOnline = false;
    const r = await outbox.answer(FeedbackFace.Ok, 'mobile/Box', 'mobile');
    expect(r.delivery).toBe('saved');
    expect(outbox.pendingCount()).toBe(1);
    expect(transport.events()).toEqual([]);
    transport.isOnline = true;
    await outbox.flush();
    expect(transport.events().map(e => e.fields['face'])).toEqual(['ok']);
    expect(outbox.pendingCount()).toBe(0);
    await outbox.flush();
    expect(transport.events()).toHaveLength(1);
  });

  it('survives an app restart: a new outbox on the same storage sends what was saved', async () => {
    const {outbox, transport, make} = setup();
    transport.isOnline = false;
    await outbox.answer(FeedbackFace.NotReally, 's', 'original');
    transport.isOnline = true;
    await make().flush();
    expect(transport.events().map(e => e.fields['face'])).toEqual(['not_really']);
  });

  it('stays saved when the collector refuses, and tries again on the next flush', async () => {
    const {outbox, transport} = setup();
    transport.accepts = false;
    expect((await outbox.answer(FeedbackFace.Yes, 's', 'original')).delivery).toBe('saved');
    transport.accepts = true;
    await outbox.flush();
    expect(transport.events()).toHaveLength(1);
  });

  it('sends a later comment as a follow-up to the same answer id', async () => {
    const {outbox, transport} = setup();
    const r = await outbox.answer(FeedbackFace.Yes, 's', 'original');
    expect(await outbox.comment(r.id, 'love the charts')).toBe('sent');
    const events = transport.events();
    expect(events).toHaveLength(2);
    expect(events[1]?.fields).toEqual({id: r.id, face: 'yes', screen: 's', skin: 'original', age_s: 42, comment: 'love the charts'});
  });

  it('sends the comment with the answer, in one event, when the answer is still queued', async () => {
    const {outbox, transport} = setup();
    transport.isOnline = false;
    const r = await outbox.answer(FeedbackFace.Ok, 's', 'mobile');
    expect(await outbox.comment(r.id, 'needs dark mode')).toBe('saved');
    transport.isOnline = true;
    await outbox.flush();
    expect(transport.events()).toHaveLength(1);
    expect(transport.events()[0]?.fields['comment']).toBe('needs dark mode');
    expect(outbox.pendingCount()).toBe(0);
  });

  it('cuts a comment at the length the collector accepts and ignores a blank one', async () => {
    const {outbox, transport} = setup();
    const r = await outbox.answer(FeedbackFace.Yes, 's', 'original');
    await outbox.comment(r.id, '   ');
    expect(transport.events()).toHaveLength(1);
    await outbox.comment(r.id, 'x'.repeat(1500));
    expect(String(transport.events()[1]?.fields['comment'])).toHaveLength(1000);
  });

  it('builds the wire fields of a feedback event', () => {
    expect(fieldsOf({kind: 'feedback', id: 'a', face: 'ok', comment: '', screen: 's', skin: 'mobile', ageS: 12})).toEqual({id: 'a', face: 'ok', screen: 's', skin: 'mobile', age_s: 12});
    expect(fieldsOf({kind: 'feedback', id: 'a', face: 'ok', comment: 'hi', screen: 's', skin: 'mobile', ageS: 12})).toEqual({id: 'a', face: 'ok', screen: 's', skin: 'mobile', age_s: 12, comment: 'hi'});
  });

  it('ignores damaged stored text', async () => {
    const {storage, make} = setup();
    storage.set('openisd_feedback_outbox_v1', '{oops');
    expect(make().pendingCount()).toBe(0);
  });
});

describe('FeedbackOutbox during a slow send', () => {
  it('still sends a comment added while the face tap is in flight', async () => {
    const storage = createMemoryStorage();
    const bodies: string[] = [];
    let release: () => void = () => undefined;
    let first = true;
    const transport: FeedbackTransport = {
      online: () => true,
      post: async body => {
        if (first) { first = false; await new Promise<void>(resolve => { release = resolve; }); }
        bodies.push(body);
        return true;
      },
    };
    const outbox = new FeedbackOutbox({storage, transport, now: () => 1_800_000_000_000, sessionAgeS: () => 42, newId: () => 'a', version: 'v', sessionId: 's', browserId: () => 'b', environment: 'test'});
    const answering = outbox.answer(FeedbackFace.Yes, 'scr', 'original');
    const commenting = outbox.comment('a', 'late words');
    release();
    await answering;
    expect(await commenting).toBe('sent');
    expect(bodies.join('')).toContain('late words');
  });
  it('stores nothing and asks for no browser id at start-up, so two start-ups leave byte-identical storage', async () => {
    const storage = createMemoryStorage();
    let asked = 0;
    const start = () => new FeedbackOutbox({
      storage, transport: new FakeTransport(), now: () => 1_800_000_000_000, sessionAgeS: () => 0, newId: () => 'x',
      version: 'v', sessionId: 's', browserId: () => { asked += 1; return 'b'; }, environment: 'test',
    });
    await start().flush();
    const afterFirst = JSON.stringify(storage.keys().map(k => [k, storage.get(k)]));
    await start().flush();
    expect(JSON.stringify(storage.keys().map(k => [k, storage.get(k)]))).toBe(afterFirst);
    expect(afterFirst).toBe('[]');
    expect(asked).toBe(0);
  });
});
