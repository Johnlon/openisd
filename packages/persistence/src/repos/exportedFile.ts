/** SERVICE: the layout stamp on an exported file (`.owpr`, `.owdr`). A file gains
 *  `"layout": <N>` as its first field when it is written, and is migrated stepwise from that
 *  layout when it is read; a file with no stamp is layout 1. The file's other fields are exactly
 *  what the domain wrote. */
import {createLayoutMigrator, type FileJson, type LayoutRules} from './layoutMigration.js';

export type OpenedFile =
  | {readonly kind: 'ok'; readonly text: string}
  /** Written by an OpenISD whose layout is newer than this one reads. */
  | {readonly kind: 'newer'; readonly layout: number; readonly reads: number};

export interface ExportedFiles {
  /** `text` (a JSON object) with `layout` first. Text that is not a JSON object is returned as it is. */
  stamp(text: string): string;
  /** `text` brought to the layout this build reads, with the stamp taken off. */
  open(text: string): OpenedFile;
}

function parseObject(text: string): FileJson | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;
}

/** The indent `text` was written with, so the stamp does not reformat the file. */
function indentOf(text: string): number | undefined {
  const m = /^\{\r?\n( +)"/.exec(text);
  return m === null ? undefined : m[1].length;
}

export function createExportedFiles(rules: LayoutRules): ExportedFiles {
  const migrator = createLayoutMigrator(rules);
  return {
    stamp(text) {
      const file = parseObject(text);
      if (file === null) return text;
      const rest = Object.entries(file).filter(([field]) => field !== 'layout');
      return JSON.stringify({layout: rules.layout, ...Object.fromEntries(rest)}, null, indentOf(text));
    },
    open(text) {
      const file = parseObject(text);
      if (file === null) return {kind: 'ok', text};
      const {layout, ...rest} = file;
      const from = layout === undefined ? 1 : typeof layout === 'number' && Number.isInteger(layout) && layout >= 1 ? layout : null;
      if (from === null) return {kind: 'ok', text};
      if (from > rules.layout) return {kind: 'newer', layout: from, reads: rules.layout};
      const migrated = migrator.migrateFile(rest, from);
      return {kind: 'ok', text: JSON.stringify(migrated ?? rest, null, indentOf(text))};
    },
  };
}
