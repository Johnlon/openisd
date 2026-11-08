import {COMPLETE_DRIVER_PROJECT_OWPR, openAProject, setFocusedBoxType, test} from '../fixtures.js';

test('scratch: desktop What-if gap at 1366x768', async ({page}) => {
  await page.setViewportSize({width: 1366, height: 768});
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await setFocusedBoxType(page, 'vented');
  await page.locator('.edit-btn', {hasText: 'What-if'}).first().click();
  await page.locator('.what-if-panel').waitFor();
  const rows = await page.locator('.what-if-panel .ui-field').evaluateAll(fs => fs.map(f => {
    const l = f.querySelector('label'); const i = f.querySelector('input');
    if (l === null || i === null) return '';
    const r = document.createRange(); r.selectNodeContents(l);
    return `${(l.textContent ?? '').trim()}: text ends ${Math.round(r.getBoundingClientRect().right)}, box at ${Math.round(i.getBoundingClientRect().x)}`;
  }));
  console.log('GAP ' + rows.join(' | '));
  await page.screenshot({path: '/tmp/claude-1000/-home-john-work-winisd-openisd/2904f0f7-95f6-4bea-acad-8acb8bde5d9a/scratchpad/whatif-main-1366.png'});
});
