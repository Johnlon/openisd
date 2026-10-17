// The screen list. Each screen acts only as a user does: clicks, typing, Escape.
// act(page) throws when the control it needs is not there (reported as "not in this build").
// keep: true = the next screen continues from this one, so no reset between.

const T = { timeout: 4000 };
const clickText = (page, text, opts = {}) => page.getByText(text, { exact: true, ...opts }).locator('visible=true').first().click(T);
const clickBtn = (page, name) => page.getByRole('button', { name, exact: true }).first().click(T);

const DESKTOP = 'd';
const PHONE = 'p';
const BOTH = [DESKTOP, PHONE];

// Desktop toolbar icons carry no accessible name; reach them by their tooltip, which every build has.
const toolbar = (page, title) => page.getByTitle(title, { exact: true }).first().click(T);

async function openPhoneMenu(page) { await page.getByRole('button', { name: 'Menu', exact: true }).click(T); await page.waitForTimeout(400); }
async function phoneMenuItem(page, text) { await openPhoneMenu(page); await clickText(page, text); }
async function infoMenuItem(page, text) { await toolbar(page, 'Info'); await page.waitForTimeout(300); await clickText(page, text); }

async function startWizard(page) { await clickBtn(page, 'New project'); await page.getByText('Step 1 of 5').waitFor(T); }
async function pickDriver(page) { await clickText(page, 'Accuton AS168-9-470'); await page.waitForTimeout(200); }
async function next(page) { await clickBtn(page, 'Next'); await page.waitForTimeout(500); }

export const SCREENS = [
  { key: 'welcome', label: 'First-run welcome', vp: BOTH, keep: true, act: async () => {} },
  { key: 'welcome-banner', label: 'First screen with the storage banner', vp: BOTH, act: async (page) => { await clickBtn(page, 'Start designing'); await page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Dismiss' }) }).waitFor(T); } },
  // From here on the banner is dismissed, as a user does with its close control.
  { key: 'empty', label: 'No project open (banner dismissed)', vp: BOTH, act: async (page) => {
      // Builds without the banner have nothing to dismiss.
      const dismiss = page.getByRole('button', { name: 'Dismiss', exact: true }).first();
      if (await dismiss.isVisible().catch(() => false)) await dismiss.click(T);
      await page.waitForTimeout(300);
    } },
  { key: 'wizard-1', label: 'New project step 1', vp: BOTH, keep: true, act: startWizard },
  { key: 'wizard-2', label: 'New project step 2', vp: BOTH, keep: true, act: async (page) => { await pickDriver(page); await next(page); } },
  { key: 'wizard-3', label: 'New project step 3', vp: BOTH, keep: true, act: next },
  { key: 'wizard-4', label: 'New project step 4', vp: BOTH, keep: true, act: next },
  { key: 'wizard-5', label: 'New project step 5', vp: BOTH, keep: true, act: next },
  { key: 'project-box', label: 'Project, Box tab', vp: BOTH, act: async (page) => {
      await page.getByPlaceholder(/Living-room/).fill('Audit', T);
      await page.getByRole('button', { name: 'Create', exact: true }).click(T);
      await page.waitForTimeout(2500);
    } },
  // desktop
  { key: 'tab-driver', label: 'Driver tab', vp: [DESKTOP], act: (p) => clickText(p, 'Driver') },
  { key: 'tab-filters', label: 'Filters tab', vp: [DESKTOP], act: (p) => clickText(p, 'Filters') },
  { key: 'tab-signal', label: 'Signal tab', vp: [DESKTOP], act: (p) => clickText(p, 'Signal') },
  { key: 'tab-advanced', label: 'Advanced tab', vp: [DESKTOP], act: (p) => clickText(p, 'Advanced') },
  { key: 'tab-project', label: 'Project tab', vp: [DESKTOP], act: (p) => p.getByText('Project', { exact: true }).last().click(T) },
  { key: 'driver-db', label: 'Driver database dialog', vp: [DESKTOP], act: async (p) => { await toolbar(p, /^Manage Drivers/); await p.getByText('Driver database').waitFor(T); } },
  { key: 'options', label: 'Options dialog', vp: [DESKTOP], act: async (p) => { await toolbar(p, 'Options'); await p.getByText('Plot Window').waitFor(T); } },
  { key: 'info-menu', label: 'Info menu', vp: [DESKTOP], act: async (p) => { await toolbar(p, 'Info'); await p.getByText('About OpenISD').waitFor(T); } },
  { key: 'about', label: 'About', vp: [DESKTOP], act: (p) => infoMenuItem(p, 'About OpenISD') },
  { key: 'differences', label: 'OpenISD and WinISD differences', vp: [DESKTOP], act: (p) => infoMenuItem(p, 'OpenISD and WinISD differences') },
  { key: 'diagnostics', label: 'Diagnostics', vp: [DESKTOP], act: (p) => infoMenuItem(p, 'Diagnostics') },
  // phone
  { key: 'menu', label: 'Menu open', vp: [PHONE], act: openPhoneMenu },
  { key: 'tab-driver', label: 'Driver tab', vp: [PHONE], act: (p) => clickBtn(p, 'Driver') },
  { key: 'tab-signal', label: 'Signal tab', vp: [PHONE], act: (p) => clickBtn(p, 'Signal') },
  { key: 'tab-filters', label: 'Filters tab', vp: [PHONE], act: (p) => clickBtn(p, 'Filters') },
  { key: 'tab-graph', label: 'Graph tab', vp: [PHONE], act: (p) => clickBtn(p, 'Graph') },
  // Builds before 17 Oct 2026 name this menu item "Open project…".
  { key: 'projects', label: 'Projects list', vp: [PHONE], act: (p) => phoneMenuItem(p, /^(Projects|Open project…)$/) },
  { key: 'options', label: 'Options dialog', vp: [PHONE], act: (p) => phoneMenuItem(p, 'Options') },
  { key: 'driver-db', label: 'Driver database dialog', vp: [PHONE], act: (p) => phoneMenuItem(p, 'Manage Drivers') },
  { key: 'project-details', label: 'Project details', vp: [PHONE], act: (p) => phoneMenuItem(p, 'Project details') },
  { key: 'advanced', label: 'Advanced', vp: [PHONE], act: (p) => phoneMenuItem(p, 'Advanced') },
  { key: 'differences', label: 'OpenISD and WinISD differences', vp: [PHONE], act: (p) => phoneMenuItem(p, 'OpenISD and WinISD differences') },
  { key: 'diagnostics', label: 'Diagnostics', vp: [PHONE], act: (p) => phoneMenuItem(p, 'Diagnostics') },
  { key: 'about', label: 'About', vp: [PHONE], act: (p) => phoneMenuItem(p, 'About OpenISD') },
];

// Returns the app to its base screen between screens.
export async function reset(page) {
  for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  // Menus close only on an outside click, as a user does it.
  if (page.viewportSize().width > 800 && await page.getByText('About OpenISD', { exact: true }).first().isVisible().catch(() => false)) { await page.mouse.click(870, 19); await page.waitForTimeout(200); }
  if (await page.locator('[data-testid=app-version]').first().isVisible().catch(() => false)) { await page.mouse.click(405, 600); await page.waitForTimeout(300); }
  // Older builds close Diagnostics only with its Dismiss button.
  const close = page.getByRole('button', { name: /^(Close|Dismiss)$/ }).first();
  if (await close.isVisible().catch(() => false)) { await close.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(200); }
}
