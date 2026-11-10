/**
 * The exhaustive desktop layout scan (John, 10 Nov 2026: "I want an exhaustive UI scan for these layout issues as
 * a test"; "if new screens are added or popups then they must be auto included"): every entry of the desktop
 * surface manifest (desktopSurfaceManifest.ts, opened through desktopSurfaceNavigation.ts) is opened at 1280 x 720
 * and at 1440 x 900 and measured with the phone scan's rules: R2 to R7, R10 (gap before the buttons), R11 (cut
 * value) and the label gap. An entry that cannot be opened is a fault. Every result is appended to
 * ui-gallery/T742-phone-clip/scan-result-desktop.jsonl. There is no skip and no known-fault list.
 */
import type {Page} from '@playwright/test';
import {appendFileSync, mkdirSync} from 'node:fs';
import {COMPLETE_DRIVER_PROJECT_OWPR, openAProject, test, expect} from '../fixtures.js';
import {measureFieldLayoutRules, measureLabelGaps} from '../fixtures/fieldLayoutAudit.js';
import {DESKTOP_SURFACES, DesktopRoute} from '../fixtures/desktopSurfaceManifest.js';
import {openDesktopSurface} from '../fixtures/desktopSurfaceNavigation.js';
import {DesktopSizes} from '@openisd/design/fields';
import {enableCloudSync, stubGoogleApis} from './fixtures/cloudSyncStubs.js';

const RESULTS = '/home/john/work/winisd/ui-gallery/T742-phone-clip';
const SIZES = [{width: 1280, height: 720}, {width: 1440, height: 900}] as const;
/** The cloud entry exists only in a build with a client id: the same stand-in the cloud specs use for the outside service. */
async function prepareCloud(page: Page, surface: {readonly route: DesktopRoute}): Promise<void> {
  if (surface.route === DesktopRoute.Cloud) { await enableCloudSync(page); await stubGoogleApis(page); }
}
/** The first line of a failure, so a view that cannot be opened is one fault line. */
function firstLine(error: unknown): string {
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}

for (const size of SIZES) {
  for (const surface of DESKTOP_SURFACES) {
    test(`scan desktop ${size.width} ${surface.id}: ${surface.title}`, async ({page}) => {
      let faults: string[];
      try {
        await page.setViewportSize(size);
        await prepareCloud(page, surface);
        await page.goto('/');
        await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
        await openDesktopSurface(page, surface);
        const root = page.locator(surface.root).first();
        await expect(root).toBeVisible();
        faults = [
          ...await root.evaluate(measureFieldLayoutRules, 0),
          ...await root.evaluate(measureLabelGaps, DesktopSizes.MAX_LABEL_GAP_PX),
        ];
      } catch (error) {
        faults = [`OPEN ${firstLine(error)}`];
      }
      mkdirSync(RESULTS, {recursive: true});
      appendFileSync(`${RESULTS}/scan-result-desktop.jsonl`, JSON.stringify({screen: surface.id, title: surface.title, size: `${size.width}x${size.height}`, skin: 'desktop', pass: faults.length === 0, faults}) + '\n');
      expect(faults, `${surface.id}`).toEqual([]);
    });
  }
}
