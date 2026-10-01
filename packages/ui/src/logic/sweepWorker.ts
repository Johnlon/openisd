/**
 * The sweep worker: answers each `SweepRequest` with its `SweepReply`, off the main thread. The
 * sweep reads no app setting, so the worker's own default engine gives what the main thread's would.
 */
import {createEngine} from '@openisd/design/engine';
import {SweepComputer, type SweepRequest} from './sweepRequest.js';

const computer = new SweepComputer(createEngine().simulation);
addEventListener('message', (e: MessageEvent<SweepRequest>) => {
  postMessage(computer.run(e.data));
});
