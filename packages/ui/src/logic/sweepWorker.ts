/**
 * The sweep worker: answers each `SweepRequest` with its `SweepReply`, off the main thread. The
 * sweep reads no app setting, so the worker needs the simulation area alone, not the whole engine.
 */
import {createSimulationEngine} from '@openisd/design/engine';
import {SweepComputer, type SweepRequest} from './sweepRequest.js';

const computer = new SweepComputer(createSimulationEngine());
addEventListener('message', (e: MessageEvent<SweepRequest>) => {
  postMessage(computer.run(e.data));
});
