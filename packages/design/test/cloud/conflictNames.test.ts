import { describe, expect, it } from 'vitest';
import { DeviceName } from '../../cloud/deviceName.js';
import { conflictProjectName, setProjectNameInBody } from '../../cloud/conflictNames.js';

const ANDROID_PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

describe('conflictNames', () => {
  it('formats project conflict name: <name> (conflict, <device>, 13 Oct 2026, 21:05)', () => {
    // 13 Oct 2026 21:05 UTC (or local depending on formatDateTime)
    const at = new Date(2026, 9, 13, 21, 5).getTime();
    const device = DeviceName.ofBrowser(ANDROID_PHONE_UA, 5);
    const name = conflictProjectName('Sub 12', device, at);
    expect(name).toBe('Sub 12 (conflict, Android phone, 13 Oct 2026, 21:05)');
  });

  it('updates project name in .owpr JSON body', () => {
    const original = JSON.stringify({
      label: 'Sub 12',
      saved: { meta: { name: 'Sub 12' } },
      edited: null,
    });
    const updated = setProjectNameInBody(original, 'Sub 12 (conflict, phone, 13 Oct 2026, 21:05)');
    const parsed: unknown = JSON.parse(updated);
    expect(parsed).toMatchObject({
      label: 'Sub 12 (conflict, phone, 13 Oct 2026, 21:05)',
      saved: { meta: { name: 'Sub 12 (conflict, phone, 13 Oct 2026, 21:05)' } },
    });
  });

  it('updates meta.name in edited if present', () => {
    const original = JSON.stringify({
      label: 'Sub 12',
      saved: { meta: { name: 'Sub 12' } },
      edited: { meta: { name: 'Sub 12' } },
    });
    const updated = setProjectNameInBody(original, 'New Name');
    const parsed: unknown = JSON.parse(updated);
    expect(parsed).toMatchObject({
      label: 'New Name',
      saved: { meta: { name: 'New Name' } },
      edited: { meta: { name: 'New Name' } },
    });
  });
});