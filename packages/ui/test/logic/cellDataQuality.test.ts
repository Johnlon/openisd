import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {dqOfCell, dqReason} from '../../src/logic/cellDataQuality.js';

function createCompleteProject() {
  const engine = createEngine();
  const project = ProjectBuilder.empty(engine);
  project.driver.specs.Fs_hz.set(40);
  project.driver.specs.Qts.set(0.38);
  project.driver.specs.Qes.set(0.45);
  project.driver.specs.Vas_m3.set(0.03);
  project.box.sealed.volume_m3.set(0.012);
  return {engine, project};
}

describe('cellDataQuality', () => {
  describe('dqOfCell — a field that is entered or absent, never calculated', () => {
    it('E while a value is entered, N once cleared; dq passes through', () => {
      const {project} = createCompleteProject();
      const width = project.box.vented.vent.width_m;
      width.set(0.05);
      expect(dqOfCell(width)).toEqual({dq: [], dqState: 'E'});

      width.clear();
      expect(dqOfCell(width)).toEqual({dq: [], dqState: 'N'});
    });
  });

  describe('dqOfCell — a field only a solver writes, never entered', () => {
    it('N while an input is missing, C once solved', () => {
      const engine = createEngine();
      const blank = ProjectBuilder.empty(engine);
      expect(dqOfCell(blank.box.sealed.resonance_hz)).toEqual({dq: [], dqState: 'N'});

      const {project} = createCompleteProject();
      expect(dqOfCell(project.box.sealed.resonance_hz)).toEqual({dq: [], dqState: 'C'});
    });
  });

  describe('dqOfCell — the readout for drive power P and drive voltage V', () => {
    it('pre: Re none — P N, V 1 C | trigger: Re 8 | post: P 1 E, V √8 C', () => {
      const {project} = createCompleteProject();
      expect(dqOfCell(project.powerDrive_W).dqState).toBe('N');
      expect(dqOfCell(project.powerDrive_W).dq[0]).toMatch(/Re_ohm/);
      expect(dqOfCell(project.driveVoltage_V)).toEqual({dq: [], dqState: 'C'});

      project.driver.specs.Re_ohm.set(8);
      expect(dqOfCell(project.powerDrive_W)).toEqual({dq: [], dqState: 'E'});
      expect(dqOfCell(project.driveVoltage_V)).toEqual({dq: [], dqState: 'C'});
    });
  });

  // The sentence a field's ⚠ opens (UIField). It renders the cell's own `.dq` and never judges
  // the value itself: a bad value (≤ 0) is the DOMAIN's mark (BUG_20260927_driver-bad-value-decided-in-ui).
  describe('dqReason', () => {
    const engine = createEngine();

    it("names an entered value as one in conflict, with the domain's own invalid-value mark", () => {
      const mark = engine.issues.positiveValueIssue(0);
      if (mark === null) throw new Error('0 must carry the domain\'s invalid-value mark');
      expect(dqReason({dq: [mark.text], dqState: 'E'})).toBe(`Conflicts with other values: ${mark.text}`);
    });

    it('names a calculated value as derived from flagged values', () => {
      const text = engine.issues.targetUnreachable('Fs_hz', 35).text;
      expect(dqReason({dq: [text], dqState: 'C'})).toBe(`Calculated from flagged values: ${text}`);
    });

    it('joins several marks and is empty when there are none', () => {
      expect(dqReason({dq: ['a', 'b'], dqState: 'N'})).toBe('a; b');
      expect(dqReason({dq: [], dqState: 'E'})).toBe('');
    });
  });
});
