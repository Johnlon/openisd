import type {KeyValueStorage} from '@openisd/persistence';
import {MAX_FEEDBACK_COMMENT, type FeedbackFace} from '@openisd/design/fields';
import {fieldsOf, type Skin, type TelemetryEnvironment, type WireEvent} from '../telemetry/events.js';

/** Sends one request to the collector. `post` answers true only when the collector accepted it. */
export interface FeedbackTransport {
  online(): boolean;
  post(body: string): Promise<boolean>;
}

export interface FeedbackOutboxDeps {
  readonly storage: KeyValueStorage;
  readonly transport: FeedbackTransport;
  readonly now: () => number;
  /** Whole seconds since the page opened. */
  readonly sessionAgeS: () => number;
  readonly newId: () => string;
  readonly version: string;
  readonly sessionId: string;
  /** Asked only when an answer is about to be sent, so a start-up that sends nothing stores no browser id. */
  readonly browserId: () => string;
  readonly environment: TelemetryEnvironment;
}

/** `sent`: the collector has it. `saved`: kept on this device, will go when online. */
export type FeedbackDelivery = 'sent' | 'saved';

export interface FeedbackAnswered {
  readonly id: string;
  readonly delivery: FeedbackDelivery;
}

interface OutboxEntry {
  readonly id: string;
  readonly face: string;
  readonly comment: string;
  readonly screen: string;
  readonly skin: Skin;
  readonly ts: number;
  readonly ageS: number;
  readonly faceSent: boolean;
  readonly commentSent: boolean;
}

export const FEEDBACK_OUTBOX_KEY = 'openisd_feedback_outbox_v1';
/** Delivered answers are kept so a later comment can still follow them; only this many. */
const KEEP_DELIVERED = 20;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function skinOf(v: unknown): Skin | null {
  return v === 'original' || v === 'mobile' ? v : null;
}

function entryOf(raw: unknown): OutboxEntry | null {
  if (!isRecord(raw)) return null;
  const {id, face, comment, screen, ts, faceSent, commentSent} = raw;
  const skin = skinOf(raw['skin']);
  if (typeof id !== 'string' || typeof face !== 'string' || typeof comment !== 'string' || typeof screen !== 'string'
    || typeof ts !== 'number' || typeof raw['ageS'] !== 'number' || typeof faceSent !== 'boolean' || typeof commentSent !== 'boolean' || skin === null) return null;
  return {id, face, comment, screen, skin, ts, ageS: raw['ageS'], faceSent, commentSent};
}

function needsSending(e: OutboxEntry): boolean {
  return !e.faceSent || (e.comment !== '' && !e.commentSent);
}

/**
 * The user's feedback answers, kept on the device until the collector has them. An answer is saved
 * first and sent second, so being offline or refused never loses it and never blocks the user. A
 * comment written after the face tap is sent as a follow-up with the same id (the collector fills
 * the same row), or together with the face when that is still queued.
 */
export class FeedbackOutbox {
  private entries: OutboxEntry[];
  private flushing: Promise<void> | null = null;

  constructor(private readonly deps: FeedbackOutboxDeps) {
    this.entries = this.read();
  }

  /** Keep the answer, then try to send it. */
  async answer(face: FeedbackFace, screen: string, skin: Skin): Promise<FeedbackAnswered> {
    const id = this.deps.newId();
    this.entries = [...this.entries, {id, face: face.value, comment: '', screen, skin, ts: this.deps.now(), ageS: this.deps.sessionAgeS(), faceSent: false, commentSent: false}];
    this.write();
    await this.flush();
    return {id, delivery: this.deliveryOf(id)};
  }

  /** Add the comment to the answer `id` and send it. A blank comment is ignored. */
  async comment(id: string, text: string): Promise<FeedbackDelivery> {
    const comment = text.trim().slice(0, MAX_FEEDBACK_COMMENT);
    const held = this.entries.find(e => e.id === id);
    if (held === undefined || comment === '') return this.deliveryOf(id);
    this.entries = this.entries.map(e => e.id === id ? {...e, comment, commentSent: false} : e);
    this.write();
    await this.flush();
    return this.deliveryOf(id);
  }

  /** Send everything waiting. Safe to call at any time: one flush runs at once, and none blocks the app. */
  flush(): Promise<void> {
    this.flushing ??= this.runUntilQuiet().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  /** How many answers (or comments) still wait to be sent. */
  pendingCount(): number {
    return this.entries.filter(needsSending).length;
  }

  /** Whether the answer `id` has reached the collector (`sent`) or still waits (`saved`). */
  deliveryOf(id: string): FeedbackDelivery {
    const e = this.entries.find(x => x.id === id);
    return e === undefined || !needsSending(e) ? 'sent' : 'saved';
  }

  /** Runs again while a run delivered something and more is waiting: a comment added during a send still goes. */
  private async runUntilQuiet(): Promise<void> {
    let delivered = await this.run();
    while (delivered > 0 && this.pendingCount() > 0) delivered = await this.run();
  }

  /** One pass over what waits; how many requests the collector accepted. */
  private async run(): Promise<number> {
    let accepted = 0;
    for (const e of this.entries.filter(needsSending)) {
      if (!this.deps.transport.online()) return accepted;
      if (!await this.deps.transport.post(JSON.stringify([this.wireOf(e)]))) return accepted;
      accepted += 1;
      this.entries = this.entries.map(x => x.id === e.id ? {...x, faceSent: true, commentSent: x.comment === e.comment ? true : x.commentSent} : x);
      this.write();
    }
    return accepted;
  }

  private wireOf(e: OutboxEntry): WireEvent {
    return {
      name: 'feedback', ts: e.ts, version: this.deps.version, session: this.deps.sessionId,
      browser_id: this.deps.browserId(), environment: this.deps.environment,
      fields: fieldsOf({kind: 'feedback', id: e.id, face: e.face, comment: e.comment, screen: e.screen, skin: e.skin, ageS: e.ageS}),
    };
  }

  private read(): OutboxEntry[] {
    const text = this.deps.storage.get(FEEDBACK_OUTBOX_KEY);
    if (text === null) return [];
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return []; }
    if (!Array.isArray(raw)) return [];
    return raw.map(entryOf).filter((e): e is OutboxEntry => e !== null);
  }

  private write(): void {
    const waiting = this.entries.filter(needsSending);
    const delivered = this.entries.filter(e => !needsSending(e)).slice(-KEEP_DELIVERED);
    this.entries = this.entries.filter(e => waiting.includes(e) || delivered.includes(e));
    this.deps.storage.set(FEEDBACK_OUTBOX_KEY, JSON.stringify(this.entries));
  }
}
