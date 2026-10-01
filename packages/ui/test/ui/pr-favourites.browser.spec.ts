import {expect, openAProject, test} from '../fixtures.js';

// A passive radiator can be starred in the PR picker, the star outlives the session, and
// Favorites narrows the picker to the starred ones.
// bugs/BUG_20260909_passive_radiators_cannot_be_favourited_at_all.md

const PR_KEY = 'openisd_my_passive_radiators';
const PR_UUID = '00000000-0000-4000-8000-000000000001';

const entered = (value: number) =>
  ({ state: 'E' as const, value, origin: 'entered', readings: { entered: { read_value: value } } });

// A conforming passive-radiator record, the same shape `OpenISDPassiveRadiatorStandalone.
// fromConformingRecord` opens in the My PR library repo.
function passiveRadiatorRecord() {
  return {
    brand: { value: 'Test PR' },
    model: { value: 'PR250' },
    manufacturer: { value: 'Test PR' },
    provided_by: { value: 'test' },
    comment: { value: '' },
    added: { value: '2026-01-01' },
    uuid: { value: PR_UUID },
    sku: { value: 'TEST-PR', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-PR' }] },
    driver_type: { value: 'passive-radiator' },
    data_sources: { value: {} },
    authoritative: { value: 'openisd' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      'passive-radiator': {
        Fs_hz: entered(12), Sd_m2: entered(0.025), Cms_m_per_N: entered(0.0009),
        Mms_kg: entered(0.09), Rms_kg_per_s: entered(1.5), Xmax_m: entered(0.015),
      },
    },
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(([key, json]) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, json);
  }, [PR_KEY, JSON.stringify({ schema: 1, entries: [{ uuid: PR_UUID, record: passiveRadiatorRecord() }] })] as const);
  await page.goto('/');
  await openAProject(page);
  await page.locator('select#og-box-type').selectOption('box-passive-radiator');
  await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
});

test('a starred passive radiator stays starred after a reload, and Favorites shows only it', async ({ page }) => {
  await page.locator('button', { hasText: 'Select PR' }).click();
  const row = page.locator('.pr-lib-item', { hasText: 'Test PR PR250' });
  await expect(row.locator('.fav-btn')).toHaveText('☆');
  await row.locator('.fav-btn').click();
  await expect(row.locator('.fav-btn')).toHaveText('★');

  await page.reload();
  await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
  await page.locator('button', { hasText: 'Select PR' }).click();
  await expect(page.locator('.pr-lib-item', { hasText: 'Test PR PR250' }).locator('.fav-btn')).toHaveText('★');

  await page.locator('.pr-lib').locator('..').locator('button', { hasText: '★ Favorites' }).click();
  await expect(page.locator('.pr-lib-item')).toHaveCount(1);
  await expect(page.locator('.pr-lib-item')).toContainText('Test PR PR250');
});
