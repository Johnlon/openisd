/**
 * Sends a `SweepRequest` to the sweep worker and hands its reply back. Where there is no Worker
 * (Node tests) or the worker fails to load, the request runs on this thread instead, still
 * answered asynchronously as the worker would.
 */
import type {SweepComputer, SweepReply, SweepRequest} from './sweepRequest.js';

export function sweepTransport(local: SweepComputer, onReply: (reply: SweepReply) => void): (req: SweepRequest) => void {
  const inThread = (req: SweepRequest) => queueMicrotask(() => onReply(local.run(req)));
  if (typeof Worker === 'undefined') return inThread;

  let worker: Worker | null = new Worker(new URL('./sweepWorker.ts', import.meta.url), {type: 'module'});
  let sent: SweepRequest | null = null;
  worker.addEventListener('message', (e: MessageEvent<SweepReply>) => {
    sent = null;
    onReply(e.data);
  });
  worker.addEventListener('error', () => {
    worker?.terminate();
    worker = null;
    if (sent !== null) inThread(sent);
  });
  return req => {
    if (worker === null) { inThread(req); return; }
    sent = req;
    worker.postMessage(req);
  };
}
