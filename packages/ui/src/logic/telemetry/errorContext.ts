/**
 * Anonymous error context: screen, dialog, project count, box type, last user actions,
 * and device type.
 *
 * Carries no project data, no values, no names, and no driver/file data.
 */
import {
  MAX_ACTIONS,
  MAX_ACTIONS_TEXT,
  MAX_BOX,
  MAX_DEVICE,
  MAX_DIALOG,
  MAX_SCREEN,
  type AnonymousErrorContext,
} from './events.js';
import type {PresentationState} from '../presentationState.js';

export type ActionName =
  | 'tab:box'
  | 'tab:driver'
  | 'tab:enclosure'
  | 'tab:filters'
  | 'tab:signal'
  | 'tab:advanced'
  | 'tab:project'
  | 'tab:graph'
  | 'dialog:options'
  | 'dialog:driver-editor'
  | 'dialog:whatif'
  | 'dialog:new-project'
  | 'dialog:open-project'
  | 'dialog:projects'
  | 'dialog:driver-browser'
  | 'dialog:diagnostics'
  | 'dialog:splash'
  | 'dialog:winisd-differences'
  | 'dialog:cloud-sync'
  | 'pane:project'
  | 'pane:advanced'
  | 'pane:drivers'
  | 'pane:cloudSync'
  | 'open-project'
  | 'close-project'
  | 'new-project'
  | 'save-project'
  | 'save-all-projects'
  | 'whatif:open'
  | 'tune:open'
  | 'feature:export'
  | 'feature:import'
  | 'feature:share_link'
  | 'feature:save_file';

/** A ring buffer of the last user actions, oldest first. */
export class RecentActions {
  private readonly buffer: ActionName[] = [];

  constructor(private readonly capacity: number = MAX_ACTIONS) {}

  record(action: ActionName): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push(action);
  }

  snapshot(): readonly ActionName[] {
    return [...this.buffer];
  }

  text(): string {
    return this.buffer.join(',');
  }
}

export interface ErrorContextReaders {
  readonly screen: () => string;
  readonly dialog: () => string;
  readonly projects: () => number;
  readonly box: () => string;
  readonly actions: RecentActions;
  readonly device: () => string;
}

export class ErrorContext {
  constructor(private readonly readers: ErrorContextReaders) {}

  snapshot(): AnonymousErrorContext {
    const box = this.readers.box().trim();
    const dialog = this.readers.dialog().trim();
    const screen = this.readers.screen().trim();
    const device = this.readers.device().trim();
    return {
      screen: (screen === '' ? 'none' : screen).slice(0, MAX_SCREEN),
      dialog: (dialog === '' ? 'none' : dialog).slice(0, MAX_DIALOG),
      projects: Math.max(0, this.readers.projects()),
      box: (box === '' ? 'none' : box).slice(0, MAX_BOX),
      actions: this.readers.actions.text().slice(0, MAX_ACTIONS_TEXT),
      device: (device === '' ? 'other' : device).slice(0, MAX_DEVICE),
    };
  }
}

export function createErrorContextReaders(presentation: PresentationState): {
  readScreen: () => string;
  readDialog: () => string;
} {
  const readScreen = (): string => {
    const skin = presentation.ui.skinOverride ?? (presentation.narrowViewport ? 'mobile' : 'original');
    if (skin === 'mobile') {
      const dest = presentation.mobileDestination || 'box';
      return `mobile/${dest}`;
    }
    const tab = typeof presentation.ui.originalProjectTab === 'string' && presentation.ui.originalProjectTab !== ''
      ? presentation.ui.originalProjectTab
      : 'box';
    return `original/${tab}`;
  };

  const readDialog = (): string => {
    if (presentation.optionsOpen) return 'options';
    if (presentation.editDriverInfo) return 'driver-editor';
    if (presentation.editDriver) return 'whatif';
    if (presentation.newProjectOpen) return 'new-project';
    if (presentation.openDialogOpen) return 'open-project';
    if (presentation.browseOpen) return 'driver-browser';
    if (presentation.projectsPaneOpen) return 'projects';
    if (presentation.mobilePane !== null) return presentation.mobilePane;
    return 'none';
  };

  return {readScreen, readDialog};
}
