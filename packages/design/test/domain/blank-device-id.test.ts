import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {OpenISDPassiveRadiatorStandalone} from '../../domain/passiveRadiator/openISDPassiveRadiatorStandalone.js';
import {fixedAppContext} from '../fixtures/domainBuilders.js';

// A blank driver or radiator takes its id from the AppServices it is given (appContext.ts: `newUuid()` is never called around it), so a
// caller that fixes the context gets the same record every time: the sample projects the visual baselines are drawn from (T834).
describe('a blank device takes its id from the AppServices', () => {
  it('a blank driver', () => {
    expect(OpenISDDriver.empty(createEngine(), fixedAppContext('driver-id')).uuid()).toBe('driver-id');
  });

  it('a blank passive radiator', () => {
    expect(OpenISDPassiveRadiatorStandalone.empty(fixedAppContext('radiator-id')).uuid()).toBe('radiator-id');
  });
});
