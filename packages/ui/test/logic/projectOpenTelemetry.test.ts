import {describe, expect, it, vi} from 'vitest';
import {OpenISDDriver} from '@openisd/design';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import type {Telemetry} from '../../src/logic/telemetry/telemetry.js';

function telemetrySpy() {
  return {record: vi.fn(), flush: vi.fn()} satisfies Telemetry;
}

describe('project-open telemetry', () => {
  it('records the bundled driver identity with the same project-open event', () => {
    const telemetry = telemetrySpy();
    const {appState} = createAppStateFixture(undefined, telemetry);
    const driver = OpenISDDriver.empty(appState.engine);
    driver.providedBy.set('OpenIsd');
    driver.brand.set('Dayton Audio');
    driver.model.set('RS225P-8');

    const project = appState.createProject(driver, builder => builder.sealed(), () => {});

    expect(telemetry.record).toHaveBeenCalledWith({
      kind: 'project_open', source: 'wizard', box: 'sealed',
      driverId: project.driver.uuid(), driverName: 'Dayton Audio RS225P-8',
    });
  });

  it('does not send a user-owned driver name or id', () => {
    const telemetry = telemetrySpy();
    const {appState} = createAppStateFixture(undefined, telemetry);
    const driver = OpenISDDriver.empty(appState.engine);
    driver.providedBy.set('My Drivers');
    driver.brand.set('Private brand');
    driver.model.set('Private model');

    appState.createProject(driver, builder => builder.sealed(), () => {});

    expect(telemetry.record).toHaveBeenCalledWith({kind: 'project_open', source: 'wizard', box: 'sealed'});
  });
});
