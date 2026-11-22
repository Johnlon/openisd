import {expect, openAProject, test} from '../fixtures.js';

const APP_STATE = '/src/logic/appState.ts';

test('probe: Frc fill round-trip', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('bandpass6');

  const frc = page.locator('.field', { hasText: 'Tuning freq (Frc)' }).locator('input');
  await frc.click();
  await frc.fill('2222');
  const rawRightAfterFill = await frc.inputValue();
  const modelAfterFill = await page.evaluate(async (modPath) =>
    (await import(/* @vite-ignore */ modPath)).requireFocusedProject().box.bandpass6.chambers.rear.tuning_goal_hz.value, APP_STATE);
  process.stdout.write('PROBE-AFTER-FILL ' + JSON.stringify({ rawRightAfterFill, modelAfterFill }) + '\n');

  await frc.blur();
  let reached = '';
  try {
    await expect(frc).toHaveValue(/^2222(\.0+)?$/, { timeout: 5000 });
    reached = await frc.inputValue();
  } catch (e) {
    reached = 'NEVER:' + ((e as Error).message.match(/Received string:  "([^"]*)"/) || [])[1] || '?';
  }
  const cls = await frc.evaluate((el) => (el as HTMLInputElement).className);
  const modelAfter = await page.evaluate(async (modPath) =>
    (await import(/* @vite-ignore */ modPath)).requireFocusedProject().box.bandpass6.chambers.rear.tuning_goal_hz.value, APP_STATE);
  const refs = await page.evaluate(async (modPath) => {
    const S = await import(/* @vite-ignore */ modPath);
    const viaFocus = S.focusedProject()?.box.bandpass6.chambers.rear.tuning_goal_hz.value ?? 'NULL-PROJ';
    const viaOpen = S.openProjects()[0]?.box.bandpass6.chambers.rear.tuning_goal_hz.value ?? 'NO-OPEN';
    const boxType = S.focusedProject()?.box.boxType.get();
    return { viaFocus, viaOpen, boxType };
  }, APP_STATE);
  process.stdout.write('PROBE-BLUR-SETTLE ' + JSON.stringify({ reached, cls, modelAfter, refs }) + '\n');
});