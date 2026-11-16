/**
 * Radiator boxes: the wizard's step and the project's page both show Vas, Qms, Fs, Sd, Mms, Cms, Rms
 * and Xmax, each stated or calculated, so a person can correct any record and every calculated
 * figure has its factors on display (John, 7 Nov 2026).
 * bugs/BUG_20261107_radiator-pages-miss-figures-the-datasheet-gives.md
 */
import type {Locator, Page} from '@playwright/test';
import {expect, openTab, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const FIGURE_IDS = ['#np-pr-vas', '#np-pr-qms', '#np-pr-fs', '#np-pr-sd', '#np-pr-mms', '#np-pr-cms', '#np-pr-rms', '#np-pr-xmax'];

interface Skin {
  readonly root: (page: Page) => Locator;
  readonly footer: (page: Page) => Locator;
  readonly open: (page: Page) => Promise<void>;
  readonly projectRms: (page: Page) => Promise<Locator>;
  readonly projectCms: (page: Page) => Promise<Locator>;
  readonly projectMms: (page: Page) => Promise<Locator>;
}

const DESKTOP: Skin = {
  root: page => page.locator('.overlay.open'),
  footer: page => page.locator('.overlay.open .modal-footer'),
  open: page => page.locator('.tb-btn[title*="New project"]').click(),
  projectRms: async page => {
    await openTab(page, 'Passive Radiator');
    return page.locator('#og-pr-rms');
  },
  projectCms: async page => {
    await openTab(page, 'Passive Radiator');
    return page.locator('#og-pr-cms');
  },
  projectMms: async page => {
    await openTab(page, 'Passive Radiator');
    return page.locator('#og-pr-mms');
  },
};

const PHONE: Skin = {
  root: page => page.locator('.mob-np-overlay'),
  footer: page => page.locator('.mob-np-footer'),
  open: page => page.getByText('New project').click(),
  // The phone shows the radiator's figures in its editor (QO946.c115): Edit, read, the caller's assertion, no Cancel needed.
  projectRms: async page => {
    await openTab(page, 'Box');
    await page.locator('#mob-pr-edit').click();
    return page.locator('#pr-editor-rms');
  },
  projectCms: async page => {
    await openTab(page, 'Box');
    await page.locator('#mob-pr-edit').click();
    return page.locator('#pr-editor-cms');
  },
  // The editor may already be open from the Cms read just before.
  projectMms: async page => {
    const mms = page.locator('#pr-editor-mms');
    if (!(await mms.isVisible())) {
      await openTab(page, 'Box');
      await page.locator('#mob-pr-edit').click();
    }
    return mms;
  },
};

/** New Project as far as the radiator step, then one bundled radiator picked and Back to its boxes. */
async function pickThenBack(page: Page, skin: Skin, radiator: string): Promise<void> {
  await skin.open(page);
  const root = skin.root(page);
  const footer = skin.footer(page);
  const next = footer.getByRole('button', {name: /Next/});
  await root.locator('.dlist .ditem').first().click();
  await next.click();
  await next.click();
  await root.locator('#np-box-type').selectOption('box-passive-radiator');
  await next.click();
  await root.locator('#np-pr-select').click();
  await page.locator('.pr-lib-item .pr-lib-name', {hasText: radiator}).first().click();
  await footer.getByRole('button', {name: /Back/}).click();
  await expect(root.locator('#np-pr-name')).toHaveValue(new RegExp(radiator));
}

async function createProject(page: Page, skin: Skin): Promise<void> {
  const footer = skin.footer(page);
  await footer.getByRole('button', {name: /Next/}).click();
  await footer.getByRole('button', {name: /Create/}).click();
  await expect(skin.root(page)).toHaveCount(0);
}


for (const [name, skin] of [['desktop', DESKTOP], ['phone', PHONE]] as const) {
  test.describe(name, () => {
    if (name === 'phone') {
      test.use({viewport: {width: 374, height: 705}});

      test.beforeEach(async ({page}) => {
        await forceMobileSkin(page);
        await page.goto('/');
      });
    }

    const pageOf = (fixtures: {page: Page; appPage: Page}): Page => name === 'phone' ? fixtures.page : fixtures.appPage;

    test('SP22R states no Qms and no Fs: the wizard calculates both and every other box is full', async ({page, appPage}) => {
      const p = pageOf({page, appPage});
      await pickThenBack(p, skin, 'SP22R');
      const root = skin.root(p);
      await expect(root.locator('#np-pr-qms')).toHaveValue(/^4\.8/);
      await expect(root.locator('#np-pr-qms')).toHaveClass(/value-c/);
      await expect(root.locator('#np-pr-fs')).toHaveValue(/^23\.3/);
      await expect(root.locator('#np-pr-fs')).toHaveClass(/value-c/);
      await expect(root.locator('#np-pr-vas')).not.toHaveClass(/value-c/);
      for (const id of FIGURE_IDS.filter(i => i !== '#np-pr-xmax')) await expect.soft(root.locator(id), id).toHaveValue(/\d/);
    });

    test('ASP190: Rms is on both pages, and Qms comes from it', async ({page, appPage}) => {
      const p = pageOf({page, appPage});
      await pickThenBack(p, skin, 'ASP190');
      const root = skin.root(p);
      await expect(root.locator('#np-pr-rms')).toHaveValue(/^2\.2/);
      await expect(root.locator('#np-pr-qms')).toHaveValue(/^4\.[67]/);
      await createProject(p, skin);
      await expect(await skin.projectRms(p)).toHaveValue(/^2\.2/);
    });

    // QO534 (John, 11 Nov 2026): "an entered value is never overwritten"; "all get the mark". A typed Cms keeps the stated Vas, and both carry the warning.
    test('a Cms typed over a stated Vas leaves Vas as stated, both boxes show the mark, and it reaches the project', async ({page, appPage}) => {
      const p = pageOf({page, appPage});
      await pickThenBack(p, skin, 'ASP190');
      const root = skin.root(p);
      const vasBefore = await root.locator('#np-pr-vas').inputValue();
      // The box is in mm/N, so 2 is 0.002 m/N: Vas = rho*c^2*Sd^2*Cms = 141855 Pa * 0.0202^2 m^4 * 0.002 m/N = 0.1158 m3
      // against the stated 0.027 m3, 4.3 times apart. (1 mm/N gave 0.0579 m3, 2.1 times apart, but a typed 1 carries
      // 0.5 of precision, which alone moves Vas by 0.029 m3, so it was within the print's slack once the air may
      // differ by 2.5% (T804).)
      await root.locator('#np-pr-cms').fill('2');
      await root.locator('#np-pr-cms').press('Tab');
      await expect(root.locator('#np-pr-vas')).toHaveValue(vasBefore);
      await expect(root.locator('#np-pr-cms')).toHaveClass(/dq-flag/);
      await expect(root.locator('#np-pr-vas')).toHaveClass(/dq-flag/);
      await createProject(p, skin);
      await expect(await skin.projectCms(p)).toHaveValue(/^2(\.0*)?$/);
    });

    // John, QO451, 8 Nov 2026: "a stated 1.01 must not be replaced by other numbers"; QO534: the charts use the boxes as they show.
    test('P173: the wizard and the project show the stated Cms 1.01 and Mms 15, entered', async ({page, appPage}) => {
      const p = pageOf({page, appPage});
      await pickThenBack(p, skin, 'P173');
      const root = skin.root(p);
      await expect(root.locator('#np-pr-cms')).toHaveValue(/^1\.010*$/);
      await expect(root.locator('#np-pr-cms')).toHaveClass(/value-e/);
      await expect(root.locator('#np-pr-mms')).toHaveValue(/^15(\.0*)?$/);
      await expect(root.locator('#np-pr-mms')).toHaveClass(/value-e/);
      await createProject(p, skin);
      const cms = await skin.projectCms(p);
      await expect(cms).toHaveValue(/^1\.010*$/);
      await expect(cms).toHaveClass(/value-e/);
      const mms = await skin.projectMms(p);
      await expect(mms).toHaveValue(/^15(\.0*)?$/);
      await expect(mms).toHaveClass(/value-e/);
    });

    test('P173 gives nothing to calculate Qms from: the box stays empty', async ({page, appPage}) => {
      const p = pageOf({page, appPage});
      await pickThenBack(p, skin, 'P173');
      await expect(skin.root(p).locator('#np-pr-qms')).toHaveValue('');
    });

    test('all eight boxes fit: nothing clipped and no sideways scroll', async ({page, appPage}) => {
      const p = pageOf({page, appPage});
      await pickThenBack(p, skin, 'SP22R');
      const root = skin.root(p);
      for (const id of FIGURE_IDS) {
        await root.locator(id).evaluate(box => box.scrollIntoView({block: 'center'}));
        await expect.soft(root.locator(id), id).toBeInViewport({ratio: 1});
      }
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
    });
  });
}

test('desktop: the dialog keeps its size between an unpicked step and a picked one, and fits the window', async ({appPage: page}) => {
  await page.locator('.tb-btn[title*="New project"]').click();
  const root = page.locator('.overlay.open');
  const dialog = root.locator('.modal').first();
  const next = root.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true});
  await root.locator('.dlist .ditem').first().click();
  await next.click();
  await next.click();
  await root.locator('#np-box-type').selectOption('box-passive-radiator');
  await next.click();
  await expect(root.locator('#np-pr-rms')).toBeVisible();
  const unpicked = await dialog.boundingBox();
  await root.locator('#np-pr-select').click();
  await page.locator('.pr-lib-item .pr-lib-name', {hasText: 'SP22R'}).first().click();
  await root.locator('.modal-footer').getByRole('button', {name: /Back/}).click();
  await expect(root.locator('#np-pr-qms')).not.toHaveValue('');
  expect(await dialog.boundingBox()).toEqual(unpicked);
  await expect(dialog).toBeInViewport({ratio: 1});
});

test('desktop: the Select PR button is the wizard blue, as on the phone', async ({appPage: page}) => {
  await page.locator('.tb-btn[title*="New project"]').click();
  const root = page.locator('.overlay.open');
  const next = root.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true});
  await root.locator('.dlist .ditem').first().click();
  await next.click();
  await next.click();
  await root.locator('#np-box-type').selectOption('box-passive-radiator');
  await next.click();
  const select = root.locator('#np-pr-select');
  await expect(select).toHaveCSS('background-color', 'rgb(24, 104, 209)');
  await expect(select).toHaveCSS('color', 'rgb(255, 255, 255)');
});
