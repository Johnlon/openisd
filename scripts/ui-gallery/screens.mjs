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
// The Driver tab's Edit button opens the driver editor; desktop labels it "✎ Edit", phone "Edit".
async function editDriver(page, tab) { await tab(page); await page.getByRole('button', { name: /^(✎ )?Edit$/ }).locator('visible=true').first().click(T); await page.waitForTimeout(600); }
async function next(page) { await clickBtn(page, 'Next'); await page.waitForTimeout(500); }

// Driver editor: the wheel goes where a user's finger or cursor is, the middle of the screen, which is
// the middle of the editor on both shells.
async function wheelEditor(page, dy) {
  const v = page.viewportSize();
  await page.mouse.move(v.width / 2, v.height / 2);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(300);
}
const EDITOR_TOP = -6000;
const EDITOR_BOTTOM = 6000;
const editorTab = async (page, name, dy) => { await page.getByRole('button', { name, exact: true }).last().click(T); await wheelEditor(page, dy); };
// Opens the editor from the Driver tab, then lands on General (the editor opens on Parameters).
const openEditorGeneral = (tab) => async (page) => { await editDriver(page, tab); await editorTab(page, 'General', EDITOR_TOP); };
const desktopDriverTab = (q) => clickText(q, 'Driver');
const phoneDriverTab = (q) => clickBtn(q, 'Driver');

// Manage drivers: pick a driver in the list, see its summary, then edit it from there.
async function previewDbDriver(page) { await clickText(page, 'Accuton AS168-9-470'); await page.getByRole('button', { name: 'Edit', exact: true }).last().waitFor(T); }
async function editFromDb(page) { await page.getByRole('button', { name: 'Edit', exact: true }).last().click(T); await page.getByRole('button', { name: 'General', exact: true }).waitFor(T); await page.waitForTimeout(400); }

// Both shells name the Options tabs the same.
const optionsTab = (name) => async (page) => { await page.getByRole('button', { name, exact: true }).click(T); await page.waitForTimeout(300); };

const openDesktopOptions = async (p) => { await toolbar(p, 'Options'); await p.getByText('Plot Window').waitFor(T); };
const openPhoneOptions = (p) => phoneMenuItem(p, 'Options');

// The pop-up that says what was exported (a confirm dialog the user must press OK on).
const exportAllPopup = async (page) => { await page.getByRole('button', { name: /^Export all/ }).locator('visible=true').first().click(T); await page.getByRole('alertdialog').waitFor(T); };

const wheelDown = async (page) => wheelEditor(page, EDITOR_BOTTOM);

// A cue or a help link opens "OpenISD and WinISD differences".
const openDeviationCue = async (page) => { await page.getByRole('button', { name: /^Differs from WinISD/ }).locator('visible=true').first().click(T); await page.getByRole('dialog', { name: 'OpenISD and WinISD differences' }).waitFor(T); };
const openGroupHelp = async (page) => { await page.getByRole('button', { name: /^Help: / }).locator('visible=true').first().click(T); await page.getByRole('dialog', { name: 'OpenISD and WinISD differences' }).waitFor(T); };

// A vented project: the Box type is the first select that offers "Vented"; its tab then carries the box name.
async function makeVented(page) { await page.locator('select:visible').filter({ hasText: 'Vented' }).first().selectOption('Vented'); await page.waitForTimeout(800); }
const ENCLOSURE_TAB = /^(Vented|Enclosure)$/;

export const SCREENS = [
  { key: 'welcome', label: 'First-run welcome (splash)', vp: BOTH, keep: true, covers: ['SplashModal', 'SplashContent'], act: async () => {} },
  { key: 'welcome-banner', label: 'First screen with the storage banner', vp: BOTH, covers: ['PersistenceBanner'], act: async (page) => { await clickBtn(page, 'Start designing'); await page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Dismiss' }) }).waitFor(T); } },
  // From here on the banner is dismissed, as a user does with its close control.
  { key: 'empty', label: 'No project open (banner dismissed)', vp: BOTH, covers: ['OriginalShell', 'MobileShell', 'OriginalProjectList'], act: async (page) => {
      // Builds without the banner have nothing to dismiss.
      const dismiss = page.getByRole('button', { name: 'Dismiss', exact: true }).first();
      if (await dismiss.isVisible().catch(() => false)) await dismiss.click(T);
      await page.waitForTimeout(300);
    } },
  { key: 'wizard-1', label: 'New project step 1', vp: BOTH, keep: true, covers: ['OriginalNewProject', 'MobileNewProject', 'DriverLibrary'], act: startWizard },
  { key: 'wizard-2', label: 'New project step 2', vp: BOTH, keep: true, covers: ['OriginalNewProject', 'MobileNewProject', 'BoxTypeDiagram'], act: async (page) => { await pickDriver(page); await next(page); } },
  { key: 'wizard-3', label: 'New project step 3', vp: BOTH, keep: true, covers: ['OriginalNewProject', 'MobileNewProject'], act: next },
  { key: 'wizard-4', label: 'New project step 4', vp: BOTH, keep: true, covers: ['OriginalNewProject', 'MobileNewProject'], act: next },
  { key: 'wizard-5', label: 'New project step 5', vp: BOTH, keep: true, covers: ['OriginalNewProject', 'MobileNewProject'], act: next },
  { key: 'project-box', label: 'Project, Box tab', vp: BOTH, covers: ['OriginalShell', 'MobileShell', 'MobileBoxTab', 'MobileTabBar', 'MobileSaveButton', 'OriginalProjectList', 'ProvenanceLegend', 'GraphPanel'], act: async (page) => {
      await page.getByPlaceholder(/Living-room/).fill('Audit', T);
      await page.getByRole('button', { name: 'Create', exact: true }).click(T);
      await page.waitForTimeout(2500);
    } },
  // desktop
  { key: 'tab-driver', label: 'Driver tab', vp: [DESKTOP], covers: ['OriginalShell'], act: (p) => clickText(p, 'Driver') },
  { key: 'tab-filters', label: 'Filters tab', vp: [DESKTOP], covers: ['OriginalFilters'], act: (p) => clickText(p, 'Filters') },
  { key: 'tab-signal', label: 'Signal tab', vp: [DESKTOP], covers: ['OriginalShell'], act: (p) => clickText(p, 'Signal') },
  { key: 'tab-advanced', label: 'Advanced tab', vp: [DESKTOP], covers: ['OriginalShell', 'AdvancedOptions'], act: (p) => clickText(p, 'Advanced') },
  { key: 'tab-project', label: 'Project tab', vp: [DESKTOP], covers: ['OriginalShell'], act: (p) => p.getByText('Project', { exact: true }).last().click(T) },
  { key: 'whatif', label: 'What-if panel', vp: [DESKTOP], covers: ['OriginalWhatIf'], act: async (p) => { await p.getByRole('button', { name: /What-if/ }).first().click(T); await p.waitForTimeout(600); } },
  { key: 'differences-help', label: 'Help link beside a compatibility group', vp: [DESKTOP], covers: ['CompatGroupHelpLink', 'WinisdDifferencesModal', 'ErrorSwitchGroup'], act: async (p) => { await clickText(p, 'Advanced'); await openGroupHelp(p); } },
  { key: 'differences-cue', label: 'Difference (≠W) popup', vp: [DESKTOP], covers: ['WinisdDeviationCue', 'WinisdDifferencesModal'], act: async (p) => { await clickText(p, 'Box'); await openDeviationCue(p); } },
  // The driver editor, every tab at the top and scrolled to the bottom (it opens on Parameters).
  { key: 'editor-general-top', label: 'Driver editor, General, top', vp: [DESKTOP], keep: true, covers: ['DriverEditorModal'], act: openEditorGeneral(desktopDriverTab) },
  { key: 'editor-general-bottom', label: 'Driver editor, General, bottom', vp: [DESKTOP], keep: true, covers: ['DriverEditorModal'], act: wheelDown },
  { key: 'editor-parameters-top', label: 'Driver editor, Parameters, top', vp: [DESKTOP], keep: true, covers: ['DriverEditorModal'], act: (p) => editorTab(p, 'Parameters', EDITOR_TOP) },
  { key: 'editor-parameters-bottom', label: 'Driver editor, Parameters, bottom', vp: [DESKTOP], keep: true, covers: ['DriverEditorModal'], act: wheelDown },
  { key: 'editor-advanced-top', label: 'Driver editor, Advanced, top', vp: [DESKTOP], keep: true, covers: ['DriverEditorModal'], act: (p) => editorTab(p, 'Advanced', EDITOR_TOP) },
  { key: 'editor-advanced-bottom', label: 'Driver editor, Advanced, bottom', vp: [DESKTOP], keep: true, covers: ['DriverEditorModal'], act: wheelDown },
  { key: 'editor-dimensions-top', label: 'Driver editor, Dimensions, top', vp: [DESKTOP], keep: true, covers: ['DriverEditorModal', 'DriverDimensionsDiagram'], act: (p) => editorTab(p, 'Dimensions', EDITOR_TOP) },
  { key: 'editor-dimensions-bottom', label: 'Driver editor, Dimensions, bottom', vp: [DESKTOP], keep: true, covers: ['DriverEditorModal', 'DriverDimensionsDiagram'], act: wheelDown },
  { key: 'editor-provenance-on', label: 'Driver editor, Inspect Provenance on', vp: [DESKTOP], keep: true, covers: ['DriverEditorModal'], act: async (p) => { await editorTab(p, 'Parameters', EDITOR_TOP); await p.getByText('Inspect Provenance').click(T); } },
  { key: 'equation-inspector', label: 'Equation inspector (a field clicked)', vp: [DESKTOP], covers: ['EquationInspectorModal'], act: async (p) => { await p.getByText('Qts', { exact: true }).locator('visible=true').last().click(T); await p.locator('text=Provenance:').first().waitFor(T); } },
  { key: 'editor-export-format', label: 'Driver editor, choose file format', vp: [DESKTOP], keep: true, covers: ['DriverEditorModal'], act: async (p) => { await editDriver(p, desktopDriverTab); await p.getByRole('button', { name: 'Export', exact: true }).last().click(T); await p.getByRole('dialog', { name: 'Choose driver file format' }).waitFor(T); } },
  { key: 'save-to-library', label: 'Save to My Drivers dialog', vp: [DESKTOP], covers: ['SaveToLibraryDialog'], act: async (p) => { await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.getByRole('button', { name: /^Copy to My Drivers/ }).last().click(T); await p.getByRole('dialog', { name: 'Save to My Drivers' }).waitFor(T); } },
  { key: 'driver-db', label: 'Driver database dialog', vp: [DESKTOP], keep: true, covers: ['DriverBrowser', 'DriverLibrary'], act: async (p) => { await toolbar(p, /^Manage Drivers/); await p.getByText('Driver database').waitFor(T); } },
  { key: 'driver-db-preview', label: 'Driver database, a driver picked', vp: [DESKTOP], keep: true, covers: ['DriverLibrary'], act: previewDbDriver },
  { key: 'driver-db-editor', label: 'Driver editor opened from Manage drivers', vp: [DESKTOP], covers: ['DriverLibrary', 'DriverEditorModal'], act: editFromDb },
  { key: 'driver-db-type-help', label: 'Driver database, how types are classified', vp: [DESKTOP], covers: ['DriverLibrary'], act: async (p) => { await toolbar(p, /^Manage Drivers/); await p.getByText('Driver database').waitFor(T); await p.getByTitle('How are driver types classified?').click(T); await p.waitForTimeout(300); } },
  { key: 'options', label: 'Options dialog, General', vp: [DESKTOP], keep: true, covers: ['OptionsModal'], act: openDesktopOptions },
  { key: 'options-plot', label: 'Options dialog, Plot Window', vp: [DESKTOP], keep: true, covers: ['OptionsModal'], act: optionsTab('Plot Window') },
  { key: 'options-data', label: 'Options dialog, Your data', vp: [DESKTOP], covers: ['OptionsModal', 'StorageHistory'], act: optionsTab('Your data') },
  { key: 'confirm-dialog', label: 'Confirm dialog (what was exported)', vp: [DESKTOP], covers: ['ConfirmDialog'], act: exportAllPopup },
  { key: 'chart-data', label: 'Chart data dialog', vp: [DESKTOP], covers: ['ChartDataDialog'], act: async (p) => { await p.getByRole('button', { name: 'Data', exact: true }).first().click(T); await p.getByRole('dialog').waitFor(T); } },
  { key: 'export-menu', label: 'Save As / Export menu', vp: [DESKTOP], covers: ['ExportMenu'], act: async (p) => { await p.getByTitle(/^Save As \/ Export/).last().click(T); await p.getByText('Share Link to Project (http:)').waitFor(T); } },
  { key: 'cloud-sync', label: 'Cloud sync dialog', vp: [DESKTOP], covers: ['CloudSyncDialog', 'CloudSyncBadge'], act: (p) => infoMenuItem(p, 'Cloud sync…') },
  { key: 'info-menu', label: 'Info menu', vp: [DESKTOP], covers: ['OriginalShell'], act: async (p) => { await toolbar(p, 'Info'); await p.getByText('About OpenISD').waitFor(T); } },
  { key: 'about', label: 'About (splash on demand)', vp: [DESKTOP], covers: ['SplashModal'], act: (p) => infoMenuItem(p, 'About OpenISD') },
  { key: 'differences', label: 'OpenISD and WinISD differences', vp: [DESKTOP], covers: ['WinisdDifferencesModal'], act: (p) => infoMenuItem(p, 'OpenISD and WinISD differences') },
  { key: 'diagnostics', label: 'Diagnostics', vp: [DESKTOP], covers: ['DiagnosticsModal'], act: (p) => infoMenuItem(p, 'Diagnostics') },
  // phone
  { key: 'menu', label: 'Menu open', vp: [PHONE], covers: ['MobileShell'], act: openPhoneMenu },
  { key: 'tab-driver', label: 'Driver tab', vp: [PHONE], covers: ['MobileDriverTab'], act: (p) => clickBtn(p, 'Driver') },
  { key: 'tab-signal', label: 'Signal tab', vp: [PHONE], covers: ['MobileSignalTab'], act: (p) => clickBtn(p, 'Signal') },
  { key: 'tab-filters', label: 'Filters tab', vp: [PHONE], covers: ['MobileFiltersTab', 'OriginalFilters'], act: (p) => clickBtn(p, 'Filters') },
  { key: 'tab-graph', label: 'Graph tab', vp: [PHONE], covers: ['MobileChartView', 'GraphPanel'], act: (p) => clickBtn(p, 'Graph') },
  { key: 'chart-picker', label: 'Graph, chart list open', vp: [PHONE], covers: ['MobileChartView'], act: async (p) => { await clickBtn(p, 'Graph'); await p.getByRole('button', { name: /▾$/ }).first().click(T); await p.waitForTimeout(300); } },
  { key: 'sheet-tune', label: 'Tune sheet over the chart', vp: [PHONE], covers: ['MobileSheet'], act: async (p) => { await clickBtn(p, 'Graph'); await p.getByRole('button', { name: 'Open Tune' }).click(T); await p.waitForTimeout(400); } },
  { key: 'sheet-whatif', label: 'What-if sheet over the chart', vp: [PHONE], covers: ['MobileSheet'], act: async (p) => { await clickBtn(p, 'Graph'); await p.getByRole('button', { name: 'Open What-if' }).click(T); await p.waitForTimeout(400); } },
  { key: 'chart-data', label: 'Chart data dialog', vp: [PHONE], covers: ['ChartDataDialog'], act: async (p) => { await clickBtn(p, 'Graph'); await p.getByRole('button', { name: 'Data', exact: true }).first().click(T); await p.getByRole('dialog').waitFor(T); } },
  { key: 'differences-cue', label: 'Difference (≠W) popup', vp: [PHONE], covers: ['WinisdDeviationCue', 'WinisdDifferencesModal'], act: async (p) => { await clickBtn(p, 'Box'); await openDeviationCue(p); } },
  // The phone editor, in the same order as the desktop one.
  { key: 'editor-general-top', label: 'Driver editor, General, top', vp: [PHONE], keep: true, covers: ['DriverEditorModal'], act: openEditorGeneral(phoneDriverTab) },
  { key: 'editor-general-bottom', label: 'Driver editor, General, bottom', vp: [PHONE], keep: true, covers: ['DriverEditorModal'], act: wheelDown },
  { key: 'editor-parameters-top', label: 'Driver editor, Parameters, top', vp: [PHONE], keep: true, covers: ['DriverEditorModal'], act: (p) => editorTab(p, 'Parameters', EDITOR_TOP) },
  { key: 'editor-parameters-bottom', label: 'Driver editor, Parameters, bottom', vp: [PHONE], keep: true, covers: ['DriverEditorModal'], act: wheelDown },
  { key: 'editor-advanced-top', label: 'Driver editor, Advanced, top', vp: [PHONE], keep: true, covers: ['DriverEditorModal'], act: (p) => editorTab(p, 'Advanced', EDITOR_TOP) },
  { key: 'editor-advanced-bottom', label: 'Driver editor, Advanced, bottom', vp: [PHONE], keep: true, covers: ['DriverEditorModal'], act: wheelDown },
  { key: 'editor-dimensions-top', label: 'Driver editor, Dimensions, top', vp: [PHONE], keep: true, covers: ['DriverEditorModal', 'DriverDimensionsDiagram'], act: (p) => editorTab(p, 'Dimensions', EDITOR_TOP) },
  { key: 'editor-dimensions-bottom', label: 'Driver editor, Dimensions, bottom', vp: [PHONE], keep: true, covers: ['DriverEditorModal', 'DriverDimensionsDiagram'], act: wheelDown },
  { key: 'editor-provenance-on', label: 'Driver editor, Inspect Provenance on', vp: [PHONE], keep: true, covers: ['DriverEditorModal'], act: async (p) => { await editorTab(p, 'Parameters', EDITOR_TOP); await p.getByText('Inspect Provenance').click(T); } },
  { key: 'equation-inspector', label: 'Equation inspector (a field clicked)', vp: [PHONE], covers: ['EquationInspectorModal'], act: async (p) => { await p.getByText('Qts', { exact: true }).locator('visible=true').last().click(T); await p.locator('text=Provenance:').first().waitFor(T); } },
  { key: 'editor-export-format', label: 'Driver editor, choose file format', vp: [PHONE], keep: true, covers: ['DriverEditorModal'], act: async (p) => { await editDriver(p, phoneDriverTab); await p.getByRole('button', { name: 'Export', exact: true }).last().click(T); await p.getByRole('dialog', { name: 'Choose driver file format' }).waitFor(T); } },
  { key: 'save-to-library', label: 'Save to My Drivers dialog', vp: [PHONE], covers: ['SaveToLibraryDialog'], act: async (p) => { await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.getByRole('button', { name: /^Copy to My Drivers/ }).last().click(T); await p.getByRole('dialog', { name: 'Save to My Drivers' }).waitFor(T); } },
  // Builds before 17 Oct 2026 name this menu item "Open project…".
  { key: 'projects', label: 'Projects list', vp: [PHONE], covers: ['MobileProjectsPane', 'MobilePaneDialog'], act: (p) => phoneMenuItem(p, /^(Projects|Open project…)$/) },
  { key: 'confirm-dialog', label: 'Confirm dialog (what was exported)', vp: [PHONE], covers: ['ConfirmDialog'], act: async (p) => { await phoneMenuItem(p, /^(Projects|Open project…)$/); await exportAllPopup(p); } },
  { key: 'options', label: 'Options dialog, General', vp: [PHONE], keep: true, covers: ['OptionsModal'], act: openPhoneOptions },
  { key: 'options-plot', label: 'Options dialog, Plot Window', vp: [PHONE], keep: true, covers: ['OptionsModal'], act: optionsTab('Plot Window') },
  { key: 'options-data', label: 'Options dialog, Your data', vp: [PHONE], covers: ['OptionsModal', 'StorageHistory'], act: optionsTab('Your data') },
  { key: 'driver-db', label: 'Driver database dialog', vp: [PHONE], keep: true, covers: ['MobilePaneDialog', 'MobileManageDriversTab', 'DriverLibrary'], act: (p) => phoneMenuItem(p, 'Manage Drivers') },
  { key: 'driver-db-preview', label: 'Driver database, a driver picked', vp: [PHONE], keep: true, covers: ['MobileManageDriversTab', 'DriverLibrary'], act: previewDbDriver },
  { key: 'driver-db-editor', label: 'Driver editor opened from Manage drivers', vp: [PHONE], covers: ['MobileManageDriversTab', 'DriverEditorModal'], act: editFromDb },
  { key: 'driver-db-type-help', label: 'Driver database, how types are classified', vp: [PHONE], covers: ['DriverLibrary'], act: async (p) => { await phoneMenuItem(p, 'Manage Drivers'); await p.getByTitle('How are driver types classified?').click(T); await p.waitForTimeout(300); } },
  { key: 'project-details', label: 'Project details', vp: [PHONE], covers: ['MobilePaneDialog', 'MobileProjectTab'], act: (p) => phoneMenuItem(p, 'Project details') },
  { key: 'advanced', label: 'Advanced', vp: [PHONE], covers: ['MobilePaneDialog', 'MobileAdvancedTab', 'AdvancedOptions'], act: (p) => phoneMenuItem(p, 'Advanced') },
  { key: 'differences-help', label: 'Help link beside a compatibility group', vp: [PHONE], covers: ['CompatGroupHelpLink', 'WinisdDifferencesModal', 'ErrorSwitchGroup'], act: async (p) => { await phoneMenuItem(p, 'Advanced'); await openGroupHelp(p); } },
  { key: 'export-menu', label: 'Save As / Export menu', vp: [PHONE], covers: ['ExportMenu'], act: async (p) => { await phoneMenuItem(p, 'Save As / Export'); await p.getByText('Share Link to Project (http:)').waitFor(T); } },
  { key: 'cloud-sync', label: 'Cloud sync dialog', vp: [PHONE], covers: ['CloudSyncDialog', 'CloudSyncBadge', 'MobilePaneDialog'], act: (p) => phoneMenuItem(p, 'Cloud sync…') },
  { key: 'differences', label: 'OpenISD and WinISD differences', vp: [PHONE], covers: ['WinisdDifferencesModal'], act: (p) => phoneMenuItem(p, 'OpenISD and WinISD differences') },
  { key: 'diagnostics', label: 'Diagnostics', vp: [PHONE], covers: ['DiagnosticsModal'], act: (p) => phoneMenuItem(p, 'Diagnostics') },
  { key: 'about', label: 'About (splash on demand)', vp: [PHONE], covers: ['SplashModal'], act: (p) => phoneMenuItem(p, 'About OpenISD') },
  // A vented project: its box tab. Last, because the project stays vented.
  { key: 'tab-enclosure', label: 'Enclosure tab (vented box)', vp: BOTH, covers: ['MobileEnclosureTab', 'VentPortFields', 'OriginalShell'], act: async (p) => { await (p.viewportSize().width > 800 ? clickText(p, 'Box') : clickBtn(p, 'Box')); await makeVented(p); await (p.viewportSize().width > 800 ? clickText(p, 'Vented') : p.getByRole('button', { name: ENCLOSURE_TAB }).click(T)); await p.waitForTimeout(400); } },
  // A passive-radiator project: its box tab, the radiator browser and the save-to-library dialog.
  { key: 'tab-passive-radiator', label: 'Passive radiator tab', vp: BOTH, keep: true, covers: ['MobileEnclosureTab', 'OriginalShell'], act: async (p) => { await (p.viewportSize().width > 800 ? clickText(p, 'Box') : clickBtn(p, 'Box')); await p.locator('select:visible').filter({ hasText: 'Passive Radiator' }).first().selectOption('Passive Radiator'); await p.waitForTimeout(800); await (p.viewportSize().width > 800 ? clickText(p, 'Passive Radiator') : p.getByRole('button', { name: 'Passive Radiator', exact: true }).click(T)); await p.waitForTimeout(400); } },
  { key: 'pr-browser', label: 'Select passive radiator dialog', vp: BOTH, covers: ['PRBrowser'], act: async (p) => { await p.getByRole('button', { name: 'Select passive radiator' }).click(T); await p.waitForTimeout(500); } },
  { key: 'pr-save-to-library', label: 'Save passive radiator to library dialog', vp: BOTH, covers: ['SaveToLibraryDialog'], act: async (p) => { await p.getByTitle(/^Save a copy of this passive radiator/).click(T); await p.getByRole('dialog', { name: 'Save passive radiator to library' }).waitFor(T); } },
  // The wizard again, this time choosing a passive radiator: its own step, then the radiator browser inside it.
  { key: 'wizard-pr-step', label: 'New project, passive radiator step', vp: BOTH, keep: true, covers: ['NewProjectPassiveRadiatorStep', 'OriginalNewProject', 'MobileNewProject'], act: async (page) => {
      if (page.viewportSize().width > 800) await startWizard(page); else { await phoneMenuItem(page, 'New project'); await page.getByText('Step 1 of 5').waitFor(T); }
      // The type-help list opened on the Manage drivers screen is still open here; a click outside closes it, as a user does.
      if (await page.getByText('Driver Range Classifications').first().isVisible().catch(() => false)) { await page.mouse.click(3, 300); await page.waitForTimeout(300); }
      await pickDriver(page); await next(page); await next(page);
      await page.locator('select:visible').filter({ hasText: 'Passive Radiator' }).last().selectOption('Passive Radiator'); await page.waitForTimeout(400);
      await next(page);
      await page.getByRole('button', { name: 'Select passive radiator' }).last().waitFor(T);
    } },
  { key: 'wizard-pr-browser', label: 'New project, select passive radiator', vp: BOTH, covers: ['PRBrowser', 'NewProjectPassiveRadiatorStep'], act: async (page) => { await page.getByRole('button', { name: 'Select passive radiator' }).last().click(T); await page.waitForTimeout(500); } },
];

// Components that look like a dialog, tab or sheet and are deliberately not in the gallery. Each has the
// reason a user cannot reach it, or why one picture of it would add nothing.
export const EXCLUDED = {
  CrashScreen: 'Shown only after an uncaught error; a user has no way to cause one on purpose.',
  StoreGate: 'Shown only when the browser store cannot be read at start, which a user cannot cause on purpose.',
};

// Returns the app to its base screen between screens.
export async function reset(page) {
  for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  // Menus close only on an outside click, as a user does it.
  if (page.viewportSize().width > 800 && await page.getByText('About OpenISD', { exact: true }).first().isVisible().catch(() => false)) { await page.mouse.click(870, 19); await page.waitForTimeout(200); }
  if (await page.locator('[data-testid=app-version]').first().isVisible().catch(() => false)) { await page.mouse.click(Math.min(405, page.viewportSize().width - 6), 600); await page.waitForTimeout(300); }
  // An open chart list closes with the button that opened it.
  const picker = page.getByRole('button', { name: /▴$/ }).first();
  if (await picker.isVisible().catch(() => false)) { await picker.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(200); }
  // A pop-up that says what was done closes only with its button.
  const popup = page.getByRole('alertdialog').getByRole('button').first();
  if (await popup.isVisible().catch(() => false)) { await popup.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(200); }
  // The Save As / Export list closes on a click anywhere else.
  if (await page.getByText('Share Link to Project (http:)').first().isVisible().catch(() => false)) { await page.mouse.click(page.viewportSize().width > 800 ? 870 : 187, page.viewportSize().width > 800 ? 19 : 650); await page.waitForTimeout(200); }
  // Older builds close Diagnostics only with its Dismiss button.
  const close = page.getByRole('button', { name: /^(Close|Dismiss)$/ }).first();
  if (await close.isVisible().catch(() => false)) { await close.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(200); }
}
