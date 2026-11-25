import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

for (const phone of [false, true]) {
  test(`${phone ? 'phone' : 'desktop'} project title opens an explicit Save and Cancel dialog`, async ({page}) => {
    if (phone) await forceMobileSkin(page);
    await page.goto('/');
    if (phone) await openAMobileProject(page); else await openAProject(page);
    const title = phone ? page.locator('.mob-project-title') : page.locator('.project-row.selected .project-name');
    const original = (await title.textContent())!.trim();
    await title.click();
    const dialog = page.getByRole('dialog', {name: 'Rename project'});
    await expect(dialog).toBeVisible();
    await page.screenshot({path: test.info().outputPath('rename-dialog.png')});
    await dialog.getByLabel('Project name').fill('Changed project');
    await dialog.getByRole('button', {name: 'Cancel'}).click();
    await expect(title).toContainText(original);
    await title.click();
    await dialog.getByLabel('Project name').fill('Changed project');
    await dialog.getByRole('button', {name: 'Save'}).click();
    await expect(title).toContainText('Changed project');
  });
}
