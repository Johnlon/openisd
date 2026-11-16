import {describe, expect, it} from 'vitest';
import {DesktopHelp, DesktopLabels, EnumField, PhoneHelpRows, PhoneLabels} from '../../fields/index.js';

/**
 * John, QO943.c4: "the WinISD field is called Connection ... so reuse of Connection for a different concept is problematic."
 * In OpenISD the words "Connection" and "Voice coil connection" mean only WinISD's concept, the coil wiring of one driver.
 * Several drivers are not wired together (QO941), so no label, tooltip or help text may say so.
 */
describe('the word Connection', () => {
  it('is no label of the number-of-drivers or placement controls and no help row about wiring the drivers', () => {
    expect('CONNECTION' in PhoneLabels).toBe(false);
    expect('CONNECTION' in PhoneHelpRows).toBe(false);
    expect(JSON.stringify(DesktopHelp.PLACEMENT)).not.toMatch(/connection/i);
    expect(JSON.stringify(DesktopHelp.PLACEMENT)).not.toMatch(/drivers are wired|wiring of (the|several) drivers/i);
  });

  it('the one field called Coil wiring or Voice coil connection is the driver\'s coil wiring, never the wiring of several drivers', () => {
    expect(DesktopLabels.VOICE_COIL_CONNECTION).toBe('Voice coil connection');
    expect(EnumField.VCCON.description).toMatch(/voice coils were wired when the maker measured this driver/);
    expect(EnumField.VCCON.description).not.toMatch(/several drivers|Num\. of drivers/);
  });
});
