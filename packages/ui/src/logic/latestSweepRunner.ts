/**
 * Keeps one sweep request in flight and only the newest one waiting, so a held spinner never
 * queues a backlog behind the worker: each reply is delivered (the charts move every step the
 * worker finishes) unless a request for a different key, or a `cancel()`, has replaced it.
 */
import type {SweepJob} from '@openisd/design';
import type {SweepReply, SweepRequest} from './sweepRequest.js';

interface Sent<K> {
  readonly key: K;
  readonly req: SweepRequest;
}

export class LatestSweepRunner<K> {
  private nextId = 1;
  private inFlight: Sent<K> | null = null;
  private waiting: Sent<K> | null = null;
  /** The key of the newest `run`; null after `cancel()`. */
  private current: K | null = null;

  constructor(
    private readonly post: (req: SweepRequest) => void,
    private readonly deliver: (key: K, reply: SweepReply) => void,
  ) {}

  run(key: K, job: SweepJob, withMax: boolean): void {
    this.current = key;
    const sent: Sent<K> = { key, req: { id: this.nextId++, job, withMax } };
    if (this.inFlight === null) this.send(sent);
    else this.waiting = sent;
  }

  /** Drops the in-flight reply and the waiting request. */
  cancel(): void {
    this.current = null;
    this.waiting = null;
  }

  /** The transport's answer to the in-flight request. */
  replied(reply: SweepReply): void {
    const done = this.inFlight;
    if (done === null || done.req.id !== reply.id) return;
    this.inFlight = null;
    if (this.current !== null && done.key === this.current) this.deliver(done.key, reply);
    const next = this.waiting;
    this.waiting = null;
    if (next !== null) this.send(next);
  }

  private send(sent: Sent<K>): void {
    this.inFlight = sent;
    this.post(sent.req);
  }
}
