/** The build stamp: which build of the app wrote the store, `v20260101T0102Z` (minute
 *  resolution, UTC). Informational — only the storage layout decides whether a build can read
 *  the store. */
const STAMP = /^v(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(?:\d{2})?Z$/;

export class BuildStamp {
  private constructor(readonly text: string) {}

  /** A dev server or test build: it has no published stamp. */
  static readonly DEV = new BuildStamp('vdev');
  /** A store written before stamps existed (layout 1). */
  static readonly UNKNOWN = new BuildStamp('vunknown');

  /** The stamp of a baked build version (`v20260101T010203Z` or `v20260101T0102Z`), cut to the
   *  minute; null when `text` is not one. */
  static parse(text: string): BuildStamp | null {
    const m = STAMP.exec(text);
    return m === null ? null : new BuildStamp(`v${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}Z`);
  }

  /** The stamp a store records, or UNKNOWN when it records none (or one that is not a stamp). */
  static ofStored(text: string | null): BuildStamp {
    if (text === null) return BuildStamp.UNKNOWN;
    if (text === BuildStamp.DEV.text) return BuildStamp.DEV;
    return BuildStamp.parse(text) ?? BuildStamp.UNKNOWN;
  }
}

/** The stamp of the running build: its baked version, or DEV when there is none. */
export function createBuildStamp(baked: string): BuildStamp {
  return BuildStamp.parse(baked) ?? BuildStamp.DEV;
}
