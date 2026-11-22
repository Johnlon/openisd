import {describe, expect, it} from 'vitest';
import {
  createErrorContextReaders,
  ErrorContext,
  RecentActions,
  type ActionName,
} from '../../../src/logic/telemetry/errorContext.js';
import {fieldsOf, type ErrorEvent, type ReportEvent} from '../../../src/logic/telemetry/events.js';
import {createPresentationState} from '../../../src/logic/presentationState.js';

describe('RecentActions ring buffer', () => {
  it('keeps the last 10, in order', () => {
    const recent = new RecentActions();
    const actions: ActionName[] = [
      'tab:box',
      'tab:driver',
      'tab:enclosure',
      'tab:filters',
      'tab:signal',
      'tab:advanced',
      'tab:project',
      'dialog:options',
      'close-project',
      'open-project',
      'save-project',
      'new-project',
    ];
    for (const a of actions) {
      recent.record(a);
    }
    expect(recent.snapshot()).toHaveLength(10);
    expect(recent.snapshot()).toEqual(actions.slice(2));
    expect(recent.text()).toBe(actions.slice(2).join(','));
  });
});

describe('ErrorContext', () => {
  it('with no project gives box none and projects 0', () => {
    const context = new ErrorContext({
      screen: () => 'original/box',
      dialog: () => 'none',
      projects: () => 0,
      box: () => '',
      actions: new RecentActions(),
      device: () => 'linux',
    });
    const snapshot = context.snapshot();
    expect(snapshot.box).toBe('none');
    expect(snapshot.projects).toBe(0);
    expect(snapshot.dialog).toBe('none');
    expect(snapshot.screen).toBe('original/box');
    expect(snapshot.device).toBe('linux');
    expect(snapshot.actions).toBe('');
  });

  it('no field carries a project name', () => {
    const recent = new RecentActions();
    recent.record('tab:box');
    recent.record('dialog:options');
    recent.record('close-project');

    // Feed a project whose name is "SECRET"
    const secretProject = {
      name: 'SECRET',
      boxType: 'vented',
    };
    const context = new ErrorContext({
      screen: () => 'original/enclosure',
      dialog: () => 'none',
      projects: () => 1,
      box: () => secretProject.boxType,
      actions: recent,
      device: () => 'android',
    });
    const snapshot = context.snapshot();

    for (const [key, value] of Object.entries(snapshot)) {
      expect(String(value), `Field ${key} must not contain secret project name`).not.toContain('SECRET');
    }
  });
});

describe('createErrorContextReaders', () => {
  it('reads screen as raw id with no label mapping on original skin', () => {
    const presentation = createPresentationState();
    presentation.narrowViewport = false;
    const {readScreen} = createErrorContextReaders(presentation);

    expect(readScreen()).toBe('original/box');

    presentation.ui.originalProjectTab = 'enclosure';
    expect(readScreen()).toBe('original/enclosure');

    presentation.ui.originalProjectTab = 'filters';
    expect(readScreen()).toBe('original/filters');
  });

  it('reads screen as mobile/<destination> on mobile skin', () => {
    const presentation = createPresentationState();
    presentation.narrowViewport = true;
    const {readScreen} = createErrorContextReaders(presentation);

    expect(readScreen()).toBe('mobile/box');

    presentation.mobileDestination = 'graph';
    expect(readScreen()).toBe('mobile/graph');
  });

  it('reads dialog according to open state, reporting projects when projectsPaneOpen', () => {
    const presentation = createPresentationState();
    const {readDialog} = createErrorContextReaders(presentation);

    expect(readDialog()).toBe('none');

    presentation.optionsOpen = true;
    expect(readDialog()).toBe('options');
    presentation.optionsOpen = false;

    presentation.projectsPaneOpen = true;
    expect(readDialog()).toBe('projects');
    presentation.projectsPaneOpen = false;

    presentation.openDialogOpen = true;
    expect(readDialog()).toBe('open-project');
    presentation.openDialogOpen = false;

    presentation.mobilePane = 'advanced';
    expect(readDialog()).toBe('advanced');
    presentation.mobilePane = null;

    expect(readDialog()).toBe('none');
  });
});

describe('fieldsOf for error and report', () => {
  it('carries every context field for error', () => {
    const errorEv: ErrorEvent = {
      kind: 'error',
      message: 'boom',
      frames: 'at f.js:1:1',
      box: 'vented',
      screen: 'original/enclosure',
      dialog: 'options',
      projects: 2,
      actions: 'tab:box,dialog:options,close-project',
      device: 'android',
    };
    const fields = fieldsOf(errorEv);
    expect(fields).toEqual({
      message: 'boom',
      frames: 'at f.js:1:1',
      box: 'vented',
      screen: 'original/enclosure',
      dialog: 'options',
      projects: 2,
      actions: 'tab:box,dialog:options,close-project',
      device: 'android',
    });
  });

  it('carries every context field and crash message for report', () => {
    const reportEv: ReportEvent = {
      kind: 'report',
      hash: 'abc123hash',
      message: 'boom',
      note: 'it crashed',
      contact: 'user@example.com',
      box: 'vented',
      screen: 'original/enclosure',
      dialog: 'options',
      projects: 2,
      actions: 'tab:box,dialog:options,close-project',
      device: 'android',
    };
    const fields = fieldsOf(reportEv);
    expect(fields).toEqual({
      hash: 'abc123hash',
      message: 'boom',
      note: 'it crashed',
      contact: 'user@example.com',
      box: 'vented',
      screen: 'original/enclosure',
      dialog: 'options',
      projects: 2,
      actions: 'tab:box,dialog:options,close-project',
      device: 'android',
    });
  });
});
