/**
 * T744: the driver editor edits a detached copy of the project's driver. The copy must use the
 * PROJECT's air (Advanced temperature), not the app's, so its Cms/Vas figures equal the project's.
 */
import {describe, expect, it} from 'vitest';
import {loadBase, loadLoadCapture} from '../fixtures/winisdEditCapture.js';

describe('detached driver copy of a W5-1138SMF project with non-default air', () => {
  it('shows the Cms, Vas and c the project shows', () => {
    const project = loadBase(loadLoadCapture('w5', 'vented-load-endcorr06'));
    project.envTempK.set(318.15);
    const copy = project.driver.detach();
    for (const field of ['Cms_m_per_N', 'Vas_m3', 'c_m_per_s', 'roo_kg_per_m3'] as const) {
      expect(copy.specField(field).value, field).toBe(project.driver.specField(field).value);
    }
  });
});
