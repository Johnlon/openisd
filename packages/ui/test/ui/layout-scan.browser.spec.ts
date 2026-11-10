/**
 * The exhaustive layout scan (John, 10 Nov 2026: "I want an exhaustive UI scan for these layout issues as a test"):
 * every phone view and popup on the surface manifest that the manifest can open (mobileSurfaceManifest.ts, opened
 * through its own route helper, mobileSurfaceNavigation.ts) is opened at 374 x 705 width and measured with every
 * field layout rule: R2 (nothing cut, including the text inside a number box), R3 to R7, R10 (gap before the
 * buttons), R11 (cut value) and the label gap. A view that cannot be opened is a fault, unless the manifest says
 * it is opened by hand (route Manual). Every result is appended to ui-gallery/T742-phone-clip/scan-result.jsonl.
 * Desktop views: waits for T739's desktop opener (BUG_20261110_layout-gate-misses-screens).
 */
import {appendFileSync, mkdirSync} from 'node:fs';
import {openAMobileProject, test, expect} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {measureFieldLayoutRules, measureLabelGaps} from '../fixtures/fieldLayoutAudit.js';
import {MOBILE_SURFACES, MobileRoute} from '../fixtures/mobileSurfaceManifest.js';
import {openMobileSurface} from '../fixtures/mobileSurfaceNavigation.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import {PhoneRowColumns} from '@openisd/design/fields';

const RESULTS = '/home/john/work/winisd/ui-gallery/T742-phone-clip';
/** Views the first scan (10 Nov 2026) found at fault and nobody has fixed yet. Each test then expects the fault (test.fail) and turns red when it is fixed; delete its id then. */
const SCAN_KNOWN: ReadonlySet<string> = new Set([
]);
const SCAN_KNOWN_BUG = 'BUG_20261110_layout-scan-first-run';
const OPENABLE = MOBILE_SURFACES.filter(surface => surface.route !== MobileRoute.Manual && surface.root !== '');

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  // Tall, so every row is painted at once (a row below the fold would otherwise overlap the fixed footer in the measure).
  await page.setViewportSize({width: PIXEL_9.width, height: 2600});
  await page.goto('/');
  await openAMobileProject(page);
});

for (const surface of OPENABLE) {
  test(`scan phone ${surface.id}: ${surface.title}`, async ({page}) => {
    if (SCAN_KNOWN.has(surface.id)) test.fail(true, SCAN_KNOWN_BUG);
    let faults: string[];
    try {
      await openMobileSurface(page, surface);
      const root = page.locator(surface.root).first();
      await root.waitFor({state: 'visible', timeout: 5000});
      faults = [
        ...await root.evaluate(measureFieldLayoutRules, PhoneRowColumns.MIN_STEPPER_GAP_PX),
        ...await root.evaluate(measureLabelGaps, PhoneRowColumns.MAX_LABEL_GAP_PX),
      ];
    } catch (error) {
      faults = [`OPEN ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`];
    }
    mkdirSync(RESULTS, {recursive: true});
    appendFileSync(`${RESULTS}/scan-result.jsonl`, JSON.stringify({screen: surface.id, title: surface.title, size: `${PIXEL_9.width}x${PIXEL_9.height}`, skin: 'phone', pass: faults.length === 0, faults}) + '\n');
    expect(faults, `${surface.id}`).toEqual([]);
  });
}
