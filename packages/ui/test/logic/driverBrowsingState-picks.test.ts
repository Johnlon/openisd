import {describe, it, expect, vi} from 'vitest';
import {OpenISDDriverStandalone} from '@openisd/design';
import {testAppLogic} from '../hooks/testAppLogic.js';
import {createDriverBrowsingState} from '../../src/logic/driverBrowsingState.js';

/** BUG_20261110_new-project-wizard-driver-not-counted-in-stats: a driver chosen for a new project is a pick. */
describe('a driver chosen in the library for a new project is counted as a pick', () => {
  function browsingWith(driverPicked: (d: OpenISDDriverStandalone) => void) {
    const app = testAppLogic();
    const browsing = createDriverBrowsingState({
      driverRepo: app.bundledDrivers, myDriverRepo: app.myDrivers, prefs: app.prefs, logging: app.logging,
      selection: app.selection, files: app.designFiles, confirmReset: app.confirmPort.port, exportNotice: {exported: () => undefined},
      appState: app.appState, presentation: app.presentation, driverPicked,
    });
    return {app, browsing};
  }

  it('inside the New Project wizard', async () => {
    const driverPicked = vi.fn<(d: OpenISDDriverStandalone) => void>();
    const {app, browsing} = browsingWith(driverPicked);
    browsing.embedLibrary(() => undefined);
    const driver = OpenISDDriverStandalone.empty(app.engine);
    await browsing.chooseDriver(driver);
    expect(driverPicked).toHaveBeenCalledTimes(1);
    expect(driverPicked.mock.calls[0]?.[0].uuid()).toBe(driver.uuid());
  });

  it('with no project open, which starts the New Project wizard', async () => {
    const driverPicked = vi.fn<(d: OpenISDDriverStandalone) => void>();
    const {app, browsing} = browsingWith(driverPicked);
    await browsing.chooseDriver(OpenISDDriverStandalone.empty(app.engine));
    expect(app.presentation.newProjectOpen).toBe(true);
    expect(driverPicked).toHaveBeenCalledTimes(1);
  });
});
