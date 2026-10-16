/**
 * `SheetMode` — Tune and Learn modes for the bottom sheet.
 *
 * Tune lines per box type follow PLAN_20261015_TUNE_SHEET.md §2 (compact paired layout).
 * Learn lines keep the educational one-field-per-row layout.
 * `rowSlots` reserves the larger line count so the sheet does not resize on mode switch.
 */
import {describe, expect, it} from 'vitest';
import type {BoxType} from '../../engine/types.js';
import {BOX_TYPE_OPTIONS} from '../../fields/options.js';
import {SheetField} from '../../fields/sheetField.js';
import {SheetMode} from '../../fields/sheetMode.js';

const TUNE_EXPECTED: Readonly<Record<BoxType, readonly (readonly SheetField[])[]>> = {
  'sealed': [
    [SheetField.BOX_VOLUME],
    [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
  ],
  'vented': [
    [SheetField.BOX_VOLUME],
    [SheetField.TUNING, SheetField.PORT_AREA],
    [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
  ],
  'box-passive-radiator': [
    [SheetField.BOX_VOLUME],
    [SheetField.PR_ADDED_MASS, SheetField.PR_COUNT],
    [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
  ],
  'bandpass4': [
    [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME],
    [SheetField.FRONT_TUNING, SheetField.PORT_AREA],
    [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
  ],
  'bandpass6': [
    [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME],
    [SheetField.REAR_TUNING],
    [SheetField.REAR_PORT_AREA, SheetField.FRONT_PORT_AREA],
    [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
  ],
  'abc': [
    [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME],
    [SheetField.REAR_TUNING],
    [SheetField.REAR_PORT_AREA, SheetField.FRONT_PORT_AREA],
    [SheetField.INTRA_PORT_AREA],
    [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
  ],
};

describe('SheetMode', () => {
  it('exposes TUNE, LEARN and ALL', () => {
    expect(SheetMode.ALL).toEqual([SheetMode.TUNE, SheetMode.LEARN]);
    expect(SheetMode.TUNE.label).toBe('Tune');
    expect(SheetMode.TUNE.edits).toBe('project');
    expect(SheetMode.LEARN.label).toBe('Learn');
    expect(SheetMode.LEARN.edits).toBe('whatIfLayer');
  });

  describe('Tune lines', () => {
    it.each(BOX_TYPE_OPTIONS.map(o => o.value))('matches the §2 table for a %s box', (type) => {
      expect(SheetMode.TUNE.lines(type)).toEqual(TUNE_EXPECTED[type]);
    });

    it('never has more than 2 fields on a line', () => {
      for (const o of BOX_TYPE_OPTIONS) {
        for (const line of SheetMode.TUNE.lines(o.value)) {
          expect(line.length).toBeGreaterThanOrEqual(1);
          expect(line.length).toBeLessThanOrEqual(2);
        }
      }
    });

    it('never contains DRIVER_FS, DRIVER_QTS or DRIVER_VAS', () => {
      const excluded = new Set([SheetField.DRIVER_FS, SheetField.DRIVER_QTS, SheetField.DRIVER_VAS]);
      for (const o of BOX_TYPE_OPTIONS) {
        for (const line of SheetMode.TUNE.lines(o.value)) {
          for (const field of line) {
            expect(excluded.has(field)).toBe(false);
          }
        }
      }
    });
  });

  describe('Learn lines', () => {
    it('has exactly one field per line, matching SheetField.forBox', () => {
      for (const o of BOX_TYPE_OPTIONS) {
        const lines = SheetMode.LEARN.lines(o.value);
        expect(lines.every(line => line.length === 1)).toBe(true);
        expect(lines.map(line => line[0])).toEqual(SheetField.forBox(o.value));
      }
    });
  });

  describe('rowSlots', () => {
    it('equals the Learn line count for every box type', () => {
      for (const o of BOX_TYPE_OPTIONS) {
        expect(SheetMode.rowSlots(o.value)).toBe(SheetMode.LEARN.lines(o.value).length);
      }
    });
  });

  describe('shortLabel', () => {
    it('gives every SheetField a non-empty shortLabel', () => {
      for (const f of SheetField.ALL) {
        expect(typeof f.shortLabel).toBe('string');
        expect(f.shortLabel.length).toBeGreaterThan(0);
      }
    });

    it('assigns the documented shortLabel to each member', () => {
      expect(SheetField.BOX_VOLUME.shortLabel).toBe('V');
      expect(SheetField.REAR_VOLUME.shortLabel).toBe('Vr');
      expect(SheetField.FRONT_VOLUME.shortLabel).toBe('Vf');
      expect(SheetField.TUNING.shortLabel).toBe('Fb');
      expect(SheetField.FRONT_TUNING.shortLabel).toBe('Ff');
      expect(SheetField.REAR_TUNING.shortLabel).toBe('Fr');
      expect(SheetField.PORT_AREA.shortLabel).toBe('Pp');
      expect(SheetField.REAR_PORT_AREA.shortLabel).toBe('Pr');
      expect(SheetField.FRONT_PORT_AREA.shortLabel).toBe('Pf');
      expect(SheetField.INTRA_PORT_AREA.shortLabel).toBe('Pi');
      expect(SheetField.PR_ADDED_MASS.shortLabel).toBe('Madd');
      expect(SheetField.PR_COUNT.shortLabel).toBe('Npr');
      expect(SheetField.INPUT_POWER.shortLabel).toBe('P');
      expect(SheetField.DRIVER_FS.shortLabel).toBe('Fs');
      expect(SheetField.DRIVER_QTS.shortLabel).toBe('Qts');
      expect(SheetField.DRIVER_VAS.shortLabel).toBe('Vas');
      expect(SheetField.DRIVER_COUNT.shortLabel).toBe('N');
    });
  });
});
