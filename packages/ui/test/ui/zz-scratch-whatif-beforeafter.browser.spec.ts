import {COMPLETE_DRIVER_PROJECT_OWPR, openAProject, setFocusedBoxType, test} from '../fixtures.js';

const OUT = '/home/john/work/winisd/ui-gallery/T712-whatif-gap/raw';
const BUILDS = [{name: 'after2', url: 'http://lap:4712/'}];
const SIZES = [{width: 1366, height: 768}, {width: 1024, height: 768}];

for (const b of BUILDS) for (const s of SIZES) {
  test(`scratch: What-if ${b.name} ${s.width}`, async ({page}) => {
    test.setTimeout(90_000);
    await page.setViewportSize(s);
    await page.goto(b.url);
    await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await setFocusedBoxType(page, 'vented');
    await page.locator('.edit-btn', {hasText: 'What-if'}).first().click();
    await page.locator('.what-if-panel').waitFor();
    await page.getByText(/Project imported/).waitFor({state: 'hidden', timeout: 30_000});
    const box = await page.locator('.what-if-panel').boundingBox();
    const rows = await page.locator('.what-if-panel .ui-field').evaluateAll(fs => fs.map(f => {
      const l = f.querySelector('label'); const i = f.querySelector('input');
      if (l === null || i === null) return '';
      const r = document.createRange(); r.selectNodeContents(l);
      return `${(l.textContent ?? '').trim()}=${Math.round(i.getBoundingClientRect().x - r.getBoundingClientRect().right)}`;
    }));
    console.log(`GAP ${b.name} ${s.width} panel=${JSON.stringify(box)} ${rows.join(' | ')}`);
    await page.screenshot({path: `${OUT}/${b.name}-${s.width}.png`});
  });
}
