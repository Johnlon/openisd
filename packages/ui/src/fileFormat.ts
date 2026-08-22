/**
 * The file formats OpenISD reads and writes — DRIVER and PROJECT formats stay two distinct
 * models (QO67 ruling: "distinct pathways for project and driver... no not unified"), but the
 * code common to both — extension classification, the legacy-classic-WinISD test that gates
 * QO62's CP1252 fallback, MIME/label plumbing — lives together in this ONE file, so the set of
 * known extensions is written down once (QO67: "dedupe to the greatest extent").
 *
 * Each format is a Java-style enum in the same shape as `driverType.ts`: the extension, the
 * label the save picker shows, and the MIME type, all carried ON the member. No caller compares
 * a bare `'wdr'`/`'wpr'` string, which would survive a value change and be invisible to rename.
 */

export class DriverFileFormat {
  private constructor(
    /** File extension WITHOUT the dot — the serialised form, and the only thing that crosses a boundary. */
    readonly value: string,
    /** What the save picker calls it. */
    readonly label: string,
    /** MIME type for the system save dialog. MUST be a custom type: a generic one
     *  (`application/json`, `text/plain`) makes the picker offer every extension
     *  registered to it, inviting a filename the app will not read back. */
    readonly mime: string,
  ) {}

  static readonly Owdr = new DriverFileFormat('owdr', 'OpenISD driver', 'application/x-openisd-driver');
  static readonly Wdr  = new DriverFileFormat('wdr',  'WinISD driver',  'application/x-winisd-driver');

  /** Every member. Must stay LAST — static fields initialise in source order. */
  static readonly ALL: readonly DriverFileFormat[] =
    Object.values(DriverFileFormat).filter((v): v is DriverFileFormat => v instanceof DriverFileFormat);

  /** The one string→member boundary. An extension the enum does not declare is not a driver file. */
  static parse(extension: string | undefined | null): DriverFileFormat | null {
    const e = (extension ?? '').toLowerCase().replace(/^\./, '');
    return DriverFileFormat.ALL.find(f => f.value === e) ?? null;
  }

  /** The format a file name declares itself to be, by its extension. */
  static ofFileName(fileName: string): DriverFileFormat | null {
    const dot = fileName.lastIndexOf('.');
    return dot < 0 ? null : DriverFileFormat.parse(fileName.slice(dot + 1));
  }

  /** `.wdr, .owdr` — the `accept` attribute of every driver file input. */
  static get ACCEPT(): string {
    return DriverFileFormat.ALL.map(f => '.' + f.value).join(',');
  }

  /** The file name a driver saves to by default. */
  fileName(base: string): string { return `${base}.${this.value}`; }

  toString(): string { return this.value; }
  toJSON(): string { return this.value; }
}

/** The PROJECT formats — a distinct model from `DriverFileFormat` (QO67): `.wpr`/`.owpr` never
 *  appear in a driver save picker's `accept`, because they are not a member of that enum at all. */
export class ProjectFileFormat {
  private constructor(
    readonly value: string,
    readonly label: string,
    readonly mime: string,
  ) {}

  static readonly Owpr = new ProjectFileFormat('owpr', 'OpenISD project', 'application/x-openisd-project');
  static readonly Wpr  = new ProjectFileFormat('wpr',  'WinISD project',  'application/x-winisd-project');

  static readonly ALL: readonly ProjectFileFormat[] =
    Object.values(ProjectFileFormat).filter((v): v is ProjectFileFormat => v instanceof ProjectFileFormat);

  static parse(extension: string | undefined | null): ProjectFileFormat | null {
    const e = (extension ?? '').toLowerCase().replace(/^\./, '');
    return ProjectFileFormat.ALL.find(f => f.value === e) ?? null;
  }

  static ofFileName(fileName: string): ProjectFileFormat | null {
    const dot = fileName.lastIndexOf('.');
    return dot < 0 ? null : ProjectFileFormat.parse(fileName.slice(dot + 1));
  }

  static get ACCEPT(): string {
    return ProjectFileFormat.ALL.map(f => '.' + f.value).join(',');
  }

  fileName(base: string): string { return `${base}.${this.value}`; }

  toString(): string { return this.value; }
  toJSON(): string { return this.value; }
}

/** Either format family — a driver file or a project file. This file's own `formatOf`/`sniff`
 *  return this; `decodeDriverFileBytes` (`driverFileText.ts`) takes it. */
export type FileFormat = DriverFileFormat | ProjectFileFormat;

/** `.wdr`/`.wpr` are the only formats classic (Windows-only) WinISD itself could have written,
 *  and so the only ones QO62's CP1252 fallback applies to — a member-equality check against
 *  the two format models' OWN enum values, so the set of legacy formats is written down once,
 *  here (QO67). Takes the FORMAT, already classified — `driverFileText.ts`'s
 *  `decodeDriverFileBytes` is this function's one caller, and it too takes a format rather
 *  than a filename. */
export function isLegacyWinisdFormat(format: FileFormat | undefined): boolean {
  return format === DriverFileFormat.Wdr || format === ProjectFileFormat.Wpr;
}

/** Which format a file NAME claims, across both families — or undefined when the extension
 *  is not one the app reads. */
export function formatOf(filename: string): FileFormat | undefined {
  return DriverFileFormat.ofFileName(filename) ?? ProjectFileFormat.ofFileName(filename) ?? undefined;
}

/** Which format the BYTES actually are, when the name does not say — domain-free content
 *  classification: INI section headers tell `.wdr` from `.wpr`; a JSON object with `specs`
 *  and no `box` is a driver record, any other JSON object is a project payload. Undefined
 *  for bytes that are not valid UTF-8 or match no known shape. */
export function sniff(bytes: Uint8Array): FileFormat | undefined {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return undefined; }
  const trimmed = text.trimStart();
  if (/^\[Driver\]/.test(trimmed) && !/\[Box\]/.test(trimmed)) return DriverFileFormat.Wdr;
  if (/\[Box\]/.test(trimmed)) return ProjectFileFormat.Wpr;
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && 'specs' in parsed && !('box' in parsed)) {
        return DriverFileFormat.Owdr;
      }
      return ProjectFileFormat.Owpr;
    } catch { return undefined; }
  }
  return undefined;
}
