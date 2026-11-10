import type {Page} from '@playwright/test';
import {TABS, CHART_LABELS} from '@openisd/design/chart';
import {DesktopRoute, type DesktopSurface} from './desktopSurfaceManifest.js';

/** Real UI navigation only, on the desktop skin: opens one manifest entry in a page that already holds a project (the desktop twin of mobileSurfaceNavigation.ts). */
export async function openDesktopSurface(page: Page, surface: DesktopSurface): Promise<void> {
  const tab = async (label: string) => page.locator('.project-nav li').filter({hasText: new RegExp('^' + label + '$')}).click();
  const box = async (type: string) => { await tab('Box'); await page.locator('#og-box-type').selectOption(type); };
  const editor = async () => { await tab('Driver'); await page.locator('.driver-id-row').getByRole('button', {name: /^(✎ )?Edit$/}).click(); };
  switch (surface.route) {
    case DesktopRoute.Bin: await page.locator('.original-project-list .bin-toggle').click(); return;
    case DesktopRoute.ProjectActions: await page.locator('.original-project-list .project-row').first().click({button: 'right'}); return;
    case DesktopRoute.InfoMenu: await page.getByRole('button', {name: 'Info', exact: true}).click(); return;
    case DesktopRoute.Cloud:
      if (await page.locator('.cloud-sync-badge').count() === 0) throw new Error('VIEW UNAVAILABLE: cloud entry is not enabled in this build');
      await page.locator('.cloud-sync-badge').click(); return;
    case DesktopRoute.Chart: {
      const key = surface.parameter ?? 'SPL';
      await box(key.startsWith('PR') ? 'box-passive-radiator' : key.startsWith('Intra') ? 'abc' : key.startsWith('Front') ? 'bandpass6' : key.startsWith('Rear') ? 'vented' : 'sealed');
      await page.locator('.chart-select').click();
      const chart = TABS.find(candidate => candidate.id === key);
      if (chart === undefined) throw new Error('Unknown chart ' + key);
      await page.locator('.chart-item').getByText(CHART_LABELS[chart.id], {exact: true}).click(); return;
    }
    case DesktopRoute.ChartPicker: await page.locator('.chart-select').click(); return;
    case DesktopRoute.ChartData: await page.locator('.gdata').first().click(); return;
    case DesktopRoute.Box: await box(surface.box ?? 'sealed'); return;
    case DesktopRoute.Enclosure: {
      await box(surface.box ?? 'vented');
      const labels = (await page.locator('.project-nav li').allTextContents()).map(label => label.trim());
      const label = labels.find(candidate => !['Box', 'Driver', 'Filters', 'Signal', 'Advanced', 'Project'].includes(candidate));
      if (label === undefined) throw new Error('No enclosure tab');
      await tab(label); return;
    }
    case DesktopRoute.Losses:
      await box(surface.box ?? 'sealed');
      await page.locator('.tab-section.active .link-btn').filter({hasText: 'Advanced->'}).nth(surface.chamber === 'Front' ? 1 : 0).click(); return;
    case DesktopRoute.Tab: await tab(surface.parameter ?? 'Box'); return;
    case DesktopRoute.PRPicker: await box('box-passive-radiator'); await tab('Passive Radiator'); await page.getByRole('button', {name: 'Select passive radiator', exact: true}).click(); return;
    case DesktopRoute.PRSave: await box('box-passive-radiator'); await tab('Passive Radiator'); await page.getByRole('button', {name: 'Save to library', exact: true}).click(); return;
    case DesktopRoute.DataQuality:
      await box('box-passive-radiator'); await tab('Passive Radiator');
      await page.locator('#og-pr-vas').fill(''); await page.locator('#og-pr-vas').blur();
      await page.locator('.pr-controls .ui-field-dq-btn').first().click(); return;
    case DesktopRoute.DriverInfo: {
      await tab('Driver');
      const button = page.locator('.driver-id-row').getByRole('button', {name: 'Info', exact: true});
      if (await button.count() === 0) throw new Error('Current-driver Info is absent');
      await button.click(); return;
    }
    case DesktopRoute.EditorHelp: {
      await editor();
      const [editorTab, title] = (surface.parameter ?? '').split('|');
      await page.locator('.de-tabs').getByRole('button', {name: editorTab, exact: true}).click();
      const button = page.getByRole('button', {name: 'Help: ' + title, exact: true});
      if (await button.count() === 0) throw new Error('Editor help is absent');
      await button.click(); return;
    }
    case DesktopRoute.Editor: await editor(); await page.locator('.de-tabs').getByRole('button', {name: surface.parameter, exact: true}).click(); return;
    case DesktopRoute.Options: await page.getByRole('button', {name: 'Options', exact: true}).click(); await page.locator('.opt-tabs').getByRole('button', {name: surface.parameter, exact: true}).click(); return;
    case DesktopRoute.Info:
      await page.getByRole('button', {name: 'Info', exact: true}).click();
      if (await page.locator('.tb-menu .dropdown-menu.open').getByText(surface.parameter ?? '', {exact: true}).count() === 0) throw new Error('VIEW UNAVAILABLE: ' + surface.parameter + ' is absent in this build');
      await page.getByText(surface.parameter ?? '', {exact: true}).last().click(); return;
    case DesktopRoute.Library: await page.getByRole('button', {name: 'Manage Drivers', exact: true}).click(); return;
    case DesktopRoute.Picker: await tab('Driver'); await page.locator('.driver-id-row').getByRole('button', {name: /Select Driver/i}).click(); return;
    case DesktopRoute.WhatIf: await box(surface.box ?? 'sealed'); await page.getByRole('button', {name: /What-if/}).click(); return;
    case DesktopRoute.Filter: await tab('Filters'); await page.locator('.filters-quickadd').getByRole('button', {name: surface.parameter, exact: true}).click(); return;
    case DesktopRoute.Projects: case DesktopRoute.ProjectImport: return;
    case DesktopRoute.ProjectExport: await page.locator('#btnExportMenu').click(); return;
    case DesktopRoute.DriverImport: await editor(); return;
    case DesktopRoute.DriverExport: await editor(); await page.locator('.de-modal').getByRole('button', {name: 'Export', exact: true}).click(); return;
    case DesktopRoute.DriverSave: await editor(); await page.locator('.de-modal').getByRole('button', {name: /Copy to My Drivers/}).click(); return;
    case DesktopRoute.Wizard: {
      await page.getByRole('button', {name: 'New project', exact: true}).first().click();
      const step = Number(surface.parameter ?? 1);
      if (step === 1) return;
      await page.locator('.overlay.open input.filter').fill('Tang Band W5-1138SMF');
      await page.getByText('Tang Band W5-1138SMF', {exact: true}).first().click();
      const next = page.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true});
      await next.click();
      if (step === 2) return;
      await next.click();
      await page.locator('#np-box-type').selectOption(surface.box ?? 'sealed');
      if (step === 3) return;
      // A radiator project asks for the radiator before Next goes on; stop when the wanted step shows.
      const header = page.locator('.np-step').first();
      for (let guard = 0; guard < 6 && !(await header.innerText()).includes(`Step ${step} of`); guard++) {
        if (surface.box === 'box-passive-radiator' && await page.locator('#np-pr-select').count() > 0 && await next.isDisabled()) { await page.locator('#np-pr-select').click(); await page.locator('.pr-lib-name').first().click(); }
        if (!(await header.innerText()).includes(`Step ${step} of`)) await next.click();
      }
      return;
    }
  }
}
