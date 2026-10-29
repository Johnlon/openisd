import {describe,it,expect} from 'vitest';
import {OpenISDDriver} from '@openisd/design';
import {testAppLogic} from '../hooks/testAppLogic.js';

describe('project driver information',()=>{
  it('clears information mode when another action closes the browser',()=>{
    const app=testAppLogic();
    app.appState.openProjectFromDriver(OpenISDDriver.empty(app.engine),'Info close');
    app.driverBrowsing.showProjectDriverInfo();
    expect(app.driverBrowsing.projectInfoOpen.value).toBe(true);
    app.presentation.browseOpen=false;
    expect(app.driverBrowsing.projectInfoOpen.value).toBe(false);
    expect(app.driverBrowsing.previewDriver.value).toBeNull();
  });
  it('previews the focused embedded driver without opening an editor or loading the catalogue',()=>{
    const app=testAppLogic();
    const driver=OpenISDDriver.empty(app.engine);
    driver.brand.set('Project');driver.model.set('Only');driver.specs.Fs_hz.set(37);
    app.appState.openProjectFromDriver(driver,'Info example');
    const project=app.appState.focusedProject();
    if(project===null)throw new Error('Expected open project');
    const embedded=project.driver;
    app.appState.markProjectSaved();
    expect(app.appState.isModified.value).toBe(false);
    app.driverBrowsing.showProjectDriverInfo();
    expect(app.presentation.browseOpen).toBe(true);
    expect(app.driverBrowsing.projectInfoOpen.value).toBe(true);
    // Domain accessors return views; compare driver identity, not wrapper identity.
    expect(app.driverBrowsing.previewDriver.value?.uuid()).toBe(embedded.uuid());
    expect(app.driverBrowsing.previewData.value?.name).toBe('Project Only');
    expect(app.presentation.editDriverInfo).toBe(false);
    expect(app.appState.isModified.value).toBe(false);
    expect(project.driver.uuid()).toBe(embedded.uuid());
    expect(project.driver.specs.Fs_hz.value).toBe(37);
    app.driverBrowsing.openedLibrary();
    expect(app.driverBrowsing.initialized.value).toBe(false);
    app.driverBrowsing.closeLibrary();
    expect(app.presentation.browseOpen).toBe(false);
    expect(app.driverBrowsing.projectInfoOpen.value).toBe(false);
    expect(app.driverBrowsing.previewDriver.value).toBeNull();
  });
});
