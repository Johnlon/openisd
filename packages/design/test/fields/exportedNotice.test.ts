import {describe, expect, it} from 'vitest';
import {exportedNotice} from '../../fields/exportedNotice.js';

describe('exportedNotice', () => {
  it('says how many projects went to which file', () => {
    expect(exportedNotice({kind: 'projects', count: 12}, 'openisd-projects-2026-10-17.json'))
      .toEqual({title: 'Projects exported', message: 'Exported 12 projects to openisd-projects-2026-10-17.json.', okLabel: 'OK'});
    expect(exportedNotice({kind: 'projects', count: 1}, 'a.json').message).toBe('Exported 1 project to a.json.');
  });
  it('names the saved drivers, the damaged entry, everything and the storage log', () => {
    expect(exportedNotice({kind: 'myDrivers'}, 'my-drivers-export.json'))
      .toEqual({title: 'Saved drivers exported', message: 'Exported your saved drivers, as they are stored, to my-drivers-export.json.', okLabel: 'OK'});
    expect(exportedNotice({kind: 'brokenDriver'}, 'my-driver-3.json'))
      .toEqual({title: 'Driver entry exported', message: 'Exported the damaged driver entry to my-driver-3.json.', okLabel: 'OK'});
    expect(exportedNotice({kind: 'everything'}, 'openisd-everything-20261017T101500Z.json'))
      .toEqual({title: 'Everything exported', message: 'Exported everything this browser holds for OpenISD to openisd-everything-20261017T101500Z.json.', okLabel: 'OK'});
    expect(exportedNotice({kind: 'storageLog'}, 'openisd-storage-log-20261017T101500Z.json'))
      .toEqual({title: 'Storage log exported', message: 'Exported the storage log to openisd-storage-log-20261017T101500Z.json.', okLabel: 'OK'});
  });
});
