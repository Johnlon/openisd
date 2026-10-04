import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone, ProjectBuilder, VoiceCoilWiring} from '../../domain/index.js';
import {fixedAppContext, ignoredIssue, wooferOf} from '../fixtures/domainBuilders.js';

describe('OpenISDProject new-project defaults', () => {
  describe('a new project, every section present and nothing stated', () => {
    // QO125 (John, 2026-09-08): "The data structure in emptyProject(eng) calls emptyDriver(eng)
    // and empty pr(eng) and then UI proceeds to fill it out in the wizard screens including
    // picking a real driver to repopulate the embedded driver section from and if it's a pr box
    // then the pr gets repopulated from a picked pr."
    //
    // So a new project invents no physics. Every section EXISTS — the wizard writes into a live
    // project rather than assembling a spec and building at the end — and every stated value is
    // one the user supplied.

    it('builds without a driver, since the wizard picks one afterwards', () => {
      const p = ProjectBuilder.empty(createEngine());
      expect(p.driver.brand.value).toBe('');
      expect(p.driver.specs.Fs_hz.value).toBe(null);
    });

    it('starts sealed, the box type the wizard opens on', () => {
      expect(ProjectBuilder.empty(createEngine()).box.boxType.value).toBe('sealed');
    });

    it('holds a radiator already, so a switch to a PR box is legal with no further setup', () => {
      const p = ProjectBuilder.empty(createEngine());
      // Writing a radiator spec field is what throws when the slot is null, so it is the test
      // that a radiator is genuinely present rather than merely reported as one.
      p.box.passiveRadiator.radiator.spec.Fs_hz.set(12);
      expect(p.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(12);
    });

    it('states no radiator parameters of its own', () => {
      const p = ProjectBuilder.empty(createEngine());
      expect(p.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(null);
      expect(p.box.passiveRadiator.systemTuning_hz.value).toBeNull();
    });

    it('gives each new project its own records, so editing one leaves the next untouched', () => {
      const engine = createEngine();
      const one = ProjectBuilder.empty(engine);
      const two = ProjectBuilder.empty(engine);
      one.driver.model.set('RS225');
      expect(two.driver.model.value).toBe('');
    });

    it('stamps created/modified from the injected AppContext, and creator from the platform user, including the embedded driver', () => {
      const appContext = fixedAppContext('id', '2026-03-04T00:00:00.000Z', 'johnl');
      const p = ProjectBuilder.empty(createEngine(), appContext);

      expect(p.created.value).toBe('20260304');
      expect(p.modified.value).toBe('20260304');
      expect(p.creator.value).toBe('johnl');
      expect(p.driver.added.value).toBe('20260304');
      expect(p.driver.providedBy.value).toBe('johnl');
    });

    it('leaves creator blank when the platform user is not known', () => {
      const p = ProjectBuilder.empty(createEngine(), fixedAppContext('id', '2026-03-04T00:00:00.000Z', null));
      expect(p.creator.value).toBe('');
    });

    it('accepts a real driver afterwards, which is how the wizard fills it in', () => {
      const p = ProjectBuilder.empty(createEngine());
      const picked = OpenISDDriver.empty(createEngine());
      picked.brand.set('Dayton');
      picked.model.set('RS225');
      p.setDriver(picked);
      expect(p.driver.brand.value).toBe('Dayton');
    });

    it('accepts a real radiator afterwards, which is how the wizard fills a PR box in', () => {
      const p = ProjectBuilder.empty(createEngine());
      const picked = OpenISDPassiveRadiatorStandalone.empty();
      picked.model.set('SB23PACS');
      p.box.passiveRadiator.configurePR(picked);
      expect(p.box.passiveRadiator.radiator.model.value).toBe('SB23PACS');
    });
  });

  describe("a blank device reports WinISD's own defaults without stating them", () => {
    // John, 2026-09-08: "use the existing WinIsd default values - but some of these are functions
    // like calcVcCon() ... which isn't really a calc but plays that role if the VCCon isn't yet
    // stated". The default reads as CALCULATED, never entered — and since John's 2026-09-24
    // ruling ("simply no reason for these exceptions to the rule") the record carries it as a
    // real `'C'` entry, the same as every other derived quantity, instead of being conjured at
    // read time. See `bugs/archive/BUG_20260924_defaulted-fields-are-neither-marked-nor-recorded.md`.

    it('reads the default wiring as calculated, not as something the user entered', () => {
      const blank = OpenISDDriver.empty(createEngine());
      const wiring = blank.specs.VCCon;
      expect(wiring.value).toBe(VoiceCoilWiring.Parallel);
      expect(wiring.calculated).toBe(true);
    });

    it('reads the default coil count the same way', () => {
      const numVC = OpenISDDriver.empty(createEngine()).specs.numVC;
      expect(numVC.value).toBe(1);
      expect(numVC.calculated).toBe(true);
    });

    it('a field with no WinISD default stays genuinely unstated', () => {
      // The defaults are specific facts, not a blanket "fill everything in" — SPEC_ENGINE.md:424
      // says "Defaults are 0, except numVC=1, VCCon=1", and Fs is not among the exceptions.
      expect(OpenISDDriver.empty(createEngine()).specs.Fs_hz.value).toBe(null);
    });

    it('VCCon is entry-backed: the calcVCCon() default is STORED as a calculated entry, not read-time', () => {
      const blank = OpenISDDriver.empty(createEngine());
      expect(wooferOf(blank.cloneDriver())?.VCCon).toMatchObject({ state: 'C', value: 1 });
      expect(blank.specs.VCCon.value).toBe(VoiceCoilWiring.Parallel);
      expect(blank.specs.VCCon.calculated).toBe(true);
      expect(blank.specs.VCCon.entered).toBe(false);
    });

    it('numVC is entry-backed: the calcNumVC() default is STORED as a calculated entry, not read-time', () => {
      const blank = OpenISDDriver.empty(createEngine());
      expect(wooferOf(blank.cloneDriver())?.numVC).toMatchObject({ state: 'C', value: 1 });
      expect(blank.specs.numVC.value).toBe(1);
      expect(blank.specs.numVC.calculated).toBe(true);
      expect(blank.specs.numVC.entered).toBe(false);
    });

    it('an entered numVC is stored as an E entry, and clearing it restores the stored C default', () => {
      const d = OpenISDDriver.empty(createEngine());
      d.specs.numVC.set(4);
      expect(wooferOf(d.cloneDriver())?.numVC).toMatchObject({ state: 'E', value: 4 });
      expect(d.specs.numVC.entered).toBe(true);

      d.specs.numVC.clear();
      expect(wooferOf(d.cloneDriver())?.numVC).toMatchObject({ state: 'C', value: 1 });
      expect(d.specs.numVC.value).toBe(1);
      expect(d.specs.numVC.calculated).toBe(true);
    });

    it('solverParams adapts VCCon to the plain series/parallel wiring Engine.sweep()/maxCurves() take, both ways', () => {
      const blank = OpenISDDriver.empty(createEngine());
      expect(blank.specs.solverParams().wiring.value).toBe('parallel');

      blank.specs.VCCon.set(VoiceCoilWiring.Series);
      expect(blank.specs.solverParams().wiring.value).toBe('series');
    });

    it('solverParams\' adapted Re_terminal_ohm/BL_terminal_Tm/wiring slots silently discard any write — ' +
      'nothing persists a value neither a resolve nor the domain has a slot for', () => {
      const blank = OpenISDDriver.empty(createEngine());
      const params = blank.specs.solverParams();

      // `wiring` is a `SolverInput`: read only, no write for a solve to reach.
      expect('setCalculated' in params.wiring).toBe(false);
      expect(params.wiring.value).toBe('parallel');

      expect(() => params.Re_terminal_ohm.setCalculated(8, [ignoredIssue('ignored')])).not.toThrow();
      expect(() => params.BL_terminal_Tm.setNotAvailable()).not.toThrow();
    });
  });
});
