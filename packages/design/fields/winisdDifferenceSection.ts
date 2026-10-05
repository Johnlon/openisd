import {CompatSwitchGroup} from './compatSwitchGroup.js';
import {WinisdDifference} from './winisdDifference.js';

/** How a section looks: `bug` carries the yellow bug-switch look. */
export type WinisdDifferenceTone = 'bug' | 'option' | 'fixed';

/** A section of the "OpenISD and WinISD differences" help page. */
export class WinisdDifferenceSection {
  readonly entries: readonly WinisdDifference[];

  private constructor(
    readonly heading: string,
    readonly intro: string,
    readonly tone: WinisdDifferenceTone,
    readonly anchor: string,
    /** The WinISD Compatibility group whose heading links here; null where none does. */
    readonly group: CompatSwitchGroup | null,
    kinds: readonly WinisdDifference['kind'][],
  ) {
    this.entries = Object.freeze(WinisdDifference.ALL.filter(e => kinds.includes(e.kind)));
  }

  static readonly BUG_SWITCHES = new WinisdDifferenceSection(
    'WinISD bugs you can switch back on',
    'WinISD gets these calculations wrong. OpenISD does them correctly by default. Each has a yellow switch under "WinISD bugs" on the Advanced tab: tick it to see WinISD\'s result.',
    'bug', 'winisd-diff-bugs', CompatSwitchGroup.BUGS, ['bugSwitch']);

  static readonly OPTIONS = new WinisdDifferenceSection(
    'Options: WinISD\'s way or another',
    'Here WinISD makes a valid choice that has another valid form. OpenISD copies WinISD by default; untick the switch under "Options" on the Advanced tab for the other form.',
    'option', 'winisd-diff-options', CompatSwitchGroup.OPTIONS, ['option']);

  static readonly FIXED = new WinisdDifferenceSection(
    'WinISD bugs OpenISD fixes (no switch)',
    'WinISD ignores an input, misses an update, crashes or loses data. OpenISD does the right thing and has no switch to copy these: there is nothing to reproduce on purpose.',
    'fixed', 'winisd-diff-fixed', null, ['ignoredInput', 'fixedBug']);

  /** Every section, in page order; declared last. */
  static readonly ALL: readonly WinisdDifferenceSection[] = Object.freeze(
    Object.values(WinisdDifferenceSection).filter((v): v is WinisdDifferenceSection => v instanceof WinisdDifferenceSection));

  /** The section a WinISD Compatibility group heading's help link opens. */
  static forGroup(g: CompatSwitchGroup): WinisdDifferenceSection {
    const hit = WinisdDifferenceSection.ALL.find(s => s.group === g);
    if (hit === undefined) throw new Error(`WinisdDifferenceSection: no section for the group "${g.heading}"`);
    return hit;
  }
}
