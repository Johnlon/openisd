/**
 * Every clickable unit label (a button titled "Click to change units") shows the dotted underline
 * that tells the user it has a tooltip and can be clicked, on every project screen of both skins
 * (T373, QD4). The underline comes from the unit label control itself, whatever class a screen gives it.
 */
import {expect, test} from '../fixtures.js';
import type {Locator} from '@playwright/test';
import {SCREENS} from '../visual/screens.js';

async function waitForLabelsWhereExpected(screenName: string, labels: Locator): Promise<void> {
  if (!/^(tab-box|tab-advanced|tab-enclosure|box-)/.test(screenName)) return;
  await expect.poll(() => labels.evaluateAll(els => els.filter(el => el.checkVisibility()).length)).toBeGreaterThan(0);
}

const project_screens = SCREENS.filter(s => /^(tab-|box-)/.test(s.name));

for (const screen of project_screens) {
  test(`unit labels are dotted-underlined ${screen.skin.name} ${screen.name}`, async ({page}) => {
    await screen.open(page);
    const labels = page.locator('[role="button"][title^="Click to change units"]');
    // Screens that always show unit labels must show some; the rest are checked for whatever they show.
    await waitForLabelsWhereExpected(screen.name, labels);
    const styles = await labels.evaluateAll(els => els.filter(el => el.checkVisibility()).map(el => {
      const cs = getComputedStyle(el);
      return {text: el.textContent ?? '', line: cs.textDecorationLine, style: cs.textDecorationStyle, cursor: cs.cursor};
    }));
    const bad = styles.filter(s => !(s.line.includes('underline') && s.style === 'dotted' && s.cursor === 'pointer'));
    expect(bad, `labels without a dotted underline and pointer on ${screen.skin.name} ${screen.name}`).toEqual([]);
  });
}
