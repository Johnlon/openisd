import {describe, expect, it} from 'vitest';
import {ChartPageHelp, ChartPageSizes, SheetMode} from '../../fields/index.js';

describe('ChartPageSizes', () => {
  it('the chart bar is 40 px controls with 8 px above and below and a rule: 57 px', () => {
    expect(ChartPageSizes.CLASSIC.barHeightPx()).toBe(57);
    const vars = ChartPageSizes.CLASSIC.cssVars();
    expect(vars.get('--gp-head-control')).toBe('40px');
    expect(vars.get('--gp-band')).toBe('28px');
    expect(vars.get('--gp-tap'), 'the Data chip is hit as the 44 px phone button').toBe('44px');
    expect(vars.get('--gp-sheet-max')).toBe('250px');
    expect(vars.get('--gp-sheet-band')).toBe('24px');
    expect(ChartPageSizes.CLASSIC.stripHeightPx(), 'the one 44 px phone button, 6 px above and below, a rule').toBe(57);
  });
});

describe('ChartPageHelp', () => {
  it('the SPL response chart starts with what it shows; a name that is no chart has no help', () => {
    expect(ChartPageHelp.forChart('SPL response')?.intro).toContain('The loudness the speaker makes');
    expect(ChartPageHelp.forChart('No such chart')).toBeNull();
  });

  it('the Tune sheet help has one line per row shown for the box, named as the sheet names them', () => {
    const vented = ChartPageHelp.forSheet(SheetMode.TUNE, 'vented');
    expect(vented.title).toBe('Tune');
    expect(vented.rows.map(r => r.label)).toEqual(['Box volume', 'Tuning', 'Port area', 'Power', 'Drivers']);
  });

  it('the What-if sheet help names the driver rows too and says the design is not changed', () => {
    const vented = ChartPageHelp.forSheet(SheetMode.WHAT_IF, 'vented');
    expect(vented.rows.map(r => r.label)).toEqual(['Box volume', 'Tuning (Fb)', 'Port area', 'Input power', 'Fs', 'Vas', 'Qes', 'Qms', 'Drivers']);
    expect(vented.intro).toContain('without changing the design');
  });
});
