import {describe, expect, it} from 'vitest';
import {KeyStripText, NumberField, PHONE_FILTER_CHIPS, PhoneDriverListText, PhoneBoxText, PhoneEditorText, PhoneHelp, PhoneLabels, PhonePrBrowserText, ToggleField, WinisdDeviation, WinisdDifference} from '../../fields/index.js';

describe('phone text', () => {
  it('the key strip says Entered, Calculated, Not Available', () => {
    expect([KeyStripText.ENTERED, KeyStripText.CALCULATED, KeyStripText.NOT_AVAILABLE]).toEqual(['Entered', 'Calculated', 'Not Available']);
  });

  it('the sealed rear chamber help names Vb, Fsc and Qtc, the vented one does not name Qtc', () => {
    const sealed = PhoneHelp.rearChamber('sealed').rows.map(r => r.label).join('|');
    const vented = PhoneHelp.rearChamber('vented').rows.map(r => r.label).join('|');
    expect(sealed).toContain('Qtc');
    expect(sealed).toContain('Fsc');
    expect(vented).not.toContain('Qtc');
    expect(vented).toContain('Vb');
  });

  it('every help line for a symbol row opens with the letters read out', () => {
    for (const row of PhoneHelp.rearChamber('sealed').rows.slice(0, 3)) expect(row.label).toMatch(/^[A-Z][a-z]+ \(/);
  });

  it('every driver editor section band has a one-line help for its ?', () => {
    const bands = [PhoneHelp.EDITOR_THIELE_SMALL, PhoneHelp.EDITOR_ELECTRO_MECHANICAL, PhoneHelp.EDITOR_LARGE_SIGNAL, PhoneHelp.EDITOR_MISCELLANEOUS,
      PhoneHelp.EDITOR_THERMAL, PhoneHelp.EDITOR_FIGURE_OF_MERIT, PhoneHelp.EDITOR_ENVIRONMENT, PhoneHelp.EDITOR_DIMENSIONS];
    for (const band of bands) {
      expect(band.title).not.toBe('');
      expect(band.intro, band.title).toMatch(/\.$/);
    }
  });

  it('chamber rows use WinISD symbols', () => {
    expect(PhoneLabels.VB).toBe('Vb');
    expect(PhoneLabels.FB).toBe('Fb');
  });

  it('uses concise labels for the passive-radiator added-mass rows', () => {
    expect(PhoneLabels.PR_ADDED_MASS).toBe('Added mass');
    expect(PhoneLabels.PR_FPR_MASS).toBe('Fpr with mass');
  });

  it('the Box page words match the accepted mock', () => {
    expect(PhoneLabels.PR_FP).toBe('Fp');
    expect(PhoneBoxText.CHOOSE_ALIGNMENT_LINK).toBe('Choose alignment…');
    expect(PhoneBoxText.BOX_LOSSES_LINK).toBe('Box losses (Qa, Ql, Qp)…');
    expect(PhoneBoxText.FP_TIP).toBe('Fp: the box tuning you enter for the passive radiator box. The Fh row shows the natural tuning of the box and radiator with no added mass.');
    expect(PhoneBoxText.INTRA_VENT_NOTE).toBe('Connects chambers; not open to outside');
  });

  it('every filter chip has a help sheet that says what the filter does', () => {
    expect(PHONE_FILTER_CHIPS).toHaveLength(10);
    for (const chip of PHONE_FILTER_CHIPS) {
      const help = PhoneHelp.filter(chip.type);
      expect(help.intro, chip.short).not.toBe('');
      expect(help.rows[0].label, chip.short).toBe('Tick');
    }
  });

  it('filter frequencies are shown in whole hertz', () => {
    expect(NumberField.PHONE_FILTER_FC_HZ.format(31.5)).toBe('32');
    expect(NumberField.PHONE_FILTER_FC_HZ.format(100)).toBe('100');
    expect(NumberField.FILTER_FC_HZ.format(31.5), 'the desktop keeps its decimals').not.toBe('32');
  });

  it('the Filters button counts the filters that are on and flips when open', () => {
    expect(PhoneDriverListText.filtersButton(false, 0)).toBe('Filters ▾');
    expect(PhoneDriverListText.filtersButton(false, 2)).toBe('Filters (2) ▾');
    expect(PhoneDriverListText.filtersButton(true, 1)).toBe('Hide filters (1) ▴');
  });

  it('the passive radiator specs line names Sd, Mms and Cms', () => {
    expect(PhonePrBrowserText.specsLine('128 cm²', '30.0 g', '0.85 mm/N')).toBe('Sd = 128 cm² · Mms = 30.0 g · Cms = 0.85 mm/N');
  });

  it('the driver list help sections are headed Search and Drivers', () => {
    expect([PhoneHelp.DRIVER_SEARCH.title, PhoneHelp.DRIVER_LIST_PICK.title, PhoneHelp.DRIVER_LIST_MANAGE.title]).toEqual(['Search', 'Drivers', 'Drivers']);
  });

  it('the Advanced bands are Environment, Simulation options, Enable WinISD-style and Enable WinISD bugs', () => {
    expect(PhoneHelp.ADVANCED_SECTIONS.map(s => s.title)).toEqual(['Environment', 'Simulation options', 'Enable WinISD-style', 'Enable WinISD bugs']);
  });

  it('every line of the bug and style help links to its Differences entry', () => {
    for (const section of [PhoneHelp.ADVANCED_WINISD_BUGS, PhoneHelp.ADVANCED_WINISD_STYLE]) {
      for (const row of section.rows) expect(row.difference, `${section.title}: ${row.label}`).toBeInstanceOf(WinisdDifference);
    }
    const twoBl = PhoneHelp.ADVANCED_WINISD_BUGS.rows.find(r => r.label === ToggleField.ADV_WINISDDRIVERMODEL.label);
    expect(twoBl?.difference).toBe(WinisdDifference.forDeviation(WinisdDeviation.DRIVER_MODEL));
  });

  it('the transmission line option line links to the TL port entry', () => {
    const tl = PhoneHelp.ADVANCED_SIMULATION.rows.find(r => r.label === ToggleField.ADV_TLPORTMODEL.label);
    expect(tl?.difference).toBe(WinisdDifference.forDeviation(WinisdDeviation.TL_PORT_END_CORRECTION));
  });

  it('the disagree bar heading counts the values', () => {
    expect(PhoneEditorText.disagreeHeading(3)).toBe('3 values disagree');
    expect(PhoneEditorText.disagreeHeading(1)).toBe('1 value disagrees');
  });

  it('an inspector badge shows the label, the value to the field\'s precision and its unit', () => {
    expect(PhoneEditorText.valueBadge('Qes', 0.42)).toBe('Qes = 0.420');
    expect(PhoneEditorText.valueBadge('Fs_hz', 45)).toBe('Fs = 45.00 Hz');
    expect(PhoneEditorText.valueBadge('Fs_hz', null)).toBe('Fs');
    expect(PhoneEditorText.valueBadge('no_such_key', 1)).toBe('no_such_key');
  });

  it('the Driver tab has one Driver band over the driver count and wiring, its help names all four rows, and Key figures says tap to edit', () => {
    expect(PhoneHelp.DRIVER.title).toBe('Driver');
    expect(PhoneHelp.DRIVER.rows.map(r => r.label)).toEqual(['Select driver', 'Edit', 'Drivers', 'Connection']);
    expect(PhoneHelp.KEY_FIGURES.intro).toContain('Tap one to edit the driver.');
  });
});
