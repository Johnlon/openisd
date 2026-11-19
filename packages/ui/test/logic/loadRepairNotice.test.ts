/**
 * A value repaired on opening is told by a toast, one line per repair (John, 18 Nov 2026, QO953.c31:
 * "all you can do is show a toast"), and the toast stays long enough to read: a plain one-line toast
 * (the plain "Project imported from X") keeps its 2 s; each repair line adds 4 s.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createLogging, visibleMsOf} from '../../src/logging/flash.js';
import {createLoadRepairNotice} from '../../src/logic/loadRepairNotice.js';

const LINE = 'Driver input voltage (each) -6 V in the file: set to the 10 mV minimum';

describe('the toast for values repaired on opening', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('a plain one-line toast stays 2 s, as before', () => {
    expect(visibleMsOf('Project imported from a.owpr')).toBe(2000);
    const logging = createLogging();
    logging.flash('Project imported from a.owpr');
    vi.advanceTimersByTime(1999);
    expect(logging.message.value).toBe('Project imported from a.owpr');
    vi.advanceTimersByTime(1);
    expect(logging.message.value).toBe('');
  });

  it('a toast with one repair line stays 6 s', () => {
    const msg = `Project imported from a.owpr\n${LINE}`;
    expect(visibleMsOf(msg)).toBe(6000);
    const logging = createLogging();
    logging.flash(msg);
    vi.advanceTimersByTime(5999);
    expect(logging.message.value).toBe(msg);
    vi.advanceTimersByTime(1);
    expect(logging.message.value).toBe('');
  });

  it('projects restored together give one toast naming each project and its repairs', () => {
    const shown: string[] = [];
    const turnEnds: (() => void)[] = [];
    const notice = createLoadRepairNotice(m => shown.push(m), show => turnEnds.push(show));
    notice({projectName: 'first', lines: [LINE]});
    notice({projectName: 'second', lines: [LINE]});
    expect(shown).toEqual([]);
    turnEnds.forEach(show => show());
    expect(shown).toEqual([`Project opened: first\n${LINE}\nProject opened: second\n${LINE}`]);
    notice({projectName: 'later', lines: [LINE]});
    turnEnds.slice(1).forEach(show => show());
    expect(shown[1]).toBe(`Project opened: later\n${LINE}`);
  });
});
