/**
 * A short name for this device that a person recognises ("Android phone", "Mac"), shown in the
 * name of a conflict copy so the user can tell which device made it. Not an identity: two phones
 * share a name, and sync tells devices apart by `DeviceId`.
 */
export class DeviceName {
  private declare readonly brand: 'DeviceName';
  private constructor(readonly text: string) {}

  /** From the browser's user agent. An iPad reports itself as a Mac, so a touch screen tells them apart. */
  static ofBrowser(userAgent: string, maxTouchPoints: number): DeviceName {
    if (userAgent.includes('iPhone')) return new DeviceName('iPhone');
    if (userAgent.includes('iPad')) return new DeviceName('iPad');
    if (userAgent.includes('Android')) return new DeviceName(userAgent.includes('Mobile') ? 'Android phone' : 'Android tablet');
    if (userAgent.includes('CrOS')) return new DeviceName('Chromebook');
    if (userAgent.includes('Windows')) return new DeviceName('Windows desktop');
    if (userAgent.includes('Macintosh')) return new DeviceName(maxTouchPoints > 1 ? 'iPad' : 'Mac');
    if (userAgent.includes('Linux')) return new DeviceName('Linux desktop');
    return new DeviceName('another device');
  }
}
