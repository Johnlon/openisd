/**
 * The in-app help page "OpenISD and WinISD differences": every WinISD Compatibility switch and every
 * ≠W cue has exactly one entry, in the section of its kind. Adding a switch or a cue without an
 * entry fails here.
 */
import {describe, expect, it} from 'vitest';
import {CompatSwitch} from '../../domain/index.js';
import {
  CompatSwitchGroup,
  WinisdDeviation,
  WinisdDifference,
  WinisdDifferenceSection,
  WinisdFilterDeviation,
  WinisdFixedBug,
  WinisdOption,
} from '../../fields/index.js';

const CUES: readonly WinisdDeviation[] = [...WinisdDeviation.ALL, ...WinisdFilterDeviation.ALL];

describe('WinisdDifferenceSection', () => {
  it('has the three sections, in page order', () => {
    expect(WinisdDifferenceSection.ALL.map(s => s.heading)).toEqual([
      'WinISD bugs you can switch back on',
      'Options: WinISD\'s way or alternative',
      'WinISD bugs OpenISD fixes (no switch)',
    ]);
  });

  it('a WinISD Compatibility group heading opens its own section', () => {
    expect(WinisdDifferenceSection.forGroup(CompatSwitchGroup.BUGS)).toBe(WinisdDifferenceSection.BUG_SWITCHES);
    expect(WinisdDifferenceSection.forGroup(CompatSwitchGroup.OPTIONS)).toBe(WinisdDifferenceSection.OPTIONS);
  });

  it('every bug switch has exactly one entry, in the bug-switch section, titled by the switch', () => {
    for (const s of CompatSwitch.BUGS) {
      const hits = WinisdDifference.ALL.filter(e => e.control === s.field.label);
      expect(hits, s.field.label).toHaveLength(1);
      expect(WinisdDifferenceSection.BUG_SWITCHES.entries).toContain(hits[0]);
    }
    expect(WinisdDifferenceSection.BUG_SWITCHES.entries).toHaveLength(CompatSwitch.BUGS.length);
  });

  it('every option has exactly one entry, in the options section', () => {
    expect(WinisdOption.ALL.map(o => o.switchField)).toEqual(CompatSwitch.OPTIONS.map(s => s.field));
    for (const s of CompatSwitch.OPTIONS) {
      const hits = WinisdDifference.ALL.filter(e => e.control === s.field.label);
      expect(hits, s.field.label).toHaveLength(1);
      expect(WinisdDifferenceSection.OPTIONS.entries).toContain(hits[0]);
    }
    expect(WinisdDifferenceSection.OPTIONS.entries).toHaveLength(CompatSwitch.OPTIONS.length);
  });

  it('the no-switch section holds every ignored input and every fixed WinISD bug, none with a control', () => {
    const ignored = CUES.filter(d => d.control === null);
    expect(WinisdDifferenceSection.FIXED.entries).toHaveLength(ignored.length + WinisdFixedBug.ALL.length);
    for (const e of WinisdDifferenceSection.FIXED.entries) expect(e.control, e.title).toBeNull();
  });

  it('every entry sits in exactly one section', () => {
    const placed = WinisdDifferenceSection.ALL.flatMap(s => s.entries);
    expect(new Set(placed).size).toBe(placed.length);
    expect(new Set(placed)).toEqual(new Set(WinisdDifference.ALL));
  });
});

describe('WinisdDifference', () => {
  it('every ≠W cue opens exactly one entry: a bug cue its switch\'s, an ignored input its own', () => {
    for (const d of CUES) {
      const e = WinisdDifference.forDeviation(d);
      expect(e.title, d.title).toBe(d.title);
      expect(e.control).toBe(d.control === null ? null : d.control.label);
    }
    expect(new Set(CUES.map(d => WinisdDifference.forDeviation(d))).size).toBe(CUES.length);
  });

  it('every entry says what WinISD does, what OpenISD does, where it shows and how large it is', () => {
    for (const e of WinisdDifference.ALL) {
      for (const text of [e.title, e.winisd, e.openisd, e.seenIn, e.size]) expect(text.trim(), e.title).not.toBe('');
      expect(e.winisd, e.title).toMatch(/WinISD/);
    }
  });

  it('an entry names no file, bug id or run', () => {
    for (const e of WinisdDifference.ALL) {
      for (const text of [e.title, e.winisd, e.openisd, e.seenIn, e.size]) {
        expect(text, e.title).not.toMatch(/\.(md|ts|json)\b|BUG_|\bQO\d|runs?\/|-w5-|abc-w5/);
      }
    }
  });

  it('every entry has its own page anchor', () => {
    const anchors = [...WinisdDifference.ALL.map(e => e.anchor), ...WinisdDifferenceSection.ALL.map(s => s.anchor)];
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const a of anchors) expect(a).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('a bug entry reads its "Seen in" line from its switch', () => {
    expect(WinisdDifference.forDeviation(WinisdDeviation.VA_MODEL).seenIn).toBe(WinisdDeviation.VA_MODEL.seenIn);
  });
});
