/**
 * A printed "EBP" is not always the quantity OpenISD's EBP field means (John, 14 Nov 2026, QO903 R5, QO923).
 *
 * OpenISD's EBP is Fs/Qes, the efficiency-bandwidth product, calculated from Fs and Qes. Purifi's
 * product pages print an "EBP" that equals Fs/Qts instead (30 of 30 stored Purifi records within 1%,
 * 0 of 30 within 1% of Fs/Qes; winisd_tools/reports/dq/DQ_purifi_20261115.md). FaitalPRO prints Fs/Qes.
 * So the bridge does not enter Purifi's printed EBP as the field's value: the field is left open, the
 * app calculates it from Fs and Qes (marked calculated), and the printed reading stays in driver.json.
 *
 * Every expected number is worked out by hand from the printed figures, with the page they come from.
 */
import {describe, expect, it} from 'vitest';
import type {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {printedRecord as recordOf, projectPrinted, type Printed} from '../fixtures/printedRecord.js';

const project = (text: string) => ({driver: projectPrinted(text)});
const ebpIssues = (d: OpenISDDriver) => d.issues().filter(i => i.kind === 'inconsistent-inputs' && i.target === 'EBP_hz');

// Purifi PTT5.25M04-NAA-05, https://purifi-audio.com/shop/ptt5-25m04-naa-05-ptt5-25m04-naa-05-3055 prints
// Fs 39 Hz, Qes 0.25, Qts 0.24, EBP 162.5 Hz.   Fs/Qts = 39/0.24 = 162.5 (the printed EBP); Fs/Qes = 39/0.25 = 156.
const PTT5: Record<string, Printed> = {
  Fs_hz: {text: '39Hz', value: 39, precision: 0.5}, Qes: {text: '0.25', value: 0.25, precision: 0.005},
  Qts: {text: '0.24', value: 0.24, precision: 0.005}, EBP_hz: {text: '162.5Hz', value: 162.5, precision: 0.05},
};
// Purifi PTT10.0X04-NAB-01, https://purifi-audio.com/shop/ptt10-0x04-nab-01-ptt10-0x04-nab-01-2043 prints
// Fs 24 Hz, Qes 0.35, Qts 0.33, EBP 72.7 Hz.   Fs/Qts = 72.727; Fs/Qes = 24/0.35 = 68.571.
const PTT10: Record<string, Printed> = {
  Fs_hz: {text: '24Hz', value: 24, precision: 0.5}, Qes: {text: '0.35', value: 0.35, precision: 0.005},
  Qts: {text: '0.33', value: 0.33, precision: 0.005}, EBP_hz: {text: '72.7Hz', value: 72.7, precision: 0.05},
};

describe('a maker whose printed EBP is Fs/Qts (Purifi)', () => {
  it.each([
    ['PTT5.25M04-NAA-05', PTT5, 156],
    ['PTT10.0X04-NAB-01', PTT10, 24 / 0.35],
  ])('%s: EBP is calculated Fs/Qes, not the printed figure, and raises no warning', (_name, specs, fsOverQes) => {
    const {driver} = project(recordOf('Purifi', specs));
    expect(driver.specs.EBP_hz.entered).toBe(false);
    expect(driver.specs.EBP_hz.calculated).toBe(true);
    expect(driver.specs.EBP_hz.value).toBeCloseTo(fsOverQes, 9);
    expect(ebpIssues(driver)).toEqual([]);
  });

  it('the box-type suitability follows the calculated EBP (156 Hz is above 100: vented), exactly as before', () => {
    expect(project(recordOf('Purifi', PTT5)).driver.ebpSuitability()).toBe('vented');
  });

  it('the maker is read from the manufacturer, whatever case it is written in', () => {
    expect(project(recordOf('PURIFI', PTT5)).driver.specs.EBP_hz.calculated).toBe(true);
  });
});

describe('every other maker keeps its printed EBP and the check on it', () => {
  it('FaitalPRO 12FH510-8 prints Fs 45 Hz, Qes 0.25, EBP 180 Hz (= 45/0.25): entered, no warning', () => {
    const faital: Record<string, Printed> = {
      Fs_hz: {text: '45 Hz', value: 45, precision: 0.5}, Qes: {text: '0.25', value: 0.25, precision: 0.005},
      EBP_hz: {text: '180 Hz', value: 180, precision: 0.5},
    };
    const {driver} = project(recordOf('FaitalPRO', faital));
    expect(driver.specs.EBP_hz.entered).toBe(true);
    expect(driver.specs.EBP_hz.value).toBe(180);
    expect(ebpIssues(driver)).toEqual([]);
  });

  it('the Purifi figures under another maker are still a true disagreement: 162.5 against Fs/Qes 156 (interval 151 to 161.2)', () => {
    const {driver} = project(recordOf('FaitalPRO', PTT5));
    expect(driver.specs.EBP_hz.entered).toBe(true);
    expect(ebpIssues(driver)).toHaveLength(1);
  });
});
