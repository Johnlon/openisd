/** What an export tells the user once the file has been handed over. */
export type ExportedFile =
  | {readonly kind: 'projects'; readonly count: number}
  | {readonly kind: 'myDrivers'}
  | {readonly kind: 'brokenDriver'}
  | {readonly kind: 'everything'}
  | {readonly kind: 'storageLog'};

export interface ExportedNotice {
  readonly title: string;
  readonly message: string;
  readonly okLabel: string;
}

const OK = 'OK';

/** The popup after an export: what was exported and the file name, e.g.
 *  "Exported 12 projects to openisd-projects-2026-10-17.json." */
export function exportedNotice(what: ExportedFile, fileName: string): ExportedNotice {
  switch (what.kind) {
    case 'projects':
      return {title: 'Projects exported', message: `Exported ${what.count} ${what.count === 1 ? 'project' : 'projects'} to ${fileName}.`, okLabel: OK};
    case 'myDrivers':
      return {title: 'Saved drivers exported', message: `Exported your saved drivers, as they are stored, to ${fileName}.`, okLabel: OK};
    case 'brokenDriver':
      return {title: 'Driver entry exported', message: `Exported the damaged driver entry to ${fileName}.`, okLabel: OK};
    case 'everything':
      return {title: 'Everything exported', message: `Exported everything this browser holds for OpenISD to ${fileName}.`, okLabel: OK};
    case 'storageLog':
      return {title: 'Storage log exported', message: `Exported the storage log to ${fileName}.`, okLabel: OK};
  }
}
