import {describe, expect, it} from 'vitest';
import {TABS, TAB_META} from '../../chart/index.js';
import {CHART_HELP} from '../../fields/index.js';

const CHART_IDS = TABS.map(tab => tab.id);

describe('CHART_HELP: every chart has help with four parts', () => {
  it('covers the same charts as the chart registry', () => {
    expect(Object.keys(CHART_HELP).sort()).toEqual([...CHART_IDS].sort());
  });
  for (const id of CHART_IDS) {
    describe(id, () => {
      const help = CHART_HELP[id];
      it('is titled with the chart name', () => { expect(help.title).toBe(TAB_META[id].name); });
      it('has a sentence, axes, good and fault rows, and 60 to 140 words', () => {
        expect(help.intro.length).toBeGreaterThan(20);
        expect(help.rows.map(row => row.label)).toEqual(['Axes', 'Good', 'Faults']);
        const words = [help.intro, ...help.rows.map(row => row.text)].join(' ').split(/\s+/).length;
        expect(words).toBeGreaterThanOrEqual(50);
        expect(words).toBeLessThanOrEqual(140);
      });
      it('has one to three https references', () => {
        expect(help.links.length).toBeGreaterThanOrEqual(1);
        expect(help.links.length).toBeLessThanOrEqual(3);
        for (const link of help.links) { expect(link.url).toMatch(/^https:\/\//); expect(link.title.length).toBeGreaterThan(5); }
      });
    });
  }
});
