import { ref } from 'vue';
import type { Cell, Field } from '@openisd/design';
import { createCell } from '@openisd/design';
import type { OgTuneAPI } from '../../src/hooks/OgTune-hooks.js';

/** A test-only `OgTuneAPI` whose fields all read a fixed dummy cell, for exercising the Tune
 *  panel's hook surface without a real driver. Lives with the tests, not in shipped source:
 *  the domain barrel exports `Field` as a type only (its class has private members), so a
 *  structural stand-in must assert the shape, and that assertion belongs in a test file. */
export function createMockOgTuneAPI(overrides?: Partial<OgTuneAPI>): OgTuneAPI {
  const dummyHandle = {
    get: () => createCell<number>('', 30, 'entered'),
    set: () => {},
    clear: () => {},
  } as unknown as Field<number>;
  return {
    ebp: ref(50),
    specField: () => dummyHandle,
    fieldCell: (): Cell<number> => createCell<number>('', 30, 'entered'),
    cellClass: () => 'cell-ok',
    cellVal: () => 30,
    dqNote: () => null,
    enterField: () => {},
    clearField: () => {},
    ...overrides,
  };
}