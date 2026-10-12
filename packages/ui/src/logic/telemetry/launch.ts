import type {DisplayMode, LaunchEvent, Platform, Skin} from './events.js';
import type {Telemetry} from './telemetry.js';

/** The browser facts a launch event is made from, read once. */
export interface LaunchEnvironment {
  readonly standalone: boolean;
  /** `navigator.userAgentData?.platform`, when the browser has it. */
  readonly platformHint: string | undefined;
  readonly userAgent: string;
  readonly screenW: number;
  readonly screenH: number;
  readonly lang: string;
  readonly referrer: string;
}

export function platformOf(hint: string | undefined, userAgent: string): Platform {
  const text = hint !== undefined && hint !== '' ? hint : userAgent;
  if (/android/i.test(text)) return 'Android';
  if (/iphone|ipad|ipod|ios/i.test(text)) return 'iOS';
  if (/windows|win32/i.test(text)) return 'Windows';
  if (/mac/i.test(text)) return 'macOS';
  if (/linux|x11|cros/i.test(text)) return 'Linux';
  return 'other';
}

/** The host of a referrer URL, '' when there is none or it does not parse. */
export function referrerHost(referrer: string): string {
  try { return referrer === '' ? '' : new URL(referrer).host; } catch { return ''; }
}

export function launchEventOf(env: LaunchEnvironment, skin: Skin): LaunchEvent {
  const mode: DisplayMode = env.standalone ? 'standalone' : 'browser';
  return {
    kind: 'launch', mode, platform: platformOf(env.platformHint, env.userAgent), skin,
    w: env.screenW, h: env.screenH, lang: env.lang, ref: referrerHost(env.referrer),
  };
}

/** Records the launch event once and sends it, after the app has booted. */
export class LaunchReporter {
  private reported = false;

  constructor(
    private readonly telemetry: Telemetry,
    private readonly environment: () => LaunchEnvironment,
    /** Runs the work off the boot path (idle callback or timer). */
    private readonly defer: (work: () => void) => void,
  ) {}

  report(skin: Skin): void {
    if (this.reported) return;
    this.reported = true;
    this.defer(() => {
      this.telemetry.record(launchEventOf(this.environment(), skin));
      this.telemetry.flush();
    });
  }
}

/** `navigator.userAgentData.platform`, for browsers that have it. */
export function platformHintOf(nav: object): string | undefined {
  if (!('userAgentData' in nav)) return undefined;
  const data = nav.userAgentData;
  if (typeof data !== 'object' || data === null || !('platform' in data)) return undefined;
  return typeof data.platform === 'string' ? data.platform : undefined;
}
