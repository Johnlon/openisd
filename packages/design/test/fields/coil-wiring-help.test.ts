import {describe, expect, it} from 'vitest';
import {DesktopHelp, EnumField, PhoneHelp, PhoneHelpRows} from '../../fields/index.js';

/**
 * John, QO942.c58: "make sure help distinguish and make clear the role and effect". Both controls are labelled "Coil wiring":
 * the driver's `VCCon` (Driver editor) and the project's `VCCon` (Driver tab). Their help must differ and each must name its
 * role: the driver's says how the maker MEASURED the driver and changes no figure; the project's says how YOU wire the driver
 * in THIS project, what that changes in the calculation, and that the driver's own figures are never changed.
 */
describe('the two Coil wiring helps', () => {
  const driver = EnumField.VCCON.description;
  const project = EnumField.PROJECT_VCCON.description;

  it('are different texts under the same label', () => {
    expect(EnumField.VCCON.label).toBe('Coil wiring');
    expect(EnumField.PROJECT_VCCON.label).toBe('Coil wiring');
    expect(driver).not.toBe(project);
  });

  it('the driver\'s names the measuring and says it changes no figure and may stay Not stated', () => {
    expect(driver).toMatch(/when the maker measured this driver/);
    expect(driver).toMatch(/what the published Re and BL mean/);
    expect(driver).toMatch(/changes no figure/);
    expect(driver).toMatch(/Not stated/);
    expect(driver).not.toMatch(/in this project/);
  });

  it('the project\'s names this project, the effect on the calculations, the never-changed figures and when it is shown', () => {
    expect(project).toMatch(/[Hh]ow you wire this driver's voice coils in this project/);
    expect(project).toMatch(/the calculations use the figures for your wiring/);
    expect(project).toMatch(/Series gives Re, Le and nominal impedance ×4 and BL ×2 compared with Parallel; Fs, Q, Vas and Mms do not change/);
    expect(project).toMatch(/figures are never changed/);
    expect(project).toMatch(/can be changed only for a driver with 2 or more coils whose measured wiring is stated/);
    // The desktop shows it greyed for other drivers (rulings, QO942.c88-c90): the help never says it is shown only then.
    expect(project).not.toMatch(/Shown only/);
    expect(project).not.toMatch(/when the maker measured/);
  });

  it('the Driver tab help rows (phone and desktop) carry the project text, the editor help the driver text', () => {
    const body = (text: string) => text.slice(text.indexOf('\n') + 1);
    expect(PhoneHelpRows.COIL_WIRING.label).toBe('Coil wiring');
    expect(PhoneHelpRows.COIL_WIRING.text).toContain('how you wire this driver\'s voice coils in this project');
    expect(PhoneHelpRows.COIL_WIRING.text).toBe(body(project).charAt(0).toLowerCase() + body(project).slice(1));
    expect(PhoneHelp.DRIVER.rows).toContain(PhoneHelpRows.COIL_WIRING);
    expect(DesktopHelp.PLACEMENT.rows.map(r => r.label)).toContain('Coil wiring');
    expect(PhoneHelp.EDITOR_MISCELLANEOUS.rows.map(r => r.text).join(' ')).toContain('how the voice coils were wired when the maker measured this driver');
    expect(body(project).length).toBeGreaterThan(40);
  });
});

describe('the Driver wiring help (ticket 519)', () => {
  it('the ? sheets (phone and desktop) carry the approved registry text, word for word', () => {
    const body = EnumField.PROJECT_DRIVERWIRING.description.slice(EnumField.PROJECT_DRIVERWIRING.description.indexOf('\n') + 1);
    expect(PhoneHelpRows.DRIVER_WIRING.text.toLowerCase()).toBe(body.toLowerCase());
    expect(PhoneHelp.DRIVER.rows).toContain(PhoneHelpRows.DRIVER_WIRING);
    expect(DesktopHelp.PLACEMENT.rows).toContain(PhoneHelpRows.DRIVER_WIRING);
  });
});
