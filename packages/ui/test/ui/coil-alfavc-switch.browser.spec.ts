/**
 * "Coil coefficient from project" (T917, John QO953.c16): a person heats the coil (Driver tab, Voice coil temp rise) and
 * gives the driver its own AlfaVC in the Driver Editor. The yellow switch under "Enable WinISD bugs" then becomes
 * editable, a ≠W cue by the project's AlfaVC on the Driver tab says what WinISD does, and ticking the switch takes the
 * cue away. Before either step the switch is greyed: with a cold coil or a driver AlfaVC of 0 it changes no sum.
 */
import {driverEditorField, expect, openAProject, openDriverEditor, setFocusedBoxType, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';

test('a hot coil and a driver AlfaVC of its own make the switch editable and show the cue until it is ticked', async ({appPage: page}) => {
  await page.goto('/');
  await openAProject(page);
  await setFocusedBoxType(page, 'sealed');

  const sw = page.locator('label[data-field-key="winisdProjectAlfaVC"]');
  const alfaRow = page.locator('.driver-advanced-fields .field-row').filter({hasText: 'AlfaVC'});
  await page.locator('.project-nav li', {hasText: /^Advanced$/}).click();
  await expect(sw.locator('input')).toBeDisabled();

  // The coil runs 100 K hot.
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  const rise = page.locator('.driver-advanced-fields .field-row').filter({hasText: 'Voice coil temp rise'}).locator('input').first();
  await fillAndBlur(rise, '100');
  await expect(alfaRow.locator('.winisd-deviation-cue')).toHaveCount(0);

  // The driver states its own AlfaVC, 4.2 per 1000 K (an aluminium coil).
  await openDriverEditor(page);
  await page.getByRole('button', {name: 'Advanced', exact: true}).click();
  await fillAndBlur(driverEditorField(page, 'AlfaVC').locator('input').first(), '4.2');
  await page.locator('.de-footer button.pri', {hasText: 'OK'}).click();

  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await expect(alfaRow.locator('.winisd-deviation-cue')).toBeVisible();

  await page.locator('.project-nav li', {hasText: /^Advanced$/}).click();
  await expect(sw.locator('input')).toBeEnabled();
  await sw.locator('input').setChecked(true);
  await expect(sw).toHaveClass(/error-switch-on/);

  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await expect(alfaRow.locator('.winisd-deviation-cue')).toHaveCount(0);
});
