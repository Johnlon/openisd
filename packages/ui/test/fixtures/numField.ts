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

/**
 * Type into an already-resolved field like a real user — select-all, delete, then keystroke-by-
 * keystroke. Unlike `fill()`, keystrokes fire keydown, which is what NumInput's raw-echo
 * (`typing`) listens for: a typing user sees the raw string ("8.0") until blur, while `fill()`
 * is treated as a spinner/step and reformats to the field's dp ("8.00") immediately. Does NOT
 * commit — the caller may assert the raw echoed value, then `press('Tab')`/`blur()` to commit.
 */
export async function typeInto(input: Locator, value: string): Promise<void> {
  await input.click();
  await input.press('Control+a');
  await input.press('Delete');
  await input.pressSequentially(value);
}

/**
 * A tiny intent-named wrapper over the "fill, then commit by blur" gesture for fields the specs
 * reach by CSS selector (an id like `#og-pr-madd`) rather than by label. Turns
 * `await page.locator('#og-pr-madd').fill('0'); await page.locator('#og-pr-madd').blur();`
 * into one call that says what it is doing: set the field to 0.
 */
export class PageOps {
  readonly #page: Page;
  constructor(page: Page) {
    this.#page = page;
  }

  /** Type a value into the field at `selector` and commit it by blurring. */
  async setNum(selector: string, value: string | number): Promise<void> {
    await this.#page.locator(selector).fill(String(value));
    await this.#page.locator(selector).blur();
  }
}

/** Fill an already-resolved field and commit by blurring — the var-holding-a-Locator form of the
 *  same gesture `PageOps.setNum` wraps. */
export async function fillAndBlur(input: Locator, value: string): Promise<void> {
  await input.fill(value);
  await input.blur();
}