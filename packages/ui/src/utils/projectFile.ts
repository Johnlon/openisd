/**
 * Project name ↔ file name.
 *
 * The FILE NAME is the source of truth for a project's name. Opening `glob 3.openisd.json`
 * gives the project `glob 3`; saving the project `glob 3` writes `glob 3.openisd.json`. The
 * two are one string, so a user reading their file list is reading their project list.
 *
 * The only transformation on the way to disk is dropping characters a filename genuinely
 * cannot hold — `<>:"/\|?*`, control characters, and a leading/trailing dot or space (all
 * illegal on Windows). Spaces, apostrophes, dashes and interior dots are ordinary name
 * characters and are kept verbatim; anything stricter breaks the equivalence on everyday
 * names (the historic `[^\w.-]+ → _` rule silently turned `glob 3` into `glob_3`).
 */

/** The project file extension. A bare `.json` is also accepted on the way in. */
export const PROJECT_EXT = '.owpr';

/** Characters no Windows filename may contain (`/` is illegal on POSIX too). */
const ILLEGAL_IN_FILENAME = /[<>:"/\\|?*]/g;
/** Leading/trailing dots and spaces — legal in a project name, not in a Windows filename. */
const EDGE_DOTS_AND_SPACES = /^[.\s]+|[.\s]+$/g;

/** C0/DEL control characters, which no filename may hold. Matched by code point so the
 *  source carries no literal control character (and needs no lint suppression). */
function stripControls(s: string, replacement: string): string {
  return Array.from(s).map((ch) => {
    const cp = ch.codePointAt(0)!;
    return cp < 0x20 || cp === 0x7f ? replacement : ch;
  }).join('');
}

/** The project name a file of this name holds — the basename minus the project extension. */
export function projectNameFromFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? '';
  const lower = base.toLowerCase();
  if (lower.endsWith(PROJECT_EXT)) return base.slice(0, -PROJECT_EXT.length).trim();
  if (lower.endsWith('.json')) return base.slice(0, -'.json'.length).trim();
  return base.trim();
}

/** The file name a project of this name is saved as. */
export function projectFilename(name: string): string {
  const raw = name || '';
  // A name with NO filename-legal character at all (e.g. "///") has no meaningful file name,
  // so it falls back to "design" rather than to a row of underscores.
  const legalChars = stripControls(raw, '').replace(ILLEGAL_IN_FILENAME, '').replace(EDGE_DOTS_AND_SPACES, '');
  if (!legalChars) return 'design' + PROJECT_EXT;
  const safe = stripControls(raw, '_').replace(ILLEGAL_IN_FILENAME, '_').replace(EDGE_DOTS_AND_SPACES, '');
  return safe + PROJECT_EXT;
}

/** The name of a copy of this project. */
export function copyOfName(name: string): string {
  return 'Copy of ' + name;
}

/** `name`, or `name (2)`, `name (3)`… — the first form not already in `taken`. */
export function uniqueName(name: string, taken: readonly string[]): string {
  if (!taken.includes(name)) return name;
  let n = 2;
  while (taken.includes(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}
