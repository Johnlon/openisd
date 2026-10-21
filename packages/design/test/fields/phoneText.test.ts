import {describe, expect, it} from 'vitest';
import {NumberField, PHONE_FILTER_CHIPS, KeyStripText, PhoneDriverListText, PhoneHelp, PhoneLabels, PhonePrBrowserText} from '../../fields/index.js';

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

  it('chamber rows use WinISD symbols', () => {
    expect(PhoneLabels.VB).toBe('Vb');
    expect(PhoneLabels.FB).toBe('Fb');
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
});
