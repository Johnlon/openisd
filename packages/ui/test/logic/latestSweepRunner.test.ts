/**
 * `SweepComputer` — what the sweep worker computes for one request — and `LatestSweepRunner`,
 * which keeps one request in flight and only the newest one waiting, so a held spinner never
 * queues a backlog behind the worker.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder, type FrequencyGrid, type SweepJob} from '@openisd/design';
import {SweepComputer, type SweepReply, type SweepRequest} from '../../src/logic/sweepRequest.js';
import {LatestSweepRunner} from '../../src/logic/latestSweepRunner.js';

const GRID: FrequencyGrid = { fmin: 10, fmax: 1000, N: 50 };
const engine = createEngine();

function project() {
  const p = ProjectBuilder.empty(engine);
  const s = p.driver.specs;
  s.Fs_hz.set(37); s.Qts.set(0.378); s.Qes.set(0.40); s.Qms.set(7.0); s.Vas_m3.set(0.03);
  s.Sd_m2.set(0.0133); s.Re_ohm.set(5.6); s.Le_H.set(0.7e-3); s.Xmax_m.set(0.005); s.Pe_W.set(60);
  p.box.boxType.set('sealed');
  p.box.sealed.volume_m3.set(0.03);
  return p;
}

function jobOf(p: ReturnType<typeof project>): SweepJob {
  const plan = p.sweepPlan(GRID);
  if (plan.kind !== 'ready') throw new Error('expected a ready plan');
  return plan.job;
}

describe('SweepComputer', () => {
  it('gives the sweep and max curves the project gives', () => {
    const p = project();
    const reply = new SweepComputer(createEngine().simulation).run({ id: 7, job: structuredClone(jobOf(p)), withMax: true });
    expect(reply.id).toBe(7);
    expect(reply.sweep).toEqual(p.sweep(GRID));
    expect(reply.max).toEqual(p.maxCurves(GRID));
  });

  it('without max curves, max is null', () => {
    const reply = new SweepComputer(engine.simulation).run({ id: 1, job: jobOf(project()), withMax: false });
    expect(reply.max).toBeNull();
    expect(reply.sweep.values).not.toBeNull();
  });
});

/** A transport the test answers by hand. */
function harness() {
  const posted: SweepRequest[] = [];
  const delivered: { key: string; reply: SweepReply }[] = [];
  const runner = new LatestSweepRunner<string>(
    req => posted.push(req),
    (key, reply) => delivered.push({ key, reply }),
  );
  const computer = new SweepComputer(engine.simulation);
  const answer = (req: SweepRequest) => runner.replied(computer.run(req));
  return { posted, delivered, runner, answer };
}

describe('LatestSweepRunner', () => {
  const job = jobOf(project());

  it('posts at once when idle and delivers the reply', () => {
    const { posted, delivered, runner, answer } = harness();
    runner.run('A', job, true);
    expect(posted).toHaveLength(1);
    answer(posted[0]);
    expect(delivered.map(d => d.key)).toEqual(['A']);
  });

  it('while busy, keeps only the newest request and posts it on the reply', () => {
    const { posted, delivered, runner, answer } = harness();
    runner.run('A', job, true);
    runner.run('A', job, false);
    runner.run('A', job, true);
    expect(posted).toHaveLength(1);
    answer(posted[0]);
    expect(posted).toHaveLength(2);
    expect(posted[1].id).toBe(3);
    answer(posted[1]);
    expect(posted).toHaveLength(2);
    expect(delivered).toHaveLength(2);
  });

  it('drops a reply for a key that a newer request replaced', () => {
    const { posted, delivered, runner, answer } = harness();
    runner.run('A', job, true);
    runner.run('B', job, true);
    answer(posted[0]);
    expect(delivered).toEqual([]);
    answer(posted[1]);
    expect(delivered.map(d => d.key)).toEqual(['B']);
  });

  it('cancel drops the in-flight reply and the waiting request', () => {
    const { posted, delivered, runner, answer } = harness();
    runner.run('A', job, true);
    runner.run('A', job, true);
    runner.cancel();
    answer(posted[0]);
    expect(delivered).toEqual([]);
    expect(posted).toHaveLength(1);
  });
});
