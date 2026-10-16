import {expect, test} from '../fixtures.js';
import {SCREENS} from './screens.js';

/**
 * One screenshot per screen and skin, compared with its committed baseline. A difference fails the
 * test, named by the screen; the post-land run publishes the before/after pictures.
 */
for (const screen of SCREENS) {
  test(`visual ${screen.skin.name} ${screen.name}`, async ({page}) => {
    await screen.open(page);
    // The build stamp differs on every build: it is masked, nothing else is.
    await expect(page).toHaveScreenshot(`${screen.skin.name}-${screen.name}.png`, {mask: [page.getByTestId('app-version')]});
  });
}
