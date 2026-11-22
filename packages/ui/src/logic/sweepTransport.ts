/**
 * Sends a `SweepRequest` to the sweep worker and hands its reply back. Where there is no Worker
 * (Node tests) or the worker fails to load, the request runs on this thread instead, still
 * answered asynchronously as the worker would.
 */
import type {SweepComputer, SweepReply, SweepRequest} from './sweepRequest.js';
import {placeOf} from './telemetry/browserListeners.js';

/** @param onWorkerFault told once when the worker fails to load or throws, with its message and place;
 *  the event stops at the worker, so the window never sees it as a masked "Script error.". */
export function sweepTransport(
  local: SweepComputer,
  onReply: (reply: SweepReply) => void,
  onWorkerFault: (fault: Error) => void = () => {},
): (req: SweepRequest) => void {
  const inThread = (req: SweepRequest) => queueMicrotask(() => onReply(local.run(req)));
  if (typeof Worker === 'undefined') return inThread;

  let worker: Worker | null = new Worker(new URL('./sweepWorker.ts', import.meta.url), {type: 'module'});
  let sent: SweepRequest | null = null;
  worker.addEventListener('message', (e: MessageEvent<SweepReply>) => {
    sent = null;
    onReply(e.data);
  });
  worker.addEventListener('error', e => {
    e.preventDefault();
    onWorkerFault(new Error(`sweep worker failed: ${placeOf(e.message, e.filename, e.lineno, e.colno)}`));
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
