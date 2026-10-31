import {describe, expect, it} from 'vitest';
import {computed, createApp, ref} from 'vue';
import {createCloudUiStore, createMemoryStorage} from '@openisd/persistence';
import {ProjectBuilder} from '@openisd/design';
import {APP_LOGIC} from '../../src/logic/app.js';
import {FOCUSED_PROJECT} from '../../src/logic/focusedProjectContext.js';
import {SplashModalKey} from '../../src/hooks/SplashModal-hooks.js';
import {provideCloudSync} from '../../src/hooks/CloudSync-hooks.js';
import {useMobileShell} from '../../src/hooks/MobileShell-hooks.js';
import {createConfirmPort} from '../../src/logic/confirmPort.js';
import {testAppLogic} from './testAppLogic.js';

describe('MobileShell-hooks revertProject', () => {
  it('keeps the menu open until the discard question is answered, then closes it', async () => {
    const confirmPort = createConfirmPort();
    let answer: (discard: boolean) => void = () => undefined;
    const asked = new Promise<boolean>(resolve => { answer = resolve; });
    const logic = testAppLogic({confirmPort: {port: {ask: () => asked}, state: confirmPort.state}});
    const project = ProjectBuilder.empty(logic.appState.engine);
    logic.appState.addProject(project);
    project.box.sealed.volume_m3.set(0.012);
    const app = createApp({render: () => null});
    app.provide(APP_LOGIC, logic);
    app.provide(FOCUSED_PROJECT, computed(() => project));
    app.provide(SplashModalKey, {
      open: computed(() => false), driverCount: ref(null), passiveRadiatorCount: ref(null), versions: ref(null),
      dismiss: () => undefined, show: () => undefined,
    });
    provideCloudSync(app, null, createCloudUiStore(createMemoryStorage()));
    const shell = app.runWithContext(() => useMobileShell());
    expect(shell.isModified.value).toBe(true);
    shell.toggleMenu();
    const reverting = shell.revertProject();
    expect(shell.menuOpen.value).toBe(true);
    answer(true);
    await reverting;
    expect(shell.menuOpen.value).toBe(false);
  });
});
