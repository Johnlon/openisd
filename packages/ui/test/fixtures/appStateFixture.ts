/**
 * A fresh `AppState` and `PresentationState` for one test, built the way `main.ts` builds them:
 * one engine reading the application settings from an in-memory repo. Call it in `beforeEach`;
 * nothing is shared between tests or files.
 */
import {createEngine} from '@openisd/design/engine';
import {type AppSettingsRepo, createMemoryStorage, type ListableStorage} from '@openisd/persistence';
import {type AppState, createAppState} from '../../src/logic/appState.js';
import {createPresentationState, type PresentationState} from '../../src/logic/presentationState.js';
import {appSettingsRepoOn} from './repoOn.js';
import type {Telemetry} from '../../src/logic/telemetry/telemetry.js';

export interface AppStateFixture {
  readonly appState: AppState;
  readonly presentation: PresentationState;
  readonly appSettings: AppSettingsRepo;
}

/** `storage` is where the application settings live; pass one to start from settings already written. */
export function createAppStateFixture(storage: ListableStorage = createMemoryStorage(), telemetry?: Telemetry, reportFault?: (fault: Error) => void): AppStateFixture {
  const appSettings = appSettingsRepoOn(storage);
  const engine = createEngine({
    ventedLimits: () => appSettings.ventedLimits(),
    envDefaults: () => appSettings.envDefaults(),
  });
  const presentation = createPresentationState();
  const appState = createAppState({engine, appSettings, presentation, telemetry, reportFault});
  return {appState, presentation, appSettings};
}
