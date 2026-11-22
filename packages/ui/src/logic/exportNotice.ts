import {exportedNotice, type ExportedFile} from '@openisd/design/fields';
import type {ConfirmPort} from './confirmPort.js';

/** The one place an export says what it did: a popup with the design's text and an OK button. */
export interface ExportNotice {
  exported(what: ExportedFile, fileName: string): void;
}

export function createExportNotice(confirm: ConfirmPort): ExportNotice {
  return {
    exported(what, fileName) {
      const notice = exportedNotice(what, fileName);
      void confirm.ask({title: notice.title, message: notice.message, confirmLabel: notice.okLabel});
    },
  };
}
