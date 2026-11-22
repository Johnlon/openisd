import type {KeyValueStorage} from '@openisd/persistence';
import type {Telemetry} from './telemetry.js';

/** Held outside the app's data: it is not backed up, exported or synced. */
export const INSTALL_SENT_KEY = 'openisd_telemetry_install';

/** Sends the install event once per browser: when the browser says the app was installed, or, for
 *  browsers that never say so, at the first launch seen running as an installed app. */
export class InstallMarker {
  constructor(
    private readonly telemetry: Telemetry,
    private readonly storage: KeyValueStorage,
  ) {}

  noteInstalled(): void {
    if (this.storage.get(INSTALL_SENT_KEY) !== null) return;
    this.storage.set(INSTALL_SENT_KEY, '1');
    this.telemetry.record({kind: 'install'});
    this.telemetry.flush();
  }

  noteLaunch(standalone: boolean): void {
    if (standalone) this.noteInstalled();
  }
}
