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

    appState.createProject(driver, builder => builder.sealed(), () => {});

    expect(telemetry.record).toHaveBeenCalledWith({
      kind: 'project_open', source: 'wizard', box: 'sealed',
      driverName: 'Dayton Audio RS225P-8',
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

  // John, 10 Nov 2026: "scan rest of app for missed telemetry".
  it('a copied project is counted as opened by copy', () => {
    const telemetry = telemetrySpy();
    const {appState} = createAppStateFixture(undefined, telemetry);
    appState.createProject(OpenISDDriver.empty(appState.engine), builder => builder.vented(), () => {});
    telemetry.record.mockClear();

    appState.duplicateFocusedProject('Copy of it');

    expect(telemetry.record).toHaveBeenCalledWith({kind: 'project_open', source: 'copy', box: 'vented'});
  });

  it('a project opened from a share link while the app runs is counted as a share', () => {
    const telemetry = telemetrySpy();
    const {appState} = createAppStateFixture(undefined, telemetry);
    appState.createProject(OpenISDDriver.empty(appState.engine), builder => builder.sealed(), () => {});
    const shared = appState.requireFocusedProject();
    telemetry.record.mockClear();

    appState.applyState({project: shared, view: appState.currentViewSnapshot()});

    expect(telemetry.record).toHaveBeenCalledWith({kind: 'project_open', source: 'share', box: 'sealed'});
  });
});
