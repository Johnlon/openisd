/**
 * In-app feedback, used as a person does on both skins: Info menu (desktop) or hamburger menu (phone) ->
 * Send feedback -> one tap on a face sends it. Offline the answer is kept ("Saved, will send when online")
 * and goes when the network is back ("Thanks, sent"). The telemetry collector is a scripted stand-in.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

const COLLECTOR = 'https://openisd-stats.john-lonergan-0e9.workers.dev/e';
const DESKTOP = {width: 1280, height: 720};
const PHONE = {width: 374, height: 705};

/** The stand-in collector: keeps every body it is sent and answers like the real one (204 with CORS). */
async function standInCollector(page: Page): Promise<string[]> {
  const bodies: string[] = [];
  await page.addInitScript(() => { Reflect.set(globalThis, 'openisdTelemetryOn', true); });
  await page.route(COLLECTOR, async route => {
    const request = route.request();
    const origin = request.headers()['origin'] ?? '*';
    if (request.method() === 'POST') bodies.push(request.postData() ?? '');
    await route.fulfill({status: 204, headers: {'access-control-allow-origin': origin}});
  });
  return bodies;
}

const feedbackBodies = (bodies: readonly string[]): string[] => bodies.filter(b => b.includes('"name":"feedback"'));

async function openFromDesktopInfoMenu(page: Page): Promise<void> {
  await page.getByTitle('Info', {exact: true}).first().click();
  await expect(page.getByText('Announcements', {exact: true}).first()).toBeVisible();
  await page.getByTestId('menu-send-feedback').click();
}

async function expectDialogFits(page: Page): Promise<void> {
  const view = page.viewportSize();
  if (view === null) throw new Error('no viewport');
  // Measure the dialog at rest, not while it slides in.
  await page.getByTestId('feedback-dialog').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  const box = await page.getByTestId('feedback-dialog').boundingBox();
  if (box === null) throw new Error('dialog not drawn');
  expect(box.x).toBeGreaterThanOrEqual(-0.5);
  expect(box.y).toBeGreaterThanOrEqual(-0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 0.5);
  const problems = await page.getByTestId('feedback-dialog').evaluate((root: HTMLElement) => {
    const r = root.getBoundingClientRect();
    const sideways = root.scrollWidth > root.clientWidth + 1;
    const cut = [...root.querySelectorAll<HTMLElement>('button, textarea, p, label, h2')]
      .filter(e => e.scrollWidth > e.clientWidth + 1)
      .map(e => (e.textContent ?? e.tagName).trim().slice(0, 30));
    const outside = [...root.querySelectorAll<HTMLElement>('button, textarea')]
      .filter(e => { const b = e.getBoundingClientRect(); return b.right > r.right + 0.5 || b.left < r.left - 0.5; })
      .map(e => (e.textContent ?? e.tagName).trim().slice(0, 30));
    return {sideways, cut, outside, pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth};
  });
  expect(problems).toEqual({sideways: false, cut: [], outside: [], pageScrolls: false});
}

test.describe('desktop skin', () => {
  test.use({viewport: DESKTOP});

  test('Info > Send feedback: one tap sends; a comment follows; offline is saved, then sent when online', async ({page, context}) => {
    const bodies = await standInCollector(page);
    await page.goto('/');
    await expect(page.locator('.original-root')).toBeVisible();

    await openFromDesktopInfoMenu(page);
    await expect(page.getByTestId('feedback-heading')).toHaveText('Do you like OpenISD?');
    await expectDialogFits(page);

    // One tap, online: sent at once, no other field needed.
    await page.getByTestId('feedback-face-yes').click();
    await expect(page.getByTestId('feedback-status')).toHaveText('Thanks, sent');
    await expect(page.getByTestId('feedback-heading')).toHaveText('Thanks!');
    await expect.poll(() => feedbackBodies(bodies).length).toBe(1);
    expect(feedbackBodies(bodies)[0]).toContain('"face":"yes"');

    // The comment is a follow-up to the same answer.
    await page.getByTestId('feedback-comment').fill('Love the charts');
    await expectDialogFits(page);
    await page.getByTestId('feedback-send-comment').click();
    await expect(page.getByTestId('feedback-status')).toHaveText('Thanks, sent');
    await expect(page.getByTestId('feedback-dialog').getByRole('status')).toHaveCount(1); // one confirmation, not one per send (T881)
    await expect.poll(() => feedbackBodies(bodies).length).toBe(2);
    expect(feedbackBodies(bodies)[1]).toContain('"comment":"Love the charts"');
    await page.getByTestId('feedback-done').click();
    await expect(page.getByTestId('feedback-dialog')).toBeHidden();

    // Offline: kept on the device, then sent when the network is back.
    await context.setOffline(true);
    await openFromDesktopInfoMenu(page);
    await page.getByTestId('feedback-face-ok').click();
    await expect(page.getByTestId('feedback-status')).toHaveText('Saved, will send when online');
    expect(feedbackBodies(bodies)).toHaveLength(2);
    await context.setOffline(false);
    await expect(page.getByTestId('feedback-status')).toHaveText('Thanks, sent');
    await expect.poll(() => feedbackBodies(bodies).length).toBe(3);
    expect(feedbackBodies(bodies)[2]).toContain('"face":"ok"');
  });

  test('Not now, Escape and a tap outside each close it and send nothing', async ({page}) => {
    const bodies = await standInCollector(page);
    await page.goto('/');
    await expect(page.locator('.original-root')).toBeVisible();
    await openFromDesktopInfoMenu(page);
    await page.getByTestId('feedback-not-now').click();
    await expect(page.getByTestId('feedback-dialog')).toBeHidden();
    await openFromDesktopInfoMenu(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('feedback-dialog')).toBeHidden();
    await openFromDesktopInfoMenu(page);
    await page.getByTestId('feedback-backdrop').click({position: {x: 5, y: 5}});
    await expect(page.getByTestId('feedback-dialog')).toBeHidden();
    expect(feedbackBodies(bodies)).toHaveLength(0);
  });

  test('after a save the prompt offers itself once, and a Not now keeps it quiet on the next save', async ({page}) => {
    await standInCollector(page);
    await page.clock.install();
    await page.goto('/');
    await openAProject(page);
    await page.getByRole('button', {name: 'Save', exact: true}).first().click();
    await page.clock.runFor(2500);
    await expect(page.getByTestId('feedback-dialog')).toBeVisible();
    await expectDialogFits(page);
    await page.getByTestId('feedback-not-now').click();
    await expect(page.getByTestId('feedback-dialog')).toBeHidden();
    await page.getByRole('button', {name: 'Save', exact: true}).first().click();
    await page.clock.runFor(3000);
    await expect(page.getByTestId('feedback-dialog')).toBeHidden();
  });
});

test.describe('phone skin', () => {
  test.use({viewport: PHONE});

  test('Menu > Send feedback: big faces, one tap sends, offline is saved then sent', async ({page, context}) => {
    const bodies = await standInCollector(page);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);

    await tapMobileMenuItem(page, 'Send feedback');
    await expectDialogFits(page);
    const face = await page.getByTestId('feedback-face-yes').boundingBox();
    expect(face?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(face?.width ?? 0).toBeGreaterThanOrEqual(44);

    await context.setOffline(true);
    await page.getByTestId('feedback-face-not_really').click();
    await expect(page.getByTestId('feedback-status')).toHaveText('Saved, will send when online');
    await page.getByTestId('feedback-comment').fill('The phone keyboard hides the chart');
    await expectDialogFits(page);
    await page.getByTestId('feedback-send-comment').click();
    await expect(page.getByTestId('feedback-status')).toHaveText('Saved, will send when online');
    await expect(page.getByTestId('feedback-dialog').getByRole('status')).toHaveCount(1); // one confirmation, not one per send (T881)
    expect(feedbackBodies(bodies)).toHaveLength(0);

    await context.setOffline(false);
    await expect(page.getByTestId('feedback-status')).toHaveText('Thanks, sent');
    await expect.poll(() => feedbackBodies(bodies).length).toBeGreaterThanOrEqual(1);
    expect(feedbackBodies(bodies).join('')).toContain('"face":"not_really"');
    expect(feedbackBodies(bodies).join('')).toContain('The phone keyboard hides the chart');
  });

  test('after a save the prompt offers itself', async ({page}) => {
    await standInCollector(page);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await tapMobileMenuItem(page, /^Save$/);
    await expect(page.getByTestId('feedback-dialog')).toBeVisible();
    await expectDialogFits(page);
  });
});
