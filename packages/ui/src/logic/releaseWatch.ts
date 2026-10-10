import {ref} from 'vue';

/** Minimal logging port — avoids direct console calls in logic. */
export interface Logger {
  log(message: string): void;
}

/** Where the app learns about newer builds and moves onto one. The browser implementation is
 *  `browserReleasePort.ts`; a test passes a fake. */
export interface ReleasePort {
  /** The version of the build currently published, or null when it cannot be read (offline). */
  latestVersion(): Promise<string | null>;
  /** Fetch the newest build and reload the page onto it. */
  reloadOntoLatest(): Promise<void>;
  /** Get the version the user has already reloaded onto in this session, if any. */
  getRecordedReloadedVersion(): string | null;
  /** Record that the user has reloaded onto the given version. */
  recordReloadedVersion(version: string): void;
  /** Get the published version the user has dismissed, if any. */
  getDismissedVersion(): string | null;
  /** Record that the user has dismissed the notice for the given published version. */
  recordDismissedVersion(version: string): void;
}

/** Tells the running app whether a newer build has been published. */
export class ReleaseWatch {
  /** A build other than the running one is published. */
  readonly newVersionAvailable = ref(false);

  /** The version baked into this build; '' on a dev server. */
  constructor(
    readonly runningVersion: string,
    private readonly port: ReleasePort,
    private readonly logger: Logger,
  ) {}

  async check(): Promise<void> {
    if (this.runningVersion === '') return;
    const latest = await this.port.latestVersion();
    if (latest === null) return;
    if (latest === this.runningVersion) return;
    const recorded = this.port.getRecordedReloadedVersion();
    if (recorded === latest) {
      this.logger.log(`[release] bundle still differs from published version ${latest} (already reloaded)`);
      return;
    }
    const dismissed = this.port.getDismissedVersion();
    if (dismissed === latest) {
      this.logger.log(`[release] published version ${latest} was dismissed`);
      return;
    }
    this.newVersionAvailable.value = true;
  }

  /** Moves onto the newest build; the notice clears only once that succeeds. */
  async reload(): Promise<void> {
    const latest = await this.port.latestVersion();
    if (latest !== null) this.port.recordReloadedVersion(latest);
    await this.port.reloadOntoLatest();
    this.newVersionAvailable.value = false;
  }

  /** Dismisses the notice for the currently published version. */
  async dismiss(): Promise<void> {
    const latest = await this.port.latestVersion();
    if (latest !== null) this.port.recordDismissedVersion(latest);
    this.newVersionAvailable.value = false;
  }
}
