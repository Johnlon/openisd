export interface Entry {
  stamp: string;
  /** The public number from the release title, "7.0.951"; '' when the title has none. */
  version: string;
  kind: 'release' | 'snap';
  tag: string;
  url: string;
  published: string;
  subject: string;
  latest: boolean;
}
export interface GithubRelease {
  tag_name?: string;
  prerelease?: boolean;
  draft?: boolean;
  name?: string | null;
  html_url?: string;
  published_at?: string;
  created_at?: string;
  body?: string | null;
}
export function publicVersionOf(title: string | null | undefined): string;
export function toBasic(iso: string): string;
export function subjectOf(body: string | null | undefined): string;
export function entryOf(release: GithubRelease, latestTag: string): Entry | null;
export function entriesOf(releases: readonly GithubRelease[], latestTag: string): Entry[];
export function parseNdjson(text: string): GithubRelease[];
export function pageHtml(kind: 'snap' | 'release', entries: readonly Entry[]): string;
export function writeSite(entries: readonly Entry[], outdir: string): void;
