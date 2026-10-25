import {expect, openAProject, test} from '../fixtures.js';

test.describe.serial('App reset isolation', () => {
  test('opens a project and a dialog, sets a route stub, and narrows the window to the mobile skin', async ({ appPage }) => {
    await openAProject(appPage);
    await expect(appPage.locator('.project-nav')).toBeVisible();

    await appPage.locator('.tb-btn[title^="Options"]').click();
    await expect(appPage.locator('.options-modal, .opt-modal')).toBeVisible();

    await appPage.route('**/build-info.json', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ customStub: true }) }),
    );
    const stubbed = await appPage.evaluate(async () => {
      const res = await fetch('/build-info.json');
      const body: unknown = await res.json();
      return body;
    });
    expect(stubbed).toEqual({ customStub: true });

    await appPage.setViewportSize({ width: 375, height: 667 });
    await expect(appPage.locator('.mobile-root')).toBeVisible();
  });

  test('the project, dialog, route stub and window size from test 1 are gone', async ({ appPage }) => {
    await expect(appPage.locator('.original-root .no-project-tabmsg')).toBeVisible();
    await expect(appPage.locator('.options-modal, .opt-modal, .modal:visible, dialog[open]')).toHaveCount(0);

    const unstubbed = await appPage.evaluate(async () => {
      const res = await fetch('/build-info.json');
      const body: unknown = await res.json();
      return body;
    });
    expect(unstubbed).not.toEqual({ customStub: true });
    expect(unstubbed).toHaveProperty('version');

    expect(appPage.viewportSize()).toEqual({ width: 1280, height: 720 });
    await expect(appPage.locator('.original-root')).toBeVisible();
    await expect(appPage.locator('.mobile-root')).toHaveCount(0);
  });
});

const handledDialogs: string[] = [];

test.describe.serial('App reset isolation: what a test adds to the page itself', () => {
  test('adds an init script, a dialog handler, a cookie, a header and a colour scheme', async ({ appPage }) => {
    await appPage.addInitScript(() => { localStorage.clear(); Reflect.set(window, '__poison', 1); });
    await appPage.context().addCookies([{ name: 'poison', value: '1', url: 'http://localhost:4100' }]);
    await appPage.evaluate(() => { document.cookie = 'docpoison=1'; });
    await appPage.setExtraHTTPHeaders({ 'x-poison': '1' });
    await appPage.emulateMedia({ colorScheme: 'dark' });
    appPage.on('dialog', d => { handledDialogs.push(d.message()); void d.dismiss(); });
    await appPage.evaluate(() => { alert('first'); });
    expect(handledDialogs).toEqual(['first']);
  });

  test('the init script, handler, cookies, header and colour scheme are gone', async ({ appPage }) => {
    await appPage.evaluate(() => { alert('second'); });
    expect(handledDialogs).toEqual(['first']);
    expect(await appPage.context().cookies()).toEqual([]);
    expect(await appPage.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
    // A real load: the removed init script would clear storage and set the marker on it.
    await appPage.evaluate(() => { localStorage.setItem('kept', '1'); });
    await appPage.reload();
    expect(await appPage.evaluate((): unknown => Reflect.get(window, '__poison') ?? null)).toBeNull();
    expect(await appPage.evaluate(() => localStorage.getItem('kept'))).toBe('1');
  });
});
