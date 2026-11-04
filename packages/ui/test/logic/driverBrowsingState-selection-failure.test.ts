import {describe,it,expect} from 'vitest';
import {OpenISDDriver} from '@openisd/design';
import {testAppLogic} from '../hooks/testAppLogic.js';
import {createDriverBrowsingState} from '../../src/logic/driverBrowsingState.js';
import type {DriverSelection, SelectionResult} from '../../src/logic/driverSelection.js';

describe('a failed driver selection',()=>{
  it('shows its message in the picker status line',async()=>{
    const app=testAppLogic();
    app.appState.openProjectFromDriver(OpenISDDriver.empty(app.engine),'Selection failure');
    const failing: DriverSelection={...app.selection,selectDriver:()=>Promise.resolve({ok:false,error:'Embedding failed'})};
    const browsing=createDriverBrowsingState({
      driverRepo:app.bundledDrivers,myDriverRepo:app.myDrivers,prefs:app.prefs,logging:app.logging,
      selection:failing,files:app.designFiles,confirmReset:app.confirmPort.port,exportNotice:{exported:()=>undefined},
      appState:app.appState,presentation:app.presentation,
    });
    await browsing.chooseDriver(OpenISDDriver.empty(app.engine));
    expect(browsing.statusMsg.value).toBe('Embedding failed');
    expect(browsing.statusErr.value).toBe(true);
  });
  it('a failed result always carries its message (checked by the compiler)',()=>{
    // Compiles only while the failed variant's `error` is a required string: an optional or
    // missing `error` makes `MessageRequired` resolve to `false` and this assignment fail to typecheck.
    type Failed = Extract<SelectionResult, {ok: false}>;
    type MessageRequired = undefined extends Failed['error'] ? false : Failed['error'] extends string ? true : false;
    const required: MessageRequired = true;
    expect(required).toBe(true);
  });
});
