import type {Page} from '@playwright/test';
/** Types shared by the view-open module and its step tables (kept apart so the tables can use the reasons without a cycle). */
export enum WalkSkin {Phone = 'phone', Desktop = 'desktop'}
export const WALK_VIEWPORT: Readonly<Record<WalkSkin, {readonly width: number; readonly height: number}>> = {
  [WalkSkin.Phone]: {width: 374, height: 705},
  [WalkSkin.Desktop]: {width: 1440, height: 900},
};

/** Why a view has no open() step. A closed set: adding a reason is a decision, not a convenience. */
export enum NoOpenReason {
  BrowserOwned = 'browser-owned',
  CloudAccountNeeded = 'cloud-account-needed',
  FaultNeeded = 'fault-needed',
  SavedStateNeeded = 'saved-state-needed',
  RejectedInputNeeded = 'rejected-input-needed',
  OutsideApp = 'outside-app',
  IndexDisagrees = 'index-disagrees',
  StepNotWritten = 'step-not-written',
}
/** Each reason, in one short line. */
export const NO_OPEN_WHY: Readonly<Record<NoOpenReason, string>> = {
  [NoOpenReason.BrowserOwned]: 'The browser or the OS draws it, so the page cannot be measured.',
  [NoOpenReason.CloudAccountNeeded]: 'Cloud sync is off in the test build; the view needs a signed-in account.',
  [NoOpenReason.FaultNeeded]: 'Shows only after a runtime, startup or storage fault that a user cannot cause on purpose.',
  [NoOpenReason.SavedStateNeeded]: 'Needs saved data first (a backup, a broken saved driver, a new announcement, another tab).',
  [NoOpenReason.RejectedInputNeeded]: 'Shows only after the user enters a value the app rejects; the input script is not written.',
  [NoOpenReason.OutsideApp]: 'A static page outside the app, with its own check.',
  [NoOpenReason.IndexDisagrees]: 'The index lists a step the skin does not have (the wizard ends one step earlier); the index needs John\'s ruling to change.',
  [NoOpenReason.StepNotWritten]: 'A user can reach it; nobody has written the open step yet. The ceiling only goes down.',
};

export type ViewPlan =
  | {readonly kind: 'open'; readonly root: string; readonly open: (page: Page) => Promise<void>}
  | {readonly kind: 'reason'; readonly reason: NoOpenReason};
/** A step that opens a view from a page that already holds a project. */
export interface OpenStep {readonly root: string; readonly open: (page: Page) => Promise<void>}

