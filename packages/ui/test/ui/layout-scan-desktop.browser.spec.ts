/**
 * The exhaustive desktop layout scan (John, 10 Nov 2026: "I want an exhaustive UI scan for these layout issues as
 * a test"; "if new screens are added or popups then they must be auto included"): every entry of the desktop
 * surface manifest (desktopSurfaceManifest.ts, opened through desktopSurfaceNavigation.ts) is opened at 1280 x 720
 * and at 1440 x 900 and measured with the phone scan's rules: R2 to R7, R10 (gap before the buttons), R11 (cut
 * value) and the label gap. An entry that cannot be opened is a fault. Every result is appended to
 * ui-gallery/T742-phone-clip/scan-result-desktop.jsonl. A fault nobody has fixed is a SCAN_KNOWN entry
 * (test.fail: red when fixed, then delete the entry); there is no skip.
 */
import {appendFileSync, mkdirSync} from 'node:fs';
import {COMPLETE_DRIVER_PROJECT_OWPR, openAProject, test, expect} from '../fixtures.js';
import {measureFieldLayoutRules, measureLabelGaps} from '../fixtures/fieldLayoutAudit.js';
import {DESKTOP_SURFACES} from '../fixtures/desktopSurfaceManifest.js';
import {openDesktopSurface} from '../fixtures/desktopSurfaceNavigation.js';
import {DesktopSizes} from '@openisd/design/fields';

const RESULTS = '/home/john/work/winisd/ui-gallery/T742-phone-clip';
const SIZES = [{width: 1280, height: 720}, {width: 1440, height: 900}] as const;
/** Entries the first scan (10 Nov 2026) found at fault and nobody has fixed yet, as `<id> <width>`. Each then expects the fault (test.fail) and turns red when it is fixed; delete its entry then. */
const SCAN_KNOWN: ReadonlySet<string> = new Set<string>([
  'desktop/settings/cloud/account-and-activity 1280',
  'desktop/settings/cloud/account-and-activity 1440',
]);
const SCAN_KNOWN_BUG = 'BUG_20261110_layout-scan-first-run';

for (const size of SIZES) {
  for (const surface of DESKTOP_SURFACES) {
    test(`scan desktop ${size.width} ${surface.id}: ${surface.title}`, async ({page}) => {
      if (SCAN_KNOWN.has(`${surface.id} ${size.width}`)) test.fail(true, SCAN_KNOWN_BUG);
      let faults: string[];
      try {
        await page.setViewportSize(size);
        await page.goto('/');
        await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
        await openDesktopSurface(page, surface);
        const root = page.locator(surface.root).first();
        await root.waitFor({state: 'visible', timeout: 5000});
        faults = [
          ...await root.evaluate(measureFieldLayoutRules, 0),
          ...await root.evaluate(measureLabelGaps, DesktopSizes.MAX_LABEL_GAP_PX),
        ];
      } catch (error) {
        faults = [`OPEN ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`];
      }
      mkdirSync(RESULTS, {recursive: true});
      appendFileSync(`${RESULTS}/scan-result-desktop.jsonl`, JSON.stringify({screen: surface.id, title: surface.title, size: `${size.width}x${size.height}`, skin: 'desktop', pass: faults.length === 0, faults}) + '\n');
      expect(faults, `${surface.id}`).toEqual([]);
    });
  }
}
