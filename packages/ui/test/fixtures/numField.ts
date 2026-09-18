import type { Locator, Page } from '@playwright/test';

/**
 * Numeric-driving helpers shared by the browser specs — one home for the "find a NumInput by its
 * label, set its value, commit by blurring" idiom that used to be copy-pasted into every spec
 * (a per-spec `numInputByLabel` plus `fill(v); press('Tab')` blocks).
 *
 * A NumInput renders a plain `<input type="number">` with no id; the parent `.row` (NumInput's
 * own) or `.field-row` wrapper contains the `<label>` and the input as siblings, so the stable
 * handle is "the number input inside the label's parent".
 */

export function numInputByLabel(page: Page, labelText: string, scope: Locator = page.locator('body')): Locator {
  return scope.locator('label')
    .filter({ hasText: labelText })
    .locator('..')
    .locator('input[type="number"]');
}

/** Type into an already-resolved field and commit it by blurring (Tab) — the app's commit point. */
export async function fillAndCommit(input: Locator, value: string): Promise<void> {
  await input.fill(value);
  await input.press('Tab');
}

/** Fill a field found by its label and commit — the value may also be a number. */
export async function setNumField(page: Page, label: string, value: string | number, scope?: Locator): Promise<void> {
  await fillAndCommit(numInputByLabel(page, label, scope), String(value));
}

/** Clear a field's entered value back to its calculated default and commit the clear by blurring. */
export async function clearNumField(page: Page, label: string, scope?: Locator): Promise<void> {
  await setNumField(page, label, '', scope);
}