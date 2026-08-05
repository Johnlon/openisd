// The driver file formats OpenISD reads and writes — a closed set, so a Java-style enum
// in the same shape as `driverType.ts`: the extension, the label the format picker shows,
// and the caveat that goes with it, all carried ON the member. No caller compares a bare
// `'wdr'` string, which would survive a value change and be invisible to rename.

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
