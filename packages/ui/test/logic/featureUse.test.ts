import {describe, expect, it, vi} from 'vitest';
import {FeatureUse} from '../../src/logic/telemetry/featureUse.js';
import type {Telemetry} from '../../src/logic/telemetry/telemetry.js';

function fake(): Telemetry { return {record: vi.fn(), flush: vi.fn()}; }

describe('FeatureUse', () => {
  it('records a feature once per session', () => {
    const t = fake();
    const u = new FeatureUse(t);
    u.feature('whatif');
    u.feature('whatif');
    u.feature('export');
    expect(t.record).toHaveBeenCalledTimes(2);
    expect(t.record).toHaveBeenCalledWith({kind: 'feature', name: 'whatif'});
    expect(t.record).toHaveBeenCalledWith({kind: 'feature', name: 'export'});
  });
  it('records a chart once per session', () => {
    const t = fake();
    const u = new FeatureUse(t);
    u.chart('SPL');
    u.chart('SPL');
    expect(t.record).toHaveBeenCalledTimes(1);
    expect(t.record).toHaveBeenCalledWith({kind: 'chart_view', chart: 'SPL'});
  });
  it('never flushes', () => {
    const t = fake();
    const u = new FeatureUse(t);
    u.feature('options');
    u.chart('SPL');
    expect(t.flush).not.toHaveBeenCalled();
  });
});
