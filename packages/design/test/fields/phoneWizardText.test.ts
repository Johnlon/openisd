import {describe, expect, it} from 'vitest';
import {PhoneWizardHelp, PhoneWizardText} from '../../fields/index.js';

describe('phone wizard text', () => {
  it('the EBP badge follows the engine thresholds in the mock\'s words', () => {
    expect(PhoneWizardText.ebpBadge('sealed')).toEqual({label: 'Sealed', tone: 'sealed'});
    expect(PhoneWizardText.ebpBadge('vented')).toEqual({label: 'Vented', tone: 'vented'});
    expect(PhoneWizardText.ebpBadge('either')).toEqual({label: 'Sealed or vented', tone: 'either'});
    expect(PhoneWizardText.ebpBadge(null)).toBeNull();
  });

  it('the banner lines read as the mock: figures, EBP, box and driver count', () => {
    expect(PhoneWizardText.driverFigures(['Fs: 45 Hz', 'Qts: 0.49', 'Vas: 4.85 L'])).toBe('Fs 45 Hz · Qts 0.49 · Vas 4.85 L');
    expect(PhoneWizardText.ebpLine('84.9', PhoneWizardText.ebpBadge('either'))).toBe('EBP 84.9 · Sealed or vented');
    expect(PhoneWizardText.ebpLine('84.9', null)).toBe('EBP 84.9');
    expect(PhoneWizardText.boxAndDrivers('Vented', 1)).toBe('Vented · 1 driver');
    expect(PhoneWizardText.boxAndDrivers('Vented', 2)).toBe('Vented · 2 drivers');
  });

  it('the footer buttons read Cancel, ◀ Back, Next ▸ and Create Project', () => {
    expect([PhoneWizardText.CANCEL, PhoneWizardText.BACK, PhoneWizardText.NEXT, PhoneWizardText.CREATE]).toEqual(['Cancel', '◀ Back', 'Next ▸', 'Create Project']);
  });

  it('the ⓘ popups carry the driver\'s EBP and say Iso-Barik is not modelled', () => {
    expect(PhoneWizardText.ebpInfo('84.9').note).toBe('Your driver: EBP 84.9.');
    expect(PhoneWizardText.PLACEMENT_INFO.note).toContain('not modelled');
  });

  it('each box type has its own details help; bandpass 4 has no rear tuning line', () => {
    const labels = (type: Parameters<typeof PhoneWizardHelp.boxDetails>[0]) => PhoneWizardHelp.boxDetails(type).map(s => `${s.title}:${s.rows.map(r => r.label).join(',')}`);
    expect(labels('sealed')[1]).toContain('Box resonance');
    expect(labels('vented')[0]).toContain('Tuning frequency');
    expect(labels('box-passive-radiator')[1]).toContain('Xmax');
    expect(labels('bandpass4')[0]).toBe('Rear Chamber:Volume');
    expect(labels('abc')[0]).toBe('Rear Chamber:Volume,Tuning');
  });
});
