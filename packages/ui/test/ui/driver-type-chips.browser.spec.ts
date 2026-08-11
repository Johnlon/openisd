import { test, expect } from '../fixtures.js';
import { Chip } from '../../src/driverType.js';

// The filter chips are rendered straight from the Chip enum (`DRIVER_TYPES = Chip.ALL`),
// so this spec needs NO driver records — it stays meaningful while the bundler ships an
// empty catalogue, which is exactly when driver-search.browser.spec.ts cannot run.
//
// What it protects: the picker templates bind `t.value`/`t.label`, and `toggleType()` is
// keyed by `t.value`. A chip whose id and label came apart would render blank buttons or
// a filter that never matches — neither is visible to a unit test.

// Both picker skins draw the chips in `.type-row` (DriverBrowserMd.vue, DriverBrowserWinisd.vue).
// `.type-row` also holds non-chip siblings — the conditional "✕ clear" button
// (`.type-clear`), the "?" help toggle (`.help-btn`), and the Favorites filter
// (`.fav-filter`, which Modern draws with chip styling in a second `.type-row`). The chips
// proper are the `.type-chip` buttons minus those: this list must be exactly the Chip enum,
// so anything that is a filter rather than an enum member has to be excluded by class.
const CHIPS = '.type-row .type-chip:not(.type-clear):not(.fav-filter)';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Browse \/ Select/ }).click();
});

test('every Chip enum member renders as a labelled filter button', async ({ page }) => {
  for (const chip of Chip.ALL) {
    const btn = page.getByRole('button', { name: chip.label, exact: true });
    await expect(btn, `chip "${chip.value}" did not render with label "${chip.label}"`)
      .toBeVisible();
  }
});

test('clicking a chip toggles include -> off, keyed by its value', async ({ page }) => {
  const chip = Chip.Sub;
  const btn = page.getByRole('button', { name: chip.label, exact: true }).first();

  await btn.click();
  await expect(btn, 'first click did not mark the chip included').toHaveClass(/include/);
  await btn.click();
  await expect(btn, 'second click did not clear the chip').not.toHaveClass(/include/);
});

test('the chip bar renders exactly the enum, in enum order', async ({ page }) => {
  const chips = page.locator(CHIPS);
  await expect(chips.first(), 'no chips rendered in the picker').toBeVisible();
  const labels = await chips.allTextContents();
  expect(labels.map(s => s.trim())).toEqual(Chip.ALL.map(c => c.label));
});

// A chip's state must be READABLE — the class alone proves nothing a user can see.
// The tests above assert `toHaveClass(/include/)`, which a chip that renders identically
// in both states passes; only the RENDERED style shows whether the filter is on.
//
// Every skin is exercised, because the two shells use different pickers
// (`original`/`classic` → DriverBrowserWinisd.vue, `modern` → DriverBrowserMd.vue) with
// separate stylesheets. store.ts picks `modern` on port 4100, which is this suite's port,
// so without seeding the skin these specs never visit DriverBrowserWinisd.vue at all.
for (const skin of ['original', 'classic', 'modern'] as const) {
  test(`an included chip is visibly distinct from an idle one — skin ${skin}`, async ({ page }) => {
    await page.addInitScript((s) => {
      localStorage.setItem('openisd.state', JSON.stringify({ ui: { skin: s } }));
    }, skin);
    await page.reload();

    // Each shell opens the picker from its own control; all of them say "library".
    await page.locator('[title*="librar" i]').first().click();

    const btn = page.locator(CHIPS).first();
    await expect(btn, `no chips rendered in the ${skin} picker`).toBeVisible();

    // The pointer must not rest on the chip: :hover would supply a colour change of its
    // own and mask a state style that never applies.
    // Colour only. Every picker states the included chip in colour — a fill, a text colour
    // and a border — and weight is deliberately excluded: a bolder label is not a filter
    // indicator, and counting it would let a chip pass while every colour it declares is
    // overridden away.
    const paint = async () => {
      await page.mouse.move(0, 0);
      return btn.evaluate((el) => {
        const cs = getComputedStyle(el);
        return `bg=${cs.backgroundColor} fg=${cs.color} border=${cs.borderColor}`;
      });
    };

    const idle = await paint();
    await btn.click();
    await expect(btn, 'click did not mark the chip included').toHaveClass(/include/);
    const included = await paint();

    expect(included, `an included chip is the same colour as an idle one in the ${skin} skin — `
      + `its filter state is invisible (idle: ${idle})`).not.toBe(idle);
  });

  // The state must be readable AT THE MOMENT OF THE CLICK, with the pointer still resting
  // on the chip — that is when the user is looking at it. A `:hover` rule that outranks the
  // state rule delays the colour change until the pointer leaves, which reads as a control
  // that did not respond. The test above moves the pointer away on purpose to isolate the
  // cascade, so it cannot see this; that is why the two are separate tests.
  test(`an included chip shows its state while still hovered — skin ${skin}`, async ({ page }) => {
    await page.addInitScript((s) => {
      localStorage.setItem('openisd.state', JSON.stringify({ ui: { skin: s } }));
    }, skin);
    await page.reload();
    await page.locator('[title*="librar" i]').first().click();

    const btn = page.locator(CHIPS).first();
    await expect(btn, `no chips rendered in the ${skin} picker`).toBeVisible();

    // Never move the mouse off between the readings: both are taken hovered.
    //
    // Compared PROPERTY BY PROPERTY, not as one joined string. A `:hover` rule usually
    // declares only `background`, so a joined comparison passes on a changed border/colour
    // while the fill stays the hover grey — which is exactly the defect this test exists
    // for, and exactly what a joined comparison let through once already.
    const paintHovered = () => btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, fg: cs.color, border: cs.borderColor };
    });

    await btn.hover();
    const idleHovered = await paintHovered();
    await btn.click();
    await expect(btn, 'click did not mark the chip included').toHaveClass(/include/);
    const includedHovered = await paintHovered();

    for (const prop of ['bg', 'fg', 'border'] as const) {
      expect(includedHovered[prop], `in the ${skin} skin an included chip's ${prop} is still the `
        + `hovered-idle value (${idleHovered[prop]}) while the pointer rests on it — the state `
        + 'only appears once the pointer leaves').not.toBe(idleHovered[prop]);
    }
  });

  // The Z impedance buttons are chips too, drawn by the same picker and beaten by the same
  // blanket rule. They were only ever checked by eye, which is how the type chips went wrong.
  test(`an active Z filter shows its state while still hovered — skin ${skin}`, async ({ page }) => {
    await page.addInitScript((s) => {
      localStorage.setItem('openisd.state', JSON.stringify({ ui: { skin: s } }));
    }, skin);
    await page.reload();
    await page.locator('[title*="librar" i]').first().click();

    const z = page.locator('.param-row .zchip').first();
    await expect(z, `no Z filter buttons rendered in the ${skin} picker`).toBeVisible();

    const paint = () => z.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, fg: cs.color, border: cs.borderColor };
    });

    await z.hover();
    const idleHovered = await paint();
    await z.click();
    await expect(z, 'click did not mark the Z filter active').toHaveClass(/active/);
    const activeHovered = await paint();

    for (const prop of ['bg', 'fg', 'border'] as const) {
      expect(activeHovered[prop], `in the ${skin} skin an active Z filter's ${prop} is still the `
        + `hovered-idle value (${idleHovered[prop]}) while the pointer rests on it`)
        .not.toBe(idleHovered[prop]);
    }
  });
}
