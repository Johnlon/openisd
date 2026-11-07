/**
 * `sweepTransport` when its Web Worker fails: the fault is reported with the worker's own message
 * and place, the event stops at the worker (so the window never sees a masked "Script error."),
 * and the request is answered on this thread.
 */
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder, type FrequencyGrid, type SweepJob} from '@openisd/design';
import {sweepTransport} from '../../src/logic/sweepTransport.js';
import {SweepComputer, type SweepReply, type SweepRequest} from '../../src/logic/sweepRequest.js';

interface WorkerErrorEvent {
  readonly message: string;
  readonly filename: string;
  readonly lineno: number;
  readonly colno: number;
  preventDefault(): void;
}

/** A Worker stand-in: records what it was sent and lets the test fail it. */
class FakeWorker {
  static readonly instances: FakeWorker[] = [];
  readonly posted: SweepRequest[] = [];
  terminated = false;
  private readonly onError: ((e: WorkerErrorEvent) => void)[] = [];
  constructor(readonly url: URL, readonly options: {type: string}) { FakeWorker.instances.push(this); }
  addEventListener(type: string, listener: (e: WorkerErrorEvent) => void): void {
    if (type === 'error') this.onError.push(listener);
  }
  postMessage(req: SweepRequest): void { this.posted.push(req); }
  terminate(): void { this.terminated = true; }
  fail(e: WorkerErrorEvent): void { for (const l of this.onError) l(e); }
}

const GRID: FrequencyGrid = {fmin: 10, fmax: 1000, N: 50};
const engine = createEngine();

function job(): SweepJob {
  const p = ProjectBuilder.empty(engine);
  const s = p.driver.specs;
  s.Fs_hz.set(37); s.Qts.set(0.378); s.Qes.set(0.40); s.Qms.set(7.0); s.Vas_m3.set(0.03);
  s.Sd_m2.set(0.0133); s.Re_ohm.set(5.6); s.Le_H.set(0.7e-3); s.Xmax_m.set(0.005); s.Pe_W.set(60);
  p.box.boxType.set('sealed');
  p.box.sealed.volume_m3.set(0.03);
  const plan = p.sweepPlan(GRID);
  if (plan.kind !== 'ready') throw new Error('expected a ready plan');
  return plan.job;
}

function faultMessage(onFault: ReturnType<typeof vi.fn<(fault: Error) => void>>): string {
  const fault = onFault.mock.calls[0]?.[0];
  if (fault === undefined) throw new Error('no fault was reported');
  return fault.message;
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.instances.length = 0;
});

describe('sweepTransport — the worker fails', () => {
  it('reports the fault with the worker\'s message and place, stops the event, and answers on this thread', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const request: SweepRequest = {id: 7, job: job(), withMax: false};
    const replies: SweepReply[] = [];
    const onFault = vi.fn<(fault: Error) => void>();
    const send = sweepTransport(new SweepComputer(engine.simulation), reply => replies.push(reply), onFault);
    send(request);
    const worker = FakeWorker.instances[0];
    expect(worker?.posted).toEqual([request]);

    const preventDefault = vi.fn();
    worker?.fail({message: 'ReferenceError: x is not defined', filename: 'https://openisd.app/assets/sweepWorker-1.js', lineno: 3, colno: 9, preventDefault});

    expect(preventDefault).toHaveBeenCalled();
    expect(worker?.terminated).toBe(true);
    expect(faultMessage(onFault)).toBe('sweep worker failed: ReferenceError: x is not defined at https://openisd.app/assets/sweepWorker-1.js:3:9');
    await Promise.resolve();
    expect(replies.map(r => r.id)).toEqual([7]);
  });

  it('reports a failure to load the worker (no file) with the message alone', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onFault = vi.fn<(fault: Error) => void>();
    sweepTransport(new SweepComputer(engine.simulation), () => {}, onFault);
    FakeWorker.instances[0]?.fail({message: 'Script error.', filename: '', lineno: 0, colno: 0, preventDefault: vi.fn()});
    expect(faultMessage(onFault)).toBe('sweep worker failed: Script error.');
  });
});
