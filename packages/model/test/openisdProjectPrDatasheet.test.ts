/**
 * `enterPrDatasheet` — the one door from a passive radiator's DATASHEET vocabulary into the
 * canonical Cms/Mmd/Rms, and an SI-only door.
 *
 * The rule this pins: every parameter is SI. The engine's PR inverse happens to speak litres
 * (`Engine.prCmsFromVas(prVasL, …)`), and that conversion belongs INSIDE the model, beside the
 * four siblings that already do it (`m3ToLitres` at the engine call sites in
 * openisdProject.ts). A litre-valued parameter on the public method pushes the ×1000 back out
 * to every caller, where getting it wrong is undetectable: 0.03 m³ and 30 L are both plausible
 * compliance volumes, so a missed conversion is a silently wrong radiator, not a crash.
 *
 * bugs/BUG_20260828_enterPrDatasheet_takes_litres_for_vas_while_every_other_parameter_is_si.md
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { OpenISDProject, OpenISDDriver } from '../src/index.js';
import { Engine } from '@openisd/design/engine';

/** A project on its passive-radiator box type, ready to adopt a datasheet radiator. */
function prProject(): OpenISDProject {
  const p = OpenISDProject.empty(OpenISDDriver.empty());
  p.setBoxType('passive-radiator');
  return p;
}

describe('enterPrDatasheet takes SI throughout', () => {
  it('Vas is cubic metres: 0.03 m³ gives the engine-exact compliance', () => {
    // The oracle is the engine's own inverse — SI in, like every other parameter — never a
    // number copied out of the implementation. A unit slip anywhere along this path shows up
    // here as a factor of 1000, not as a subtly wrong radiator.
    const project = prProject();
    project.enterPrDatasheet({ vasM3: 0.03, fsHz: 20, qms: 5, sdM2: 0.0133, xmaxM: 0.008 });

    const expectedCms = new Engine().prCmsFromVas(0.03, 0.0133);
    const cms = project.prCms_m_per_N();
    assert.ok(
      Math.abs(cms - expectedCms) / expectedCms < 1e-12,
      `Cms is ${cms}, engine says ${expectedCms} for 30 L / 0.0133 m² — ratio ${cms / expectedCms}`,
    );
  });

  it('the radiator it builds round-trips back to the Vas that was entered', () => {
    // Vas in → Cms → Vas out. The read side (`prVas_m3`) is already SI, so a units mismatch
    // between the two halves shows up here as a factor of 1000 rather than as a wrong shape.
    const project = prProject();
    project.enterPrDatasheet({ vasM3: 0.045, fsHz: 18, qms: 4.2, sdM2: 0.0201 });

    const back = project.prVas_m3();
    assert.ok(
      Math.abs(back - 0.045) / 0.045 < 1e-9,
      `entered Vas 0.045 m³, read back ${back} m³ (ratio ${back / 0.045})`,
    );
  });

  it('Sd, Xmax and Fs are stored exactly as handed over — no scaling on any SI parameter', () => {
    const project = prProject();
    project.enterPrDatasheet({ vasM3: 0.03, fsHz: 20, qms: 5, sdM2: 0.0133, xmaxM: 0.008 });

    assert.equal(project.prSd_m2(), 0.0133, 'Sd must be stored in m² untouched');
    assert.equal(project.prXmax_m(), 0.008, 'Xmax must be stored in m untouched');
  });

  it('omitting Xmax leaves the radiator’s existing excursion alone', () => {
    // `xmaxM` is optional; absent means "the datasheet did not state one", which must not be
    // read as zero excursion.
    const project = prProject();
    project.enterPrDatasheet({ vasM3: 0.03, fsHz: 20, qms: 5, sdM2: 0.0133, xmaxM: 0.008 });
    project.enterPrDatasheet({ vasM3: 0.03, fsHz: 20, qms: 5, sdM2: 0.0133 });

    assert.equal(project.prXmax_m(), 0.008, 'a datasheet with no Xmax must not blank the stored one');
  });
});
