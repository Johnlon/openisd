/**
 * Usage telemetry in the running app: it never blocks boot, and an uncaught error offers the
 * report box whose submission goes out with sendBeacon. The suite's build sends nothing unless a
 * spec opts in (`openisdTelemetryOn`), as these two do.
 */
import {expect, test} from '../fixtures.js';

const ENDPOINT_HOST = 'openisd-stats.john-lonergan-0e9.workers.dev';

test('the app boots and renders with the collector blocked', async ({page}) => {
  await page.addInitScript(() => { Reflect.set(globalThis, 'openisdTelemetryOn', true); });
  await page.route(`https://${ENDPOINT_HOST}/**`, route => route.abort());
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();
});

test('an uncaught error offers the report box and the report is sent with sendBeacon', async ({page}) => {
  await page.addInitScript(() => {
    Reflect.set(globalThis, 'openisdTelemetryOn', true);
    const sent: string[] = [];
    Reflect.set(globalThis, 'sentBeacons', sent);
    navigator.sendBeacon = (_url: string | URL, body?: BodyInit | null): boolean => {
      if (body instanceof Blob) void body.text().then(text => sent.push(text));
      return true;
    };
  });
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent('error', {error: new Error('telemetry spec boom'), message: 'telemetry spec boom'}));
  });
  await expect(page.getByTestId('crash-screen')).toBeVisible();
  await page.getByTestId('crash-note').fill('I pressed the button');
  await page.getByTestId('crash-contact').fill('me@example.org');
  await page.getByTestId('crash-send').click();
  await expect(page.getByTestId('crash-screen')).toBeHidden();

  const sentBodies = (): Promise<string[]> => page.evaluate(() => {
    const sent: unknown = Reflect.get(globalThis, 'sentBeacons');
    return Array.isArray(sent) ? sent.map(String) : [];
  });
  await expect.poll(async () => (await sentBodies()).join('\n')).toContain('"name":"report"');
  const all = (await sentBodies()).join('\n');
  expect(all).toContain('"name":"error"');
  expect(all).toContain('telemetry spec boom');
  expect(all).toContain('I pressed the button');
  expect(all).toContain('me@example.org');
});
