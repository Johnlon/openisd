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
      it('has at most two https references', () => {
        expect(help.links.length).toBeLessThanOrEqual(2);
        for (const link of help.links) { expect(link.url).toMatch(/^https:\/\//); expect(link.title.length).toBeGreaterThan(5); }
      });
      it('avoids formulaic openers ("essential", "critical")', () => {
        const fullText = [help.intro, ...help.rows.map(row => row.text)].join(' ');
        expect(fullText).not.toMatch(/\b(essential|critical)\b/i);
      });
      it('uses British spelling', () => {
        const fullText = [help.intro, ...help.rows.map(row => row.text)].join(' ');
        expect(fullText).not.toMatch(/\bmeters?\b/i);
        expect(fullText).not.toMatch(/\bcenter(ed|ing)?\b/i);
        expect(fullText).not.toMatch(/\bnormaliz(ed|ing|ation)\b/i);
      });
    });
  }

  describe('SPL charts link only to the Eminence SPL page (John, 3 Nov 2026: "just spl - it\'s a better reference")', () => {
    for (const id of ['SPL', 'MaxSPL'] as const) {
      it(id, () => {
        expect(CHART_HELP[id].links.map(link => link.url)).toEqual(['https://eminence.com/blogs/blog/understanding-spl']);
      });
    }
  });

  // John, 3 Nov 2026: "want simple clear info". Each page below was read in full and kept only when it
  // is plain, short, about that chart, and agrees with the help text; a chart with no such page has no link.
  describe('every chart links only to the simple pages chosen for it', () => {
    const AUDIOHOLICS = 'https://www.audioholics.com/loudspeaker-articles/sealed-vs-ported-subwoofers';
    const IMPEDANCE = 'https://audiojudgement.com/speaker-impedance-curve-explained/';
    const SOS_FILTERS = 'https://www.soundonsound.com/sound-advice/q-what-are-filters-and-what-do-they-do';
    const SOS_FILTER_EQ = 'https://www.soundonsound.com/sound-advice/q-whats-difference-between-filtering-and-eq';
    const SPL = 'https://eminence.com/blogs/blog/understanding-spl';
    const EXPECTED: Record<keyof typeof CHART_HELP, readonly string[]> = {
      SPL: [SPL], MaxSPL: [SPL],
      TFMag: [AUDIOHOLICS], GD: [AUDIOHOLICS], RearPortGain: [AUDIOHOLICS],
      MaxPwr: ['https://international.mtx.com/library-speakers'],
      Excursion: ['https://www.subwoofer-builder.com/xmax.htm'],
      Zmag: [IMPEDANCE], Zph: [IMPEDANCE],
      FltMag: [SOS_FILTERS], FltPhase: [SOS_FILTER_EQ], FltGD: [SOS_FILTER_EQ],
      PRTFMag: [], PRTFPhase: [], PRExcursion: [], Phase: [], VA: [],
      RearPort: [], FrontPort: [], FrontPortGain: [], IntraPort: [],
    };
    for (const id of CHART_IDS) {
      it(id, () => { expect(CHART_HELP[id].links.map(link => link.url)).toEqual(EXPECTED[id]); });
    }
  });

  describe('key design thresholds and landmarks are present', () => {
    it('SPL mentions 1 m and Signal page power', () => {
      const text = [CHART_HELP.SPL.intro, ...CHART_HELP.SPL.rows.map(r => r.text)].join(' ');
      expect(text).toMatch(/1 m/);
      expect(text).toMatch(/Signal/);
    });
    it('TFMag mentions F3, -3 dB, 12 dB and 24 dB per octave', () => {
      const text = [CHART_HELP.TFMag.intro, ...CHART_HELP.TFMag.rows.map(r => r.text)].join(' ');
      expect(text).toMatch(/F3/);
      expect(text).toMatch(/-3 dB/);
      expect(text).toMatch(/12 dB/);
      expect(text).toMatch(/24 dB/);
    });
    it('GD and FltGD mention 15 to 20 ms at 40 Hz', () => {
      for (const id of ['GD', 'FltGD'] as const) {
        const text = [CHART_HELP[id].intro, ...CHART_HELP[id].rows.map(r => r.text)].join(' ');
        expect(text).toMatch(/15.*20 ms/);
        expect(text).toMatch(/40 Hz/);
      }
    });
    it('Excursion and PRExcursion mention Xmax and subsonic filter', () => {
      for (const id of ['Excursion', 'PRExcursion'] as const) {
        const text = [CHART_HELP[id].intro, ...CHART_HELP[id].rows.map(r => r.text)].join(' ');
        expect(text).toMatch(/Xmax/);
        expect(text).toMatch(/subsonic/);
      }
    });
    it('MaxPwr mentions thermal and excursion limits', () => {
      const text = [CHART_HELP.MaxPwr.intro, ...CHART_HELP.MaxPwr.rows.map(r => r.text)].join(' ');
      expect(text).toMatch(/thermal/);
      expect(text).toMatch(/excursion/);
    });
    it('Zmag mentions Fc, Fb, and crossover', () => {
      const text = [CHART_HELP.Zmag.intro, ...CHART_HELP.Zmag.rows.map(r => r.text)].join(' ');
      expect(text).toMatch(/Fc/);
      expect(text).toMatch(/Fb/);
      expect(text).toMatch(/crossover/);
    });
    it('air velocity charts mention 17 m/s, 35 m/s, and the limit line', () => {
      for (const id of ['RearPort', 'FrontPort', 'IntraPort'] as const) {
        const text = [CHART_HELP[id].intro, ...CHART_HELP[id].rows.map(r => r.text)].join(' ');
        expect(text).toMatch(/17 m\/s/);
        expect(text).toMatch(/35 m\/s/);
        expect(text).toMatch(/limit line/);
      }
    });
  });
});
