import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/index.js';
import {at, specSection, driverFrom} from '../fixtures/domainBuilders.js';

describe('OpenISDProject graphs/cursor — project-scoped, not a UI singleton (S10/QO130)', () => {
  const project = () => new ProjectBuilder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), createEngine()).sealed().volume_m3(0.03).build();

  it('graphs defaults to empty and round-trips a stated list through the project record', () => {
    const p = project();
    expect(p.graphs.value).toEqual([]);
    p.graphs.set(['SPL', 'Zmag']);
    expect(p.graphs.value).toEqual(['SPL', 'Zmag']);
  });

  it('two projects hold independent graphs — no shared singleton', () => {
    const a = project();
    const b = project();
    a.graphs.set(['SPL']);
    expect(b.graphs.value).toEqual([]);
  });

  it('does not count as an unsaved change — graphs writes stay out of isModified()', () => {
    const p = project();
    expect(p.isModified()).toBe(false);
    p.graphs.set(['SPL']);
    expect(p.isModified()).toBe(false);
  });

  it('graphs round-trips through the saved record (John 2026-09-20/21: it only changes per ' +
     'click, unlike the mousemove-driven cursor below)', () => {
    const p = project();
    p.graphs.set(['SPL', 'Zmag']);
    p.save();

    const saved = at(JSON.parse(p.toOwprText()), 'saved');
    expect(at(saved, 'charts', 'graphs')).toEqual(['SPL', 'Zmag']);
  });

  it('openCharts is the default chart alone when graphs is empty', () => {
    const p = project();
    expect(p.openCharts.value).toEqual([createEngine().box.defaultChart]);
  });

  it('openCharts keeps only charts this box shows, in chart-menu order', () => {
    const p = project();
    p.graphs.set(['Zmag', 'RearPort', 'SPL', 'NoSuchChart']);
    expect(p.openCharts.value).toEqual(p.charts.filter(c => c === 'SPL' || c === 'Zmag'));
  });

  it('openCharts falls back to the default chart when no stored chart applies to this box', () => {
    const p = project();
    p.graphs.set(['RearPort']);
    expect(p.openCharts.value).toEqual([createEngine().box.defaultChart]);
  });

  it('openCharts.showOnly replaces the open charts with the one chart', () => {
    const p = project();
    p.graphs.set(['SPL', 'Zmag']);
    p.openCharts.showOnly('Excursion');
    expect(p.openCharts.value).toEqual(['Excursion']);
  });

  it('openCharts.toggle adds a closed chart and removes an open one', () => {
    const p = project();
    p.openCharts.showOnly('SPL');
    p.openCharts.toggle('Zmag');
    expect(p.openCharts.value).toEqual(p.charts.filter(c => c === 'SPL' || c === 'Zmag'));
    p.openCharts.toggle('SPL');
    expect(p.openCharts.value).toEqual(['Zmag']);
  });

  it('openCharts.toggle never closes the last open chart', () => {
    const p = project();
    p.openCharts.showOnly('Zmag');
    p.openCharts.toggle('Zmag');
    expect(p.openCharts.value).toEqual(['Zmag']);
  });

  it('openCharts.toggle on an empty graphs list adds to the shown default chart', () => {
    const p = project();
    p.openCharts.toggle('Zmag');
    expect(p.openCharts.value).toEqual(p.charts.filter(c => c === 'SPL' || c === 'Zmag'));
  });

  it('cursorF/pinnedF/cursorLocked/dragRange default to unset and round-trip in memory ' +
     '(QO168: a documented exception, not part of OpenISDProjectJson)', () => {
    const p = project();
    expect(p.cursorF.value).toBeNull();
    expect(p.pinnedF.value).toBeNull();
    expect(p.cursorLocked.value).toBe(false);
    expect(p.dragRange.value).toBeNull();

    p.cursorF.set(120);
    p.pinnedF.set(100);
    p.cursorLocked.set(true);
    p.dragRange.set({ fLo: 80, fHi: 200 });

    expect(p.cursorF.value).toBe(120);
    expect(p.pinnedF.value).toBe(100);
    expect(p.cursorLocked.value).toBe(true);
    expect(p.dragRange.value).toEqual({ fLo: 80, fHi: 200 });
  });

  it('two projects hold independent cursors — no shared singleton', () => {
    const a = project();
    const b = project();
    a.cursorF.set(120);
    expect(b.cursorF.value).toBeNull();
  });

  it('cursor writes never reach the saved record — QO168 keeps them out of .owpr entirely', () => {
    const p = project();
    p.cursorF.set(120);
    p.pinnedF.set(100);
    p.cursorLocked.set(true);
    p.dragRange.set({ fLo: 80, fHi: 200 });
    p.save();

    const saved = at(JSON.parse(p.toOwprText()), 'saved');
    expect(at(saved, 'charts')).not.toHaveProperty('cursor');
  });

  it('does not count as an unsaved change — cursor writes stay out of isModified()', () => {
    const p = project();
    expect(p.isModified()).toBe(false);
    p.cursorF.set(120);
    p.dragRange.set({ fLo: 80, fHi: 200 });
    expect(p.isModified()).toBe(false);
  });
});
