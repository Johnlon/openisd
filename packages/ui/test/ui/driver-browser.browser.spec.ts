import {editorTab, expect, openAProject, test} from '../fixtures.js';
import {Chip} from '@openisd/design/filter';
import type {Page} from '@playwright/test';
import {MY_DRIVERS_KEY, myDriversJson, parseMyDriversBucket} from '../fixtures/seedMyDrivers.js';

test.describe('Driver browser', () => {
  test.describe('controls', () => {
    // ui-todo.md "Remove UI Elements" — four controls come out of the driver picker
    // (DriverBrowser.vue).

    const CONTROLS = {
      'Reset Demo Drivers button': '.reset-demo-btn',
      'All Sources dropdown': '.src-btn',
      'Add GitHub URL input': '.addrow',
      'SpeakerBoxLite footer link': 'a[href*="speakerboxlite"]',
    } as const;

    test('the picker no longer carries the four removed controls', async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
      await page.locator('[title*="librar" i]').first().click();
      await expect(page.locator('.dlist'), 'the picker did not open').toBeVisible();

      for (const [label, selector] of Object.entries(CONTROLS)) {
        await expect(page.locator(selector), `the ${label} is still present`).toHaveCount(0);
      }
    });
  });

  test.describe('count', () => {
    // The count above the driver list must always mean ONE thing: how many rows are listed right
    // now. It used to mean the size of the whole pool, because init() writes the pool total into
    // `statusMsg` and the template renders `statusMsg || filteredFiles.length` — so the fallback
    // that carries the real count was unreachable. Worse, choosing a driver clears `statusMsg`,
    // after which the same number silently started tracking the filter instead. One number,
    // two meanings, depending on what the user had done earlier.

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
      await page.locator('[title*="librar" i]').first().click();
      await expect(page.locator('.dlist')).toBeVisible();
    });

    test('the count matches the number of rows listed, and follows a filter', async ({ page }) => {
      const rows = page.locator('.dlist .ditem:not(.my-ditem)');
      const status = page.locator('.statusrow .status');

      // Narrow hard with the search box so the list is small enough to count exactly — the
      // unfiltered list is capped at DISPLAY_LIMIT rows, which is a different number again. The
      // model is one of the suite's six reference devices (fixtures/test-bundle-paths.json).
      await page.locator('.filter').fill('W5-1138SMF');
      await expect(rows).not.toHaveCount(0);

      const listed = await rows.count();
      await expect(status, 'the count does not report the number of rows actually listed')
        .toHaveText(`${listed} drivers`);
    });

    test('the count drops when the Favorites filter narrows the list', async ({ page }) => {
      const rows = page.locator('.dlist .ditem:not(.my-ditem)');
      const status = page.locator('.statusrow .status');

      await rows.first().locator('.fav-btn').click();
      await page.locator('.fav-filter').click();

      await expect(rows).toHaveCount(1);
      await expect(status, 'the count ignored the Favorites filter and still reports the whole pool')
        .toHaveText('1 drivers');
    });
  });

  test.describe('search', () => {
    // A saved driver need not carry a `name` — one saved from a record whose brand and model are
    // known has those instead. Its row must still read as something and still be findable, so the
    // picker derives the label with `driverShort()` (manufacturer and brand collapse when equal)
    // rather than reading `.name` raw, which rendered a blank row that no search could match.

    test('a saved driver with no name is listed and searchable under its derived name', async ({ page }) => {
      await page.addInitScript(([key, json]) => {
        localStorage.setItem(key, json);
      }, [MY_DRIVERS_KEY, myDriversJson([{
        brand: 'Dayton Audio',
        model: 'Epique Series E150HE-44',
        specs: {
          Fs_hz: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas_m3: 0.028, Sd_m2: 0.0132,
          Re_ohm: 5.4, Le_H: 0.5e-3, Xmax_m: 0.0055, Pe_W: 70, Znom_ohm: 8,
        },
      }])] as const);
      await page.goto('/');
      await openAProject(page);
      await page.locator('[title*="librar" i]').first().click();
      await page.locator('input.filter').fill('Epique');

      // Manufacturer and brand are identical, so the label collapses to one "Dayton Audio".
      const driverRow = page.locator('.my-ditem', { hasText: 'Dayton Audio Epique Series E150HE-44' });
      await expect(driverRow).toBeVisible();

      // Choosing it embeds it in the project and closes the picker (docs/design/STATE_MODEL.md rule 1).
      await driverRow.locator('b').click();
      await page.locator('.use-btn').click();

      await expect(page.locator('.modal:not(.de-modal)')).toBeHidden();
      await expect(page.locator('.de-modal')).toBeHidden();
      await page.locator('li', { hasText: 'Driver' }).click();
      await expect(page.locator('.driver-id-row input').nth(1)).toHaveValue(/E150HE-44/);
    });

    test('the delete button removes a saved driver that carries no name', async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
      await page.evaluate(([key, json]) => {
        localStorage.setItem(key, json);
      }, [MY_DRIVERS_KEY, myDriversJson([
        { brand: 'Dayton Audio', model: 'Epique Series E150HE-44', specs: { Fs_hz: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas_m3: 0.028, Sd_m2: 0.0132, Re_ohm: 5.4, Le_H: 0.5e-3, Xmax_m: 0.0055, Pe_W: 70, Znom_ohm: 8 } },
        { brand: 'Dayton Audio', model: 'RS180-8', specs: { Fs_hz: 37, Qts: 0.38, Qes: 0.42, Qms: 4.0, Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6, Le_H: 0.5e-3, Xmax_m: 0.005, Pe_W: 60, Znom_ohm: 8 } },
      ])] as const);
      await page.goto('/');

      await openAProject(page);
      await page.locator('[title*="librar" i]').first().click();
      const row = page.locator('.my-ditem', { hasText: 'Dayton Audio Epique Series E150HE-44' });
      await expect(row).toBeVisible();

      await row.locator('.my-del').click();

      // Deletion is keyed on <brand>/<model>, so the OTHER unnamed driver survives.
      await expect(row).toBeHidden();
      const raw = await page.evaluate((key: string) => localStorage.getItem(key), MY_DRIVERS_KEY);
      const env = parseMyDriversBucket(raw);
      const left = (env.entries ?? []).map(e => e.record?.model?.value ?? '');
      expect(left).toEqual(['RS180-8']);
    });
  });

  test.describe('summary', () => {
    // ui-todo.md "Single click opens a driver summary, not the editor" — the picker
    // (DriverBrowser.vue) previews before it selects.
    //
    // docs/design/STATE_MODEL.md rule 1 governs what a selection DOES, and it changed under this spec: a
    // choice now EMBEDS the driver in the project and closes the picker — no editor in the way.
    // So the summary is a reading step in front of that embed, and Use is the moment of choice.
    // Editing is a separate act afterwards, from the Driver panel.
    //
    // The driver is seeded into My Drivers rather than taken from the bundled catalogue, so the
    // spec does not depend on how many records the bundler currently ships.

    // The row's name is the driver's own Brand + Model (displayNameOf), so the fixture's identity
    // IS "Summary Fixture" — there is no separate stored name field.
    const PICKED = 'Summary Fixture';
    const EDITOR = '.de-modal';
    const SUMMARY = '.preview';

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
      await page.evaluate(([key, json]) => {
        localStorage.setItem(key, json);
      }, [MY_DRIVERS_KEY, myDriversJson([{
        brand: 'Summary', model: 'Fixture',
        specs: {
          Fs_hz: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas_m3: 0.028, Sd_m2: 0.0132,
          Re_ohm: 5.4, Le_H: 0.5e-3, Xmax_m: 0.0055, Pe_W: 70, Znom_ohm: 8,
        },
      }])] as const);
      await page.goto('/');
      await openAProject(page);
    });

    // The project's own driver, read off the Original shell's read-only Brand/Model pair — the
    // same pair `my-drivers.browser.spec.ts` reads. It reflects the PROJECT's embedded driver, so
    // a change here IS a change to the design; there is no separate persisted-state key to read.
    async function currentDriver(page: Page): Promise<string> {
      const row = page.locator('.driver-id-row').first();
      return `${await row.locator('input').nth(0).inputValue()}/${await row.locator('input').nth(1).inputValue()}`;
    }

    async function openSummary(page: Page): Promise<void> {
      await page.locator('[title*="librar" i]').first().click();
      await page.locator('.my-ditem b', { hasText: PICKED }).click();
      await expect(page.locator(SUMMARY), 'the row click did not open the summary').toBeVisible();
    }

    test('a single click opens the summary and does NOT open the editor', async ({ page }) => {
      await openSummary(page);
      await expect(page.locator(EDITOR), 'the row click went straight into the driver editor')
        .toBeHidden();
    });

    test('the summary shows what we know about the driver', async ({ page }) => {
      await openSummary(page);
      // Its identity, and real values off the record — not an empty shell.
      await expect(page.locator('.wb-modal h2')).toContainText(PICKED);
      await expect(page.locator(`${SUMMARY} .spec-row`).first()).toBeVisible();
      await expect(page.locator(SUMMARY)).toContainText('Fs');
      await expect(page.locator(SUMMARY)).toContainText('41');
    });

    test('Cancel returns to the list with nothing changed', async ({ page }) => {
      const before = await currentDriver(page);
      await openSummary(page);

      await page.locator(`${SUMMARY} .cancel-btn`).click();

      await expect(page.locator(SUMMARY), 'Cancel did not close the summary').toBeHidden();
      await expect(page.locator('.dlist'), 'Cancel did not return to the driver list').toBeVisible();
      await expect(page.locator(EDITOR), 'Cancel opened the editor').toBeHidden();
      expect(await currentDriver(page),
        'Cancel changed the design').toBe(before);
    });

    test('Use embeds the driver in the project and closes the picker', async ({ page }) => {
      const before = await currentDriver(page);
      await openSummary(page);

      await page.locator(`${SUMMARY} .use-btn`).click();

      // docs/design/STATE_MODEL.md rule 1: the choice IS the commit. No editor stands in the way, and the
      // picker gets out of the way too. `.wb-modal` is this picker's own class — the broader
      // `.modal:not(.de-modal)` matches two elements in the Original shell.
      await expect(page.locator(EDITOR), 'Use opened the editor — choosing is not editing')
        .toBeHidden();
      await expect(page.locator('.wb-modal'), 'the picker stayed open after the driver was chosen')
        .toBeHidden();
      expect(await currentDriver(page), 'Use did not embed the chosen driver in the project')
        .not.toBe(before);
    });

    // Use is the primary action and Cancel is the way out; they must not look like the same
    // button. This is the third time a rule in this component has been silently beaten by the
    // blanket `.wb-modal button` rule (see bugs/_archive for the chip case), and every previous
    // time the class was applied correctly while the paint was not — so this asserts the PAINT.
    test('Use is styled as the primary action, distinct from Cancel', async ({ page }) => {
      await openSummary(page);

      const paint = (sel: string) => page.locator(sel).evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, fg: cs.color };
      });

      await page.mouse.move(0, 0);
      const use = await paint(`${SUMMARY} .use-btn`);
      const cancel = await paint(`${SUMMARY} .cancel-btn`);

      expect(use.bg, 'Use and Cancel have the same fill — Use is not reading as the primary action')
        .not.toBe(cancel.bg);
    });

    test('the summary carries a favourite toggle, and the star it sets shows on the row', async ({ page }) => {
      await openSummary(page);

      const star = page.locator(`${SUMMARY} .fav-btn`);
      await expect(star, 'the summary has no favourite toggle').toHaveCount(1);
      await expect(star, 'the summary star started out already on').not.toHaveClass(/on/);
      await star.click();
      await expect(star, 'the summary star did not light up').toHaveClass(/on/);

      await page.locator(`${SUMMARY} .cancel-btn`).click();
      await expect(page.locator('.my-ditem').filter({ hasText: PICKED }).locator('.fav-btn'),
        'starring in the summary did not mark the same driver in the list').toHaveClass(/on/);
    });
  });

  test.describe('type chips', () => {
    // The filter chips are rendered straight from the Chip enum (`DRIVER_TYPES = Chip.ALL`),
    // so this spec needs NO driver records — it stays meaningful while the bundler ships an
    // empty catalogue, which is exactly when driver-search.browser.spec.ts cannot run.
    //
    // What it protects: the picker templates bind `t.value`/`t.label`, and `toggleType()` is
    // keyed by `t.value`. A chip whose id and label came apart would render blank buttons or
    // a filter that never matches — neither is visible to a unit test.

    // The picker draws the chips in `.type-row` (DriverBrowser.vue).
    // `.type-row` also holds non-chip siblings — the conditional "✕ clear" button
    // (`.type-clear`), the "?" help toggle (`.help-btn`), and the Favorites filter
    // (`.fav-filter`). The chips
    // proper are the `.type-chip` buttons minus those: this list must be exactly the Chip enum,
    // so anything that is a filter rather than an enum member has to be excluded by class.
    const CHIPS = '.type-row .type-chip:not(.type-clear):not(.fav-filter)';

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
      // "Select Driver" lives on the Driver tab; the rail is persisted UI state defaulting to Box.
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.getByRole('button', { name: 'Select Driver' }).click();
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
      const count = await chips.count();
      console.log('CHIPS COUNT:', count);
      const firstVisible = await chips.first().isVisible();
      console.log('FIRST VISIBLE?', firstVisible);
      await expect(chips.first(), 'no chips rendered in the picker').toBeVisible({ timeout: 1000 });
      const labels = await chips.allTextContents();
      expect(labels.map(s => s.trim())).toEqual(Chip.ALL.map(c => c.label));
    });

    // A chip's state must be READABLE — the class alone proves nothing a user can see.
    // The tests above assert `toHaveClass(/include/)`, which a chip that renders identically
    // in both states passes; only the RENDERED style shows whether the filter is on.
    test('an included chip is visibly distinct from an idle one', async ({ page }) => {
      const btn = page.locator(CHIPS).first();
      await expect(btn, 'no chips rendered in the picker').toBeVisible();

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

      expect(included, 'an included chip is the same colour as an idle one — '
        + `its filter state is invisible (idle: ${idle})`).not.toBe(idle);
    });

    // The state must be readable AT THE MOMENT OF THE CLICK, with the pointer still resting
    // on the chip — that is when the user is looking at it. A `:hover` rule that outranks the
    // state rule delays the colour change until the pointer leaves, which reads as a control
    // that did not respond. The test above moves the pointer away on purpose to isolate the
    // cascade, so it cannot see this; that is why the two are separate tests.
    test('an included chip shows its state while still hovered', async ({ page }) => {
      const btn = page.locator(CHIPS).first();
      await expect(btn, 'no chips rendered in the picker').toBeVisible();

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
        expect(includedHovered[prop], `an included chip's ${prop} is still the `
          + `hovered-idle value (${idleHovered[prop]}) while the pointer rests on it — the state `
          + 'only appears once the pointer leaves').not.toBe(idleHovered[prop]);
      }
    });

    // The Z impedance buttons are chips too, drawn by the same picker and beaten by the same
    // blanket rule. They were only ever checked by eye, which is how the type chips went wrong.
    test('an active Z filter shows its state while still hovered', async ({ page }) => {
      const z = page.locator('.param-row .zchip').first();
      await expect(z, 'no Z filter buttons rendered in the picker').toBeVisible();

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
        expect(activeHovered[prop], `an active Z filter's ${prop} is still the `
          + `hovered-idle value (${idleHovered[prop]}) while the pointer rests on it`)
          .not.toBe(idleHovered[prop]);
      }
    });
  });

  test.describe('scope chip', () => {
    // The scope control — which POOL the WinISD picker lists. All three scopes are on screen at
    // once, exactly one highlighted, and a click anywhere on the control rotates the highlight:
    // Bundled → My Drivers → All → Bundled. It sits beside the Favorites chip and is ORTHOGONAL
    // to it, so the two compose and all six pairings are reachable. That table is what this spec
    // proves, one test per cell.


    const POOL_ROWS = '.dlist .ditem:not(.my-ditem)';
    const MY_ROWS = '.dlist .my-ditem';
    const SCOPE_CHIP = '.fav-row .scope-filter';
    const SCOPE_SEGS = '.fav-row .scope-filter .scope-seg';
    const SCOPE_ACTIVE = '.fav-row .scope-filter .scope-seg.active';
    const FAV_CHIP = '.fav-row .fav-filter';

    // Every scope, in the order the control renders them — which is also the click cycle.
    const SCOPE_LABELS = ['Bundled', 'My Drivers', 'All'];

    // Two saved drivers, so "My Drivers" can be narrowed to one by a star and the difference
    // between "the section is filtered" and "the section is hidden" is visible.
    const MY_DRIVERS = [
      { brand: 'Scope Test', model: 'Alpha', specs: { Fs_hz: 40, Re_ohm: 6.2, Sd_m2: 0.02, Qts: 0.4, Qes: 0.5, Qms: 3 } },
      { brand: 'Scope Test', model: 'Beta', specs: { Fs_hz: 55, Re_ohm: 6.4, Sd_m2: 0.015, Qts: 0.42, Qes: 0.52, Qms: 3.2 } },
    ];

    // Clicks needed to reach each scope from the chip's starting position, `All`. Declaring the
    // distance rather than clicking until the label matches keeps the walk assertion-free — and
    // makes a change to the cycle order fail the cycle test below rather than hang here.
    const CLICKS_TO: Record<string, number> = { All: 0, Bundled: 1, 'My Drivers': 2 };

    async function openPicker(page: Page): Promise<void> {
      await page.addInitScript(([key, json]) => {
        localStorage.setItem(key, json);
      }, [MY_DRIVERS_KEY, myDriversJson(MY_DRIVERS)] as const);
      await page.goto('/');
      await openAProject(page);
      await page.locator('[title*="librar" i]').first().click();
      await expect(page.locator('.dlist')).toBeVisible();
    }

    /** Star exactly one bundled driver and one saved driver, with the picker in its `All` state. */
    async function starOneOfEach(page: Page): Promise<void> {
      await expect(page.locator(MY_ROWS), 'the two saved drivers were not seeded').toHaveCount(2);
      await page.locator(POOL_ROWS).first().locator('.fav-btn').click();
      await page.locator(MY_ROWS).first().locator('.fav-btn').click();
    }

    async function setScope(page: Page, label: string): Promise<void> {
      const active = page.locator(SCOPE_ACTIVE);
      await expect(active, 'the picker did not start on the All scope').toHaveText('All');
      for (let i = 0; i < CLICKS_TO[label]; i++) await page.locator(SCOPE_CHIP).click();
      await expect(active, `clicking ${CLICKS_TO[label]}x did not reach the ${label} scope`)
        .toHaveText(label);
    }

    test('all three scopes are shown at once, and exactly one is highlighted', async ({ page }) => {
      await openPicker(page);
      await expect(page.locator(SCOPE_CHIP), 'no scope control rendered next to the Favorites chip')
        .toHaveCount(1);
      await expect(page.locator(FAV_CHIP), 'the Favorites chip left the row').toHaveCount(1);

      // The whole point of the segmented form: the choices are visible without clicking, in the
      // order clicking will visit them.
      await expect(page.locator(SCOPE_SEGS), 'the control does not show all three scopes at once')
        .toHaveText(SCOPE_LABELS);
      await expect(page.locator(SCOPE_ACTIVE), 'the control does not highlight exactly one scope')
        .toHaveCount(1);
    });

    test('a click rotates the highlight Bundled → My Drivers → All, and the labels never move', async ({ page }) => {
      await openPicker(page);
      const chip = page.locator(SCOPE_CHIP);
      const active = page.locator(SCOPE_ACTIVE);

      await expect(active, 'the control started somewhere other than All').toHaveText('All');

      // One click, one step, through the rendered order and back to the start — and after each,
      // still all three labels in the same order and still exactly one highlighted. A rotate must
      // never turn into a swap of the control's face.
      for (const expected of SCOPE_LABELS) {
        await chip.click();
        await expect(active, `a click did not move the highlight to ${expected}`).toHaveText(expected);
        await expect(page.locator(SCOPE_SEGS), `the labels changed on the way to ${expected}`)
          .toHaveText(SCOPE_LABELS);
        await expect(active, `more than one scope was highlighted at ${expected}`).toHaveCount(1);
      }
    });

    // ── The six combinations. Scope decides which library is a candidate, Favorites decides
    //    which of those rows survive; neither may swallow the other.

    test('Bundled + Favorites off — bundled drivers, and no saved ones', async ({ page }) => {
      await openPicker(page);
      await setScope(page, 'Bundled');
      await expect(page.locator(POOL_ROWS), 'Bundled listed no bundled drivers').not.toHaveCount(0);
      await expect(page.locator(MY_ROWS), 'Bundled left the saved drivers on screen').toHaveCount(0);
    });

    test('My Drivers + Favorites off — the saved drivers, and nothing bundled', async ({ page }) => {
      await openPicker(page);
      await setScope(page, 'My Drivers');
      await expect(page.locator(POOL_ROWS), 'My Drivers left bundled drivers on screen').toHaveCount(0);
      await expect(page.locator(MY_ROWS), 'My Drivers dropped a saved driver').toHaveCount(2);
    });

    test('All + Favorites off — every driver, both kinds together', async ({ page }) => {
      await openPicker(page);
      await setScope(page, 'All');
      await expect(page.locator(POOL_ROWS), 'All listed no bundled drivers').not.toHaveCount(0);
      await expect(page.locator(MY_ROWS), 'All dropped a saved driver').toHaveCount(2);
    });

    test('Bundled + Favorites on — the starred bundled driver only', async ({ page }) => {
      await openPicker(page);
      await starOneOfEach(page);
      await page.locator(FAV_CHIP).click();
      await setScope(page, 'Bundled');
      await expect(page.locator(POOL_ROWS), 'the two filters did not compose over the pool').toHaveCount(1);
      await expect(page.locator(MY_ROWS), 'a starred saved driver survived the Bundled scope').toHaveCount(0);
    });

    test('My Drivers + Favorites on — the starred saved driver only', async ({ page }) => {
      await openPicker(page);
      await starOneOfEach(page);
      await page.locator(FAV_CHIP).click();
      await setScope(page, 'My Drivers');
      await expect(page.locator(POOL_ROWS), 'a starred bundled driver survived the My Drivers scope').toHaveCount(0);
      await expect(page.locator(MY_ROWS), 'Favorites did not narrow the saved drivers to the starred one').toHaveCount(1);
    });

    test('All + Favorites on — every starred driver, of both kinds', async ({ page }) => {
      await openPicker(page);
      await starOneOfEach(page);
      await page.locator(FAV_CHIP).click();
      await setScope(page, 'All');
      await expect(page.locator(POOL_ROWS), 'the starred bundled driver is missing').toHaveCount(1);
      await expect(page.locator(MY_ROWS), 'the starred saved driver is missing').toHaveCount(1);
    });

    test('the count above the list follows the scope, counting both sections', async ({ page }) => {
      await openPicker(page);
      const status = page.locator('.statusrow .status');

      await setScope(page, 'My Drivers');
      await expect(status, 'the count ignored the saved drivers it was listing').toHaveText('2 drivers');

      // A scope that lists rows must never read as an empty list.
      await expect(page.locator('.dlist .status.loading'), 'a populated My Drivers list still showed the empty/loading message')
        .toHaveCount(0);
    });
  });

  test.describe('selecting a driver', () => {
    // docs/design/STATE_MODEL.md rule 1: choosing a driver EMBEDS it in the project. The pick copies the
    // driver in, closes the picker, and returns the user to the project — there is no editor in
    // the way and no live link back to where the driver came from. Editing is a separate act,
    // from the Driver panel's Edit button, and it edits the project's own copy.
    // The browserLog auto-fixture also asserts a clean console + network throughout.
    //
    // The driver under test is seeded into "My Drivers" rather than taken from the bundled
    // catalogue: what is being tested is the choose → embed flow, which must not depend on how
    // many records the bundler currently ships (see scripts/bundle-drivers.mjs).

    // The row's name is the driver's own Brand + Model (displayNameOf) — there is no stored name.
    const PICKED = 'Spec Fixture';
    const EDITOR = '.de-modal';
    const PICKER = '.modal:not(.de-modal)';   // the library dialog

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
      await page.evaluate(([key, json]) => {
        localStorage.setItem(key, json);
      }, [MY_DRIVERS_KEY, myDriversJson([{
        brand: 'Spec', model: 'Fixture', uuid: 'spec-fixture-uuid',
        specs: {
          Fs_hz: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas_m3: 0.028,
          Sd_m2: 0.0132, Re_ohm: 5.4, Le_H: 0.5e-3, Xmax_m: 0.0055, Pe_W: 70, Znom_ohm: 8,
        },
      }])] as const);
      await page.goto('/');
      await openAProject(page);
    });

    /** The model of every driver in My Drivers, out of the stored envelope. */
    async function savedModels(page: Page): Promise<string[]> {
      const raw = await page.evaluate((key: string) => localStorage.getItem(key), MY_DRIVERS_KEY);
      const env = parseMyDriversBucket(raw);
      return (env.entries ?? []).map(e => e.record?.model?.value ?? '');
    }

    /** Open the library — the toolbar's Manage Drivers button, visible on every tab. */
    function openPicker(page: Page) {
      return page.locator('.tb-btn[title^="Manage Drivers"]').click();
    }

    /**
     * What the project's driver is CALLED, read off the Driver tab's read-only Brand/Model pair.
     * That pair reflects the PROJECT's own copy, which is exactly what "choosing embeds" has to
     * change — the library row it came from is left alone.
     */
    async function projectDriverName(page: Page): Promise<string> {
      // Select the tab only when it is not already showing. Reading this AFTER an edit happens
      // with the picker still open behind the editor, and a click would be intercepted by that
      // overlay — whereas reading a value never needs the element to be clickable.
      const tab = page.locator('.project-nav li', { hasText: 'Driver' });
      if (!(await tab.evaluate(el => el.classList.contains('active')))) await tab.click();
      const ids = page.locator('.driver-id-row input');
      return `${(await ids.nth(0).inputValue()).trim()} ${(await ids.nth(1).inputValue()).trim()}`.trim();
    }

    /**
     * The editor's Model cell. Model lives on the GENERAL pane and the editor opens on Parameters,
     * so the pane is ensured on every use rather than assumed: reaching for this cell on the
     * Parameters pane waits on an element that never mounts, which is a 60 s timeout, not a failure
     * (ui-bugfix.md testing creed).
     */
    async function modelCell(page: Page) {
      await editorTab(page, 'General');
      return page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
    }

    /** Open the full driver editor on the PROJECT's driver, from the Driver panel's Edit button. */
    async function openProjectDriverEditor(page: Page) {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.edit-btn', { hasText: 'Edit' }).click();
      await expect(page.locator(EDITOR)).toBeVisible();
    }

    /** Open the library and choose the seeded driver. */
    async function pickSeededDriver(page: Page) {
      await openPicker(page);
      await page.locator('.my-ditem b', { hasText: PICKED }).click();
      // A row click summarises; "Use" is what chooses.
      const use = page.locator('.use-btn');
      await use.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      if (await use.isVisible()) await use.click();
    }

    test('choosing a driver embeds it in the project and closes the picker', async ({ page }) => {
      // No goto here: beforeEach already loaded the seeded page. A third navigation cancels the
      // second load's in-flight requests — `icon.svg` aborts — and the fixture rightly counts an
      // aborted same-origin request as a network failure.
      const before = await projectDriverName(page);

      await pickSeededDriver(page);

      // Straight back to the project: no editor, no picker.
      await expect(page.locator(EDITOR)).toBeHidden();
      await expect(page.locator(PICKER)).toBeHidden();

      // And the project now holds the chosen driver.
      const after = await projectDriverName(page);
      expect(after).not.toBe(before);
      expect(after).toContain('Spec');
    });

    test('the embedded driver is a copy — editing it does not touch the saved driver', async ({ page }) => {
      await pickSeededDriver(page);

      // Edit the project's driver, changing its model.
      await openProjectDriverEditor(page);

      const modelInput = await modelCell(page);
      await modelInput.fill('Fixture Edited');
      await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
      await expect(page.locator(EDITOR)).toBeHidden();

      // The saved driver in My Drivers is untouched — a project embeds a COPY.
      const saved = await page.evaluate(() => localStorage.getItem('openisd_my_drivers'));
      expect(saved).toContain('"value":"Fixture"');
      expect(saved).not.toContain('Fixture Edited');
    });

    test('OK on the project driver updates the project — it is left edited, nothing is saved', async ({ page }) => {
      await openProjectDriverEditor(page);

      await (await modelCell(page)).fill('Fixture Edited');
      await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
      await expect(page.locator(EDITOR)).toBeHidden();

      // OK routed the change into the PROJECT (editor → project.update): the project is now
      // EDITED — Save arms and Revert offers to discard. It did NOT head for My Drivers.
      // Save and Save all both light up when a project is edited, so each is named by its title.
      await expect(page.locator('.tb-btn.dirty[title^="Save - "]')).toBeVisible();
      await expect(page.locator('.tb-btn.dirty[title^="Save all"]')).toBeVisible();
      // The toolbar's Revert, specifically: the save rail carries a second one with the same
      // title, under every project tab.
      await expect(page.locator('.tb-btn[title^="Revert — discard all unsaved"]')).toBeVisible();
      const saved = await page.evaluate(() => localStorage.getItem('openisd_my_drivers'));
      expect(saved).not.toContain('Fixture Edited');
    });

    test('Copy to My Drivers writes the edited driver into the saved list', async ({ page }) => {
      await pickSeededDriver(page);

      await openProjectDriverEditor(page);

      const modelInput = await modelCell(page);
      await modelInput.fill('Fixture Copy');
      await page.locator('.de-copy-my').click();
      await page.locator('.save-confirm-btn').click();

      // A new identity (spec/fixture-copy) means a new saved driver beside the original.
      const savedM = await savedModels(page);
      expect(savedM.sort()).toEqual(['Fixture', 'Fixture Copy']);
    });

    test('Escape closes the editor and leaves the project driver as it was', async ({ page }) => {
      await pickSeededDriver(page);
      await openProjectDriverEditor(page);

      // Type into the draft, then abandon it. `.driver-id-row` is the Original shell's
      // read-only Brand/Model pair, which reflects the PROJECT's driver.
      const projectModel = page.locator('.driver-id-row input').nth(1);
      const before = await projectModel.inputValue();

      const modelInput = await modelCell(page);
      await modelInput.fill('Discarded');
      await page.keyboard.press('Escape');

      await expect(page.locator(EDITOR)).toBeHidden();
      await expect(projectModel).toHaveValue(before);
    });

    // ---- editing a SAVED driver ------------------------------------------------------------
    // The same dialog serves two subjects. The ✎ on a My Drivers row opens it on that SAVED
    // driver: OK commits through the save dialog and the project is not involved. The title says
    // which, so the user is never guessing what OK will change.
    //
    // Identity is (brand, model) and it is immutable once saved: a name-changing OK does not
    // REWRITE the entry, it writes a NEW entry under the new identity and keeps the original —
    // exactly the "Save as a copy keeps the original" outcome the name-changing-rename question
    // offers on the Save path (my-drivers-failures spec). The project is a bystander throughout.

    test('the ✎ on a My Drivers row opens the editor on that saved driver', async ({ page }) => {
      await openPicker(page);
      await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

      await expect(page.locator(EDITOR)).toBeVisible();
      await expect(page.locator(EDITOR)).toContainText('Edit My Driver');
      const modelInput = await modelCell(page);
      await expect(modelInput).toHaveValue('Fixture');
    });

    test('editing a saved driver writes a new entry under the new identity and leaves the project alone', async ({ page }) => {
      const beforeProject = await projectDriverName(page);

      await openPicker(page);
      await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

      const modelInput = await modelCell(page);
      await modelInput.fill('Fixture Mk2');
      await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
      await page.locator('.save-confirm-btn').click();
      await page.locator('.save-as-copy-btn').click();
      await expect(page.locator(EDITOR)).toBeHidden();

      // A changed identity can't rewrite the saved entry (identity is the storage key) — the save
      // ADDS the driver under its new name and keeps the original (the copy outcome, not a move).
      const savedM = await savedModels(page);
      expect(savedM.sort()).toEqual(['Fixture', 'Fixture Mk2']);

      // The project's driver never entered into it.
      expect(await projectDriverName(page)).toBe(beforeProject);
    });

    test('the picker shows a driver under its new name as soon as the editor closes', async ({ page }) => {
      await openPicker(page);
      await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

      const modelInput = await modelCell(page);
      await modelInput.fill('Renamed Live');
      await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
      await page.locator('.save-confirm-btn').click();
      await page.locator('.save-as-copy-btn').click();

      // The picker is still open behind the editor; its list must not be stale — the renamed save
      // is listed at once, next to the preserved original.
      await expect(page.locator('.my-ditem', { hasText: 'Renamed Live' })).toBeVisible();
      await expect(page.locator('.my-ditem', { hasText: PICKED })).toBeVisible();
    });

    test('OK on a saved driver without a rename overwrites that row instead of adding a twin', async ({ page }) => {
      await openPicker(page);
      await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();
      await expect(await modelCell(page)).toHaveValue('Fixture');

      await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
      await page.locator('.save-confirm-btn').click();
      await expect(page.locator(EDITOR)).toBeHidden();

      expect(await savedModels(page)).toEqual(['Fixture']);
    });

    test('Cancel on a saved driver writes nothing', async ({ page }) => {
      await openPicker(page);
      await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

      const modelInput = await modelCell(page);
      await modelInput.fill('Never Saved');
      await page.locator(`${EDITOR} .de-footer button:has-text("Cancel")`).click();
      await expect(page.locator(EDITOR)).toBeHidden();

      const savedM = await savedModels(page);
      expect(savedM).toEqual(['Fixture']);
    });
  });

  test.describe('favourites', () => {
    // ui-todo.md "Favorites" — a star toggle on every row, and a Favorites button in the slot
    // the All Sources dropdown vacated, behaving as an on/off filter over the same list exactly
    // as the type chips do.
    //
    // WinISD picker only (DriverBrowser.vue), per the agreed scope.

    async function openPicker(page: Page): Promise<void> {
      await page.goto('/');
      await openAProject(page);
      await page.locator('[title*="librar" i]').first().click();
      await expect(page.locator('.dlist')).toBeVisible();
    }

    const POOL_ROWS = '.dlist .ditem:not(.my-ditem)';

    test('every driver row carries a star toggle', async ({ page }) => {
      await openPicker(page);
      const rows = page.locator(POOL_ROWS);
      const n = await rows.count();
      expect(n, 'no driver rows rendered — the pool is empty, so this spec proves nothing').toBeGreaterThan(2);
      for (let i = 0; i < Math.min(n, 5); i++) {
        await expect(rows.nth(i).locator('.fav-btn'), `row ${i} has no star toggle`).toHaveCount(1);
      }
    });

    test('starring a driver marks it, and the mark survives closing and reopening the picker', async ({ page }) => {
      await openPicker(page);
      const row = page.locator(POOL_ROWS).first();
      const name = (await row.locator('b').textContent())?.trim();
      expect(name, 'the first row has no name to identify it by').toBeTruthy();

      const star = row.locator('.fav-btn');
      await expect(star, 'the star started out already on').not.toHaveClass(/on/);
      await star.click();
      await expect(star, 'clicking the star did not mark the driver').toHaveClass(/on/);

      // Reopen from scratch — a favourite that lives only in memory is not a favourite.
      await page.reload();
      await page.locator('[title*="librar" i]').first().click();
      const sameRow = page.locator(POOL_ROWS).filter({ hasText: name! }).first();
      await expect(sameRow.locator('.fav-btn'), 'the star did not survive a reload')
        .toHaveClass(/on/);
    });

    // The star has to answer the click under the pointer that made it. Hover painted an unstarred
    // star (#e8a317) all but the same amber as a starred one (#f0a500), so the toggle looked dead
    // until the mouse moved away (John, 2026-09-24). Colour alone cannot carry this: the state is
    // the GLYPH — hollow ☆ off, filled ★ on — which reads under any hover tint.
    test('starring changes the star under the pointer, with no mouse-out', async ({ page }) => {
      await openPicker(page);
      const star = page.locator(POOL_ROWS).first().locator('.fav-btn');

      await star.hover();
      await expect(star, 'an unstarred star is not the hollow glyph').toHaveText('☆');

      await star.click();   // the pointer stays on the star
      await expect(star, 'the click did not star the driver at all').toHaveClass(/on/);
      await expect(star, 'the starred star still reads as hollow under the pointer').toHaveText('★');

      await star.click();
      await expect(star, 'un-starring under the pointer left it filled').toHaveText('☆');
    });

    test('the star is readable at a glance — 16px in the list, 32px in the summary', async ({ page }) => {
      await openPicker(page);
      const rowStar = page.locator(POOL_ROWS).first().locator('.fav-btn');
      expect(await rowStar.evaluate(el => parseFloat(getComputedStyle(el).fontSize)),
        'the list star is smaller than the agreed 16px').toBeGreaterThanOrEqual(16);

      await page.locator(POOL_ROWS).first().click();
      const prevStar = page.locator('.prev-nav .fav-btn');
      await expect(prevStar, 'the summary has no star').toHaveCount(1);
      expect(await prevStar.evaluate(el => parseFloat(getComputedStyle(el).fontSize)),
        'the summary star is smaller than the agreed 32px').toBeGreaterThanOrEqual(32);
    });

    test('the Favorites button filters to starred drivers only, and off again', async ({ page }) => {
      await openPicker(page);
      const rows = page.locator(POOL_ROWS);
      const before = await rows.count();

      const first = rows.first();
      const firstName = (await first.locator('b').textContent())?.trim();
      await first.locator('.fav-btn').click();

      const favFilter = page.locator('.fav-filter');
      await expect(favFilter, 'no Favorites filter button rendered').toHaveCount(1);

      await favFilter.click();
      await expect(favFilter, 'the Favorites filter did not mark itself active').toHaveClass(/active/);
      await expect(rows, 'the Favorites filter did not narrow the list to the one starred driver')
        .toHaveCount(1);
      await expect(rows.first().locator('b')).toHaveText(firstName!);

      await favFilter.click();
      await expect(favFilter, 'the Favorites filter stayed active after a second press')
        .not.toHaveClass(/active/);
      await expect(rows, 'pressing Favorites again did not restore the whole list')
        .toHaveCount(before);
    });

    test('un-starring a driver removes it from the favourites-only list', async ({ page }) => {
      await openPicker(page);
      const rows = page.locator(POOL_ROWS);
      await rows.first().locator('.fav-btn').click();
      await rows.nth(1).locator('.fav-btn').click();

      await page.locator('.fav-filter').click();
      await expect(rows, 'two starred drivers should both be listed').toHaveCount(2);

      await rows.first().locator('.fav-btn').click();
      await expect(rows, 'un-starring did not drop the driver out of the filtered list')
        .toHaveCount(1);
    });
  });
});
