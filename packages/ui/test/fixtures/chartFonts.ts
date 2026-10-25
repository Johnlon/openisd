import type {Page} from '@playwright/test';

/**
 * A record of when fonts load and in which font the page draws canvas text, for the report of a
 * chart picture that differs (bugs/BUG_20261017_what-if-close-curve-not-restored.md: on the CI
 * runner the chart's tick labels sometimes stay in the fallback font). It watches the browser's
 * font loading and canvas calls; it reads and changes nothing of the app.
 */

/** One run of canvas text calls in the same font and font state. */
interface CanvasTextRun {
  readonly line: string;
  readonly firstMs: number;
  lastMs: number;
  calls: number;
}

declare global {
  interface Window {
    chartFontLog?: {readonly events: string[]; readonly runs: CanvasTextRun[]; readonly clock: Performance};
  }
}

/** Starts the record on every page load from now on. */
export async function watchChartFonts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const events: string[] = [];
    const runs: CanvasTextRun[] = [];
    // The browser's own clock and download list: a spec's page.clock replaces `performance` after this script runs.
    const clock = performance;
    window.chartFontLog = {events, runs, clock};
    // The app fetches hundreds of driver files; the default buffer of 250 drops the font downloads.
    clock.setResourceTimingBufferSize(5000);
    const faces = (e: FontFaceSetLoadEvent): string => e.fontfaces.map(f => `${f.family} ${f.weight} ${f.status}`).join(', ');
    document.fonts.addEventListener('loading', e => events.push(`${clock.now().toFixed(0)} ms loading [${faces(e)}]`));
    document.fonts.addEventListener('loadingdone', e => events.push(`${clock.now().toFixed(0)} ms loadingdone [${faces(e)}]`));
    document.fonts.addEventListener('loadingerror', e => events.push(`${clock.now().toFixed(0)} ms loadingerror [${faces(e)}]`));
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number): void {
      const now = clock.now();
      const line = `font "${this.font}" usable=${document.fonts.check(this.font)} fonts.status=${document.fonts.status}`;
      const last = runs.at(-1);
      if (last && last.line === line) { last.lastMs = now; last.calls++; }
      else runs.push({line, firstMs: now, lastMs: now, calls: 1});
      if (maxWidth === undefined) fillText.call(this, text, x, y);
      else fillText.call(this, text, x, y, maxWidth);
    };
  });
}

/** The record so far, as text: font events, canvas text runs, and font and stylesheet downloads. */
export async function chartFontReport(page: Page): Promise<string> {
  return page.evaluate(() => {
    const log = window.chartFontLog;
    const clock = log?.clock ?? performance;
    const runs = (log?.runs ?? []).map(r => `${r.firstMs.toFixed(0)}–${r.lastMs.toFixed(0)} ms ${r.calls}× ${r.line}`);
    const downloads = clock.getEntriesByType('resource')
      .filter(e => /\.(woff2?|css)(\?|$)/.test(e.name))
      .map(e => `${e.startTime.toFixed(0)}–${(e.startTime + e.duration).toFixed(0)} ms ${e.name.split('/').pop()}`);
    const faces = [...document.fonts].filter(f => f.status !== 'unloaded').map(f => `${f.family} ${f.weight} ${f.status}`);
    return [
      `now ${clock.now().toFixed(0)} ms, fonts.status=${document.fonts.status}, faces [${faces.join(', ')}]`,
      '— font events', ...(log?.events ?? ['(no record)']),
      '— canvas text', ...runs,
      '— downloads', ...downloads,
    ].join('\n');
  });
}
