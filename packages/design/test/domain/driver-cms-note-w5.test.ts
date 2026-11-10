/**
 * T744: the driver editor's Cms popup for a real datasheet that states Cms and Vas and they disagree
 * (W5-1138SMF) carries the one new sentence (cmsConflictNote), in both switch states, not the generic "disagree by N%" text.
 */
import {describe, expect, it} from 'vitest';
import {loadBase, loadLoadCapture} from '../fixtures/winisdEditCapture.js';
import {CompatSwitch} from '../../domain/project/compatSwitch.js';

describe('driver Cms note, W5-1138SMF in a project', () => {
  const texts = (ticked: boolean): readonly string[] => {
    const project = loadBase(loadLoadCapture('w5', 'vented-load-endcorr06'));
    CompatSwitch.CMS_FROM_VAS.of(project).set(ticked);
    return project.driver.specs.Cms_m_per_N.dq.map(i => i.text);
  };
  it('ticked: the note says the charts use Cms from Vas, and no Vas "disagree by" text remains (the Fs/Mms/Cms conflict is a different issue and stays)', () => {
    const t = texts(true);
    expect(t.filter(x => /^The stated Cms and Vas disagree, so the charts use Cms from Vas \([\d.]+ mm\/N\)\.$/.test(x))).toHaveLength(1);
    expect(t.filter(x => /Vas.*disagree by/.test(x))).toEqual([]);
  });
  it('unticked: the note says the charts use the stated Cms, and no Vas "disagree by" text remains (the Fs/Mms/Cms conflict is a different issue and stays)', () => {
    const t = texts(false);
    expect(t.filter(x => /^The stated Cms and Vas disagree, so the charts use the stated Cms \([\d.]+ mm\/N\)\.$/.test(x))).toHaveLength(1);
    expect(t.filter(x => /Vas.*disagree by/.test(x))).toEqual([]);
  });
});
