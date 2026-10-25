/**
 * The public version number of a release: three numbers, "7.0.951" (John, 2026-10-15). WinISD's
 * latest is 0.7.0.950, so OpenISD's first release is 7.0.951 and each later public release adds 1
 * to the last part; the first two change only for a redesign. It lives in the GitHub release's
 * title, "OpenISD 7.0.951" (scripts/release.sh writes it), so a release promoted from a snapshot
 * keeps the snapshot's bytes. Test and snapshot builds have none and keep their stamps.
 */
export interface PublicVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

const NUMBER = /^(\d+)\.(\d+)\.(\d+)$/;
const TITLE = /^OpenISD (\d+\.\d+\.\d+)$/;

/** "7.0.951" as three numbers; null for anything else. */
export function parsePublicVersion(text: string): PublicVersion | null {
  const m = NUMBER.exec(text);
  if (m === null) return null;
  return {major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3])};
}

export function formatPublicVersion(v: PublicVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/** The title of a release with this number: "OpenISD 7.0.951". */
export function titleOfPublicVersion(v: PublicVersion): string {
  return `OpenISD ${formatPublicVersion(v)}`;
}

/** What About leads with: "OpenISD 7.0.951 · 15 Oct 2026"; without a number, "OpenISD · 15 Oct 2026". */
export function runningHeading(version: string, day: string): string {
  return version === '' ? `OpenISD · ${day}` : `OpenISD ${version} · ${day}`;
}

/** The number in a release title, or null when the title carries none (a snapshot, an old release). */
export function publicVersionOfTitle(title: string): PublicVersion | null {
  const m = TITLE.exec(title);
  return m === null ? null : parsePublicVersion(m[1]);
}

/** Negative when `a` is the older number, positive when newer, 0 when equal. */
export function comparePublicVersion(a: PublicVersion, b: PublicVersion): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}
