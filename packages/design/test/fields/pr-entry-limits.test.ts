/**
 * Passive-radiator entry bounds keep the limits the dialogs enforced before the registry owned
 * them. Each case quotes the bound the dialog itself enforced, in the unit that dialog
 * displayed, and converts it with the same registry the inputs now use. No bound may be LOOSER
 * than it was: a widened floor silently admits values the form used to refuse. That the dialog
 * binds these registry fields is checked in ui/test/architecture/pr-dialog-numinput-bounds.test.ts.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {NumberField, toSI, unitFor, type UnitGroup} from '../../fields/index.js';

const fromDisplay = (val: number, group: UnitGroup, token: string) => toSI(unitFor(group, token), val);

describe('PR entry limits', () => {
  it('Sd: at least 1 cm², at most 100000 cm²', () => {
    const band = NumberField.PR_SD_CM2.limits;
    assert.equal(band.max, fromDisplay(100000, 'area', 'cm2'), 'Sd ceiling moved off 100000 cm²');
    assert.ok(band.min >= fromDisplay(0.1, 'area', 'cm2'), 'Sd floor is looser than the 0.1 cm² the form enforced');
  });

  it('Xmax: 0 to 500 mm', () => {
    const band = NumberField.PR_XMAX_MM.limits;
    assert.equal(band.max, fromDisplay(500, 'length', 'mm'), 'Xmax ceiling moved off 500 mm');
    assert.equal(band.min, 0, 'Xmax floor moved off zero — an unexcursed PR is a legal entry');
  });

  it('Vas: at least 0.01 L, at most 100000 L', () => {
    const band = NumberField.PR_VAS_L.limits;
    assert.equal(band.max, fromDisplay(100000, 'volume', 'L'), 'Vas ceiling moved off 100000 L');
    assert.ok(band.min > 0, 'Vas floor is zero — a PR with no compliance volume is unphysical');
    assert.ok(band.min <= fromDisplay(0.01, 'volume', 'L'), 'Vas floor is tighter than the 0.01 L the form allowed');
  });

  it('Fs: at least 1 Hz, at most 1000 Hz', () => {
    const band = NumberField.PR_FS_HZ.limits;
    assert.equal(band.max, 1000, 'Fs ceiling moved off 1000 Hz');
    assert.ok(band.min >= 1, 'Fs floor is below the 1 Hz the form enforced — 0 Hz is not a resonance');
  });

  it('Qms: at least 0.1, at most 100', () => {
    const band = NumberField.PR_QMS.limits;
    assert.equal(band.max, 100, 'Qms ceiling moved off 100');
    assert.ok(band.min >= 0.1, 'Qms floor is below the 0.1 the form enforced — a Q of 0 is unphysical');
  });

  // John, 2026-10-01: "num PRs is a drop down 1-4".
  it('PR count: a 1 to 4 picker', () => {
    const band = NumberField.PR_NUM.limits;
    assert.equal(band.min, 1, 'a design with a PR has at least one');
    assert.equal(band.max, 4, 'PR count ceiling moved off 4');
    assert.deepEqual(NumberField.PR_NUM.countOptions().map(o => o.value), [1, 2, 3, 4]);
  });
});
