import {expect, test} from '../fixtures.js';

/**
 * The desktop skin's toolbar (BUG_20261108_desktop-skin-clips-toolbar-at-phone-width): at 374 px
 * (a phone that chose "Switch to desktop view", or a narrow window) and at 1024 px every toolbar
 * button sits wholly inside the window and the page does not scroll sideways.
 */
for (const [width, height] of [[374, 705], [1024, 768]] as const) {
  test(`desktop skin at ${width}x${height}: every toolbar button is inside the window`, async ({page}) => {
    await page.addInitScript(() => {
      localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true, skinOverride: 'original'}}));
    });
    await page.setViewportSize({width, height});
    await page.goto('/');
    await page.locator('.original-root .toolbar').waitFor();
    const cut = await page.locator('.original-root .toolbar').evaluate(bar => {
      const view = bar.ownerDocument.defaultView;
      const frame = bar.getBoundingClientRect();
      return [...bar.querySelectorAll('button, .tb-btn, select, input')]
        .filter(el => el.checkVisibility() && el.getBoundingClientRect().width > 0)
        .map(el => ({name: el.getAttribute('aria-label') ?? el.getAttribute('title') ?? el.className, box: el.getBoundingClientRect()}))
        .filter(({box}) => box.left < -0.5 || box.right > (view?.innerWidth ?? 0) + 0.5 || box.right > frame.right + 0.5 || box.bottom > frame.bottom + 0.5)
        .map(({name, box}) => `${name.slice(0, 40)} ${Math.round(box.left)}..${Math.round(box.right)}`);
    });
    expect(cut).toEqual([]);
    expect(await page.locator('.original-root .toolbar').evaluate(bar => bar.scrollWidth <= bar.clientWidth + 1), 'toolbar does not scroll sideways').toBe(true);
  });
}
