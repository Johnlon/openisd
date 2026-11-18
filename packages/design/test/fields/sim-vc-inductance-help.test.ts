import {describe, expect, it} from 'vitest';
import {PhoneHelp, ToggleField} from '../../fields/index.js';

/**
 * Issue Johnlon/openisd#521: the help of "Simulate voice coil inductance" said that, off, Le is still in the impedance plot.
 * WinISD (winisd_research/archive/GHIDRA_FINDINGS.md, "VCInd"): the impedance routine 0x45e740 adds jωLe only when VCInd is set, and
 * CLe in the acoustic circuit is 0 unless VCInd is set. Off, Le is in neither; on, it is in both. OpenISD's default circuit
 * model does the same (`circuit.ts`, `ZcoilForZel`).
 */
describe('"Simulate voice coil inductance" help', () => {
  const help = ToggleField.ADV_SIMVCINDUCTANCE.description;

  it('says ticked puts Le in the impedance and the sound output', () => {
    expect(help).toMatch(/Ticked: .*Le.* impedance .* SPL/s);
  });

  it('says unticked leaves Le out of both, as WinISD does', () => {
    expect(help).toMatch(/Unticked \(default\): .*Le is left out of the impedance and of the SPL/s);
    expect(help).not.toMatch(/not just the impedance plot/);
  });

  it('the phone help row says the same: off leaves Le out of both', () => {
    const row = PhoneHelp.ADVANCED_SECTIONS.flatMap(section => section.rows).find(r => r.label === ToggleField.ADV_SIMVCINDUCTANCE.label);
    expect(row?.text).toMatch(/Off, Le is left out of both, as WinISD does/);
  });
});
