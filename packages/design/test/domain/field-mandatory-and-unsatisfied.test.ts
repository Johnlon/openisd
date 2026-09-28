/**
 * `Readable.mandatoryAndUnsatisfied` — whether the driver still needs this field and cannot
 * derive it. The driver editor and Tune both mark such a cell, and both ask the cell, so neither
 * can decide it differently from the other.
 *
 * It reads the `missing-dependencies` issues already on the field's own `dq`, which
 * `projectFormulaDq` put there: an issue names every field it involves — the target, and
 * whatever each blocked route requires or is still missing. An `inconsistent-inputs` issue is
 * NOT this — that is a contradiction between stated values, not an absent one.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDDriver} from '../../domain/index.js';

/** A driver with no value stated at all: every derivable quantity is blocked on its inputs. */
function emptyDriver(): OpenISDDriver {
  const driver = OpenISDDriver.empty(createEngine());
  driver.resolve();
  return driver;
}

/** Qts is derivable from Qes and Qms. Stating only Qes leaves Qts blocked, naming Qms. */
function onlyQes(): OpenISDDriver {
  const driver = OpenISDDriver.empty(createEngine());
  driver.specs.Qes.set(0.4);
  driver.resolve();
  return driver;
}

describe('a field says whether it is mandatory and unsatisfied', () => {
  it('is false for a field no issue mentions', () => {
    expect(emptyDriver().specs.Fs_hz.mandatoryAndUnsatisfied).toBe(false);
  });

  it('is true for a target no route can reach', () => {
    expect(onlyQes().specs.Qts.mandatoryAndUnsatisfied).toBe(true);
  });

  it('is true for the field a blocked route is still missing, not only the target', () => {
    expect(onlyQes().specs.Qms.mandatoryAndUnsatisfied).toBe(true);
  });

  it('agrees with the issues the driver carries, field for field', () => {
    const blocked = emptyDriver();
    const named = new Set(blocked.issues()
      .filter(i => i.kind === 'missing-dependencies')
      .flatMap(i => [...i.fields]));
    // An empty driver blocks only the Q trio: any two of Qes/Qms/Qts give the third, so with
    // none stated all three are unreachable and each names the other two.
    expect([...named].sort()).toEqual(['Qes', 'Qms', 'Qts']);
    expect(blocked.specs.Qes.mandatoryAndUnsatisfied).toBe(true);
    expect(blocked.specs.Qms.mandatoryAndUnsatisfied).toBe(true);
    expect(blocked.specs.Qts.mandatoryAndUnsatisfied).toBe(true);
  });

  it('is false for a contradiction — inconsistent inputs are stated, not missing', () => {
    const driver = OpenISDDriver.empty(createEngine());
    driver.specs.Qes.set(7.5);
    driver.specs.Qms.set(18.2);
    driver.specs.Qts.set(0.39);
    driver.resolve();
    const kinds = new Set(driver.issues().map(i => i.kind));
    expect(kinds.has('inconsistent-inputs')).toBe(true);
    expect(driver.specs.Qts.mandatoryAndUnsatisfied).toBe(false);
  });
});
