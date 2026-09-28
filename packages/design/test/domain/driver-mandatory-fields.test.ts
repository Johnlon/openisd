/**
 * `OpenISDDriver.fieldIsMandatoryAndUnsatisfied` — whether a field is one the driver still needs
 * and cannot derive. The driver editor and Tune both mark such a cell, and both ask the driver,
 * so neither can decide it differently from the other.
 *
 * It reads the `missing-dependencies` issues the driver already carries, and those name every
 * field they involve: the target, and whatever each blocked route requires or is still missing.
 * An `inconsistent-inputs` issue is NOT this — that is a contradiction between stated values,
 * not an absent one.
 */
import {describe, expect, it} from 'vitest';
import {Engine} from '@openisd/design/engine';
import {OpenISDDriver} from '../../domain/index.js';

/** A driver with no value stated at all: every derivable quantity is blocked on its inputs. */
function emptyDriver(): OpenISDDriver {
  const driver = OpenISDDriver.empty(new Engine());
  driver.resolve();
  return driver;
}

/** Qts is derivable from Qes and Qms. Stating only Qes leaves Qts blocked, naming Qms. */
function onlyQes(): OpenISDDriver {
  const driver = OpenISDDriver.empty(new Engine());
  driver.specs.Qes.set(0.4);
  driver.resolve();
  return driver;
}

describe('OpenISDDriver.fieldIsMandatoryAndUnsatisfied', () => {
  it('is false for a name no issue mentions', () => {
    expect(emptyDriver().fieldIsMandatoryAndUnsatisfied('not_a_field')).toBe(false);
  });

  it('is true for a target no route can reach', () => {
    expect(onlyQes().fieldIsMandatoryAndUnsatisfied('Qts')).toBe(true);
  });

  it('is true for the field a blocked route is still missing, not only the target', () => {
    expect(onlyQes().fieldIsMandatoryAndUnsatisfied('Qms')).toBe(true);
  });

  it('answers true for every field its own issues name, by the record key they use', () => {
    const blocked = emptyDriver();
    const named = new Set(blocked.issues()
      .filter(i => i.kind === 'missing-dependencies')
      .flatMap(i => [...i.fields]));
    // An empty driver blocks only the Q trio: any two of Qes/Qms/Qts give the third, so with
    // none stated all three are unreachable and each names the other two.
    expect([...named].sort()).toEqual(['Qes', 'Qms', 'Qts']);
    for (const name of named) {
      expect(blocked.fieldIsMandatoryAndUnsatisfied(name)).toBe(true);
    }
  });

  it('is false for a contradiction — inconsistent inputs are stated, not missing', () => {
    const driver = OpenISDDriver.empty(new Engine());
    driver.specs.Qes.set(7.5);
    driver.specs.Qms.set(18.2);
    driver.specs.Qts.set(0.39);
    driver.resolve();
    const kinds = new Set(driver.issues().map(i => i.kind));
    expect(kinds.has('inconsistent-inputs')).toBe(true);
    expect(driver.fieldIsMandatoryAndUnsatisfied('Qts')).toBe(false);
  });
});
