import {expect, test} from '../fixtures.js';
import {focusedProjectOwpr} from '../fixtures.js';
import {readFileSync} from 'node:fs';
import {createEngine} from '@openisd/design/engine';
import {OpenISDDriver} from '@openisd/design';
import {SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';
import {MY_DRIVERS_KEY} from '../fixtures/seedMyDrivers.js';

/** The generated sample-project.owpr that many specs open: it must stay a faithful copy of what the wizard builds. */

/** A freshly-parsed JSON object, navigated field by field — no domain shape is assumed. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The bundled catalogue's W5-1138SMF fixture is already a conforming `OpenISDDeviceJson`
 *  device record — the same shape `deviceRecord()` (seedMyDrivers.ts) builds, not the flat
 *  `SeedDriver` shape `myDriversJson` accepts. Validate it via the public
 *  `OpenISDDriver.fromConformingRecord` entry point (the sanctioned way to confirm a record
 *  conforms — generateSample.ts uses the same call on the same file), then wrap it straight
 *  into a My Drivers envelope entry instead of round-tripping it through `SeedDriver`. */
function w5MyDriversJson(): string {
  const parsed: unknown = JSON.parse(readFileSync('packages/ui/public/drivers/tang-band/w5-1138smf.json', 'utf-8'));
  const maybeDriver = OpenISDDriver.fromConformingRecord(parsed, createEngine());
  if (Array.isArray(maybeDriver)) {
    throw new Error(`w5-1138smf.json is not a conforming device record: ${maybeDriver.join(', ')}`);
  }
  const uuid = getPath(parsed, 'uuid', 'value');
  if (typeof uuid !== 'string') throw new Error('w5-1138smf.json record is missing a uuid');
  return JSON.stringify({ schema: 1, entries: [{ uuid, record: parsed }] });
}

/** `obj.a.b.c`, stopping at the first missing/non-object link — never throws on an absent path. */
function getPath(v: unknown, ...path: string[]): unknown {
  let cur = v;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Ignore UUIDs, dates, and non-essential meta fields for comparison. */
function normalize(json: unknown): unknown {
  const clone: unknown = JSON.parse(JSON.stringify(json));
  const device = getPath(clone, 'driverEmbedding', 'device');
  if (isRecord(device)) {
    if (device.uuid) device.uuid = 'normalized';
    if (device.added) device.added = 'normalized';
    // Retired field: the app never writes it, but a driver record from before it was retired still carries it.
    delete device.authoritative;
  }
  const component = getPath(clone, 'box', 'passiveRadiator', 'component');
  if (isRecord(component)) {
    const uuid = component.uuid;
    if (isRecord(uuid) && uuid.value) uuid.value = 'normalized';
    // The passive radiator's own added-date, stamped when the record was built. The fixture is
    // generated once and cached, so this differs from the wizard's whenever the two happen on
    // different days — the same volatility as `device.added` above.
    const added = component.added;
    if (isRecord(added) && added.value) added.value = 'normalized';
  }
  const meta = getPath(clone, 'meta');
  if (isRecord(meta)) {
    meta.created = 'normalized';
    meta.modified = 'normalized';
  }
  return clone;
}

/** Mask solved (state-C) numeric values so two construction paths compare structurally. */
function maskDerived(json: unknown): unknown {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (isRecord(node)) {
      const o = node;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) {
        if ((k === 'value' || k === 'precision') && o.state === 'C') { out[k] = 'derived'; continue; }
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };
  return walk(JSON.parse(JSON.stringify(json)));
}

/** The vented project's solved port length — the number a user reads. */
function ventLengthOf(json: unknown): number {
  const len = getPath(json, 'box', 'vented', 'vent', 'length_m', 'value');
  if (typeof len !== 'number') throw new Error('a vented project must carry a solved vent length');
  return len;
}

test.describe('sample project fixture', () => {
  test('sample-project.owpr is a faithful representation of a wizard-created project', async ({ page }) => {
    // Load the W5 driver into localStorage so it can be picked
    await page.addInitScript(([key, json]) => {
      localStorage.setItem(key, json);
    }, [MY_DRIVERS_KEY, w5MyDriversJson()] as const);
    await page.goto('/');
    await page.locator('.original-root').waitFor({ state: 'visible' });

    // Walk the new 5-step wizard (FIX_WIZARD_SEALED)
    await page.locator('.tb-btn[title*="New project"]').click();
    const modal = page.locator('.overlay.open');
    await modal.locator('.dlist .ditem', { hasText: 'Tang Band W5-1138SMF' }).first().click();  // step 1: driver (embedded library)
    await modal.locator('.modal-footer button', { hasText: 'Next' }).click();   // Next chooses the driver: step 2 (num/placement)
    await modal.locator('button', { hasText: 'Next' }).click();   // step 3: box type
    await modal.locator('.field', { hasText: 'Box type' }).locator('select').selectOption('vented');           // step 3: box type
    await modal.locator('button', { hasText: 'Next' }).click();
    await modal.locator('button', { hasText: 'Next' }).click();   // step 4: vented alignment (docs/research/VENTED_ALIGNMENT_FORMULAS.md)
    await modal.locator('input[type="text"]').fill('W5-1138SMF Fixture');  // step 5: name
    await modal.locator('button', { hasText: 'Create' }).click();
    await expect(page.locator('.original-root')).toBeVisible();

    // Export the created project and compare its core structure to the fixture
    // Export the created project and compare its core structure to the fixture
    const wizardJson = await focusedProjectOwpr(page);

    const sampleJson: unknown = JSON.parse(readFileSync(SAMPLE_PROJECT_OWPR, 'utf-8'));
  
    const normWizard = normalize(getPath(wizardJson, 'saved'));
    const normSample = normalize(getPath(sampleJson, 'saved'));

    // SOLVED values (state "C") are masked below (maskDerived) so the two construction paths
    // compare structurally; the one number a user reads (the port length) is closeTo-checked.
    const maskedWizardFull = maskDerived(normWizard);
    const maskedSampleFull = maskDerived(normSample);
    const maskedWizard = { box: getPath(maskedWizardFull, 'box'), driverEmbedding: getPath(maskedWizardFull, 'driverEmbedding') };
    const maskedSample = { box: getPath(maskedSampleFull, 'box'), driverEmbedding: getPath(maskedSampleFull, 'driverEmbedding') };

    // Compare the box section, driver section, etc.
    // Using toEqual which does a deep comparison
    expect(maskedWizard.box).toEqual(maskedSample.box);
    expect(maskedWizard.driverEmbedding).toEqual(maskedSample.driverEmbedding);

    // The port length is a solved value the two construction paths float-differ on — it must be
    // present (never skipped) and close, not bit-identical.
    expect(ventLengthOf(normWizard)).toBeCloseTo(ventLengthOf(normSample), 2);
  });
});
