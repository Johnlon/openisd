/**
 * Error switches: controls that make OpenISD reproduce a known WinISD calculation error. They
 * carry the warning class ticked or not, sit under one "WinISD errors" heading, and are inactive
 * where the open box has nothing for them to act on. Design-choice switches do not carry it.
 */
import {expect, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.goto('/');
  await openAProject(page);
});

async function boxType(page: Page, value: string): Promise<void> {
  await page.locator('.project-nav li', {hasText: 'Box'}).click();
  await page.locator('#og-box-type').selectOption(value);
  await page.locator('li', {hasText: /^Advanced$/}).click();
}

const ERROR_KEYS = ['winisdDriverModel', 'winisdVaModel', 'winisdAbcIntraPortVelocity'];
const DESIGN_KEYS = ['useWinisdAirModel', 'winisdWrapPhase', 'winisdDriverCountModel', 'winisdFlatModel'];

test('the error switches carry the warning class, unticked and ticked', async ({page}) => {
  await boxType(page, 'abc');
  for (const key of ERROR_KEYS) {
    const label = page.locator(`label[data-field-key="${key}"]`);
    const box = label.locator('input[type=checkbox]');
    for (const want of [false, true]) {
      await box.setChecked(want);
      await expect(label, `${key} ticked=${want}`).toHaveClass(/error-switch-marked/);
      await expect(label.locator('.error-switch-mark')).toBeVisible();
      await expect(label).toHaveClass(want ? /error-switch-on/ : /^(?!.*error-switch-on)/);
    }
  }
});

test('the design-choice switches do not carry it', async ({page}) => {
  await page.locator('li', {hasText: /^Advanced$/}).click();
  for (const key of [...DESIGN_KEYS, 'simVcInductance', 'rgAtDriverSide']) {
    await expect(page.locator(`label[data-field-key="${key}"]`), key).not.toHaveClass(/error-switch-marked/);
  }
});

test('every error switch tooltip starts "Reproduces a WinISD error."', async ({page}) => {
  await page.locator('li', {hasText: /^Advanced$/}).click();
  for (const key of ERROR_KEYS) {
    await expect(page.locator(`label[data-field-key="${key}"]`), key).toHaveAttribute('title', /^Reproduces a WinISD error\.\n/);
  }
});

test('the error switches sit under one "WinISD errors" heading with its own tooltip', async ({page}) => {
  await page.locator('li', {hasText: /^Advanced$/}).click();
  const group = page.locator('.error-switch-group');
  await expect(group).toHaveCount(1);
  await expect(group.locator('.error-switch-group-head')).toHaveText('WinISD errors');
  await expect(group).toHaveAttribute('title', /^WinISD errors: /);
  for (const key of ERROR_KEYS) await expect(group.locator(`label[data-field-key="${key}"]`)).toHaveCount(1);
  for (const key of DESIGN_KEYS) await expect(group.locator(`label[data-field-key="${key}"]`)).toHaveCount(0);
});

test('the ABC velocity switch is editable on an ABC box only', async ({page}) => {
  const box = page.locator('label[data-field-key="winisdAbcIntraPortVelocity"] input');
  await boxType(page, 'vented');
  await expect(box).toBeDisabled();
  await expect(page.locator('label[data-field-key="winisdAbcIntraPortVelocity"]')).toHaveClass(/error-switch-na/);
  await boxType(page, 'abc');
  await expect(box).toBeEnabled();
  await expect(page.locator('label[data-field-key="winisdAbcIntraPortVelocity"]')).not.toHaveClass(/error-switch-na/);
});

test('the loss model drop-down carries it only on a passive radiator with the WinISD lossy model', async ({page}) => {
  const frame = page.locator('.sim-options-box .field', {has: page.locator('select#adv-lossmode')});
  await boxType(page, 'sealed');
  await expect(frame).not.toHaveClass(/error-switch-marked/);
  await boxType(page, 'box-passive-radiator');
  await page.locator('select#adv-lossmode').selectOption('winisd-lossy');
  await expect(frame).toHaveClass(/error-switch-marked/);
  await expect(frame).toHaveAttribute('title', /^Reproduces a WinISD error\.\n/);
  await page.locator('select#adv-lossmode').selectOption('lossless');
  await expect(frame).not.toHaveClass(/error-switch-marked/);
  await page.locator('select#adv-lossmode').selectOption('conventional-lossy');
  await expect(frame).not.toHaveClass(/error-switch-marked/);
});

test('the error group fits inside the Compatibility panel', async ({page}) => {
  await boxType(page, 'abc');
  const panel = page.locator('.sim-options-box', {hasText: 'WinISD Compatibility'});
  const panelBox = (await panel.boundingBox())!;
  const rights = await panel.locator('.error-switch-group, .error-switch-group *').evaluateAll(
    els => els.map(e => e.getBoundingClientRect().right));
  expect(Math.max(...rights)).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
});
