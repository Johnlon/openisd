import {ref} from 'vue';

/** Where the app learns about newer builds and moves onto one. The browser implementation is
 *  `browserReleasePort.ts`; a test passes a fake. */
export interface ReleasePort {
  /** The version of the build currently published, or null when it cannot be read (offline). */
  latestVersion(): Promise<string | null>;
  /** Fetch the newest build and reload the page onto it. */
  reloadOntoLatest(): Promise<void>;
}

/** Tells the running app whether a newer build has been published. */
export class ReleaseWatch {
  /** A build other than the running one is published. */
  readonly newVersionAvailable = ref(false);

  /** `runningVersion` is the version baked into this build; '' (dev server) disables the check. */
  constructor(private readonly runningVersion: string, private readonly port: ReleasePort) {}

  async check(): Promise<void> {
    if (this.runningVersion === '') return;
    const latest = await this.port.latestVersion();
    if (latest !== null && latest !== this.runningVersion) this.newVersionAvailable.value = true;
  }

  reload(): Promise<void> {
    return this.port.reloadOntoLatest();
  }
}
