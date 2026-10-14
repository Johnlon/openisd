import { describe, expect, it } from 'vitest';
import { DeviceName } from '../../cloud/deviceName.js';

const UA = {
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iPadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

describe('DeviceName.ofBrowser', () => {
  it.each([
    [UA.androidPhone, 5, 'Android phone'],
    [UA.androidTablet, 5, 'Android tablet'],
    [UA.iPhone, 5, 'iPhone'],
    [UA.iPadDesktopMode, 5, 'iPad'],
    [UA.iPadDesktopMode, 0, 'Mac'],
    [UA.windows, 0, 'Windows desktop'],
    [UA.chromebook, 0, 'Chromebook'],
    [UA.linux, 0, 'Linux desktop'],
    ['', 0, 'another device'],
  ])('%s with %d touch points is "%s"', (ua, touch, name) => {
    expect(DeviceName.ofBrowser(ua, touch).text).toBe(name);
  });
});
