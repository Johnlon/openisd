/**
 * Signal-generator tone controller — framework-free Web Audio wrapper.
 *
 * Gesture-gated by construction: nothing happens until start() is called (from a user
 * toggle). Frequency is clamped to the audible range; stop() tears the oscillator down.
 * Tested against a fake AudioContext — we can assert node creation, frequency, and
 * start/stop, but NOT audible output (a real limitation, not a claim of sound).
 */
import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { createToneGenerator } from '../src/utils/toneGenerator.js';

// Minimal fakes capturing what the controller does to the graph.
class FakeParam { value = 0; setValueAtTime(v: number) { this.value = v; } linearRampToValueAtTime(v: number) { this.value = v; } cancelScheduledValues() {} }
class FakeOsc { type = ''; frequency = new FakeParam(); started = false; stopped = false; connect() {} start() { this.started = true; } stop() { this.stopped = true; } disconnect() {} }
class FakeGain { gain = new FakeParam(); connect() {} disconnect() {} }
class FakeCtx {
  currentTime = 0; state = 'running'; destination = {};
  oscs: FakeOsc[] = []; gains: FakeGain[] = [];
  createOscillator() { const o = new FakeOsc(); this.oscs.push(o); return o; }
  createGain() { const g = new FakeGain(); this.gains.push(g); return g; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}

let ctx: FakeCtx;
// No cast: FakeCtx satisfies the tone generator's own ToneCtx interface structurally.
const make = () => createToneGenerator(() => ctx);
beforeEach(() => { ctx = new FakeCtx(); });

describe('tone generator', () => {
  it('does nothing until started — no AudioContext work on construction', () => {
    make();
    assert.equal(ctx.oscs.length, 0, 'no oscillator created before start()');
  });

  it('start() creates and starts one oscillator at the requested frequency', () => {
    const t = make();
    t.start(50);
    assert.equal(ctx.oscs.length, 1);
    assert.equal(ctx.oscs[0].started, true);
    assert.equal(ctx.oscs[0].frequency.value, 50);
    assert.equal(t.playing(), true);
  });

  it('clamps frequency into the audible range', () => {
    const t = make();
    t.start(2);            // sub-audible → clamps up
    assert.ok(ctx.oscs[0].frequency.value >= 20);
    t.setFrequency(999999); // supersonic → clamps down
    assert.ok(ctx.oscs[0].frequency.value <= 20000);
  });

  it('start() twice does not stack oscillators', () => {
    const t = make();
    t.start(40); t.start(60);
    assert.equal(ctx.oscs.length, 1, 'still one oscillator');
  });

  it('stop() stops the oscillator and reports not playing', () => {
    const t = make();
    t.start(40);
    t.stop();
    assert.equal(ctx.oscs[0].stopped, true);
    assert.equal(t.playing(), false);
  });
});
