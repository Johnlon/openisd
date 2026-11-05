import {describe, expect, it} from 'vitest';
import {DesktopHelp, DesktopLabels, NumberField, PHONE_FILTER_CHIPS, PhoneHelp, PhoneHelpRows} from '../../fields/index.js';

const labels = (rows: readonly {label: string}[]): string[] => rows.map(r => r.label);

describe('desktop help', () => {
  it('every desktop section band has help for its ?', () => {
    const bands = [DesktopHelp.PLACEMENT, DesktopHelp.ADVANCED_OPTIONS, DesktopHelp.LISTENING_PLACE, DesktopHelp.SIGNAL_SOURCE, DesktopHelp.LIMITS];
    for (const band of bands) {
      expect(band.title).not.toBe('');
      expect(band.intro, band.title).toMatch(/\.$/);
      expect(band.rows.length, band.title).toBeGreaterThan(0);
    }
  });

  it('Placement and Signal source use the desktop captions with the phone words', () => {
    expect(labels(DesktopHelp.PLACEMENT.rows)).toEqual([DesktopLabels.NUM_DRIVERS, DesktopLabels.VOICE_COIL_CONNECTION]);
    expect(DesktopHelp.PLACEMENT.rows[0]?.text).toBe(PhoneHelpRows.DRIVERS.text);
    expect(labels(DesktopHelp.SIGNAL_SOURCE.rows)).toEqual([NumberField.SIGNAL_PIN_W.label, NumberField.SIGNAL_DRIVEV_V.label, NumberField.SIGNAL_RS_OHM.label]);
    expect(DesktopHelp.SIGNAL_SOURCE.rows.map(r => r.text)).toEqual(PhoneHelp.SIGNAL.rows.map(r => r.text));
  });

  it('Advanced options and Listening place name the rows by the field labels', () => {
    expect(labels(DesktopHelp.ADVANCED_OPTIONS.rows)).toEqual([NumberField.DRIVER_VCTEMPRISE_K.label, NumberField.DRIVER_ADDEDMASS_G.label, NumberField.ALFAVC_PER_K.label]);
    expect(labels(DesktopHelp.LISTENING_PLACE.rows)).toEqual([NumberField.SIGNAL_DISTANCE_M.label, DesktopLabels.ANGLE]);
  });

  it('the vented rear chamber also explains the tuning, under the tuning field\'s caption', () => {
    expect(labels(DesktopHelp.rearChamber('vented').rows)).toContain(NumberField.BOX_FB_HZ.label);
    expect(labels(DesktopHelp.rearChamber('sealed').rows)).toEqual([NumberField.BOX_VB_L.label, NumberField.BOX_FSC_HZ.label, NumberField.BOX_QTC_VALUE.label, DesktopLabels.ALIGNMENT, DesktopLabels.LOSSES_LINK]);
  });

  it('each vent band names its own tuning field', () => {
    expect(labels(DesktopHelp.ventSection('Vent').rows)[0]).toBe(NumberField.BOX_FB_HZ.label);
    expect(labels(DesktopHelp.ventSection('Front').rows)[0]).toBe(NumberField.BOX_FFC_HZ.label);
    expect(labels(DesktopHelp.ventSection('Rear').rows)[0]).toBe(NumberField.BOX_FRC_HZ.label);
    expect(labels(DesktopHelp.ventSection('Intra').rows)[0]).toBe(DesktopLabels.VENT_COUNT);
  });

  it('the Filters, Advanced and Project tabs each have a tab-level help', () => {
    expect(DesktopHelp.FILTERS_TAB.map(s => s.title)).toEqual(['Add filter']);
    expect(labels(DesktopHelp.FILTERS_TAB.flatMap(s => s.rows))).toEqual(PHONE_FILTER_CHIPS.map(c => DesktopLabels.addFilter(c)));
    expect(DesktopHelp.ADVANCED_TAB.map(s => s.title)).toEqual(PhoneHelp.ADVANCED_SECTIONS.map(s => s.title));
    expect(DesktopHelp.PROJECT_TAB.map(s => s.title)).toEqual(['Project details']);
  });
});
